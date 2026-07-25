# Examples and usage patterns

These examples show how to use Goal Loop well, not just how to start it.

In every case: keep the objective clear, pick a check that matches what you actually asked for, and treat that check as the gate that decides when the work is done.

## Example 1: Prove the loop is wired

Fastest way to confirm Goal Loop itself works:

```text
/goal Create .cursor/goal/proof.txt --verify "test -f .cursor/goal/proof.txt"
```

Expected behavior:

1. First check fails if the file is missing.
2. The hook returns a `followup_message`.
3. The agent creates the file.
4. The next check passes.
5. The goal becomes `completed`.

Why this verifier fits: it only asks whether the file exists, which is exactly the job. It also exercises the full path — command, hook, failed continuation, and successful stop.

## Example 2: Fix a broken build

```text
/goal Fix the app build --verify "npm run build"
```

Use this when:

- the real ask is "make the project build again"
- a passing build is enough to call the work done

Do not use this if:

- the bug can ship while the build still passes
- the real issue is runtime behavior the build does not cover

Why this verifier fits: build health is the outcome you care about, so `npm run build` is the right gate.

## Example 3: Fix a focused test failure

```text
/goal Fix auth regression --verify "npm test -- --testPathPattern=auth"
```

Use this when:

- the failure is localized
- the full suite is expensive
- you asked for a bounded defect fix

Why this verifier fits: a focused auth test proves the regression without paying for an entire monorepo suite every turn. Prefer this over the full suite as a first gate.

## Example 4: Run checks in sequence

```text
/goal Finish the release fix --verify "npm test" --verify "npm run build"
```

Behavior:

- commands run one after another
- the first failing command stops the run
- later commands do not run after a failure

Use this when both conditions are truly part of "done".

Do not stack commands just because they exist. Every added command costs another loop turn when it fails.

Why these verifiers fit: release readiness needs both tests and a build, so both must pass before the goal can complete.

## Example 5: Share a project default

If a repository always treats `npm run build` as the minimum release gate:

`.cursor/goal/defaults.json`

```json
{
  "verify": {
    "commands": ["npm run build"]
  }
}
```

Then you can run:

```text
/goal Fix the docs build
```

Why this verifier fits: the repo already agreed that a passing build is the baseline gate, so you can omit `--verify` and still get a repeatable check.

## Example 6: Custom smoke probe

```text
/goal Fix static export route behavior --verify "scripts/smoke-check.sh"
```

Use this when compile or unit tests alone do not prove the real risk.

Good smoke probes:

- return clean exit codes
- print useful failure context
- stay repeatable
- target the exact risk being fixed

Why this verifier fits: route behavior is the ask, so a dedicated smoke script is a stronger gate than a generic build.

## Example 7: Use Goal Loop on Goal Loop

Goal Loop can dogfood itself:

```text
/goal Improve the documentation site --verify "npm run docs:check"
```

This is valid only if `docs:check` actually proves what you asked for. If you wanted content quality, structure, and accuracy, a file-existence check alone is too weak.

General rule: the check must match the real ask.

## Anti-patterns

These commands are valid, but they are weak in practice.

### Anti-pattern 1: Check too broad

```text
/goal Fix a single typo --verify "npm test"
```

Possible, but wasteful if the typo has nothing to do with the full suite.

### Anti-pattern 2: Check too weak

```text
/goal Fix production auth flow --verify "npm run lint"
```

This only makes sense if lint truly decides when the work is done. Usually it does not.

### Anti-pattern 3: Objective too vague

```text
/goal Make the app better --verify "npm run build"
```

The loop can run, but the scope is unclear and the check proves very little relative to the request.

### Anti-pattern 4: Flaky check

```text
/goal Fix deployment reliability --verify "curl https://flaky-service.example.com"
```

If the command fails for reasons unrelated to your code change, the loop becomes noisy and misleading.

## Explicit `--verify` vs defaults

Use explicit `--verify` when:

- the request is unusual
- the check is task-specific
- you want the active goal to document the exact gate for this run

Use `.cursor/goal/defaults.json` when:

- the repo has a standard baseline gate
- most goals in that repo should use the same check

## How to read these examples

Every example here is a pattern, not a shortcut around thought.

Before starting a real goal, ask:

- What exactly must be true when you are done?
- What command can prove that by passing or failing?
- Is that command narrow enough to rerun every turn?
- Is it strong enough to prove the real requested outcome?

If those answers are weak, improve the check before starting the loop.

## Related docs

- [Verifier design](verifier-design.md)
- [Operator checklists](operator-checklists.md)
- [Troubleshooting](troubleshooting.md)
- [FAQ](faq.md)
