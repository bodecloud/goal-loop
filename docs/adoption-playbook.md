# Adoption playbook

This page is for the moment after you understand Goal Loop and ask:

> How do we adopt this in a real repo, or across a small team, without making the workflow sloppy?

Short answer: start small, pick honest checks, and keep repo conventions explicit.

## Start with one narrow task

Do not begin with the broadest possible use case.

Start with one of these:

- fixing a broken build
- a focused failing test
- proving a generated file exists
- a stable local smoke script

These make it easier to confirm that:

- the plugin is wired correctly
- the check is well chosen
- the team understands what Goal Loop proves, and what it does not

## Decide the repo default early

Every adopting repo should decide what to do with `.cursor/goal/defaults.json`.

There are two healthy answers.

### Option 1: no shared default

Use this when:

- goals vary widely
- a shared check would mislead people
- most tasks need an explicit `--verify`

This is often right for mixed repos.

### Option 2: a shared default exists

Use this when:

- the repo has a stable baseline check
- most goals should inherit the same completion gate

A typical shared default:

```json
{
  "verify": {
    "commands": ["npm run build"],
    "cwd": ".",
    "timeout_ms": 600000
  },
  "limits": {
    "max_iterations": 20,
    "max_wall_ms": 7200000
  }
}
```

Do not commit a default just because the file can exist. Commit it only if the check is genuinely right for normal goals in that repo.

## Decide what to commit and what to ignore

Separate shared conventions from live runtime state.

Recommended treatment:

- commit `.cursor/goal/defaults.json` when it is truly shared
- ignore `.cursor/goal/active.json`
- ignore `.cursor/goal/draft.json`
- ignore `.cursor/goal/runs/`

This repo's `.gitignore` already follows that model.

`progress.md` is intentionally not hardcoded into `.gitignore`, because teams may want different treatment for that file.

## Set a standard for objectives

Adoption fails when objectives stay vague and the loop is asked to fill the gaps.

Team rules:

- one bounded objective per active goal
- wording that maps naturally to a check
- no "make it better" prompts as active loop objectives

Good examples:

- `Fix the production build`
- `Repair the auth regression`
- `Generate the missing export manifest`

Bad examples:

- `Clean up the repo`
- `Improve reliability`
- `Make the docs way better`

Those can be real human goals, but they are not healthy active contracts until you narrow them.

## Set a standard for the check

The most important adoption rule is not "use Goal Loop often." It is "use checks that actually prove the work."

Healthy team rule: every active goal must have a check that a reviewer can defend.

Reviewers should ask:

- Does this command prove the user's request?
- Is it too broad for this task?
- Is it too weak for this task?
- Is it likely to be flaky?
- Will its output help the next turn?

If nobody asks those questions, the team is automating weak judgment.

## Decide who owns check quality

Someone must own the quality of the proof.

In a solo workflow, that is you.
In a team workflow, that is usually:

- the person who starts the goal
- or the reviewer who approves the shared default

If ownership is unclear, the standard decays quickly.

## Keep what Goal Loop does not do visible

Teams adopt tools badly when they quietly inflate them.

Repeat these truths:

- Goal Loop is not CI
- Goal Loop is not a planner OS
- Goal Loop is not proof of semantic correctness
- Goal Loop is not a substitute for your judgment

It is a local execution loop backed by a command that either passes or fails.

That description is smaller than what people often want. It is also why the tool is easier to trust.

## Recommended adoption sequence

1. Install the plugin locally.
2. Validate the loop with a trivial proof task.
3. Try one real build or focused test repair goal.
4. Decide whether the repo deserves a shared default check.
5. Document when contributors should pass an explicit `--verify`.
6. Teach contributors that the check decides when the work is done, not the assistant summary.

Do not jump straight to flaky, multi-service, or subjective tasks.

## Signs adoption is going badly

Watch for these symptoms:

- repeated goals with vague objectives
- check commands chosen for convenience rather than proof
- confusion about why a passing check did not satisfy the human request
- frustration that Auto-run behavior depends on Cursor configuration
- goals drifting into broad cleanup work

These are not automatic reasons to abandon the tool. They are signs the operating model is being applied loosely.

## What healthy steady state looks like

Adoption is going well when:

- contributors know when Goal Loop is appropriate
- default checks are rare but justified
- explicit checks are treated as part of task design
- people inspect logs when loops stall
- a passing check is read honestly and narrowly

The real success case is not "the loop ran." It is "the team used it with good judgment."
