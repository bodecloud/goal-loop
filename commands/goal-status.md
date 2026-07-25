---
name: goal-status
description: Show the current Goal Loop state and last check result.
---

# Goal Loop status

Run:

```bash
node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" status
```

Then report, in plain language:

- whether a goal is active, paused, blocked, completed, aborted, or missing
- the objective
- the check commands
- the current iteration and limits
- the `trend` field (`progressing`, `stuck`, `paused`, `blocked`, `completed`, or `aborted`)
- the last check result, including `ok`, exit codes, log path, and when it finished
- if present: `blocked_reason`, `abort_reason`, and a short skim of the recent `progress` trail

If the goal stopped for any reason, say which reason applied and point at the log path and progress trail. If there is no goal state, say so clearly. Do not invent status.
