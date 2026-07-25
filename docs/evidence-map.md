# Evidence map

This page maps important documentation claims to the code and tests that back them.

Use it when you want grounding stronger than prose. Goal Loop is small, so its critical behavior should be traceable to the implementation.

## The check decides when the work is done

Supporting implementation:

- [hooks/goal-stop.mjs](../hooks/goal-stop.mjs)
- [skills/cursor-goal/SKILL.md](../skills/cursor-goal/SKILL.md)

Why this supports the claim:

- `goal-stop.mjs` reruns the check commands after completed turns
- on success it marks the goal `completed` and returns `{}`
- on failure it returns `followup_message`
- the skill tells the agent not to declare itself done

Supporting tests:

- [tests/goal-stop.test.mjs](../tests/goal-stop.test.mjs)

Covered behaviors:

- passing check marks goal completed
- failing check returns `followup_message`
- no active goal returns `{}`

## Runtime state lives in the project

Supporting implementation:

- [scripts/goal-lib.mjs](../scripts/goal-lib.mjs)
- [scripts/goalctl.mjs](../scripts/goalctl.mjs)

Why this supports the claim:

- runtime paths are defined under `.cursor/goal/`
- start, draft, status, and abort all operate on those project-local files

Key paths:

- `.cursor/goal/active.json`
- `.cursor/goal/draft.json`
- `.cursor/goal/defaults.json`
- `.cursor/goal/runs/`

Supporting repo convention:

- [.gitignore](../.gitignore)

Why this supports the claim:

- mutable loop state is ignored by default in this repo
- shared defaults are not ignored by default

## Active goals require a check

Supporting implementation:

- [scripts/goal-lib.mjs](../scripts/goal-lib.mjs)

Why this supports the claim:

- `createGoal()` rejects active goals with no explicit or default check commands
- `validateGoal()` rejects active goal state with empty `verify.commands`

Supporting tests:

- [tests/goalctl.test.mjs](../tests/goalctl.test.mjs)

Covered behavior:

- active goal without a check is rejected

## Checks run one after another and stop at the first failure

Supporting implementation:

- [hooks/goal-stop.mjs](../hooks/goal-stop.mjs)

Why this supports the claim:

- `runVerify()` loops through check commands in order
- it breaks immediately when a command result is not `ok`

Documentation implication:

- later check commands do not run once an earlier command fails

## The loop is guarded by iteration, wall-clock, and timeout limits

Supporting implementation:

- [hooks/hooks.json](../hooks/hooks.json)
- [hooks/goal-stop.mjs](../hooks/goal-stop.mjs)
- [scripts/goal-lib.mjs](../scripts/goal-lib.mjs)

Why this supports the claim:

- `hooks/hooks.json` sets Cursor-side `loop_limit: 20`
- `goal-stop.mjs` aborts on `max_iterations` and `max_wall_ms`
- check commands run with per-command timeouts from `verify.timeout_ms`

Supporting tests:

- [tests/goal-stop.test.mjs](../tests/goal-stop.test.mjs)

Covered behavior:

- max-iteration abort path

## Hook errors fail open

Supporting implementation:

- [hooks/goal-stop.mjs](../hooks/goal-stop.mjs)

Why this supports the claim:

- hook exceptions are appended to `.cursor/goal/runs/hook-errors.log`
- the hook still returns `{}`

Supporting tests:

- [tests/goal-stop.test.mjs](../tests/goal-stop.test.mjs)

Covered behavior:

- malformed input writes the hook error log and returns `{}`

## Defaults are optional policy, not required state

Supporting implementation:

- [scripts/goal-lib.mjs](../scripts/goal-lib.mjs)

Why this supports the claim:

- defaults load from `.cursor/goal/defaults.json` if present
- missing defaults fall back to hardcoded values
- explicit flags override defaults

Supporting tests:

- [tests/goalctl.test.mjs](../tests/goalctl.test.mjs)

Covered behavior:

- start uses project defaults when the check is omitted

## Abort has two meanings

Supporting implementation:

- [scripts/goalctl.mjs](../scripts/goalctl.mjs)
- [commands/goal-abort.md](../commands/goal-abort.md)

Why this supports the claim:

- plain `abort` marks the goal `aborted`
- `abort --remove` deletes the active goal file

Supporting tests:

- [tests/goalctl.test.mjs](../tests/goalctl.test.mjs)

Covered behavior:

- abort marks an active goal aborted

## What this repo proves, and what it doesn't

This evidence map proves current implementation behavior inside this repository. It does not prove:

- marketplace publication state
- the current Cursor IDE local-plugin experience beyond the plugin shape in this repo
- that a chosen check is semantically enough for every human request
- exact conformance to any external guide not present in this repo

Those limits matter. The point of this page is traceability, not overclaiming.
