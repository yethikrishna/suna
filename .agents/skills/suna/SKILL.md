```markdown
# suna Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you the core development patterns, coding conventions, and workflows used in the **suna** Python codebase. You'll learn how to manage releases, develop new features (especially around example agents and tools), update the workspace UI, and handle thread/state data. The guide covers naming conventions, import/export styles, and how to run and write tests.

## Coding Conventions

- **File Naming:**  
  Use `camelCase` for Python files, e.g., `threadManager.py`, `toolRegistry.py`.

- **Import Style:**  
  Use **relative imports** within modules.  
  _Example:_
  ```python
  from .tool import Tool
  from .threadManager import ThreadManager
  ```

- **Export Style:**  
  Use **named exports** (explicitly listing what is exported in `__all__`).  
  _Example:_
  ```python
  __all__ = ["Tool", "ToolRegistry"]
  ```

- **Commit Messages:**  
  Freeform, often short (~20 chars), sometimes prefixed with `wip`, `fix`, `refactor`, or a feature name.

## Workflows

### Version Bump and Release
**Trigger:** When preparing a new release or after merging significant changes  
**Command:** `/bump-version`

1. Update the version number in `pyproject.toml`.
2. Optionally update `README.md` and/or `CHANGELOG.md` to reflect changes.
3. Commit with a message indicating the version bump (e.g., `bump: v0.2.1`).
4. If using pull requests, merge the PR for the version bump.

_Example:_
```toml
# pyproject.toml
version = "0.2.1"
```
```sh
git add pyproject.toml README.md CHANGELOG.md
git commit -m "bump: v0.2.1"
git push
```

---

### Feature Development with Example Agent and Tool
**Trigger:** When adding or updating a feature that involves the example agent and its tools  
**Command:** `/new-feature-agent-tool`

1. Edit `agentpress/examples/example_agent/agent.py` to add or modify agent logic.
2. Edit or add files in `agentpress/examples/example_agent/tools/` (e.g., `filesTool.py`, `terminalTool.py`) to implement new tools.
3. Update related core files as needed (e.g., `agentpress/threadManager.py`, `agentpress/tool.py`, `agentpress/toolRegistry.py`).
4. Optionally, update workspace files (`HTML/CSS/JS`) for the example agent.
5. Commit changes with a descriptive message (e.g., `wip: add file tool`).

_Example:_
```python
# agentpress/examples/example_agent/tools/filesTool.py
from ...tool import Tool

class FilesTool(Tool):
    def run(self, *args, **kwargs):
        # Implementation here
        pass
```

---

### Workspace UI Update
**Trigger:** When improving or adding UI features for the example agent workspace  
**Command:** `/update-workspace-ui`

1. Edit files in `agentpress/examples/example_agent/workspace/` (e.g., `index.html`, `styles.css`, `script.js`).
2. Optionally update backend files (e.g., `agentpress/responseProcessor.py`, `agentpress/threadManager.py`) to support UI changes.
3. Commit changes (e.g., `fix: workspace layout`).

_Example:_
```html
<!-- agentpress/examples/example_agent/workspace/index.html -->
<button id="run-tool">Run Tool</button>
<script src="script.js"></script>
```

---

### Add or Update Thread and State Files
**Trigger:** When thread or state data changes, often after running or testing features  
**Command:** `/update-thread-state`

1. Edit or add files in `threads/*.json` to update thread data.
2. Edit `state.json` as needed.
3. Optionally update related Python files to reflect data changes.
4. Commit with a message like `update: thread data`.

_Example:_
```json
// threads/exampleThread.json
{
  "id": "thread-001",
  "messages": [...]
}
```

## Testing Patterns

- **Test File Pattern:**  
  Test files use the pattern `*.test.*` (e.g., `tool.test.py`).

- **Framework:**  
  The specific test framework is unknown, but tests are likely written in standard Python style.

_Example:_
```python
# agentpress/tool.test.py
def test_tool_run():
    tool = Tool()
    assert tool.run() == "expected result"
```

## Commands

| Command                  | Purpose                                                   |
|--------------------------|-----------------------------------------------------------|
| /bump-version            | Bump project version and prepare for a new release        |
| /new-feature-agent-tool  | Add or update features involving the example agent/tools  |
| /update-workspace-ui     | Update the workspace UI (HTML/CSS/JS)                    |
| /update-thread-state     | Add or update thread and state JSON files                 |
```
