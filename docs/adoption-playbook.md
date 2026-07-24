# Adoption Playbook

This page is for the moment after someone understands Goal Loop conceptually and asks the real operational question:

> "How do we adopt this in an actual repository or across a small team without making the workflow sloppy?"

The short answer is that Goal Loop works best when the repo conventions are explicit and the verifier surface is disciplined.

## Start Small

Do not begin adoption with the broadest possible use case.

Start with one of these:

- build repair
- a focused failing test surface
- a generated-file proof task
- a stable local smoke script

These cases make it easier to validate that:

- the plugin is wired correctly
- the verifier is well chosen
- the team understands what Goal Loop is and is not proving

## Decide the Repository Default Early

Every adopting repo should make an explicit decision about `.cursor/goal/defaults.json`.

There are only two healthy answers:

### Option 1: No shared default

Use this when:

- goals vary widely
- a shared verifier would be misleading
- most tasks need explicit `--verify`

This is often the right choice for heterogeneous repos.

### Option 2: Shared default exists

Use this when:

- the repo has a stable baseline proof surface
- most goals should inherit the same completion gate

Typical shared default:

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

Do not commit a default verifier just because the file exists. Commit it only if the verifier is genuinely representative for normal goals in that repo.

## Establish Git Treatment

The repo should clearly distinguish committed conventions from live runtime state.

Recommended treatment:

- commit `.cursor/goal/defaults.json` when it is truly shared
- ignore `.cursor/goal/active.json`
- ignore `.cursor/goal/draft.json`
- ignore `.cursor/goal/runs/`

Current repo `.gitignore` patterns already reflect that model.

`progress.md` is intentionally not hardcoded into `.gitignore`, because teams may want different treatment for that file.

## Define an Objective Standard

Adoption fails when objectives become vague and the loop is asked to compensate.

Team standard should be:

- one bounded objective per active goal
- wording that maps naturally to a verifier
- no "make it better" style prompts as active loop objectives

Good team examples:

- `Fix the production build`
- `Repair the auth regression`
- `Generate the missing export manifest`

Bad team examples:

- `Clean up the repo`
- `Improve reliability`
- `Make the docs way better`

Those may be legitimate human goals, but they are not healthy active loop contracts until they are narrowed.

## Define a Verifier Standard

The most important adoption rule is not "use Goal Loop often." It is "use verifiers that actually prove the work."

Healthy team rule:

- every active goal must have a verifier that a reviewer can defend

Questions reviewers should ask:

- Does this command actually prove the user's request?
- Is it too broad for this task?
- Is it too weak for this task?
- Is it likely to be flaky?
- Will its output help the next iteration?

If those questions are not being asked, the team is automating weak judgment rather than strong execution.

## Decide Who Owns Verification Quality

Someone must own the quality of the proof surface.

In a solo workflow, that is the operator.
In a team workflow, that is usually:

- the person invoking the goal
- or the reviewer approving the shared verifier convention

If ownership is unclear, the verifier standard degrades quickly.

## Keep the Product Boundary Visible

Teams adopt tools badly when they silently inflate the tool into something larger than it is.

Repeat these truths often:

- Goal Loop is not CI
- Goal Loop is not a planner OS
- Goal Loop is not semantic correctness
- Goal Loop is not a substitute for operator judgment

It is a verifier-backed local execution loop.

That description is smaller than what people often want, but it is also why the tool is easier to trust.

## Recommended Adoption Sequence

1. Install the plugin locally.
2. Validate the loop with a trivial proof task.
3. Try one real build or focused test repair goal.
4. Decide whether the repo deserves a shared default verifier.
5. Document the repo convention for when to use explicit `--verify`.
6. Teach contributors that the verifier is the authority, not the assistant summary.

Do not jump straight to high-flakiness, multi-service, or subjective tasks.

## Failure Signals During Adoption

If adoption is going badly, the symptoms usually look like this:

- repeated goals with vague objectives
- verifier commands chosen for convenience rather than proof
- confusion about why a passing verifier did not satisfy the human request
- frustration that Auto-run behavior depends on Cursor configuration
- goals drifting into broad cleanup work

These are not reasons to abandon the tool automatically. They are signs that the operating model is being applied loosely.

## Healthy Steady State

Adoption is going well when:

- contributors know when Goal Loop is appropriate
- default verifiers are rare but justified
- explicit verifiers are treated as part of task design
- logs are inspected when loops stall
- passing verification is interpreted honestly and narrowly

That is the real success case: not "the loop ran," but "the team used it with good judgment."
