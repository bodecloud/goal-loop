---
name: goal-abort
description: Stop the active Goal Loop.
---

# Abort Goal Loop

Use this command when the user wants the active loop to stop before the check passes.

## Required behavior

1. Abort the active goal with:

   ```bash
   node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" abort
   ```

2. If the user asked to remove the goal file, run:

   ```bash
   node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" abort --remove
   ```

3. Confirm the resulting status to the user.

## What to tell the user

Say whether the goal was marked `aborted` or removed. If there was no active goal, say that clearly.
