---
name: goal-pause
description: Pause the active Goal Loop without aborting it.
---

# Pause Goal Loop

Use this command when the user wants the active loop to stop continuing for now, but keep the goal and its progress.

## Required behavior

1. Pause the active goal with:

   ```bash
   node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" pause
   ```

2. Confirm the resulting status to the user.

## What to tell the user

Say that the goal is `paused`. Iteration count and limits are retained. The stop hook will not run the check or continue the agent until someone resumes. If there was no active goal, say that clearly.
