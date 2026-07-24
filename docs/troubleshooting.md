# Troubleshooting

This guide maps likely user-visible problems to the current Goal Loop implementation.

The goal is to debug from evidence, not from guesses.

## First Inspection Checklist

When a loop behaves unexpectedly, inspect these in order:

1. `.cursor/goal/active.json`
2. `.cursor/goal/defaults.json` if defaults were expected
3. `.cursor/goal/runs/`
4. `last_verify.log_path`
5. `.cursor/goal/runs/hook-errors.log`

These files are the authoritative runtime record.

## Problem: `/goal` Fails to Start

Likely causes:

- empty objective
- missing verifier with no defaults
- malformed defaults
- invalid numeric flags

Relevant code behavior:

- `createGoal()` rejects empty objectives
- active goals require at least one verifier command
- integer fields must be positive safe integers

Typical error:

```text
at least one verifier command is required; pass --verify or add .cursor/goal/defaults.json
```

## Problem: `/goal-status` Says No Active Goal

Meaning:

- `active.json` does not exist

This is normal if:

- the goal has not been started
- `abort --remove` was used
- the active file was manually deleted

## Problem: The Hook Returns `{}` and Nothing Continues

This is expected in several cases:

- the stop event status is not `completed`
- no active goal exists
- the goal exists but is not `active`
- the goal completed successfully
- the goal was aborted
- the hook failed open due to an exception

The next question is whether this `{}` was correct or unexpected.

To tell the difference, inspect:

- current goal `status`
- `iteration`
- `last_verify`
- `hook-errors.log`

## Problem: The Agent Stops After One Failed Verification

Most likely cause:

- Cursor Agent Auto-run is disabled

What to verify:

- the hook returned a `followup_message`
- Cursor was configured to auto-submit follow-ups

Goal Loop itself cannot force Cursor to auto-run. It only emits the continuation payload.

## Problem: The Same Failure Repeats Forever

Possible causes:

- the verifier is correct and the agent is genuinely stuck
- the verifier is too weak or too noisy
- the failure log is not specific enough to guide the next turn
- the objective is underspecified

Use the run logs to distinguish these:

- repeated identical log output suggests the loop is not making progress
- noisy logs suggest the verifier surface needs refinement

Operational fix:

- improve the verifier or objective rather than merely rerunning the same loop

## Problem: The Goal Aborts Unexpectedly

The hook can set:

- `abort_reason: "max_iterations"`
- `abort_reason: "max_wall_ms"`

Inspect:

- `iteration`
- `limits.max_iterations`
- `started_at`
- `limits.max_wall_ms`

Remember that the hook increments `iteration` before running verification.

## Problem: The Hook Crashes

Current design:

- write exception details to `.cursor/goal/runs/hook-errors.log`
- return `{}`

That is fail-open behavior by design.

What to inspect:

- malformed JSON in `active.json`
- malformed stdin
- environment issues affecting Node or shell execution

Tests currently cover malformed hook input and confirm fail-open behavior.

## Problem: The Verifier Passed but the User Is Still Unhappy

This is often not a Goal Loop bug.

It usually means the verifier was too weak for the actual user request.

Examples:

- build passes but runtime flow still broken
- file exists but contents are wrong
- docs page exists but the content is shallow

The correct response is usually to strengthen the verifier or redefine the objective more honestly, not to claim the loop was wrong for honoring the verifier you gave it.

## Problem: Multi-Command Verification Stops Too Early

This is normal.

Goal Loop runs verifier commands sequentially and stops at the first failure. It does not try to collect every possible downstream failure in one pass.

That behavior is intentional because:

- the first failure is usually the root blocker
- downstream noise is often misleading
- shorter failure feedback is easier for the agent to act on

## Problem: Manual Edits Broke the Contract

If someone hand-edits `active.json`, `validateGoal()` may reject it.

Check for:

- invalid `status`
- blank objective
- missing `verify`
- empty `verify.cwd`
- invalid integer fields
- empty `verify.commands` on an active goal

## Escalation Rule

When debugging Goal Loop, prefer direct evidence from:

- current JSON state
- verifier logs
- hook errors
- test coverage

Do not infer loop behavior from the assistant's summary alone. The runtime files are the real source of truth.
