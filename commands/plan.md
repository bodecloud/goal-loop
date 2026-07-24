---
name: plan
description: Draft a goal objective and verifier before activating Goal Loop.
---

# Plan a Goal Loop

Use this command when the user needs help shaping scope, success criteria, or verification before activating autonomous continuation.

`/plan` exists to improve loop quality before execution. It does not activate the stop hook and it does not start an active goal.

## What a Good Plan Must Contain

Draft:

- a concise objective
- concrete success criteria
- one or more verifier commands
- important in-scope constraints
- explicit non-goals when needed

The plan should make the future `/goal` contract less ambiguous, not simply restate the user's prompt.

## Required Behavior

1. Translate the user's request into a bounded objective.
2. Choose deterministic verifier commands wherever possible.
3. Prefer shell verification over subjective completion promises.
4. Write the draft with:

   ```bash
   node "${CURSOR_PLUGIN_ROOT}/scripts/goalctl.mjs" draft "<objective>" --verify "<command>"
   ```

5. Present the draft clearly enough that the user can confirm or refine it.
6. Ask the user to confirm before activating with `/goal`.

## Planning Standards

Good plan:

- matches the real user request
- exposes the proof surface explicitly
- notes meaningful boundaries and exclusions
- stays honest about what the verifier can and cannot prove

Weak plan:

- vague objective
- generic verifier that does not prove the ask
- hidden assumptions about scope
- no distinction between required work and optional cleanup

## Activation Boundary

Planning does not activate the stop-hook loop.

Activation happens only through `/goal`. Do not treat a draft as an active goal unless the user explicitly wants to start execution.
