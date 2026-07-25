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

- whether a goal is active, completed, aborted, or missing
- the objective
- the check commands
- the current iteration and limits
- the last check result, including `ok`, exit codes, log path, and when it finished

If there is no goal state, say so clearly. Do not invent status.
