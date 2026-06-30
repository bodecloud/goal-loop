---
name: goal-abort
description: Stop the active Goal Loop.
---

# Abort Goal Loop

Run:

```bash
node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" abort
```

Then tell the user the active goal has been marked aborted and the stop hook will no longer continue the loop. If the user explicitly asks to remove state instead of preserving it, run:

```bash
node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" abort --remove
```
