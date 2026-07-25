# Troubleshooting

Debug from runtime evidence, not from guesses. Inspect state files and logs before changing the objective or rerunning the loop.

## First files to inspect

When a loop behaves unexpectedly, check these in order:

1. `.cursor/goal/active.json`
2. `.cursor/goal/defaults.json` if you expected defaults
3. `.cursor/goal/runs/`
4. `last_verify.log_path`
5. `.cursor/goal/runs/hook-errors.log`

These files are the real runtime record.

## `/goal` fails to start

**Symptom:** `/goal` rejects the start and prints an error.

**Likely cause:**

- empty objective
- missing verifier and no defaults
- malformed defaults
- invalid numeric flags

Relevant behavior:

- `createGoal()` rejects empty objectives
- active goals require at least one verifier command
- integer fields must be positive safe integers

Typical error:

```text
at least one verifier command is required; pass --verify or add .cursor/goal/defaults.json
```

**What to do:** Pass `--verify "..."` or add a valid `.cursor/goal/defaults.json`. Fix empty objectives and invalid numeric flags before retrying.

## `/goal-status` says no active goal

**Symptom:** Status reports that there is no active goal.

**Likely cause:** `.cursor/goal/active.json` does not exist.

This is normal if:

- the goal has not been started
- `/goal-abort --remove` was used
- the active file was manually deleted

**What to do:** Start a goal with `/goal`, or confirm you did not remove `active.json` on purpose.

## The hook returns `{}` and nothing continues

**Symptom:** The stop hook returns `{}` and Cursor does not send the agent back to work.

**Likely cause:** This is expected in several cases:

- the stop event status is not `completed`
- no active goal exists
- the goal exists but is not `active`
- the goal completed successfully
- the goal was aborted
- the hook failed open due to an exception

The hook returns `{"followup_message": "..."}` only when an active goal's verifier actually ran and failed. In all other stop cases it returns `{}`.

**What to do:** Inspect current goal `status`, `iteration`, `last_verify`, and `.cursor/goal/runs/hook-errors.log` to see whether `{}` was correct or unexpected.

## The agent stops after one failed verification

**Symptom:** The verifier failed once, then the agent stopped instead of continuing.

**Likely cause:** Cursor Agent Auto-run is disabled.

**What to do:**

- Confirm the hook returned a `followup_message`.
- Enable Auto-run so Cursor auto-submits follow-ups.

Without Auto-run, the loop still verifies honestly, but a human may need to continue. Goal Loop cannot force Cursor to auto-run; it only emits the continuation payload.

## The same failure repeats forever

**Symptom:** Every turn fails with the same verifier result.

**Likely cause:**

- the check is correct and the agent is genuinely stuck
- the check is too weak or too noisy
- the failure log is not specific enough to guide the next turn
- the objective is underspecified

Use the run logs to tell these apart:

- repeated identical log output suggests no progress
- noisy logs suggest the check needs refinement

**What to do:** Improve the verifier or objective. Do not merely rerun the same loop.

## The goal aborts unexpectedly

**Symptom:** The goal status becomes `aborted` before you expect.

**Likely cause:** The hook hit a limit and set:

- `abort_reason: "max_iterations"`
- `abort_reason: "max_wall_ms"`

Defaults include `limits.max_iterations: 20` and `limits.max_wall_ms: 7200000`.

**What to do:** Inspect `iteration`, `limits.max_iterations`, `started_at`, and `limits.max_wall_ms`. Remember the hook increments `iteration` before verification runs. Raise limits only when the task truly needs more room; otherwise tighten the objective or check.

## The hook crashes

**Symptom:** Continuation stops, and `.cursor/goal/runs/hook-errors.log` has a new entry.

**Likely cause:** An exception in the hook. By design the hook fails open: it writes the exception to `hook-errors.log` and returns `{}`, so a broken hook never traps the agent.

**What to do:** Inspect:

- malformed JSON in `active.json`
- malformed stdin
- environment issues affecting Node or shell execution

Tests cover malformed hook input and confirm fail-open behavior.

## The verifier passed but the result still feels wrong

**Symptom:** Goal status is `completed`, but the original request is not really satisfied.

**Likely cause:** The check was too weak for the actual request. This is often not a Goal Loop bug.

Examples:

- build passes but runtime flow still broken
- file exists but contents are wrong
- docs page exists but the content is shallow

**What to do:** Strengthen the verifier or redefine the objective more honestly. Do not claim the loop was wrong for honoring the check you gave it.

## Multi-command verification stops at the first failure

**Symptom:** Later `--verify` commands never ran after an earlier one failed.

**Likely cause:** Normal behavior. Verifier commands run one after another and stop at the first failure. Goal Loop does not collect every downstream failure in one pass.

That is intentional because:

- the first failure is usually the root blocker
- downstream noise is often misleading
- shorter failure feedback is easier for the agent to act on

**What to do:** Fix the first failing command, then let the next turn run the full sequence again.

## Manual edits broke the contract

**Symptom:** Status or start fails after someone hand-edited `active.json`.

**Likely cause:** `validateGoal()` rejected invalid fields.

Check for:

- invalid `status`
- blank objective
- missing `verify`
- empty `verify.cwd`
- invalid integer fields
- empty `verify.commands` on an active goal

Valid statuses are `draft`, `active`, `completed`, and `aborted`.

**What to do:** Fix the JSON fields, or abort and start a fresh goal instead of hand-repairing a broken contract.

## Escalation rule

Prefer direct evidence from:

- current JSON state
- verifier logs under `.cursor/goal/runs/NNN.log`
- hook errors
- test coverage (`npm test`, `npm run verify`)

Do not infer loop behavior from the assistant's summary alone. The runtime files are the source of truth.

## Related docs

- [Goal contract](goal-contract.md)
- [Operator checklists](operator-checklists.md)
- [Examples](examples.md)
- [FAQ](faq.md)
