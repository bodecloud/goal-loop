# Operator checklists

Short runbooks for people who already know what Goal Loop is and need a fast checklist before or during a real run.

## Before you start a goal

- [ ] The objective is specific enough to act on.
- [ ] The objective is narrow enough that a command can prove it.
- [ ] The check matches the real request.
- [ ] The check is repeatable enough to rerun after every turn.
- [ ] Failure output will be useful when it fails.
- [ ] The repo has either a justified shared default or an explicit `--verify`.
- [ ] Cursor Agent Auto-run is on if you want unattended continuation.

If any box is unchecked, fix the setup before starting the loop.

## Writing a healthy objective

A healthy active objective should:

- describe one bounded outcome
- map naturally to a command that passes or fails
- avoid vague "make it better" language
- avoid bundling unrelated cleanup

Good examples:

- `Fix the production build`
- `Repair the auth regression`
- `Generate the missing export manifest`

Bad examples:

- `Make the app better`
- `Clean up this repo`
- `Improve docs quality` without a real check that can prove it

## Reviewing a verifier

Ask:

1. Does this command actually prove the request?
2. Is it too broad for the task?
3. Is it too weak for the task?
4. Is it likely to be flaky?
5. Will the output be actionable if it fails?
6. Is it cheap enough to rerun every turn?

If you cannot defend the check in one or two sentences, it is not ready.

## Defaults vs explicit `--verify`

Use `.cursor/goal/defaults.json` when:

- the repo has a stable baseline gate
- most goals in that repo should inherit the same check

Use explicit `--verify` when:

- the task is narrower than the repo baseline
- the check is task-specific
- multiple commands need to run in a specific order

Do not create a shared default just because it is convenient. Defaults are repo policy, not a shortcut.

## When a loop fails repeatedly

Inspect in this order:

1. `.cursor/goal/active.json`
2. `.cursor/goal/defaults.json` if relevant
3. `.cursor/goal/runs/`
4. `last_verify.log_path`
5. `.cursor/goal/runs/hook-errors.log`

Then ask:

- Is the failure identical each time?
- Is the check too noisy?
- Is the check too weak for the task?
- Is the objective underspecified?
- Is Auto-run disabled?

Do not blindly rerun the same failing loop.

## When a passing check still feels wrong

Ask:

- Did the check actually prove the full request?
- Did it only prove a narrow proxy?
- Was the real proof runtime behavior rather than build health?
- Was the task more subjective than a shell command can capture?

If the check was weak, strengthen the proof model. Do not blame the loop for enforcing the gate you gave it.

## Team adoption review

Before a team treats Goal Loop as normal workflow:

- [ ] Contributors know the check decides when the work is done.
- [ ] Repo defaults exist only when justified.
- [ ] Active objectives stay narrow.
- [ ] Runtime state is ignored in git where appropriate.
- [ ] Someone owns check quality.
- [ ] Contributors know when not to use Goal Loop.

Without those norms, adoption drifts into noisy false confidence.

## When not to use Goal Loop

Do not use it when:

- the task is mostly subjective
- you cannot encode proof as a command that passes or fails
- the check depends heavily on flaky external state
- the real request is broader than any honest local check you currently have

Goal Loop helps when it sharpens execution. It is a poor fit when it only creates false confidence.

## Related docs

- [Examples](examples.md)
- [Reviewer guide](reviewer-guide.md)
- [Troubleshooting](troubleshooting.md)
- [Adoption playbook](adoption-playbook.md)
