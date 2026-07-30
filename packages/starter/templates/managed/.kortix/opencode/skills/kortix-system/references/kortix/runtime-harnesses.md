# ACP and runtime harnesses

Kortix defines four session harnesses. One is stable:

| Manifest id | Harness | Default config directory | Status |
| --- | --- | --- | --- |
| `opencode` | OpenCode | `.kortix/opencode` | stable |
| `claude` | Claude Code | `.claude` | experimental |
| `codex` | Codex | `.codex` | experimental |
| `pi` | Pi | `.pi` | experimental |

Two gates decide which harness a session runs.

**1. The manifest declares it.** `kortix_version: 2` runs OpenCode and only
OpenCode — it has no `runtimes` block. `kortix_version: 3` declares named runtime
profiles and each one names a harness. The manifest is an input, not an
authority.

**2. The deployment enables it.** `KORTIX_ENABLED_HARNESSES` is the operator
allowlist. Empty means the stable set only, so `claude`, `codex`, and `pi` are
off unless an operator names them. The allowlist only adds experimental
harnesses; OpenCode is never removable. A session that asks for a harness the
deployment did not enable is refused with `HARNESS_NOT_ENABLED` (HTTP 409).
Kortix never falls back to a different harness — running OpenCode against
`.claude` config would be a wrong answer that looks like a working one.

Enabling a harness applies to NEW sessions. A running session keeps the
`runtime_harness` it booted with.

The project experiment key `acp_runtime` is a separate concern: it selects the
TRANSPORT, not the harness.

- Disabled: the project uses the OpenCode REST compatibility transport.
- Enabled: the project uses ACP, which is the transport for every harness.

New projects enable the experiment automatically. Existing projects keep their
current experiment state. Enable it before starting a v3 session in an existing
project. The API rejects a v3 session with `ACP_RUNTIME_REQUIRED` while the
experiment is disabled.

## The one starter

| Starter id | Manifest | Runtime |
| --- | --- | --- |
| `general-knowledge-worker` | `kortix_version: 2` | OpenCode |

It is the only starter. `acp-multi-harness` is a deprecated alias that scaffolds
the same files, and an absent or unrecognized `starter_template` resolves to the
same starter. The starter scaffolds no `.claude`, `.codex`, or `.pi` directory.

### Create a multi-harness test project

No starter writes a v3 manifest. Scaffold the project, then edit `kortix.yaml`
into the v3 shape shown below and add each harness's config directory by hand:

```sh
kortix init harness-lab --yes --no-git
```

The CLI command writes files only. `kortix ship` creates the cloud project.
Cloud project creation enables `acp_runtime`.

## Manifest model

Use `kortix_version: 3` for multiple harnesses. `runtimes` declares named
runtime profiles. Each logical agent selects one profile through `runtime`.

```yaml
# yaml-language-server: $schema=https://kortix.com/schema/kortix.v3.schema.json
kortix_version: 3
default_agent: opencode

runtimes:
  opencode:
    harness: opencode
    config_dir: .kortix/opencode
  claude:
    harness: claude
    config_dir: .claude
  codex:
    harness: codex
    config_dir: .codex
  pi:
    harness: pi
    config_dir: .pi

agents:
  opencode:
    runtime: opencode
    connectors: all
    secrets: all
    skills: all
    kortix_cli: all
  claude:
    runtime: claude
    connectors: all
    secrets: all
    skills: all
    kortix_cli: all
  codex:
    runtime: codex
    connectors: all
    secrets: all
    skills: all
    kortix_cli: all
  pi:
    runtime: pi
    connectors: all
    secrets: all
    skills: all
    kortix_cli: all
```

Runtime-profile names and logical-agent names are project-defined. They do not
need to equal the harness id. The `harness` value must be `opencode`, `claude`,
`codex`, or `pi`.

`agents.<name>.agent` is optional. It selects a harness-native agent identifier.
Omit it to use the harness default.

Version 3 logical-agent blocks contain routing and Kortix grants. Harness-native
behavior stays in the selected `config_dir`. Do not put OpenCode fields such as
`model`, `mode`, `temperature`, or `permission` in a v3 logical-agent block.

## Immutable session identity

Kortix resolves the logical agent, runtime profile, harness, config directory,
and native agent when the session starts. That launch plan is immutable for the
session.

Editing `kortix.yaml` does not change an existing session's harness. Start a new
session to use a different harness. An in-place restart keeps the existing
harness, `acp_server_id`, and `acp_session_id`.

The session API exposes the persisted identity:

- `runtime_harness`
- `native_agent`
- `acp_server_id`
- `acp_session_id`
- `metadata.runtime_name`
- `metadata.compiled_runtime_plan`, including the resolved config directory

For new managed sessions, `acp_server_id` equals the Kortix
`project_session_id`. `acp_session_id` is the harness-native ACP conversation
identifier.

## Native instructions and skills

The sandbox injects the current Kortix system skills into the selected
harness's native discovery directory:

| Harness | Managed skill discovery |
| --- | --- |
| OpenCode | `<config_dir>/skills` |
| Claude Code | `<config_dir>/skills` |
| Codex | `.agents/skills` at the repository root |
| Pi | `<config_dir>/skills` |

Agents can also fetch the deployed copy through the pre-authenticated CLI:

```sh
kortix system-skills
kortix system-skills get kortix-system
kortix system-skills get kortix-system --full
```

`kortix skills` is a permanent alias for `kortix system-skills`. The API host
serves these files from the deployed `@kortix/starter` package. The command does
not depend on the session harness.

## Credentials

Credential selection depends on the harness and the model provider.

| Harness | Managed access | Direct project credentials |
| --- | --- | --- |
| OpenCode | Kortix LLM Gateway through the generated OpenCode provider config. | OpenCode provider configuration and its provider environment variables. |
| Claude Code | Kortix LLM Gateway when the project has managed model access. | `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or `CLAUDE_CODE_OAUTH_TOKEN`. |
| Codex | Kortix OpenAI-compatible gateway when managed access is available. | `CODEX_API_KEY` or `OPENAI_API_KEY`. ChatGPT OAuth state is Kortix-managed. Do not create `CODEX_AUTH_JSON` manually. |
| Pi | Kortix OpenAI-compatible gateway when managed access is available. | `OPENAI_API_KEY` or `CODEX_API_KEY`. |

Declare direct credential names under `env.required` or `env.optional`. Grant
them through `agents.<name>.secrets`. Store values in the Kortix Secrets
Manager. Never put a credential value in `kortix.yaml`.

The Models view supports these project-wide subscription flows:

- Claude Code: run `claude setup-token`, then store the result as
  `CLAUDE_CODE_OAUTH_TOKEN`.
- Codex: complete the ChatGPT device authorization. Kortix stores the resulting
  `CODEX_AUTH_JSON`. Do not create that value manually.

The backend keeps a generic provider verification route for SDK compatibility.
The connected-provider UI does not expose it. A key can authenticate while the
selected model, region, entitlement, or API dialect still fails. Test the real
harness and model with a session prompt.

## Model behavior

OpenCode uses gateway-prefixed model ids. Claude Code and Codex own their native
default model when the session has no explicit model. Pi uses the platform
default unless a model is explicit.

Live model changes remain OpenCode-specific. Start a new session when changing
the model for Claude Code, Codex, or Pi.

## Test all harnesses

The canonical live protocol smoke is:

```sh
pnpm exec dotenvx run --ignore=MISSING_ENV_FILE \
  -f apps/api/.env.local -f apps/api/.env -f apps/web/.env \
  -- bun tests/e2e/scripts/acp-multi-harness-smoke.ts
```

The default set is `opencode,claude,codex,pi`. The script creates a disposable
user and provisions the one starter, which is v2 — a non-OpenCode harness needs a
v3 manifest written into the project first. Project creation
enables `acp_runtime`. The deployment must also list every harness under test in
`KORTIX_ENABLED_HARNESSES`, or each non-OpenCode session start returns
`HARNESS_NOT_ENABLED`. The script starts one session per harness and cleans up the
managed repository, project rows, account row, and user in `finally`. Run
`pnpm dev` first.

Use a subset or provider:

```sh
E2E_ACP_MULTI_HARNESS_HARNESSES=codex,pi \
E2E_ACP_MULTI_HARNESS_PROVIDER=daytona \
pnpm exec dotenvx run --ignore=MISSING_ENV_FILE \
  -f apps/api/.env.local -f apps/api/.env -f apps/web/.env \
  -- bun tests/e2e/scripts/acp-multi-harness-smoke.ts
```

Supported options:

| Variable | Meaning |
| --- | --- |
| `E2E_ACP_MULTI_HARNESS_HARNESSES` | Comma-separated harness subset. |
| `E2E_ACP_MULTI_HARNESS_PROVIDER` | `daytona`, `platinum`, or the configured project default when unset. |
| `E2E_ACP_MULTI_HARNESS_MODEL` | Explicit session model. |
| `E2E_ACP_MULTI_HARNESS_OPENAI_API_KEY` | Temporary direct key for the disposable project. Do not print or commit it. |
| `E2E_KEEP_ACP_MULTI_HARNESS_FIXTURE` | Set to `1` to keep the fixture for debugging. |
| `E2E_ACP_MULTI_HARNESS_REUSE_PROJECT_ID` | Reuse one existing test project instead of creating a fixture. |
| `E2E_ACP_MULTI_HARNESS_REUSE_EMAIL` | Login email for the reused project. Set it with `E2E_ACP_MULTI_HARNESS_REUSE_PROJECT_ID`. |
| `E2E_API_URL` | Target API. Defaults to `http://localhost:8008/v1`. |
| `E2E_SUPABASE_URL` | Target Supabase Auth URL. Defaults to `http://127.0.0.1:54321`. |
| `E2E_DATABASE_URL` | Database URL override used for test credits and complete fixture cleanup. The script falls back to `DATABASE_URL`. |

Each harness must pass all checks:

1. Headless prompt.
2. Follow-up prompt.
3. Transcript reload.
4. Immutable harness identity.
5. In-place restart.
6. Post-restart prompt.
7. Persisted ACP identity.

The smoke verifies the protocol and runtime. It does not replace browser
verification of the agent selector or transcript renderer.
