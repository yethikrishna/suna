# Network-boundary secrets on Daytona

**Status:** proposal, awaiting one blocking experiment
**Author:** drafted 2026-08-11
**Problem owner:** production runs on Daytona; the feature exists only on Platinum

---

## 1. The problem in one paragraph

A *network-boundary* secret (`strategy:'egress'`, `consumer:'network'`) is delivered by the
**Platinum** sandbox provider: Kortix registers the credential with Platinum at session
provision, and Platinum's egress proxy terminates TLS and injects a header on outbound
requests to allow-listed hosts. The sandbox never receives the value — no env var, no alias,
no placeholder. **Production runs on Daytona**, where
`syncProviderNetworkBoundary` throws `Sandbox provider daytona does not support
network-boundary secret delivery`. So no paying customer can use the feature.

## 2. What we are actually protecting against

Two different goals get conflated. Separating them decides the architecture.

| Goal | Statement | Who it defends against |
| --- | --- | --- |
| **Confidentiality** | The agent never possesses the credential | a leaky or compromised agent, prompt injection, logs, `env` dumps |
| **Transparency** | The agent uses an ordinary HTTP client and the credential appears in flight | developer effort; nothing security-related |

Platinum's boundary delivers both. **Most of the value is confidentiality.** Transparency is
ergonomics. This matters because we already ship a confidentiality-equivalent mechanism that
works on Daytona today (§5).

## 3. Measured facts

Everything here was probed on live dev sandboxes on 2026-08-11, not read off a doc.

### 3.1 Guest privilege — the same on both providers

| | Platinum | Daytona |
| --- | --- | --- |
| PID 1 | `pt-init` as **root** | `daytona` as `kortix` (uid 1001) |
| own kernel | yes (`kthreadd`, `kworker` visible) | no — Docker, bridge `172.20.0.0/16` |
| agent uid | `kortix` (1001) | `kortix` (1001) |
| `CapEff` / `CapPrm` | `0000000000000000` | `0000000000000000` |
| **`sudo -n id`** | — | **`uid=0(root)`** |
| `iptables` / `nft` in image | absent | absent |
| direct egress | — | works (200 to `api.github.com`) |
| CA store agent-writable | — | no (but sudo makes that moot) |

**The agent has passwordless root** (`apps/sandbox/Dockerfile:94-96`, `NOPASSWD:ALL`). An
earlier draft of this analysis claimed the agent was unprivileged and that a root-owned boot
step could install egress rules it could not remove. That was wrong — a silent `sudo -n true`
was misread as failure. Any in-guest rule is removable with `sudo iptables -F`.

> **Conclusion:** in-guest enforcement is not viable on **either** provider. Enforcement must
> live outside the guest.

### 3.2 What Daytona offers outside the guest

The pinned SDK (`@daytonaio/sdk@0.184.0`) exposes, at create **and** live via
`sandbox.updateNetworkSettings()`:

- `networkBlockAll` — default-deny egress
- `networkAllowList` — CIDR allow-list

Documented as *"the runner applies iptables rules to the sandbox container"* — i.e. on the
host, outside guest control. **We pass neither today.**

> **`outboundProxyUrl` does not exist.** An earlier draft listed it here as a third option
> and built all of Track B on it. It is absent from the pinned SDK's typings, and the API
> silently ignores it — see §7, which is now a settled negative result, not a pending
> experiment. Treat any vendor-proxy-chaining design as unavailable until Daytona ships the
> feature.

What Daytona does **not** have: a secret store, TLS termination, header injection, or any
`on_echo` equivalent. Zero of the ten Platinum primitives the boundary depends on. So the
feature cannot be ported provider-natively; it can only be **rebuilt** with Daytona supplying
the funnel and Kortix supplying the injection.

### 3.3 The claim the whole design rests on

Daytona's docs state: *"Clients that do not respect `HTTP_PROXY` are blocked at egress."*

If true, `outboundProxyUrl` is an **enforced** chaining point and a Kortix-operated proxy gets
the same class of guarantee as Platinum. If false, it is **cooperative** and a determined agent
walks around it. **This is unverified and is the first thing to test** (§7).

## 4. Prior art

The pattern is well-trodden; we should position against it rather than invent.

- **Anthropic's Claude Code sandbox** — `credentials.envVars` with `mode:"mask"`, `injectHosts`,
  `network.tlsTerminate`. Closest public analogue to what we want.
- **Vercel Sandbox** — credential brokering + a documented firewall model.
- **Cloudflare Sandbox** — outbound Workers.
- **IETF draft "Credential Broker for Agents" (CB4A)**, Model A "Proxy Gateway" — names the
  pattern.
- **CyberArk Secretless Broker**, **Vault Agent/Proxy**, **Envoy ext_authz**, **Squid/mitmproxy
  with a private CA** — the older generation.

Convergent design across all of them:

1. Terminate TLS **only** for hosts that have an injection rule; never blanket-MITM.
2. Mint a **per-sandbox ephemeral CA**, push it into the system trust bundle *and* the ~11
   per-runtime env vars (`NODE_EXTRA_CA_CERTS`, `REQUESTS_CA_BUNDLE`, `SSL_CERT_FILE`, …).
3. Enforce at the host/hypervisor, **never with `HTTP_PROXY` alone**.
4. Give the guest a **placeholder**, not nothing, so tools that read the variable still work.

Two places we are unusual:

- **"Guest sees nothing at all"** is the strictest variant. Most vendors substitute a
  placeholder. Ours breaks any tool that insists on reading the env var.
- **`on_echo` response blocking appears to be genuinely rare.** No vendor found documents it.
  One (iron-proxy) explains why: buffering responses end-to-end to scan them stalls the client.
  Ours cuts the connection instead, which is cheaper but produces `curl: (52) Empty reply` —
  the single biggest source of "this feature is broken" reports we have had.

## 5. The option we already own

`strategy:'broker'` + `consumer:'http_broker'` (backend `kortix_fetch`) is **provider-agnostic
and works on Daytona today**. Route `POST /v1/projects/:projectId/secrets/:identifier/broker`,
executed by `apps/api/src/secrets/http-broker.ts` from the API process. Verified on a live
Daytona session: saves clean, `delivery_status: 'available'`, and the in-sandbox `kortix` CLI is
session-authenticated.

Compared with the network boundary:

| | boundary (`egress`/`network`) | broker (`broker`/`http_broker`) |
| --- | --- | --- |
| credential in sandbox | never | never |
| works on Daytona | **no** | **yes, today** |
| host matching | exact only | wildcards, paths, methods |
| injection slots | one header | header, query, JSON body |
| per-request audit | no | **yes** |
| **credential echoed by upstream** | connection cut (`on_echo`) | **redacted, response still returned** |
| transparent to the agent | **yes** | no — must call `kortix secrets call` |
| TLS interception needed | yes (Platinum's) | **none** |

On **confidentiality the broker is equal**, on **authorization and audit it is stronger**, and
it needs no MITM. Its only deficit is transparency. An agent that ignores the broker does not
get a weaker credential — it gets **no** credential.

**Correction to an earlier draft of this doc.** It claimed `on_echo` had no broker equivalent.
It does: `redactSecretFromResponse` (`apps/api/src/secrets/http-broker.ts:350`) scrubs the
value from the response body in four representations — raw, URL-encoded, base64, and
JSON-escaped — and returns the rest of the response normally. That is *better* than the
boundary's behaviour, not worse: Platinum kills the connection, which surfaces as
`curl: (52) Empty reply from server` and is the single largest source of "this feature is
broken" reports we have had (§4). The broker gives the agent a usable response with
`[REDACTED]` where the credential would have been. Verified live — see §5.1.

**Why customers do not have it: reach, not capability.** `kortix secrets call` is a string in a
system-prompt file, and models reach for tools far more reliably than for documented shell
commands.

### 5.1 Verified live on dev, 2026-08-12

Project `kaab-demo`, secret `BROKER_PROOF`, policy `broker`/`http_broker` with
`--allow-host postman-echo.com --allow-method GET --inject-header x-proof-token`. A real
session agent ran `kortix secrets call BROKER_PROOF https://postman-echo.com/get`:

```
Upstream status: 200
{"args":{},"headers":{"host":"postman-echo.com",…,"x-proof-token":"[REDACTED]",…}}
```

Three facts in one response: the header **arrived at the upstream** (so Kortix injected it
outside the sandbox), the call **succeeded** (200), and the echoed value came back
**redacted** rather than killing the connection.

The authorization gate was also observed working: before the agent's `secrets:` grant named
`BROKER_PROOF`, the identical call returned
`✗ secret delivery denied: agent_grant_excludes`.

**Caveat — this ran on Platinum.** `kaab-demo` inherits the dev platform default, which is
Platinum, so this proves the broker works but not yet that it works on Daytona. The broker
executes entirely in the API process (`http-broker.ts`) and touches no provider API, so
there is no mechanism by which the provider could matter — but that is an argument, not a
measurement, and this doc does not accept arguments where a measurement is available.
Daytona confirmation is tracked in §5.2.

### 5.2 The MCP tool, end to end — and the premise it disproved

`secret_call` verified live on dev (2026-08-12, commit `3d03cc68`), invoked as a real MCP
`tools/call` inside a sandbox:

```json
{"ok": true, "status": 200,
 "body": "{\"headers\":{\"x-proof-token\":\"[REDACTED]\", …},\"url\":\"https://postman-echo.com/get\"}"}
```

The tool works. **But the reason given for building it does not hold.** §6 argued that
`kortix secrets call` was unreachable in practice because "models reach for tools far more
reliably than for documented shell commands". Tested with a prompt that named neither the
tool nor the command — *"Fetch https://postman-echo.com/get with our BROKER_PROOF credential
attached"* — the agent went straight to the CLI on its first move:

> `BROKER_PROOF`: HTTPS broker. Use `kortix secrets call BROKER_PROOF <https-url> [options]`.
> So I need to use `kortix secrets call BROKER_PROOF https://postman-echo.com/get`.

One turn, `200`, header injected. It never considered the MCP tool — reasonably, because the
capabilities instruction it reads (`secret-capabilities.ts`) names the CLI command and says
nothing about a tool.

So the honest scoring of Track A step 1: the broker was **already discoverable** through the
instruction file, and the tool is a second door onto the same room rather than the first door
onto a locked one. It is still worth having (a host that only speaks MCP now has a path, and
tool calls are structured where shell output is not), but it was not the highest-leverage
change in this doc and this section should be read before anyone repeats that claim.

If the tool is meant to be the preferred path, the instruction renderer has to say so —
that is a one-line change in `secret-capabilities.ts`, not a new capability.

### 5.3 Where the broker is NOT equivalent to Platinum

Worth stating plainly, because a passing end-to-end test makes them look identical and they
are not:

| | Platinum boundary | broker (today, any provider) |
| --- | --- | --- |
| agent calls the API itself | works | works |
| a Python script the agent writes | **works** | **no credential** |
| a third-party SDK / CLI in the sandbox | **works** | **no credential** |
| `curl` in a Makefile, a test suite, a build step | **works** | **no credential** |

Platinum injects for *any* process making an allow-listed HTTPS request; the broker injects
only for requests routed through `secret_call` / `kortix secrets call`. Everything else in
the sandbox gets an unauthenticated request, not a failed one — which fails at the upstream
rather than locally, and is the more confusing failure.

Closing that gap is exactly Track B, and §6b establishes its precondition holds: Daytona's
egress control is enforced on the runner and root inside the guest cannot bypass it.

Note also that the agent, unprompted, described the broker's injection as happening "at the
network boundary". The two mechanisms are already being conflated in transcripts; the naming
in the product should separate them.

## 6. Recommendation — two tracks, in this order

### Track A — make the broker the production answer (start now, low risk)

The fastest path to a real capability for Daytona customers.

1. **Add an MCP tool** for the broker so the model discovers it the way it discovers everything
   else. **Done** — `secret_call` in `apps/cli/src/connector-gateway/mcp.ts`.

   This step was written on a false premise and the premise had to be fixed first. The doc
   assumed the `kortix-connectors` MCP server was a live surface with eight tools on it. It is
   not, for two independent reasons found while implementing:

   - **It was broken.** The daemon registered `kortix connector mcp` (singular) while the CLI
     only routes `connectors`. OpenCode's launcher got `unknown command` and exit 2, so the
     server never started. Introduced by e868be1d6c on 2026-08-06 — the same commit that
     renamed `executor` → `connectors` — and invisible because the daemon's unit tests were
     updated to assert the typo'd literal. Fixed, with a CLI-side guard that now runs the argv
     the daemon registers and requires a clean JSON-RPC handshake.
   - **It is disabled.** `KORTIX_CONNECTORS_MCP_ENABLED` appears in tests and nowhere else —
     no values.yaml, no env profile. The CLI is the deliberate agent-facing default
     (87ad9a3665, "refactor executor to prefer cli surface").

   So `secret_call` is correct and tested but reaches no production agent until that flag is
   turned on. **That flag flip is a product decision, not a bug fix** — it adds nine tools to
   every agent's context — and is deliberately left to the owner rather than taken here.
   Until then the live channel for broker discovery remains the capabilities instruction file
   (`/tmp/kortix/secret-capabilities.md`), which already names `kortix secrets call`.
2. **Stop offering `egress` on projects that cannot run it.** Already partly done — the UI now
   gates on the project's active provider — but the *strategy picker* should present the broker
   as the Daytona-native option rather than showing a disabled control.
3. ~~**Fix the dead limb**: `broker`/`git_proxy` advertises `delivery_status:'available'`
   while no execution path implements it.~~ **Withdrawn — the claim was false.** `git_proxy`
   is consumed at `apps/api/src/projects/lib/git.ts:569`, which resolves the git credential
   server-side for push/pull. It is narrow (one call site, one fixed key
   `KORTIX_GIT_AUTH_TOKEN`) but it is live. And `delivery_status` documents itself, in a
   comment directly above the branch, as "does this *deployment* support the mode" — not
   "will this particular secret be consumed" — so `available` is the correct value under the
   field's own semantics. Nothing to fix.
4. **Docs**: one page, "which delivery mode do I want", with the table from §5.

### Track B — an enforced Kortix egress proxy (gated on the §7 experiment)

Daytona supplies the non-bypassable funnel; Kortix supplies everything Platinum's edge does.

```
guest ──(runner iptables: block-all + allow only proxy)──▶ Kortix egress proxy ──▶ upstream
                                                            │
                                                            ├─ per-sandbox ephemeral CA
                                                            ├─ inject header for policy hosts
                                                            ├─ pass through everything else
                                                            └─ on_echo response handling
```

Non-negotiables:

- **Selective termination.** MITM only hosts with an injection rule. Everything else is
  `CONNECT`-tunnelled untouched. This bounds the blast radius and avoids breaking pinned TLS.
- **Ephemeral per-sandbox CA**, minted at provision, destroyed with the sandbox. Never a
  long-lived Kortix root in a customer image.
- **We become a credential-handling MITM.** That is a real compliance and blast-radius change
  and must be an explicit decision, not a side effect. Document the threat model before code.
- **Honest labelling.** If the §7 experiment fails, the UI must say *cooperative on Daytona,
  enforced on Platinum* — in the product, not only in docs.

## 7. The blocking experiment — RUN. Result: `outboundProxyUrl` is ignored

Run 2026-08-12 against `app.daytona.io/api` on throwaway sandboxes from
`kortix-default-b539f1be09d3`, control vs treatment, deleted after.

Treatment set `outboundProxyUrl` to `http://198.51.100.7:3128` — RFC 5737 TEST-NET-2, which
cannot route anywhere. If the runner forced egress through it, every request would die.

| probe | control (no options) | `outboundProxyUrl` set |
| --- | --- | --- |
| `curl https://api.github.com/rate_limit` | 200 | **200** |
| `curl --noproxy '*'` | 200 | 200 |
| `$HTTPS_PROXY` / `$https_proxy` in guest | unset | **unset** |
| raw Python socket to `140.82.121.6:443` | CONNECTED | CONNECTED |
| DNS | RESOLVED | RESOLVED |
| `sudo -n curl` (root) | 200 | 200 |

Identical in every cell. The field is not enforced and not even **applied** — the runner
does not so much as set the proxy env var. Consistent with the API validator, which is
lenient about unknown properties: a deliberately invented `zzTotallyMadeUpField` produced
no complaint either, so a clean 200 on create says nothing about a field being real.

**Consequence: the transparent-redirect architecture in §6 Track B is unbuildable as
written.** Daytona gives us a funnel we can close (§6b) but no vendor mechanism to redirect
traffic into a proxy.

### 7.1 What Track B has to look like instead

Split the two properties, because on Daytona they now come from different places:

- **Enforcement** comes from `networkAllowList` restricted to the Kortix proxy's address.
  Runner-applied, root-proof, already measured (§6b). Nothing escapes the guest, ever.
- **Transparency** cannot come from the runner. The guest has to be *pointed* at the proxy:
  `HTTPS_PROXY`/`HTTP_PROXY` in the sandbox env, and for clients that ignore those, an
  `LD_PRELOAD` socket shim (proxychains-style).

The pleasant property of that split: the transparency layer is removable and its removal is
**fail-closed**. An agent that unsets `HTTPS_PROXY` does not gain a bypass — the allow-list
still permits only the proxy, so it simply loses network. Security does not depend on the
part the guest can touch.

The unpleasant one: **in-guest transparent redirect is impossible**, so any client that
honours neither the env var nor the shim gets no network at all. That is not hypothetical —
Node/Bun `fetch` (undici) ignores `HTTP_PROXY` by default, and agents write `fetch` code
constantly. Note also that in-guest `iptables` is doubly out: it is absent from the image
*and* the container holds no capabilities (`CapEff: 0000000000000000`, §3.1), so even root
cannot install a redirect rule.

So the honest positioning of Track B on Daytona is **enforced, selectively transparent** —
strictly weaker on ergonomics than Platinum, identical on confidentiality. Any UI copy must
say which one a project is getting.

### 7.2 Still worth measuring before building

- `domainAllowList` (surfaced in a validation error, absent from the SDK typings): if it
  accepts DNS names it removes the CIDR-only constraint and the DNS breakage in §6b.
- Live `updateNetworkSettings()` on a running sandbox, and behaviour across resume /
  CoW-restore — the allow-list must survive both or the funnel has a hole.
- Whether the proxy can be reached over Daytona's own network without a public address.

## 8. What I would not build

- **In-guest iptables enforcement.** Dead on both providers (§3.1). Even granting `NET_ADMIN`
  is self-defeating while the agent holds `NOPASSWD:ALL`.
- **Blanket TLS interception.** Breaks pinned clients and mTLS, and makes us MITM for traffic
  that has nothing to do with any secret.
- **`HTTP_PROXY` alone, sold as a boundary.** Every prior-art implementation warns against it,
  and it would be a security claim we cannot support.

## 9. Open questions

1. Does `outboundProxyUrl` actually block non-conforming clients? (§7 — blocking)
2. Are we willing to operate a credential-handling MITM for customer traffic, with the
   compliance surface that implies?
3. Should the guest get a **placeholder** instead of nothing, matching the rest of the industry?
   It would fix tools that insist on reading the variable, at the cost of our strictest property.
4. Can `on_echo` be preserved through a Kortix proxy without stalling responses, or do we accept
   header-only protection off Platinum?

## 10. Related

- `docs/SECRET_DELIVERY_CONTROL_PLANE.md` — the shipped control plane
- `apps/web/content/docs/project/secrets.mdx` — the user-facing explainer
- `.claude/skills/learnings/SKILL.md` — "A per-turn hot path must not contain an unbounded
  third-party round-trip", the incident that came out of this feature
