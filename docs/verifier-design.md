# Verifier Design

The verifier is the heart of Goal Loop.

The command surface, the hook, the state file, and the loop mechanics are all secondary. If the verifier is weak, misaligned, flaky, or too broad, the loop will faithfully enforce the wrong thing.

This document explains how to choose a verifier that actually matches user intent.

## Core Principle

The verifier should answer one question:

> "Has the requested work actually been completed on the intended proof surface?"

If the verifier cannot answer that, it is the wrong verifier.

## Verifier Quality Checklist

A good Goal Loop verifier is:

- deterministic
- relevant to the user's request
- strong enough to prove the intended result
- narrow enough to rerun frequently
- cheap enough that the loop remains usable
- explicit about failure through non-zero exit status

## Common Verifier Types

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
- clear failing test surfaces
- changes where a focused test truly proves the fix

### Sequential multi-command verifier

```bash
npm test
npm run build
```

Best for:

- tasks where both conditions are required for "done"

Tradeoff:

- each additional command increases runtime and failure surface

### Scripted smoke verifier

```bash
scripts/smoke-check.sh
```

Best for:

- runtime behavior not covered by build or unit tests
- cases where the proof surface needs environment-aware checks

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

- semantic correctness beyond file existence

## Verifier Alignment

The most common mistake is verifier misalignment.

Examples:

- user asks to fix runtime auth flow, verifier only checks lint
- user asks to improve docs quality, verifier only checks that a file exists
- user asks to stop a crash, verifier only checks that the app compiles

These commands may pass, but they do not prove the requested outcome.

Goal Loop is strict about mechanical proof, but it cannot infer the right proof surface for you.

## Narrow vs Broad Gates

Prefer the narrowest verifier that still proves the real request.

Why:

- narrower verifiers rerun faster
- narrower verifiers isolate failure better
- narrower verifiers reduce loop noise

But do not narrow so far that the proof becomes fake.

Examples:

- Good narrow gate: targeted failing test for a bounded bug
- Too narrow gate: checking one file exists when the user asked for correct runtime behavior
- Good broad gate: full build when the user's request is "make the project build"
- Needlessly broad gate: full test suite for a one-line docs typo

## Flakiness

A flaky verifier poisons the loop because the hook cannot distinguish "code still broken" from "environment randomly failed" unless the failure mode is explicit and stable.

Before using a flaky command as a verifier, ask whether you can:

- narrow the surface
- add deterministic local setup
- replace network dependency with a stable mock or local probe
- write a smaller script that returns cleaner failure signals

## Output Quality

The hook sends a tail of verifier output back to the agent. That means verifier output quality matters.

Good verifier output:

- points to the primary failure
- keeps noise manageable
- includes actionable error text

Bad verifier output:

- floods logs with irrelevant setup noise
- hides the real failure in thousands of lines
- produces ambiguous non-zero exits

If the output is noisy, wrap the command in a better script rather than accepting poor feedback.

## Timeouts

Each verifier command is bounded by `verify.timeout_ms`.

Design implication:

- very long-running commands may be a poor fit for per-turn verification
- if long verification is unavoidable, make sure the runtime still matches the intended operator experience

## Defaults vs Per-Goal Commands

Use repo defaults when:

- the repository has a common baseline proof surface
- most goals should inherit the same verifier

Use explicit per-goal commands when:

- the proof surface is task-specific
- the task is narrower than the repo baseline
- the task needs multiple commands in a specific order

## Honest Limits

Even a good verifier can only prove what it checks.

A passing build does not prove deployment behavior.
A passing targeted test does not prove unrelated flows.
A passing smoke script does not prove the whole system.

Goal Loop works best when the operator is honest about that boundary and chooses the verifier accordingly.
