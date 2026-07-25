# Verifier design

The verifier — a command that either passes or fails — is the heart of Goal Loop.

The commands, the hook, the state file, and the loop mechanics are all secondary. If the check is weak, misaligned, flaky, or too broad, the loop will faithfully enforce the wrong thing.

This document explains how to choose a check that matches what you asked for.

## Core principle

The check should answer one question:

> "Has the requested work actually been completed in the place that proves it?"

If the check cannot answer that, it is the wrong check.

## Verifier quality checklist

A good Goal Loop check is:

- a repeatable check
- relevant to your request
- strong enough to prove the intended result
- narrow enough to rerun often
- cheap enough that the loop stays usable
- explicit about failure through a non-zero exit status

## Common verifier types

### Build verifier

```bash
npm run build
```

Best for:

- build breakages
- type or compile regressions
- packaging or static export integrity

Weak for:

- runtime bugs not expressed in the build

### Targeted test verifier

```bash
npm test -- --testPathPattern=auth
```

Best for:

- bounded regressions
- clear failing tests
- changes where a focused test truly proves the fix

### Sequential multi-command verifier

```bash
npm test
npm run build
```

Best for:

- tasks where both conditions are required for "done"

Tradeoff:

- each extra command increases runtime and ways to fail

### Scripted smoke verifier

```bash
scripts/smoke-check.sh
```

Best for:

- runtime behavior not covered by build or unit tests
- cases where the proof needs environment-aware checks

Requirements:

- stable exit codes
- stable setup
- readable output

### Existence or output verifier

```bash
test -f generated/report.json
```

Best for:

- file generation tasks
- simple proof-of-effect loops
- bootstrapping or dogfooding

Weak for:

- correctness beyond "the file exists"

## Verifier alignment

The most common mistake is a check that does not match the request.

Examples:

- you ask to fix a runtime auth flow, the check only runs lint
- you ask to improve docs quality, the check only proves a file exists
- you ask to stop a crash, the check only proves the app compiles

These commands may pass, but they do not prove the requested outcome.

Goal Loop is strict about mechanical proof. It cannot invent the right check for you.

## Narrow vs broad gates

Prefer the narrowest check that still proves the real request.

Why:

- narrower checks rerun faster
- narrower checks isolate failure better
- narrower checks reduce loop noise

But do not narrow so far that the proof becomes fake.

Examples:

- Good narrow gate: targeted failing test for a bounded bug
- Too narrow gate: checking one file exists when you asked for correct runtime behavior
- Good broad gate: full build when the request is "make the project build"
- Needlessly broad gate: full test suite for a one-line docs typo

## Flakiness

A flaky check poisons the loop. The hook cannot tell "code still broken" from "environment randomly failed" unless the failure mode is explicit and stable.

Before using a flaky command as a check, ask whether you can:

- narrow what it covers
- add a stable local setup
- replace a network dependency with a stable mock or local probe
- write a smaller script that returns cleaner failure signals

## Output quality

The hook sends a tail of check output back to the agent. So output quality matters.

Good check output:

- points to the primary failure
- keeps noise manageable
- includes actionable error text

Bad check output:

- floods logs with irrelevant setup noise
- hides the real failure in thousands of lines
- produces ambiguous non-zero exits

If the output is noisy, wrap the command in a better script instead of accepting poor feedback.

## Timeouts

Each command is bounded by `verify.timeout_ms`.

Design implication:

- very long-running commands may be a poor fit for per-turn checks
- if a long check is unavoidable, make sure the runtime still matches the experience you want

## Defaults vs per-goal commands

Use repo defaults when:

- the repository has a common baseline check
- most goals should inherit the same check

Use explicit per-goal commands when:

- the proof is task-specific
- the task is narrower than the repo baseline
- the task needs multiple commands in a specific order

## Honest limits

Even a good check can only prove what it checks.

A passing build does not prove deployment behavior.
A passing targeted test does not prove unrelated flows.
A passing smoke script does not prove the whole system.

A weak check gives you weak autonomy. Goal Loop works best when you are honest about that boundary and choose the check accordingly.
