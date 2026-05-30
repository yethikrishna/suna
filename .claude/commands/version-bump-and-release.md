---
name: version-bump-and-release
description: Workflow command scaffold for version-bump-and-release in suna.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /version-bump-and-release

Use this workflow when working on **version-bump-and-release** in `suna`.

## Goal

Bump the project version for a new release, often including updating pyproject.toml and sometimes README.md or CHANGELOG.md.

## Common Files

- `pyproject.toml`
- `README.md`
- `CHANGELOG.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Update the version number in pyproject.toml
- Optionally update README.md and/or CHANGELOG.md
- Commit with a message indicating version bump
- Sometimes merge a pull request for the version bump

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.