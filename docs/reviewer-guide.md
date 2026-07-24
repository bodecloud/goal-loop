# Reviewer Guide

This page is for reviewers evaluating Goal Loop usage, not just operators invoking it.

The core reviewer question is:

> "Does this loop have a defensible objective, a defensible verifier, and an honest claim about what success proves?"

If the answer is no, the loop may still run mechanically, but it is not high-quality usage.

## What a Reviewer Should Check First

Inspect:

1. the objective wording
2. the verifier command or commands
3. whether defaults were used or overridden
4. what the verifier actually proves
5. whether the claimed success matches that proof surface

Reviewing the resulting prose summary alone is not enough.

## Objective Review

A reviewer should reject or challenge objectives that are:

- vague
- broader than the verifier can prove
- bundles of unrelated cleanup
- framed as quality aspirations rather than bounded outcomes

Healthy objective:

- one bounded result
- naturally mappable to verification
- aligned with the user's actual ask

Weak objective:

- `Make this better`
- `Clean up the codebase`
- `Improve docs quality` with no mechanical proof surface

## Verifier Review

The verifier is the center of review.

Ask:

1. Does this verifier actually prove the request?
2. Is it too broad for the task?
3. Is it too weak for the task?
4. Is it likely to be flaky?
5. Will its output be useful when it fails?
6. Is it reasonable to rerun every turn?

If a verifier cannot be defended in plain language, it should be reconsidered.

## Default Verifier Review

If `.cursor/goal/defaults.json` is involved, ask:

- Is this truly the repo’s normal baseline proof surface?
- Would most reasonable goals in this repo want this default?
- Is the current task narrower than the default and better served by explicit `--verify`?

Defaults are policy, not convenience.

## Reviewing Claimed Success

When a loop passes, reviewers should ask:

- what exactly passed?
- what exactly does that prove?
- what does it not prove?

Examples:

- passing build proves build health, not every runtime path
- passing focused test proves that focused test surface, not all adjacent behavior
- passing file-existence check proves existence, not semantic correctness

The tighter the claim matches the verifier, the healthier the review posture.

## Reviewing Repeated Failure

If a loop failed repeatedly, reviewers should inspect:

- whether the same failure recurred
- whether the verifier was too noisy
- whether the objective was underspecified
- whether the operator kept rerunning without improving the proof model

Repeated failure is not automatically a tool problem. It may indicate weak task shaping.

## Team-Level Review Questions

For team adoption, reviewers should also ask:

- Are repo defaults justified?
- Are contributors using Goal Loop for the right class of tasks?
- Is runtime state treated correctly in git?
- Is someone clearly responsible for verifier quality?
- Are people interpreting success too broadly?

If those answers are weak, the team is likely drifting toward false confidence.

## Healthy Reviewer Position

A good reviewer of Goal Loop usage is neither naive nor hostile.

They should:

- accept mechanical proof when the proof surface is well chosen
- challenge weak or misaligned verifiers
- demand honesty about what passed results really mean
- distinguish tool misuse from tool malfunction

That is the standard that keeps Goal Loop useful instead of ceremonial.
