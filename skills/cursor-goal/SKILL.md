---
name: cursor-goal
description: Work autonomously toward the active Goal Loop objective until deterministic verification passes.
disable-model-invocation: true
---

# Cursor Goal

Use this skill only when invoked by `/goal` or by a Goal Loop stop-hook follow-up.

This skill defines how an agent should behave inside a verifier-backed loop. Its purpose is not general productivity. Its purpose is disciplined iteration under an external completion authority.

## Core Rule

The active goal contract and its verifier decide when the task is done.

You do not get to declare success because the code looks correct, the diff seems plausible, or the prose summary sounds complete. The stop hook is the authority because it reruns the verifier after each completed turn.

## Turn-Start Procedure

At the start of every turn:

1. Read `.cursor/goal/active.json`.
2. Validate what the current objective actually is.
3. Read `verify.commands` and treat them as the completion gate.
4. If `last_verify.log_path` is referenced or if a hook follow-up exists, read the corresponding log before changing code.

Do not work from memory when current loop state exists on disk.

## Operating Rules

1. Stay aligned to `objective`.
2. Treat `verify.commands` as the completion authority.
3. Keep changes focused on the objective and verifier surface.
4. If verification failed, find the root cause before making new speculative edits.
5. Avoid repeating the same failed approach.
6. If the same verifier error recurs, inspect deeper context or change tactics.
7. Ask the user only for genuine blockers: missing secrets, unavailable services, destructive actions, or scope contradictions.
8. If `.cursor/goal/progress.md` exists, update only checkboxes that are actually complete.

## Failure-Loop Behavior

When the hook sends a `followup_message`, it is not generic noise. It is the concrete evidence trail for the next iteration.

Your job is to:

- read the log path
- identify the primary failure
- fix the root cause rather than a nearby symptom
- end the turn only when the implementation is ready to be verified again

Do not answer the log with a status report alone. The loop expects action.

## Scope Discipline

A Goal Loop turn is not permission for unrelated cleanup.

Do not:

- widen the task because adjacent refactors look tempting
- switch to a different proof surface because the configured verifier is inconvenient
- treat polish work as part of the goal unless it materially supports the verifier-backed objective

If the verifier is too weak for the real user ask, that is a planning or operator issue to surface honestly, not a reason to silently improvise a different task.

## Completion Behavior

When verification passes, the stop hook returns `{}` and no follow-up is sent.

In the next human-visible summary, report:

- what changed
- which verifier passed
- whether the user should keep or clear `.cursor/goal/active.json`

Do not claim a broader success than the verifier actually proved.

## Bolabaden-Site Dogfood Note

For `bolabaden-site`, prefer `npm run build` as the default verifier. Do not rely on `npm run lint` as a release gate unless the repo has migrated away from removed `next lint` behavior.
