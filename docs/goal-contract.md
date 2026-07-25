# Goal contract

Goal Loop ties commands, hooks, and agents together through one project-local JSON file.

For v0.1.0, that file is `.cursor/goal/active.json`.

This is not just metadata. It is the runtime state for the loop.

## Canonical active goal example

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

## Why the contract lives in the project

Goal Loop stores runtime state in the workspace instead of hiding it inside the plugin because that gives you:

- inspectability
- portability
- easier debugging
- a stable handoff point for other agents or wrappers

The loop is easier to trust when you can read its state directly.

## Schema fields

| Field | Meaning |
| --- | --- |
| `version` | Contract schema version. v0.1.0 supports only `1`. |
| `status` | Goal state: `draft`, `active`, `paused`, `blocked`, `completed`, or `aborted`. |
| `objective` | Human-readable target for the agent. |
| `verify.commands` | Shell commands run one after another after each completed turn. |
| `verify.cwd` | Working directory used when spawning those commands. |
| `verify.timeout_ms` | Timeout per command. |
| `limits.max_iterations` | Maximum number of hook verification attempts. |
| `limits.max_wall_ms` | Maximum allowed elapsed wall time since `started_at`. |
| `limits.max_repeat_failures` | Optional. Consecutive identical failures before `blocked` (default 3). |
| `completion_promise` | Reserved field for future non-shell completion modes. It is currently not used by the loop logic. |
| `started_at` | ISO timestamp for loop start. |
| `iteration` | Number of verification attempts already consumed. |
| `last_verify` | Latest check result object, or `null` if a check has not run yet. |
| `progress` | Optional bounded array of compact per-iteration entries (outcome, exit codes, reason, log path). |
| `paused_at` / `blocked_at` | Optional timestamps when the goal entered those states. |
| `blocked_reason` | Optional short description of what is blocking. |
| `last_failure_signature` / `repeat_failure_count` | Optional repeat-failure tracking used to earn `blocked`. |

## How status values behave

### `draft`

- created by `/plan`
- not enforced by the stop hook
- used for shaping scope before activation

### `active`

- live loop state
- stop hook validates and runs the check
- must have at least one command that either passes or fails

### `paused`

- set by `/goal-pause`
- stop hook returns `{}` and does not run the check
- iteration and limits are retained for `/goal-resume`

### `blocked`

- earned when the same check failure repeats across consecutive iterations (default 3)
- honest stop: the objective was not met
- resumable with `/goal-resume` after the user intervenes

### `completed`

- final success state
- means the check passed
- hook returns `{}` and does not continue the loop

### `aborted`

- final stopped state without success
- reached through `/goal-abort` or limit exhaustion

## Validation rules

The code currently enforces these rules:

- `version` must equal `1`
- `status` must be one of `active`, `draft`, `completed`, `aborted`, `paused`, `blocked`
- `objective` must be a non-empty string
- `verify` must be an object
- `verify.cwd` must be a non-empty string
- `verify.timeout_ms` must be a positive integer
- `limits.max_iterations` must be a positive integer
- `limits.max_wall_ms` must be a positive integer
- `iteration` must be a non-negative integer
- `active` goals must have at least one non-empty command
- optional trust-and-control fields (`progress`, `blocked_reason`, `repeat_failure_count`, and similar) are tolerated when absent so older files still validate

Whitespace-only commands are removed during normalization.

## Default resolution

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

If a goal is started with `status: active` and no explicit or default commands exist, creation fails.

## How `iteration` is counted

`iteration` is incremented by the stop hook before the check runs.

That means:

- a check that passes on the first post-turn run records `iteration: 1`
- a check that fails on the first post-turn run also records `iteration: 1`
- limit checks happen after incrementing, so a goal already at the max iteration count aborts on the next stop-hook run

## Run logs

Check logs are written to:

```text
.cursor/goal/runs/NNN.log
```

where `NNN` is a zero-padded iteration number, such as `001.log`.

The hook writes:

- objective
- iteration number
- hook-side timestamp
- combined command output

That makes run logs readable for both the agent and you.

## `last_verify` shape

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

- `ok`: overall check success
- `exit_codes`: exit codes for commands that ran
- `command_results`: per-command result summary
- `log_path`: where the full combined output was written
- `completed_at`: when the check finished

Commands run one after another. The check stops at the first failure.

## How the stop hook decides what happens next

The stop hook has only two meaningful outputs:

### Success or stop

```json
{}
```

Returned when:

- no active goal exists
- goal status is not `active`
- stop event status is not `completed`
- the check passes
- loop aborts due to limits
- hook crashes and fails open

If the hook crashes, it returns `{}` and writes `.cursor/goal/runs/hook-errors.log`. A broken hook never traps the agent.

### Continue

```json
{
  "followup_message": "Goal Loop verification failed..."
}
```

Returned only when:

- an active goal exists
- the stop event is `completed`
- the check ran
- at least one command failed

The `followup_message` includes:

- the objective
- current iteration and limit
- log path
- a tail of the command output
- explicit instruction to fix the root cause instead of declaring success

## State transitions

Typical path:

```text
draft -> active -> completed
```

Other valid paths:

```text
draft -> abandoned manually
active -> paused -> active
active -> blocked -> active
active -> aborted
active -> completed
```

There is currently no built-in command that promotes a `draft` to `active`. Activation happens through `/goal`, not automatically through `/plan`.

When `/goal` or `/plan` create a goal, `goalctl` may print advisory `warnings` if the check looks too weak for the objective. Those warnings never change the check the user chose.

## Practical implications

The contract is simple enough to reimplement elsewhere. Any other agent wrapper can adopt Goal Loop behavior if it follows the same rules:

- preserve goal state
- rerun the check after a completed turn
- continue only when a command that either passes or fails actually failed
- stop when the check passes or when a loop-stop condition is hit

## Related docs

- [Cursor setup and operation](cursor.md)
- [Verifier design](verifier-design.md)
- [Other agents](other-agents.md)
