---
name: plan
description: Draft a goal objective and verifier before activating Goal Loop.
---

# Plan a Goal Loop

Use this command when the user wants to shape the objective, scope, and verification before starting an autonomous loop.

## Instructions

1. Draft a concise objective, success criteria, verifier commands, in-scope work, and non-goals.
2. Prefer deterministic shell verification over subjective completion promises.
3. Write the draft with:

   ```bash
   node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" draft "<objective>" --verify "<command>"
   ```

4. Ask the user to confirm the draft before activating it with `/goal`.

Planning does not activate the stop-hook loop. Activation happens only through `/goal`.
