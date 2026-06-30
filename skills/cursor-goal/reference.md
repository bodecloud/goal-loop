# Goal Loop Reference

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

`active.json`, `draft.json`, and `runs/` are mutable state. `defaults.json` is intended to be committed when a project wants a shared default verifier.

## active.json v1

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

- `draft`: planned but not active.
- `active`: stop hook will verify and continue on failure.
- `completed`: verifier passed.
- `aborted`: loop stopped because the user aborted or limits were reached.

## Verification Contract

Verifier commands run sequentially. The first failing command stops the verifier, writes a log, updates `last_verify`, and returns a stop-hook `followup_message`.

The agent is not the completion authority. The verifier is.
