# {{projectName}}

This project contains four ACP runtime profiles:

- `opencode`
- `claude`
- `codex`
- `pi`

Select the matching logical agent when you create a session.

## Authentication

- OpenCode can use Kortix-managed models or project provider keys.
- Claude Code accepts `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, or
  `CLAUDE_CODE_OAUTH_TOKEN`.
- Codex accepts `CODEX_AUTH_JSON`, `OPENAI_API_KEY`, or `CODEX_API_KEY`.
- Pi accepts `OPENAI_API_KEY` or `CODEX_API_KEY`.

Use the project Models view to connect credentials. Do not commit credentials.

## Test all harnesses

Create one session with each logical agent:

1. Select `opencode`, `claude`, `codex`, or `pi` in the agent selector.
2. Send a real prompt with the model that you intend to use.
3. Confirm the session detail reports the matching `runtime_harness`.
4. Start a new session before selecting another harness.

For the complete automated protocol smoke, run this command from the Kortix
repository after `pnpm dev` is ready:

```sh
pnpm exec dotenvx run --ignore=MISSING_ENV_FILE \
  -f apps/api/.env.local -f apps/api/.env -f apps/web/.env \
  -- bun tests/e2e/scripts/acp-multi-harness-smoke.ts
```

The smoke creates a disposable project. It sends real prompts through all four
harnesses. It verifies transcript reload, immutable runtime identity, restart
recovery, and persisted ACP identity. It cleans up the fixture in `finally`.
