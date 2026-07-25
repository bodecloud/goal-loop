# Reviewer guide

Use this page when you review someone else's Goal Loop usage, not when you are only running a loop yourself.

Core question:

> Does this loop have a clear objective, a defensible check, and an honest claim about what success proves?

If the answer is no, the loop may still run, but the usage is weak.

## What to check first

Inspect:

1. the objective wording
2. the verifier command or commands
3. whether defaults were used or overridden
4. what the check actually proves
5. whether the claimed success matches that proof

Do not review only the agent's prose summary.

## Objective review

Challenge or reject objectives that are:

- vague
- broader than the check can prove
- bundles of unrelated cleanup
- quality aspirations rather than bounded outcomes

Healthy objective:

- one bounded result
- naturally maps to a command that passes or fails
- matches the user's actual ask

Weak objective:

- `Make this better`
- `Clean up the codebase`
- `Improve docs quality` with no mechanical check

## Verifier review

The check is the center of the review.

Ask:

1. Does this check actually prove the request?
2. Is it too broad for the task?
3. Is it too weak for the task?
4. Is it likely to be flaky?
5. Will its output be useful when it fails?
6. Is it reasonable to rerun every turn?

If the check cannot be defended in plain language, ask for a better one.

## Default verifier review

If `.cursor/goal/defaults.json` is involved, ask:

- Is this truly the repo's normal baseline gate?
- Would most reasonable goals in this repo want this default?
- Is the current task narrower than the default and better served by explicit `--verify`?

Defaults are policy, not convenience.

## Reviewing claimed success

When a loop passes, ask:

- What exactly passed?
- What exactly does that prove?
- What does it not prove?

Examples:

- a passing build proves build health, not every runtime path
- a passing focused test proves that focused suite, not all adjacent behavior
- a file-existence check proves existence, not correct contents

The tighter the claim matches the check, the healthier the review.

## Reviewing repeated failure

If a loop failed repeatedly, inspect:

- whether the same failure recurred
- whether the check was too noisy
- whether the objective was underspecified
- whether the person kept rerunning without improving the proof model

Repeated failure is not automatically a Goal Loop bug. It often means weak task shaping.

## Team-level review questions

For team adoption, also ask:

- Are repo defaults justified?
- Are people using Goal Loop for the right class of tasks?
- Is runtime state treated correctly in git?
- Is someone clearly responsible for check quality?
- Are people reading success too broadly?

Weak answers here usually mean the team is drifting toward false confidence.

## Healthy reviewer posture

A good reviewer of Goal Loop usage is neither naive nor hostile.

- [ ] Accept mechanical proof when the check is well chosen.
- [ ] Challenge weak or misaligned checks.
- [ ] Demand honesty about what a pass really means.
- [ ] Distinguish misuse from malfunction.

That standard keeps Goal Loop useful instead of ceremonial.

## Related docs

- [Operator checklists](operator-checklists.md)
- [Examples](examples.md)
- [Evidence map](evidence-map.md)
- [Adoption playbook](adoption-playbook.md)
