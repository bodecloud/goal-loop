---
name: goal-status
description: Show the current Goal Loop state and last verifier result.
---

# Goal Loop Status

Run:

```bash
node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" status
```

## What to Report

Summarize:

- whether an active goal exists
- the current status
- the objective
- the current iteration
- verifier commands
- loop limits
- the last verification result, if present
- the last log path, if present

If no active goal exists, say so plainly and stop there.

## Reporting Style

Status output should help the user understand the current loop state, not merely dump JSON back at them.

If a goal is active, clarify:

- what the loop is trying to achieve
- what command(s) are currently deciding completion
- whether the last run passed or failed
- where the operator can inspect evidence

If a goal is completed or aborted, say that explicitly rather than implying the loop is still live.
