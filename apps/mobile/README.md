# Kortix Mobile App

> ## ⚠️ Stale — work in progress, not currently maintained
>
> **This app is knowingly behind the rest of the monorepo and is not part of the
> current release path.** Treat it as parked. It will be reconsolidated in a
> future pass; until then, do not assume anything here reflects how Kortix works.
>
> ### Why it is stale
>
> The platform is moving to **ACP as the single runtime transport**, with
> `@kortix/sdk` as the only way any host reaches the Kortix API. This app
> predates both decisions:
>
> - **Zero ACP support.** `grep -rn 'acp\|ACP' apps/mobile/lib apps/mobile/app`
>   returns no matches. Every runtime call here speaks the OpenCode REST API.
> - **~2,800 LOC of hand-rolled OpenCode REST client** under
>   `apps/mobile/lib/opencode/`, rather than consuming the SDK.
> - **Session navigation is keyed on the OpenCode REST session pin**
>   (`apps/mobile/app/projects/[id].tsx`). A managed-ACP session never has one,
>   so those screens cannot resolve a session at all.
> - It groups models by `providerName`, which is always `"Kortix"` under the
>   gateway, so its model list disagrees with the web app's.
>
> **Consequence: this app does not work against managed-ACP projects**, which are
> the default for new work. It was not broken by a recent change — it was never
> migrated.
>
> ### What reconsolidation requires
>
> Do not patch around the above. The work is:
>
> 1. Delete `apps/mobile/lib/opencode/` and consume `@kortix/sdk` instead — one
>    client via `createKortix({ backendUrl, getToken })`, per the repo rule that
>    the SDK is the single source of truth for anything that talks to the API.
> 2. Mount session screens on the SDK's transport-correct session identity
>    rather than the REST pin.
> 3. Drive the session lifecycle through the SDK's session hook rather than
>    hand-rolled mounting.
>
> ### If you are here to change something
>
> Prefer changing `packages/sdk` and `apps/web`. A fix applied only to this app
> will likely be discarded by the reconsolidation. If you must ship something
> here, say so explicitly in the PR and note that it is throwaway.

## Local development

See the repo root `AGENTS.md` / `CLAUDE.md` for the full local stack. Mobile runs
against the local API in the iOS simulator; expect setup friction while this app
is parked.
