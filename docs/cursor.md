# Cursor Setup

Goal Loop ships as a Cursor plugin with commands, a skill, an optional verifier agent, and a stop hook.

## Requirements

- Cursor with plugin support.
- Node.js 18 or newer available on `PATH`.
- Cursor Agent Auto-run enabled for unattended continuation.

## Plugin Structure

```text
goal-loop/
├── .cursor-plugin/plugin.json
├── commands/
├── skills/
├── agents/
├── hooks/hooks.json
├── hooks/goal-stop.mjs
├── scripts/goalctl.mjs
└── templates/
```

Cursor loads `hooks/hooks.json` from the manifest. The stop hook runs:

```bash
node ${CURSOR_PLUGIN_ROOT}/hooks/goal-stop.mjs
```

For Cursor Agent CLI development, load this repository as a local plugin:

```bash
cursor-agent --plugin-dir "$PWD" --workspace /path/to/your/project
```

## Auto-run

Goal Loop can return a `followup_message` from the stop hook. Cursor submits that follow-up as the next user message when Auto-run is enabled. Without Auto-run, you still get deterministic verification, but you may need to continue manually.

## Project Defaults

Commit `.cursor/goal/defaults.json` when a repository has a standard verifier:

```json
{
  "verify": {
    "commands": ["npm run build"],
    "cwd": ".",
    "timeout_ms": 600000
  }
}
```

## Command Reference

### `/goal`

Starts `.cursor/goal/active.json` and tells the agent to load the `cursor-goal` skill.

Example:

```text
/goal Make the docs build cleanly --verify "npm run build"
```

### `/plan`

Writes `.cursor/goal/draft.json` and asks for confirmation before activation.

### `/goal-status`

Reads `.cursor/goal/active.json` and summarizes the current objective, iteration, verifier, and latest log path.

### `/goal-abort`

Marks the current goal `aborted` so the stop hook stops looping.

## Troubleshooting

### The agent stops after one failure

Check whether Cursor Agent Auto-run is enabled.

### The hook does nothing

Run `/goal-status`. If no active goal exists, start one with `/goal`. If the goal is `draft`, `completed`, or `aborted`, the hook returns `{}`.

### The hook crashes

Goal Loop writes hook errors to `.cursor/goal/runs/hook-errors.log` and returns `{}`.

### The verifier passes but the agent keeps going

Inspect `.cursor/goal/active.json`. A passing verifier should set `status` to `completed`. If the file remains active, report the hook log and active goal JSON in a GitHub issue.
