# Cursor Setup and Operating Guide

This document is the practical guide for running Goal Loop in Cursor. It focuses on how the plugin is wired, what Cursor is expected to do, what the operator must configure, and what behavior is normal when loops fail or stop.

## Preconditions

Goal Loop assumes:

- Cursor with plugin support
- Node.js 18 or newer on `PATH`
- a workspace where the agent can run shell commands

For unattended continuation, it also assumes:

- Cursor Agent Auto-run is enabled

Without Auto-run, Goal Loop still performs verification honestly. The difference is that failed verification may require a human to continue the next turn manually.

## Plugin Layout

Relevant files:

```text
goal-loop/
├── .cursor-plugin/plugin.json
├── commands/
│   ├── goal.md
│   ├── plan.md
│   ├── goal-status.md
│   └── goal-abort.md
├── skills/cursor-goal/
├── agents/goal-verifier.md
├── hooks/hooks.json
├── hooks/goal-stop.mjs
├── scripts/goalctl.mjs
└── templates/
```

The plugin manifest points Cursor at commands, skills, agents, and hooks. The stop hook configured in `hooks/hooks.json` is:

```bash
node ${CURSOR_PLUGIN_ROOT}/hooks/goal-stop.mjs
```

`loop_limit: 20` in that hook config is a Cursor-side safety bound, separate from the goal contract's own iteration limit.

## Local Development Load

For Cursor Agent CLI experiments:

```bash
cursor-agent --plugin-dir "$PWD" --workspace /path/to/your/project
```

That tells Cursor to load the plugin from the repository checkout rather than from a packaged install.

For Cursor IDE local-plugin workflows, treat this repository as authoritative for the plugin shape, but not as proof of current IDE UX details. Those details can change outside this repo.

## Day-One Setup in a Project

The minimum useful setup is:

1. Make sure your project can run the intended verifier from the workspace root.
2. Decide whether the verifier should be per-goal or committed as a project default.
3. Enable Auto-run if you want the loop to continue automatically after failed verification.

If a repo has a stable shared verifier, create `.cursor/goal/defaults.json`:

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

That makes `/goal "Fix build"` valid even without explicit `--verify`.

## What Happens When You Run `/goal`

The `/goal` command handler does not itself execute the loop. It creates the contract that drives the loop.

Operationally:

1. It parses the objective from the command text.
2. It collects every `--verify "<command>"` flag.
3. If no verifier is passed, it loads defaults from `.cursor/goal/defaults.json`.
4. It runs `node scripts/goalctl.mjs start ...`.
5. It tells the agent to load the `cursor-goal` skill.
6. The agent begins the requested work.

The resulting `active.json` becomes the source of truth for subsequent turns.

## Normal Loop Behavior

With Auto-run enabled, the expected happy path is:

1. User runs `/goal`.
2. Agent makes a change and ends its turn.
3. Stop hook runs verification.
4. If the verifier fails, the hook returns a `followup_message`.
5. Cursor submits that message as the next prompt.
6. Agent reads the log, fixes the problem, and ends the turn again.
7. Hook reruns verification.
8. Once the verifier passes, the hook returns `{}` and marks the goal `completed`.

That loop continues until success or until one of the stop conditions is hit.

## Normal Non-Happy-Path Behavior

These cases are expected and documented behavior, not plugin corruption:

### The loop stops after the first failure

Likely cause: Auto-run is disabled.

What to check:

- Cursor Agent Auto-run setting
- whether the hook returned a `followup_message`

### The hook appears to do nothing

Likely causes:

- no `.cursor/goal/active.json`
- active goal status is not `active`
- Cursor emitted a non-completed stop event

`goal-stop.mjs` intentionally returns `{}` in these cases.

### The verifier never runs

Inspect:

- `.cursor/goal/active.json`
- `hooks/hooks.json`
- `last_verify`
- `.cursor/goal/runs/hook-errors.log`

If `active.json` is missing or invalid, the hook cannot enforce the loop.

### The agent says it is done but the loop keeps going

That is normal if the verifier is still failing. Goal Loop explicitly does not trust the agent's own declaration of completion.

### The verifier passes but the loop seems stuck

Expected code behavior is:

- `status` becomes `completed`
- `last_verify.ok` becomes `true`
- hook returns `{}`

If you do not see that state transition, capture:

- the current `active.json`
- the latest run log
- the hook output

Then file an issue.

## Abort Modes

`/goal-abort` has two operator meanings:

- soft abort: keep the final `active.json`, but mark it `aborted`
- remove state: delete `active.json` completely

The default command path is soft abort because it preserves auditability. `--remove` is for operators who explicitly want state erased instead.

## Recommended Repository Conventions

For teams using Goal Loop across multiple repos:

- commit `.cursor/goal/defaults.json` only when the verifier is truly shared
- ignore `.cursor/goal/active.json`, `.cursor/goal/draft.json`, and `.cursor/goal/runs/`
- keep verifier commands close to the user request, not to generic repo hygiene
- prefer one active goal at a time

## Operator Guidance

Goal Loop is strongest when the operator treats it as a bounded execution tool, not as a magical autonomy switch.

Practical guidance:

- Scope the objective tightly.
- Choose the narrowest verifier that still proves the job.
- Do not use Goal Loop when the real completion authority is purely subjective.
- If the same failure repeats, inspect the log instead of merely letting the loop churn.

## Related Docs

- [Goal contract](goal-contract.md)
- [Verifier design](verifier-design.md)
- [Examples](examples.md)
- [Troubleshooting](troubleshooting.md)
