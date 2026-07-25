---
name: plan
description: Draft a goal objective and check before activating Goal Loop.
---

# Plan a Goal Loop

Use this command when the user needs help shaping scope, success criteria, or the check before activating the loop.

This command drafts. It does not start the loop. Activation happens later with `/goal`.

## Required behavior

1. Understand the user's objective.
2. Propose a bounded objective that a shell check can prove.
3. Propose one or more concrete check commands.
4. Write the draft with:

   ```bash
   node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" draft "<objective>" --verify "<command>"
   ```

5. Show the user the drafted objective and check.
6. Tell the user how to activate with `/goal` once they accept the draft.

## Draft quality rules

A good draft has:

- a specific objective
- a check that matches that objective
- limits that fit the expected work

Prefer a narrow, honest draft over a broad, hard-to-prove one.

## What not to do

Do not:

- activate the goal yourself
- invent a check that cannot fail
- expand the request into unrelated work
- treat the draft as proof that the work is done
