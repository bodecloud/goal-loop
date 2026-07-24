# Decision Guide and FAQ

This page answers the questions underneath "should we use Goal Loop?" rather than only "how do we invoke it?"

## What is the core idea?

Goal Loop gives a non-Codex agent a goal-like working mode by placing deterministic verification outside the agent's prose.

That means:

- the user defines an objective
- the system stores it in a project-local contract
- the agent works on that objective
- a verifier decides whether the work is actually done

The idea is mechanical completion, not generic autonomy theater.

## Why is it so small?

Because the important part is the authority model, not the number of commands.

The current release stays narrow on purpose:

- one primary execution command
- one runtime contract
- one post-turn verifier loop
- explicit stop conditions

A broader surface would be easier to overclaim. This design is easier to reason about and easier to audit.

## Why not just trust the agent?

Because agents routinely stop when work looks done but has not been proven done.

Goal Loop assumes:

- prose is not proof
- verification is better than confidence
- repeated mechanical checks are more useful than repeated self-reporting

## Why not just use CI?

CI and Goal Loop solve different moments in the workflow.

- Goal Loop: local per-turn completion control while the agent is still working
- CI: broader repo or deployment assurance after changes are committed or pushed

CI is not a substitute for a good local iteration loop, and Goal Loop is not a substitute for CI.

## When is Goal Loop a good fit?

Use it when:

- the request can be proven by a shell command
- the proof surface is local and deterministic enough to rerun
- the task benefits from verify-fix-verify iteration
- the operator wants inspectable state and logs

Typical good fits:

- build repair
- focused regression repair
- generated-file proof
- bounded smoke-checked fixes

## When is Goal Loop a bad fit?

Avoid it when:

- the task is mostly subjective
- the proof surface is too vague to encode mechanically
- the verifier is dominated by flaky external state
- the operator is unwilling to choose a real completion authority

If the request is qualitative and the verifier is trivial, the loop can still run, but it will be proving the wrong thing.

## Does a passing verifier mean the entire user request is satisfied?

Only if the verifier actually covers the real request.

A passing build proves build health. A passing targeted test proves that targeted test surface. A passing smoke script proves whatever that script truly checks.

Goal Loop enforces the verifier honestly. It cannot compensate for a verifier that is too weak or misaligned.

## Why store state in `.cursor/goal/`?

Because hidden state is harder to inspect, debug, and port.

Project-local state gives:

- inspectability
- auditability
- portability
- easier reproduction of loop behavior

That is why the state is visible by design.

## Why fail open on hook errors?

Because a broken hook should not trap the operator in an unusable loop.

Current behavior:

- write hook errors to `.cursor/goal/runs/hook-errors.log`
- return `{}`

That favors recoverability over rigid hook enforcement.

## Why stop at the first failing verifier command?

Because the first failure is usually the one that matters for the next turn.

Collecting downstream failures after an upstream command already failed often adds noise instead of signal. The current design optimizes for actionable follow-up.

## Why keep `/plan` separate from `/goal`?

Because planning and execution are different commitments.

`/plan` is for shaping scope and proof before activating the loop. `/goal` is for starting a live verifier-backed process.

## Can Goal Loop be used outside Cursor?

Yes, if the other environment can preserve the same behavioral contract:

- persist goal state
- run verification after completed turns
- feed failure output back as the next instruction
- stop on verifier success

The packaging is Cursor-specific. The core loop is not.

## Is this trying to become an agent platform?

Not in the current release.

The product should be read as a precise utility with strong boundaries, not as an expanding orchestration system in disguise.

## What is the single most important operator judgment call?

Choosing the verifier.

If the verifier is weak, flaky, or misaligned, the rest of the loop will faithfully automate the wrong completion model.
