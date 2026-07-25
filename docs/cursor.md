# Cursor setup and operating guide

This guide shows how to run Goal Loop in Cursor: how the plugin is wired, what you need to configure, and what normal success and failure look like.

## What you need first

Goal Loop assumes:

- Cursor with plugin support
- Node.js 18 or newer on `PATH`
- a workspace where the agent can run shell commands

For unattended continuation, it also assumes:

- Cursor Agent Auto-run is enabled

Without Auto-run, Goal Loop still runs the check honestly. The difference is that a failed check may need you to start the next turn by hand.

## Plugin layout

Relevant files:

```text
goal-loop/
├── .cursor-plugin/plugin.json
├── commands/
│   ├── goal.md
│   ├── plan.md
│   ├── goal-status.md
│   ├── goal-pause.md
│   ├── goal-resume.md
│   └── goal-abort.md
├── skills/cursor-goal/
├── agents/goal-verifier.md
├── hooks/hooks.json
├── hooks/goal-stop.mjs
├── scripts/goalctl.mjs
└── templates/
```

The plugin manifest points Cursor at commands, skills, agents, and hooks. The stop hook in `hooks/hooks.json` is:

```bash
node ${CURSOR_PLUGIN_ROOT}/hooks/goal-stop.mjs
```

`loop_limit: 20` in that hook config is a Cursor-side safety bound. It is separate from the goal contract's own iteration limit.

## Local development load

For Cursor Agent CLI experiments:

```bash
cursor-agent --plugin-dir "$PWD" --workspace /path/to/your/project
```

That loads the plugin from this checkout instead of a packaged install.

For Cursor IDE local-plugin workflows, treat this repository as the source of truth for plugin shape. It does not prove current IDE UX details. Those can change outside this repo.

## Day-one setup in a project

The minimum useful setup is:

1. Make sure your project can run the intended check from the workspace root.
2. Decide whether the check should be per-goal or committed as a project default.
3. Enable Auto-run if you want the loop to continue on its own after a failed check.

If a repo has a stable shared check, create `.cursor/goal/defaults.json`:

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

## What happens when you run `/goal`

The `/goal` command does not run the loop itself. It creates the contract that drives the loop.

What it does:

1. It parses the objective from the command text.
2. It collects every `--verify "<command>"` flag.
3. If no check is passed, it loads defaults from `.cursor/goal/defaults.json`.
4. It runs `node scripts/goalctl.mjs start ...`.
5. It tells the agent to load the `cursor-goal` skill.
6. The agent begins the requested work.

The resulting `active.json` is the source of truth for later turns.

## Normal loop behavior

With Auto-run enabled, the happy path is:

1. You run `/goal`.
2. The agent makes a change and ends its turn.
3. The stop hook runs the check.
4. If the check fails, the hook returns a `followup_message`.
5. Cursor submits that message as the next prompt.
6. The agent reads the log, fixes the problem, and ends the turn again.
7. The hook runs the check again.
8. Once the check passes, the hook returns `{}` and marks the goal `completed`.

That continues until success or until a stop condition is hit.

## Normal non-happy-path behavior

These cases are expected. They are not plugin corruption.

### The loop stops after the first failure

Likely cause: Auto-run is disabled.

What to check:

- Cursor Agent Auto-run setting
- whether the hook returned a `followup_message`

### The hook appears to do nothing

Likely causes:

- no `.cursor/goal/active.json`
- active goal status is not `active`
- Cursor emitted a stop event that is not `completed`

`goal-stop.mjs` intentionally returns `{}` in these cases.

### The check never runs

Inspect:

- `.cursor/goal/active.json`
- `hooks/hooks.json`
- `last_verify`
- `.cursor/goal/runs/hook-errors.log`

If `active.json` is missing or invalid, the hook cannot enforce the loop.

### The agent says it is done but the loop keeps going

That is normal if the check is still failing. Goal Loop does not trust the agent to declare itself done.

### The check passes but the loop seems stuck

Expected behavior is:

- `status` becomes `completed`
- `last_verify.ok` becomes `true`
- hook returns `{}`

If you do not see that state change, capture:

- the current `active.json`
- the latest run log
- the hook output

Then file an issue.

## Abort, pause, and blocked

`/goal-abort` has two meanings:

- soft abort: keep the final `active.json`, but mark it `aborted`
- remove state: delete `active.json` completely

The default is soft abort because it keeps an audit trail. Use `--remove` when you want the state erased.

`/goal-pause` keeps the goal and its progress but stops the hook from running the check or continuing the agent. `/goal-resume` returns a paused or blocked goal to `active` without resetting iteration or limits.

When the same check failure repeats across consecutive iterations (default 3), the hook enters `blocked`. That is an honest stop — the objective was not met — and is resumable after you intervene.

## Recommended repository conventions

For teams using Goal Loop across multiple repos:

- commit `.cursor/goal/defaults.json` only when the check is truly shared
- ignore `.cursor/goal/active.json`, `.cursor/goal/draft.json`, and `.cursor/goal/runs/`
- keep check commands close to the user request, not to generic repo hygiene
- prefer one active goal at a time

## Practical guidance

Treat Goal Loop as a bounded execution tool, not as a magic autonomy switch. Auto-run is what makes continuation unattended. A weak check gives you weak autonomy.

Practical guidance:

- Scope the objective tightly.
- Choose the narrowest check that still proves the job.
- Do not use Goal Loop when "done" is purely subjective.
- If the same failure repeats, read the log instead of letting the loop churn. After enough identical failures the loop will enter `blocked` on its own.

## Related docs

- [Goal contract](goal-contract.md)
- [Verifier design](verifier-design.md)
- [Examples](examples.md)
- [Troubleshooting](troubleshooting.md)
