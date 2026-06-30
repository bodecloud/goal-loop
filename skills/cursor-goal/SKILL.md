---
name: cursor-goal
description: Work autonomously toward the active Goal Loop objective until deterministic verification passes.
disable-model-invocation: true
---

# Cursor Goal

Use this skill only when invoked by `/goal` or by a Goal Loop stop-hook follow-up.

## Operating Rules

1. Read `.cursor/goal/active.json` at the start of every turn.
2. Treat `objective` as the active goal and `verify.commands` as the completion authority.
3. Do not declare success because the code looks done. The stop hook ends the loop when verification passes.
4. If the hook follow-up points to `last_verify.log_path`, read that log, identify the root cause, and fix it.
5. Avoid repeating a failed approach. If the same verifier error recurs, change tactics or inspect deeper context.
6. Ask the user only for real blockers: missing secrets, unavailable services, destructive actions, or scope contradictions.
7. Keep changes focused on the objective and verifier. Do not expand into unrelated cleanup.
8. If `.cursor/goal/progress.md` exists, update checkboxes that accurately reflect work completed.

## Completion Behavior

When verification passes, the stop hook returns `{}` and no follow-up is sent. In the next human-visible summary, report what changed, what verifier passed, and whether the user should keep or clear `.cursor/goal/active.json`.

## Bolabaden-Site Dogfood Note

For `bolabaden-site`, prefer `npm run build` as the default verifier. Do not rely on `npm run lint` as a release gate unless the repo has migrated away from removed `next lint` behavior.
