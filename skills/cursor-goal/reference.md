# Goal Loop reference

This reference is the short operational companion to the main docs. Use it when you need the key runtime facts quickly.

## Runtime files

Goal Loop stores runtime state in the active project, not in the plugin install directory.

```text
.cursor/goal/
├── active.json
├── draft.json
├── defaults.json
├── progress.md
└── runs/
```

Guidance:

- `active.json`, `draft.json`, and `runs/` are mutable runtime state
- `defaults.json` is meant to be committed when a project wants a shared check
- `progress.md` is optional and should stay accurate if used

## `active.json` v1

```json
{
  "version": 1,
  "status": "active",
  "objective": "All auth tests pass and build is clean",
  "verify": {
    "commands": ["npm test -- --testPathPattern=auth", "npm run build"],
    "cwd": ".",
    "timeout_ms": 600000
  },
  "limits": {
    "max_iterations": 20,
    "max_wall_ms": 7200000
  },
  "completion_promise": null,
  "started_at": "2026-06-30T00:00:00.000Z",
  "iteration": 0,
  "last_verify": null
}
```

## Status values

- `draft`: planned but not active
- `active`: stop hook will run the check and continue on failure
- `paused`: stop hook skips the check; resume with `/goal-resume`
- `blocked`: same failure repeated enough times; honest stop, resumable after intervention
- `completed`: check passed and the loop is done
- `aborted`: loop stopped without a passing check

The contract may also carry a bounded `progress` array and optional fields like `blocked_reason` and `repeat_failure_count`. Older files without those fields still validate.

## Check contract

Check commands:

- run one after another
- stop at the first failure
- write a run log under `.cursor/goal/runs/`
- update `last_verify`
- return a stop-hook `followup_message` on failure

The agent does not decide when the work is done. The check does.

## Stop hook outcomes

Success or no continuation:

```json
{}
```

Failure requiring another turn:

```json
{
  "followup_message": "Goal Loop verification failed..."
}
```

## Loop guardrails

- Cursor hook `loop_limit: 20`
- goal-level `limits.max_iterations`
- goal-level `limits.max_wall_ms`
- goal-level `limits.max_repeat_failures` (default 3) for earned `blocked`
- per-command `verify.timeout_ms`
- fail-open hook error handling via `.cursor/goal/runs/hook-errors.log`

## Quick reminder

If loop behavior is confusing, inspect:

1. `.cursor/goal/active.json`
2. `.cursor/goal/defaults.json`
3. `.cursor/goal/runs/`
4. `last_verify.log_path`

Those files are the authoritative evidence trail.
