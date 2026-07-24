---
name: goal
description: Start a verifier-backed autonomous goal loop.
---

# Start a Goal Loop

Use this command when the user wants the agent to keep working until a deterministic verifier passes.

This command is not a generic "be more autonomous" switch. Its job is to create a concrete goal contract whose completion authority is a shell verifier, not the assistant's judgment.

## Command Intent

When `/goal` is used correctly, the resulting loop should have:

- one clear objective
- one or more explicit verifier commands
- a bounded completion surface
- a stop hook that can mechanically decide pass or fail after each completed turn

If the request is vague, expand it into a precise objective before writing the goal.

## Required Behavior

1. Parse the user's objective from the command text.
2. Collect every verifier passed as `--verify "<command>"`.
3. If no verifier was provided, fall back to `.cursor/goal/defaults.json`.
4. Refuse to proceed if there is no explicit or default verifier for an active goal.
5. Create the goal with:

   ```bash
   node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" start "<objective>" --verify "<command>"
   ```

6. Load the `cursor-goal` skill.
7. Tell the user that Cursor Agent Auto-run is required for unattended continuation.
8. Start working on the objective immediately.

## Objective Quality Rules

Before starting the loop, make sure the objective is:

- specific enough to act on
- narrow enough that the verifier can actually prove it
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

## Verifier Quality Rules

Prefer verifier commands that are:

- deterministic
- relevant to the actual request
- cheap enough to rerun every turn
- strong enough to prove completion

Good examples:

- `npm run build`
- `npm test -- --testPathPattern=auth`
- `test -f .cursor/goal/proof.txt`
- `scripts/smoke-check.sh`

Do not choose a verifier that is only tangentially related to the request just because it is easy to run.

## Operator Messaging

When you start a goal, communicate three things clearly:

- what objective is now active
- what verifier will decide completion
- whether Auto-run is needed for unattended continuation

If the verifier came from defaults rather than explicit `--verify`, say so.

## Non-Goals

Do not:

- declare success yourself
- replace the verifier with subjective completion language
- expand the task into unrelated cleanup
- start a loop whose proof surface does not match the request

The Goal Loop stop hook is the authority. When verification passes, it will stop the loop. When verification fails, it will send the next instruction.
