# Goal Contract

Goal Loop coordinates commands, hooks, and agents through one project-local JSON contract.

For v0.1.0, that contract is `.cursor/goal/active.json`.

This file is not just metadata. It is the runtime state machine for the loop.

## Canonical Active Goal Example

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

## Why the Contract Lives in the Project

Goal Loop stores runtime state in the workspace instead of hiding it inside plugin internals because that gives you:

- inspectability
- portability
- easier debugging
- a stable handoff surface for other agents or wrappers

The loop is easier to trust when you can inspect its state directly.

## Schema Fields

| Field | Meaning |
| --- | --- |
| `version` | Contract schema version. v0.1.0 supports only `1`. |
| `status` | Goal state: `draft`, `active`, `completed`, or `aborted`. |
| `objective` | Human-readable target for the agent. |
| `verify.commands` | Shell commands run sequentially after each completed turn. |
| `verify.cwd` | Working directory used when spawning verifier commands. |
| `verify.timeout_ms` | Timeout per verifier command. |
| `limits.max_iterations` | Maximum number of hook verification attempts. |
| `limits.max_wall_ms` | Maximum allowed elapsed wall time since `started_at`. |
| `completion_promise` | Reserved field for future non-shell completion modes. It is currently not used by the loop logic. |
| `started_at` | ISO timestamp for loop start. |
| `iteration` | Number of verification attempts already consumed. |
| `last_verify` | Latest verifier result object, or `null` if verification has not run yet. |

## Status Semantics

### `draft`

- created by `/plan`
- not enforced by the stop hook
- used for shaping scope before activation

### `active`

- live loop state
- stop hook validates and executes verification
- must have at least one verifier command

### `completed`

- final success state
- indicates the verifier passed
- hook returns `{}` and does not continue the loop

### `aborted`

- final stopped state without success
- reached through `/goal-abort` or limit exhaustion

## Validation Rules

The code currently enforces these rules:

- `version` must equal `1`
- `status` must be one of `active`, `draft`, `completed`, `aborted`
- `objective` must be a non-empty string
- `verify` must be an object
- `verify.cwd` must be a non-empty string
- `verify.timeout_ms` must be a positive integer
- `limits.max_iterations` must be a positive integer
- `limits.max_wall_ms` must be a positive integer
- `iteration` must be a non-negative integer
- `active` goals must have at least one non-empty verifier command

Whitespace-only commands are removed during normalization.

## Default Resolution

When a goal is created, `scripts/goal-lib.mjs` resolves defaults from `.cursor/goal/defaults.json`.

Default shape:

```json
{
  "verify": {
    "commands": ["npm run build"],
    "cwd": ".",
    "timeout_ms": 600000
  },
  "limits": {
    "max_iterations": 20,
    "max_wall_ms": 7200000
  }
}
```

Resolution behavior:

- explicit CLI flags override defaults
- explicit `--verify` commands override `defaults.verify.commands`
- missing values fall back to hardcoded defaults

If a goal is started with `status: active` and no explicit or default verifier commands exist, creation fails.

## Iteration Semantics

`iteration` is incremented by the stop hook before verification runs.

That means:

- a verifier that passes on the first post-turn run records `iteration: 1`
- a verifier that fails on the first post-turn run also records `iteration: 1`
- limit checks happen after incrementing, so a goal already at the max iteration count aborts on the next stop-hook run

## Run Logs

Verifier logs are written to:

```text
.cursor/goal/runs/NNN.log
```

where `NNN` is a zero-padded iteration number, such as `001.log`.

The hook writes:

- objective
- iteration number
- hook-side timestamp
- combined verifier output

That makes run logs both agent-readable and operator-auditable.

## `last_verify` Shape

Example:

```json
{
  "ok": false,
  "exit_codes": [1],
  "command_results": [
    {
      "command": "npm run build",
      "ok": false,
      "exit_code": 1,
      "signal": null,
      "timed_out": false,
      "duration_ms": 1200
    }
  ],
  "log_path": ".cursor/goal/runs/001.log",
  "completed_at": "2026-06-30T00:05:00.000Z"
}
```

Meaning:

- `ok`: overall verifier success
- `exit_codes`: exit codes for commands that ran
- `command_results`: per-command result summary
- `log_path`: where the full combined output was written
- `completed_at`: when the verification run finished

Commands run sequentially. Verification stops at the first failure.

## Hook Return Contract

The stop hook has only two meaningful outputs:

### Success or stop

```json
{}
```

Returned when:

- no active goal exists
- goal status is not `active`
- stop event status is not `completed`
- verification passes
- loop aborts due to limits
- hook crashes and fails open

### Continue

```json
{
  "followup_message": "Goal Loop verification failed..."
}
```

Returned only when:

- an active goal exists
- the stop event is `completed`
- verification ran
- at least one verifier command failed

The `followup_message` includes:

- the objective
- current iteration and limit
- log path
- a tail of the verifier output
- explicit instruction to fix the root cause instead of declaring success

## State Transitions

Typical path:

```text
draft -> active -> completed
```

Other valid paths:

```text
draft -> abandoned manually
active -> aborted
active -> completed
```

There is currently no built-in promotion command from `draft` to `active`; activation occurs through `/goal`, not automatically through `/plan`.

## Practical Implications

The contract is intentionally simple enough to reimplement elsewhere. Any other agent wrapper can adopt Goal Loop behavior if it respects the same semantics:

- preserve goal state
- rerun verification after a completed turn
- continue only on mechanical verifier failure
- stop on verifier success or loop-stop conditions

## Related Docs

- [Cursor setup and operation](cursor.md)
- [Verifier design](verifier-design.md)
- [Other agents](other-agents.md)
