---
name: feature-development-with-example-agent-and-tool
description: Workflow command scaffold for feature-development-with-example-agent-and-tool in suna.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-development-with-example-agent-and-tool

Use this workflow when working on **feature-development-with-example-agent-and-tool** in `suna`.

## Goal

Develop or extend a feature by updating the example agent, its tools, and related core files, often together.

## Common Files

- `agentpress/examples/example_agent/agent.py`
- `agentpress/examples/example_agent/tools/*.py`
- `agentpress/thread_manager.py`
- `agentpress/tool.py`
- `agentpress/tool_registry.py`
- `agentpress/examples/example_agent/workspace/*`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit agentpress/examples/example_agent/agent.py
- Edit or add files in agentpress/examples/example_agent/tools/ (e.g., files_tool.py, terminal_tool.py)
- Edit related core files (e.g., agentpress/thread_manager.py, agentpress/tool.py, agentpress/tool_registry.py)
- Optionally update workspace files (HTML/CSS/JS) for the example agent
- Commit changes, often with 'wip', 'refactor', or feature-specific message

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.