# Goal Loop Reference

This reference is the compact operational companion to the main documentation. It exists for agents and operators who need the key runtime facts quickly.

## Runtime Files

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
- `defaults.json` is intended to be committed when a project wants a shared verifier
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

## Status Values

- `draft`: planned but not active
- `active`: stop hook will verify and continue on failure
- `completed`: verifier passed and the loop is done
- `aborted`: loop stopped without verifier success

## Verification Contract

Verifier commands:

- run sequentially
- stop at the first failure
- write a run log under `.cursor/goal/runs/`
- update `last_verify`
- return a stop-hook `followup_message` on failure

The agent is not the completion authority. The verifier is.

## Stop Hook Outcomes

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

## Loop Guardrails

- Cursor hook `loop_limit: 20`
- goal-level `limits.max_iterations`
- goal-level `limits.max_wall_ms`
- per-command `verify.timeout_ms`
- fail-open hook error handling via `.cursor/goal/runs/hook-errors.log`

## Quick Operator Reminder

If loop behavior is confusing, inspect:

1. `.cursor/goal/active.json`
2. `.cursor/goal/defaults.json`
3. `.cursor/goal/runs/`
4. `last_verify.log_path`

Those files are the authoritative evidence trail.
