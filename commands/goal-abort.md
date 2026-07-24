---
name: goal-abort
description: Stop the active Goal Loop.
---

# Abort Goal Loop

Use this command when the user wants the active loop to stop before verifier success.

Default behavior preserves the final state by marking the active goal `aborted`. This is preferable when the user may want an audit trail of what happened.

## Default Abort

Run:

```bash
node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" abort
```

Then tell the user:

- the active goal has been marked aborted
- the stop hook will no longer continue the loop
- the final `active.json` remains available for inspection

## Remove-State Abort

If the user explicitly wants the goal file removed rather than preserved, run:

```bash
node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" abort --remove
```

Use removal only when the user clearly wants state cleared. Do not silently erase state when simple abort semantics are enough.
