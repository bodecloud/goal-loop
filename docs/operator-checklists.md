# Operator Checklists

This page is the compact runbook version of the documentation set.

Use it when you already understand Goal Loop conceptually and need a fast, repeatable checklist for real operation rather than a long explanation.

## Checklist 1: Before Starting a Goal

Confirm all of these:

- The objective is specific enough to act on.
- The objective is narrow enough that a verifier can actually prove it.
- The verifier matches the user's real request.
- The verifier is deterministic enough to rerun after every turn.
- The verifier output will be useful if it fails.
- The repo has either a justified shared default or an explicit `--verify`.
- Cursor Agent Auto-run is enabled if unattended continuation is desired.

If any of those are false, improve the setup before starting the loop.

## Checklist 2: Writing a Healthy Objective

A healthy active objective should:

- describe one bounded outcome
- map naturally to a proof surface
- avoid vague improvement language
- avoid bundling unrelated cleanup

Good examples:

- `Fix the production build`
- `Repair the auth regression`
- `Generate the missing export manifest`

Bad examples:

- `Make the app better`
- `Clean up this repo`
- `Improve docs quality` without a real proof surface

## Checklist 3: Reviewing a Verifier

Ask these questions:

1. Does this command actually prove the request?
2. Is it too broad for the task?
3. Is it too weak for the task?
4. Is it likely to be flaky?
5. Will the output be actionable if it fails?
6. Is it cheap enough to rerun every turn?

If you cannot defend the verifier in one or two sentences, it is probably not ready.

## Checklist 4: Deciding Between Defaults and Explicit `--verify`

Use `.cursor/goal/defaults.json` when:

- the repo has a stable baseline proof surface
- most goals in that repo should inherit the same verifier

Use explicit `--verify` when:

- the task is narrower than the repo baseline
- the proof surface is task-specific
- multiple commands need to run in a specific order

Do not create a shared default merely because it is convenient. Defaults are repo policy, not a shortcut.

## Checklist 5: When a Loop Fails Repeatedly

Inspect in this order:

1. `.cursor/goal/active.json`
2. `.cursor/goal/defaults.json` if relevant
3. `.cursor/goal/runs/`
4. `last_verify.log_path`
5. `.cursor/goal/runs/hook-errors.log`

Then ask:

- Is the failure identical each time?
- Is the verifier too noisy?
- Is the verifier too weak for the task?
- Is the objective underspecified?
- Is Auto-run disabled?

Do not just rerun the same failing loop blindly.

## Checklist 6: When a Passing Verifier Still Feels Wrong

Ask:

- Did the verifier actually prove the full request?
- Did it only prove a narrow proxy?
- Was the real proof surface runtime behavior rather than build health?
- Was the task more subjective than the verifier could capture?

If the answer exposes verifier weakness, fix the proof model rather than blaming the loop for enforcing it faithfully.

## Checklist 7: Team Adoption Review

Before a team treats Goal Loop as normal workflow, confirm:

- contributors know the verifier is the completion authority
- repo defaults exist only when justified
- active objectives are kept narrow
- runtime state is ignored in git where appropriate
- someone owns verifier quality
- contributors know when not to use Goal Loop

If those norms are absent, adoption will drift into noisy pseudo-autonomy.

## Checklist 8: When Not to Use Goal Loop

Do not use it when:

- the task is mostly subjective
- the proof surface cannot be encoded mechanically
- the verifier depends heavily on flaky external state
- the real request is broader than any honest local verifier you currently have

Goal Loop is valuable when it sharpens execution. It is a poor fit when it only creates false confidence.
