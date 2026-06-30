---
name: goal-status
description: Show the current Goal Loop state and last verifier result.
---

# Goal Loop Status

Run:

```bash
node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" status
```

Summarize:

- Whether a goal is active.
- The objective.
- The current iteration.
- The verifier commands.
- The last verification result and log path, if present.

If no active goal exists, say so plainly.
