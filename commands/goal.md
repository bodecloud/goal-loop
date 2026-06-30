---
name: goal
description: Start a verifier-backed autonomous goal loop.
---

# Start a Goal Loop

Use this command when the user wants the agent to keep working until deterministic verification passes.

## Instructions

1. Parse the user's objective from the command text.
2. If the user included verifier commands, pass each as `--verify "<command>"`.
3. If no verifier was provided, read `.cursor/goal/defaults.json`.
4. Run:

   ```bash
   node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" start "<objective>" --verify "<command>"
   ```

5. Load the `cursor-goal` skill.
6. Tell the user that Cursor Agent Auto-run must be enabled for unattended looping.
7. Start working on the objective immediately.

Do not declare success yourself. The Goal Loop stop hook is the authority: it will stop the loop when verification passes or send a follow-up when verification fails.
