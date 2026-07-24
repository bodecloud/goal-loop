# Examples and Usage Patterns

This document shows how to use Goal Loop well, not just how to make it run.

The theme across all examples is the same: keep the objective clear, keep the verifier honest, and keep the proof surface aligned with what the user actually asked for.

## Example 1: File Creation Proof

This is the fastest way to prove the loop itself is wired correctly:

```text
/goal Create .cursor/goal/proof.txt --verify "test -f .cursor/goal/proof.txt"
```

Expected behavior:

1. First verifier run fails if the file does not exist.
2. The hook returns a `followup_message`.
3. The agent creates the file.
4. The next verifier run passes.
5. The goal transitions to `completed`.

Why this example matters:

- it tests the command path
- it tests hook execution
- it tests failed-verifier continuation
- it tests successful stop behavior

## Example 2: Build Repair

```text
/goal Fix the app build --verify "npm run build"
```

Use this when:

- the user's real request is "make the project build again"
- build health is the correct completion authority

Do not use this if:

- the bug can ship while the build still passes
- the real issue is runtime behavior not covered by the build

## Example 3: Focused Test Repair

```text
/goal Fix auth regression --verify "npm test -- --testPathPattern=auth"
```

Use this when:

- the failure is localized
- the full test suite is expensive
- the user asked for a bounded defect fix

This is usually a better first verifier than an entire monorepo test suite.

## Example 4: Sequential Verification

```text
/goal Finish the release fix --verify "npm test" --verify "npm run build"
```

Behavior:

- commands run in order
- the first failing command stops the run
- later commands do not execute after a failure

Use this when both conditions are genuinely part of "done".

Do not stack commands merely because they exist. Every added command increases loop cost.

## Example 5: Shared Project Default

If a repository always treats `npm run build` as the minimum release gate:

`.cursor/goal/defaults.json`

```json
{
  "verify": {
    "commands": ["npm run build"]
  }
}
```

Then operators can run:

```text
/goal Fix the docs build
```

That keeps normal usage short while preserving deterministic completion.

## Example 6: Custom Smoke Probe

```text
/goal Fix static export route behavior --verify "scripts/smoke-check.sh"
```

Use this when the real proof surface is not captured by compile or unit-test gates alone.

Good smoke probes:

- return clean exit codes
- print useful failure context
- stay deterministic
- target the exact risk being fixed

## Example 7: Using Goal Loop on Goal Loop

Goal Loop can dogfood itself:

```text
/goal Improve the documentation site --verify "npm run docs:check"
```

This is valid only if `docs:check` actually proves the required surface. If the user asked for content quality, structure, and accuracy, a file-existence check alone is too weak.

That is the general rule: the verifier must match the real ask.

## Anti-Patterns

These are mechanically valid but operationally weak.

### Anti-pattern 1: Verifier too broad

```text
/goal Fix a single typo --verify "npm test"
```

Possible, but wasteful if the typo has nothing to do with the full suite.

### Anti-pattern 2: Verifier too weak

```text
/goal Fix production auth flow --verify "npm run lint"
```

This only makes sense if lint is genuinely the completion authority. Usually it is not.

### Anti-pattern 3: Objective too vague

```text
/goal Make the app better --verify "npm run build"
```

The loop can run, but the scope is underspecified and the verifier proves very little relative to the request.

### Anti-pattern 4: Flaky verifier

```text
/goal Fix deployment reliability --verify "curl https://flaky-service.example.com"
```

If the command fails for reasons unrelated to the code change, the loop becomes noisy and misleading.

## Choosing Between Explicit and Default Verifiers

Use explicit `--verify` when:

- the request is unusual
- the verifier is task-specific
- you want the active goal to document the exact gate for this run

Use `defaults.json` when:

- the repo has a standard baseline gate
- most goals in that repo should use the same verifier

## Reading Examples Correctly

Every example in this file is a pattern, not a shortcut around thought.

Before starting a real goal, ask:

- What exactly is the user asking to be true?
- What command can mechanically prove that?
- Is that command narrow enough to rerun every turn?
- Is it strong enough to prove the real requested outcome?

If those answers are weak, improve the verifier before starting the loop.
