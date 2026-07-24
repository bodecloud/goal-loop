# Implementation Evidence Map

This page maps the most important documentation claims to the current code and tests that support them.

It exists for readers who want stronger grounding than explanatory prose alone. Goal Loop is a small product, so its critical behavior should be traceable directly to the implementation.

## Core Product Claim: Completion Authority Lives in the Verifier

Supporting implementation:

- [hooks/goal-stop.mjs](../hooks/goal-stop.mjs)
- [skills/cursor-goal/SKILL.md](../skills/cursor-goal/SKILL.md)

Why this supports the claim:

- `goal-stop.mjs` reruns verifier commands after completed turns
- on success it marks the goal `completed` and returns `{}`
- on failure it returns `followup_message`
- the skill explicitly tells the agent not to self-declare success

Supporting tests:

- [tests/goal-stop.test.mjs](../tests/goal-stop.test.mjs)

Covered behaviors:

- passing verifier marks goal completed
- failing verifier returns `followup_message`
- no active goal returns `{}`

## Core Product Claim: Runtime State Is Project-Local

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

- mutable loop state is ignored by default in the current repo
- shared defaults are not ignored by default

## Core Product Claim: Active Goals Require a Verifier

Supporting implementation:

- [scripts/goal-lib.mjs](../scripts/goal-lib.mjs)

Why this supports the claim:

- `createGoal()` rejects active goals with no explicit or default verifier commands
- `validateGoal()` rejects active goal state with empty `verify.commands`

Supporting tests:

- [tests/goalctl.test.mjs](../tests/goalctl.test.mjs)

Covered behavior:

- active goal without verifier is rejected

## Core Product Claim: Verification Runs Sequentially and Stops on First Failure

Supporting implementation:

- [hooks/goal-stop.mjs](../hooks/goal-stop.mjs)

Why this supports the claim:

- `runVerify()` loops through verifier commands in order
- it breaks immediately when a command result is not `ok`

Documentation implication:

- later verifier commands do not run once an earlier command fails

## Core Product Claim: The Loop Is Guarded by Iteration, Wall-Clock, and Timeout Limits

Supporting implementation:

- [hooks/hooks.json](../hooks/hooks.json)
- [hooks/goal-stop.mjs](../hooks/goal-stop.mjs)
- [scripts/goal-lib.mjs](../scripts/goal-lib.mjs)

Why this supports the claim:

- `hooks/hooks.json` sets Cursor-side `loop_limit: 20`
- `goal-stop.mjs` aborts on `max_iterations` and `max_wall_ms`
- verifier commands are run with per-command timeouts from `verify.timeout_ms`

Supporting tests:

- [tests/goal-stop.test.mjs](../tests/goal-stop.test.mjs)

Covered behavior:

- max-iteration abort path

## Core Product Claim: Hook Errors Fail Open

Supporting implementation:

- [hooks/goal-stop.mjs](../hooks/goal-stop.mjs)

Why this supports the claim:

- hook exceptions are appended to `.cursor/goal/runs/hook-errors.log`
- the hook still returns `{}`

Supporting tests:

- [tests/goal-stop.test.mjs](../tests/goal-stop.test.mjs)

Covered behavior:

- malformed input writes hook error log and returns `{}`

## Core Product Claim: Defaults Are a Policy Surface, Not Required State

Supporting implementation:

- [scripts/goal-lib.mjs](../scripts/goal-lib.mjs)

Why this supports the claim:

- defaults are loaded from `.cursor/goal/defaults.json` if present
- missing defaults fall back to hardcoded values
- explicit flags override defaults

Supporting tests:

- [tests/goalctl.test.mjs](../tests/goalctl.test.mjs)

Covered behavior:

- start uses project defaults when verifier is omitted

## Core Product Claim: Abort Has Two Meanings

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

## What This Page Does Not Prove

This evidence map proves current implementation behavior inside this repository. It does not prove:

- marketplace publication state
- Cursor UI behavior beyond the documented hook contract
- that a chosen verifier is semantically sufficient for every human request
- exact conformance to any missing external guide not present in the current repo context

Those boundaries matter. The point of this page is traceability, not overclaiming.
