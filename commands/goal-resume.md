---
name: goal-resume
description: Resume a paused or blocked Goal Loop.
---

# Resume Goal Loop

Use this command when the user wants a paused or blocked goal to become active again.

## Required behavior

1. Resume the goal with:

   ```bash
   node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" resume
   ```

2. Confirm the resulting status to the user.

## What to tell the user

Say that the goal is `active` again. Iteration count and limits carry forward from before the pause or block. If the goal was blocked, mention that the repeat-failure counter was cleared so the loop can try again after their intervention. If there was nothing to resume, say that clearly.
