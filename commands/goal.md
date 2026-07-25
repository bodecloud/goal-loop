---
name: goal
description: Start a check-backed goal loop that keeps working until a shell command passes.
---

# Start a Goal Loop

Use this command when the user wants the agent to keep working until a shell check passes.

This command is not a generic "be more autonomous" switch. Its job is to create a concrete goal contract. A shell check decides when the work is done, not the assistant's judgment.

## Command intent

When `/goal` is used correctly, the resulting loop should have:

- one clear objective
- one or more explicit check commands
- a bounded definition of done
- a stop hook that can mechanically decide pass or fail after each finished turn

If the request is vague, expand it into a precise objective before writing the goal.

## Required behavior

1. Parse the user's objective from the command text.
2. Collect every check passed as `--verify "<command>"`.
3. If no check was provided, fall back to `.cursor/goal/defaults.json`.
4. Refuse to proceed if there is no explicit or default check for an active goal.
5. Create the goal with:

   ```bash
   node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" start "<objective>" --verify "<command>"
   ```

6. If the printed JSON includes `warnings`, relay them to the user in plain language and suggest a stronger check. Coaching is advisory only — if the user proceeds with the chosen check, keep it exactly as written.
7. Load the `cursor-goal` skill.
8. Tell the user that Cursor Agent Auto-run is required for unattended continuation.
9. Start working on the objective immediately.

## Objective quality rules

Before starting the loop, make sure the objective is:

- specific enough to act on
- narrow enough that the check can actually prove it
- aligned with the user's real ask rather than a convenience rewrite

Good examples:

- `Fix the failing auth tests`
- `Restore a clean production build`
- `Generate the missing export manifest`

Weak examples:

- `Make the app better`
- `Clean things up`
- `Finish whatever is broken`

If the user's wording is broad, convert it into the most faithful bounded objective you can justify from the request.

## Check quality rules

Prefer check commands that are:

- repeatable
- relevant to the actual request
- cheap enough to rerun every turn
- strong enough to prove completion

Good examples:

- `npm run build`
- `npm test -- --testPathPattern=auth`
- `test -f .cursor/goal/proof.txt`
- `scripts/smoke-check.sh`

Do not choose a check that is only loosely related to the request just because it is easy to run.

## What to tell the user

When you start a goal, say three things clearly:

- what objective is now active
- what check will decide completion
- whether Auto-run is needed for unattended continuation

If the check came from defaults rather than explicit `--verify`, say so.

## What not to do

Do not:

- declare success yourself
- replace the check with subjective completion language
- expand the task into unrelated cleanup
- start a loop whose check does not match the request

The Goal Loop stop hook decides when the work is done. When the check passes, it stops the loop. When the check fails, it sends the next instruction.
