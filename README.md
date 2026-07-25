# Goal Loop

Goal Loop is a small Cursor plugin. It gives your agent a `/goal` command that keeps working until a shell check passes.

The product is intentionally small:

- One main command: `/goal`
- One project-local contract: `.cursor/goal/active.json`
- One stop-hook loop that reruns your check after each finished turn
- One rule that matters: a command exit code decides when the work is done, not the agent's own claim

Use it when you want an agent to keep going until `npm test`, `npm run build`, a smoke script, or another concrete command passes. Do not use it as a broad agent platform, a planning OS, or a marketplace of agent behaviors. That is outside what this project does.

## What it does

Goal Loop turns a normal objective into a bounded loop:

1. `/goal` writes a contract to `.cursor/goal/active.json`.
2. The agent works on that objective.
3. Cursor runs the Goal Loop stop hook after each finished turn.
4. The hook runs your check commands in the shell.
5. If a check fails, the hook returns a `followup_message` with the failure context and log path.
6. If every check passes, the hook marks the goal `completed` and returns `{}`.

That is the whole product.

It does not invent new agent thinking. It does not prove more than your check covers. It does not replace good scoping, good tests, or your own judgment.

## Why it exists

Most agent loops fail in one of two ways:

- The agent stops too early because the work "looks done".
- You have to keep saying "continue" after every failed test or build.

Goal Loop fixes both by moving the "is it done?" decision out of the assistant's narrative and into a shell check that can run on every turn.

That makes it useful for:

- Build repair
- Focused test repair
- Static checks
- Smoke probes
- File existence or output generation proof
- Any other bounded task where a shell command can decide pass or fail

## What it does not do

Goal Loop is not:

- A general autonomous agent platform
- A task graph or multi-agent system
- A deployment system
- A replacement for CI
- A promise of semantic correctness
- A promise that an agent will succeed without a good check

v0.1.0 is deliberately conservative. It solves one problem well: keep an agent iterating until a real check passes, or until the loop stops.

## How to think about it

Treat Goal Loop as a local, inspectable contract between four pieces:

- You: choose the objective and the check
- The commands: write or inspect goal state
- The stop hook: runs the check after each turn
- The agent: does the work, but is not trusted to declare itself done

The contract lives in the project, not in the plugin install directory. That keeps state visible, reviewable, and easy to reuse in other wrappers.

## Runtime layout

Goal Loop stores mutable state in the active project:

```text
.cursor/goal/
├── active.json
├── draft.json
├── defaults.json
├── progress.md
└── runs/
```

- `active.json`: the live goal contract used by the stop hook
- `draft.json`: a planned but not activated goal
- `defaults.json`: shared check defaults that a repo can commit
- `progress.md`: optional human-readable checklist
- `runs/`: check logs and hook error logs

Recommended git treatment:

- Commit `defaults.json` if the repo has a stable shared check
- Ignore `active.json`, `draft.json`, and `runs/`
- Keep `progress.md` optional and project-specific

## Install

### Cursor Marketplace

After marketplace publication:

```text
/add-plugin goal-loop
```

This repository does not prove current marketplace publication state. It documents the intended install path if publication exists.

### Local development install

```bash
git clone https://github.com/bodecloud/goal-loop.git
cd goal-loop
```

For Cursor Agent CLI experiments:

```bash
cursor-agent --plugin-dir "$PWD" --workspace /path/to/your/project
```

For Cursor IDE local development, use Cursor's current local plugin workflow. This repository documents the plugin shape and local CLI loading path directly. It does not independently prove the current IDE-side local-plugin UX.

### Docs site

Install-oriented docs are published to GitHub Pages:

https://bodecloud.github.io/goal-loop/

## Quick start

1. Enable Cursor Agent Auto-run if you want unattended continuation.
2. Optionally define a project default check in `.cursor/goal/defaults.json`:

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

3. Start a goal with an explicit check:

   ```text
   /goal Fix the failing auth tests --verify "npm test -- --testPathPattern=auth"
   ```

4. Let the agent work.
5. After each finished turn, Goal Loop reruns the check.
6. Use `/goal-status` to inspect current state.
7. Use `/goal-abort` to stop the loop early.

## Commands

| Command | Purpose |
| --- | --- |
| `/goal <objective>` | Start an active check-backed goal loop. |
| `/plan [objective]` | Draft objective and check before activation. |
| `/goal-status` | Read the active goal and last check result. |
| `/goal-abort` | Mark the active goal aborted, or remove it with `--remove`. |

## Lifecycle

### `/goal`

The command handler:

- parses the objective
- collects `--verify` commands
- falls back to `.cursor/goal/defaults.json` if no check is passed
- writes `.cursor/goal/active.json`
- tells the agent to load the `cursor-goal` skill

### Agent turn

The agent works on the objective using the active goal contract as its source of truth.

### Stop hook

At the end of a finished turn, Cursor runs:

```bash
node ${CURSOR_PLUGIN_ROOT}/hooks/goal-stop.mjs
```

The hook:

- ignores stop events that are not `completed`
- reads and validates `.cursor/goal/active.json`
- increments `iteration`
- aborts if iteration or wall-clock limits are exceeded
- runs check commands one after another
- writes a run log
- updates `last_verify`
- returns `{}` on success
- returns `{ "followup_message": "..." }` on failure

### Continuation

If Auto-run is enabled, Cursor submits the `followup_message` as the next instruction. Without Auto-run, Goal Loop still checks honestly, but you may need to continue by hand.

## How to choose a check

Goal Loop is only as good as the check you choose.

Good checks are:

- repeatable
- local to the stated objective
- cheap enough to rerun every turn
- strong enough to prove the intended result

Examples:

- `npm run build`
- `npm test -- --testPathPattern=auth`
- `cargo test login_flow`
- `test -f generated/output.json`
- `scripts/smoke-check.sh`

Bad checks are:

- vague promises that cannot fail mechanically
- commands unrelated to the user's actual request
- massive, flaky end-to-end suites for tiny local changes, unless they are truly the right gate
- checks that pass while the real failure surface remains untested

The loop does not fix a weak check. It only reruns it faithfully.

## Safety model

Goal Loop uses multiple guardrails:

- `hooks/hooks.json` sets `loop_limit: 20`
- `active.json` sets `limits.max_iterations`
- `active.json` sets `limits.max_wall_ms`
- each check command has `verify.timeout_ms`
- hook crashes fail open by returning `{}` and writing `hook-errors.log`

That last point is intentional: a broken hook should not trap the agent in a bad loop.

## What Goal Loop does in v0.1.0

In scope:

- check-backed `/goal` loop
- draft and status commands
- project-local JSON contract
- stop hook continuation via `followup_message`
- portable pattern for other agents

Not in scope:

- richer planner workflows
- multiple simultaneous active goals
- semantic diff understanding
- custom UI dashboards
- non-shell check backends
- distributed multi-agent systems

## Documentation map

- [Documentation index](docs/index.md)
- [Cursor setup and operating guide](docs/cursor.md)
- [Goal contract and schema](docs/goal-contract.md)
- [How to design a check](docs/verifier-design.md)
- [Implementation evidence map](docs/evidence-map.md)
- [Examples and usage patterns](docs/examples.md)
- [Operator checklists](docs/operator-checklists.md)
- [Reviewer guide](docs/reviewer-guide.md)
- [Documentation authoring standard](docs/authoring-standard.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Decision guide and FAQ](docs/faq.md)
- [Adoption playbook](docs/adoption-playbook.md)
- [Adapting the pattern to other agents](docs/other-agents.md)

## What this repo proves, and what it doesn't

What this repository directly proves:

- current plugin manifest shape
- current command, hook, and state-file behavior
- current test-covered loop behavior in this repo
- current static documentation site structure and local serving behavior

What it does not directly prove:

- current marketplace publication state
- current Cursor IDE local-plugin UX beyond the repo-documented plugin shape
- that any chosen check is enough for every human request
- exact conformance to any external guide that is not present in this repo

## Development

```bash
npm test
npm run validate
npm run docs:check
npm run verify
```

## License

MIT
