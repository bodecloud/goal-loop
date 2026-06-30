# Goal Loop

Bring Codex-style goal loops to Cursor and other coding agents.

Goal Loop keeps an agent working until your verifier passes. You describe the objective, Goal Loop writes a project-local goal file, and a Cursor stop hook reruns your verification command after each agent turn. If verification fails, the hook sends the agent a focused follow-up with the failure log. If verification passes, the loop stops.

The important detail: the agent is not trusted to self-declare success. Your shell verifier is the authority.

## Why Use It

- Keep long-running agent work moving without manually saying "continue".
- Make completion deterministic with commands like `npm test`, `npm run build`, or a custom smoke test.
- Keep runtime state in the project so every loop is inspectable and abortable.
- Reuse the same goal contract outside Cursor in custom wrappers or other agent environments.

## Install

### Cursor Marketplace

After the plugin is published:

```bash
/add-plugin goal-loop
```

### Local Development Install

Clone the repository and install it through Cursor's local plugin flow:

```bash
git clone https://github.com/bodecloud/goal-loop.git
cd goal-loop
```

For Cursor Agent CLI experiments, load the local plugin directory explicitly:

```bash
cursor-agent --plugin-dir "$PWD" --workspace /path/to/your/project
```

For the Cursor IDE, use Cursor's current local plugin development workflow or install from the marketplace after publication.

## Quickstart

1. Enable Cursor Agent Auto-run.
2. Add a project default verifier:

   ```json
   {
     "verify": {
       "commands": ["npm run build"]
     }
   }
   ```

   Save it at `.cursor/goal/defaults.json`.

3. Start a goal:

   ```text
   /goal Fix the failing auth tests --verify "npm test -- --testPathPattern=auth"
   ```

4. Let Cursor work. After each agent turn, Goal Loop runs the verifier.

5. Check status any time:

   ```text
   /goal-status
   ```

6. Stop early:

   ```text
   /goal-abort
   ```

## How It Works

```text
User starts /goal
  -> command writes .cursor/goal/active.json
  -> agent works on the objective
  -> Cursor stop hook runs verifier commands
  -> verifier passes: hook returns {}
  -> verifier fails: hook returns followup_message with log tail
  -> Cursor Auto-run submits the follow-up
```

Runtime state lives in the project:

```text
.cursor/goal/
├── active.json          # current goal contract, gitignored
├── draft.json           # optional planned goal, gitignored
├── defaults.json        # shared project verifier defaults, safe to commit
├── progress.md          # optional checklist
└── runs/                # verifier logs, gitignored
```

## Commands

| Command | Purpose |
| --- | --- |
| `/goal <objective>` | Start an active verifier-backed goal loop. |
| `/plan [objective]` | Draft the objective and verifier before activating. |
| `/goal-status` | Show active goal state and last verifier result. |
| `/goal-abort` | Stop the active loop. |

## Safety Model

Goal Loop uses two loop limits:

- Cursor hook `loop_limit: 20`
- Goal contract `limits.max_iterations: 20`

It also has a wall-clock limit and per-command timeout. Hook failures fail open by returning `{}` and writing `.cursor/goal/runs/hook-errors.log`, so a broken hook should not trap your agent in a loop.

Verifier commands are shell commands. Treat them like any other command you ask an agent to run. Prefer read-only or deterministic checks: tests, builds, static checks, smoke probes, or file existence checks.

## Use Outside Cursor

Goal Loop is Cursor-first, but the contract is simple:

1. Store an objective and verifier in `.cursor/goal/active.json`.
2. Let the agent work.
3. Run the verifier at the end of each turn.
4. If it fails, feed the log back as the next instruction.
5. If it passes, stop.

See [docs/other-agents.md](docs/other-agents.md) for adaptation notes.

## Documentation

- [Cursor setup](docs/cursor.md)
- [Goal contract](docs/goal-contract.md)
- [Examples](docs/examples.md)
- [Other agents](docs/other-agents.md)

## Development

```bash
npm test
npm run validate
npm run verify
```

## License

MIT
