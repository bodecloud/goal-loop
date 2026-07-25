---
name: cursor-goal
description: Work toward the active Goal Loop objective until a shell check passes.
disable-model-invocation: true
---

# Cursor Goal

Use this skill only when invoked by `/goal` or by a Goal Loop stop-hook follow-up.

This skill defines how an agent should behave inside a check-backed loop. Its purpose is not general productivity. Its purpose is disciplined iteration under an external check that decides when the work is done.

## Core rule

The active goal contract and its check decide when the task is done.

You do not get to declare success because the code looks correct, the diff seems plausible, or the prose summary sounds complete. The stop hook is in charge because it reruns the check after each finished turn.

## Turn-start procedure

At the start of every turn:

1. Read `.cursor/goal/active.json`.
2. Confirm what the current objective actually is.
3. Read `verify.commands` and treat them as the completion gate.
4. If `last_verify.log_path` is referenced or if a hook follow-up exists, read the corresponding log before changing code.

Do not work from memory when current loop state exists on disk.

## Operating rules

1. Stay aligned to `objective`.
2. Treat `verify.commands` as what decides when the work is done.
3. Keep changes focused on the objective and the configured check.
4. If verification failed, find the root cause before making new speculative edits.
5. Avoid repeating the same failed approach.
6. If the same check error recurs, inspect deeper context or change tactics. After enough identical failures the hook may enter `blocked` — that is an honest stop, not success.
7. Ask the user only for genuine blockers: missing secrets, unavailable services, destructive actions, or scope contradictions.
8. If `.cursor/goal/progress.md` exists, update only checkboxes that are actually complete. The contract also keeps a bounded `progress` array inside `active.json` that `/goal-status` can skim.

## Failure-loop behavior

When the hook sends a `followup_message`, it is not generic noise. It is the concrete evidence trail for the next iteration.

Your job is to:

- read the log path
- identify the primary failure
- fix the root cause rather than a nearby symptom
- end the turn only when the implementation is ready to be checked again

Do not answer the log with a status report alone. The loop expects action.

## Scope discipline

A Goal Loop turn is not permission for unrelated cleanup.

Do not:

- widen the task because adjacent refactors look tempting
- switch to a different check because the configured one is inconvenient
- treat polish work as part of the goal unless it materially supports the check-backed objective

If the check is too weak for the real user ask, say so honestly. Do not silently improvise a different task.

## Completion behavior

When the check passes, the stop hook returns `{}` and no follow-up is sent.

In the next human-visible summary, report:

- what changed
- which check passed
- whether the user should keep or clear `.cursor/goal/active.json`

Do not claim a broader success than the check actually proved.

## Bolabaden-site dogfood note

For `bolabaden-site`, prefer `npm run build` as the default check. Do not rely on `npm run lint` as a release gate unless the repo has migrated away from removed `next lint` behavior.
