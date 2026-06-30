# Goal Contract

Goal Loop coordinates commands, hooks, and agents through one project-local JSON file.

## `active.json`

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

## Fields

| Field | Meaning |
| --- | --- |
| `version` | Schema version. v0.1.0 supports `1`. |
| `status` | `draft`, `active`, `completed`, or `aborted`. |
| `objective` | Human-readable target for the agent. |
| `verify.commands` | Shell commands run sequentially after each agent turn. |
| `verify.cwd` | Working directory for verifier commands. |
| `verify.timeout_ms` | Timeout per verifier command. |
| `limits.max_iterations` | Maximum hook verification attempts. |
| `limits.max_wall_ms` | Maximum elapsed wall time for the goal. |
| `completion_promise` | Reserved for future non-shell completion modes. |
| `started_at` | ISO timestamp for loop start. |
| `iteration` | Number of verification attempts. |
| `last_verify` | Latest verifier result and log path. |

## Verifier Result

`last_verify` looks like:

```json
{
  "ok": false,
  "exit_codes": [1],
  "command_results": [
    {
      "command": "npm run build",
      "ok": false,
      "exit_code": 1,
      "timed_out": false,
      "duration_ms": 1200
    }
  ],
  "log_path": ".cursor/goal/runs/001.log",
  "completed_at": "2026-06-30T00:05:00.000Z"
}
```

## Defaults

`.cursor/goal/defaults.json` can provide shared verifier defaults:

```json
{
  "verify": {
    "commands": ["npm run build"]
  },
  "limits": {
    "max_iterations": 20
  }
}
```

Defaults are used when `/goal` does not receive explicit verifier commands.
