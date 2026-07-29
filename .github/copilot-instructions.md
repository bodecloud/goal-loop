Goal Loop keeps an agent working until a shell check passes. Use `/goal` to start a check-backed loop for any bounded task. The stop hook runs your check after each finished turn and continues only when it fails.

## Quick reference

- `/goal <objective> --verify "<command>"` — start an active loop
- `/plan [objective]` — draft objective and check without activating
- `/goal-status` — show active goal and last check result
- `/goal-abort` — stop the loop early
- `/goal-pause` — pause the active goal
- `/goal-resume` — resume a paused goal

## Core rule

A command exit code decides when the work is done. The agent does not declare itself done.