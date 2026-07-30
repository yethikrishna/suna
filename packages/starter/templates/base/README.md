# {{projectName}}

This project runs the OpenCode harness. `kortix.yaml` declares
`kortix_version: 2`, the stable manifest schema.

## Authentication

OpenCode uses Kortix-managed models or project provider credentials. Use the
project Models view to connect credentials. Do not commit credentials.

## Verify the project

1. Create a session with the `kortix` agent.
2. Send a real prompt.
3. Confirm that the response completes.

A provider availability check does not prove prompt execution. Test the exact
model that the project will use.

## Other harnesses

Claude Code, Codex, and Pi run on `kortix_version: 3`, which is EXPERIMENTAL and
not fully released. Create a project from the experimental multi-harness starter
to use them.

Run `kortix system-skills get kortix-system --full` for the current platform
instructions. Run `kortix schema --version 2` for the exact manifest schema.
