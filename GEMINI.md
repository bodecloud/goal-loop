# Goal Loop

Goal Loop keeps a coding agent working until a shell check passes.

## Core rule

A command exit code decides when the work is done. The agent does not declare itself done.

## Commands

- `/goal <objective> --verify "<command>"` — start an active loop
- `/plan [objective]` — draft objective and check without activating
- `/goal-status` — show active goal and last check result
- `/goal-abort` — stop the loop early

## Runtime state

Project-local contract:

```text
.cursor/goal/active.json
.cursor/goal/defaults.json
.cursor/goal/runs/
```

## When a goal is active

1. Read `.cursor/goal/active.json`.
2. Work only on `objective`.
3. Treat `verify.commands` as the completion gate.
4. After each finished turn, the stop hook reruns the check.
5. On failure, fix the root cause from the run log. Do not claim success.
