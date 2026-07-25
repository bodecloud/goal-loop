# FAQ

This page answers the question behind the question: not just "how do I run Goal Loop?" but "should I?"

## What is the core idea?

A command that either passes or fails decides when the work is done, not the agent's own claim.

The flow:

- you define an objective
- Goal Loop stores it in a contract file inside your project
- the agent works on the objective
- after each finished turn, a repeatable check runs and decides whether the work is actually done

The point is mechanical completion, not the appearance of autonomy.

## Why is it so small?

Because the important part is who decides completion, not how many commands exist.

v0.1.0 stays narrow on purpose:

- one main command to start a goal
- one runtime contract file
- one check that runs after each turn
- explicit stop conditions

A bigger tool would be easier to overclaim. A small one is easier to reason about and audit.

## Why not just trust the agent?

Because agents often stop when work looks done but has not been proven done.

Goal Loop assumes:

- prose is not proof
- a check that runs is better than a claim of confidence
- rerunning the same check beats repeated self-reporting

## Why not just use CI?

CI and Goal Loop cover different moments.

- Goal Loop checks completion locally, after each turn, while the agent is still working.
- CI checks the whole repo or deployment after you commit or push.

Neither replaces the other.

## When is Goal Loop a good fit?

Use it when a shell command can prove the work is done.

Good conditions:

- the proof is local and repeatable
- the task benefits from a check-fix-check cycle
- you want state and logs you can inspect

Typical good fits: fixing a broken build, fixing a specific failing test, proving a generated file exists, small fixes covered by a smoke script.

## When is Goal Loop a bad fit?

Avoid it when no command can honestly prove the work.

Bad conditions:

- the task is mostly subjective
- the proof is too vague to write as a command
- the check depends on flaky external state
- you are not willing to pick a real check

If the request is qualitative and the check is trivial, the loop will run, but it will prove the wrong thing.

## If the check passes, is my whole request satisfied?

Only if the check actually covers your real request.

A passing build proves the build works. A passing test proves that test. A passing smoke script proves whatever the script checks. Goal Loop enforces the check honestly, but it cannot fix a check that is too weak or aimed at the wrong thing.

## Why does state live in `.cursor/goal/`?

Because hidden state is harder to inspect, debug, and move.

Keeping the files in your project means you can:

- read the contract at any time
- audit what the loop did
- reproduce loop behavior
- carry the state to another tool

## Why does the hook return `{}` when it crashes?

Because a broken hook should not trap you in a loop you cannot exit.

If the hook crashes, it:

- writes the error to `.cursor/goal/runs/hook-errors.log`
- returns `{}`

That favors letting you recover over enforcing the loop at all costs.

## Why stop at the first failing check command?

Because the first failure is usually the one the agent should fix next.

Running the remaining commands after one already failed tends to add noise, not signal. The output of the first failure is the useful follow-up.

## Why are `/plan` and `/goal` separate?

Because planning and starting a live loop are different commitments.

`/plan` shapes the objective and the check before anything runs. `/goal` starts the real loop with the check in charge.

## Can I use Goal Loop outside Cursor?

Yes, if the other environment can copy the same behavior:

- keep the goal state on disk
- run the check after each finished turn
- feed failure output back as the next instruction
- stop when the check passes

The packaging is Cursor-specific. The loop is not. See [Adapting Goal Loop to other agents](other-agents.md).

## Is this going to become an agent platform?

Not in v0.1.0.

Read it as a narrow tool with clear limits, not as a growing platform in disguise.

## What is the single most important call you make?

Choosing the check.

If the check is weak, flaky, or aimed at the wrong thing, the loop will faithfully automate the wrong definition of done.
