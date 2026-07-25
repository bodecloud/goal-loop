---
title: One hook core, thin per-host adapters for multi-CLI plugin packaging
date: 2026-07-25
category: architecture-patterns
module: packaging
problem_type: architecture_pattern
component: tooling
severity: medium
applies_when:
  - Shipping the same plugin to Cursor, Claude Code, Grok, Gemini, and Copilot
  - A host CLI expects a different hook output shape than the one you already implement
  - Writing an installer that must not hang on an interactive prompt
tags: [plugin-packaging, stop-hook, multi-cli, installer, fail-open]
related_components: [hooks, scripts, commands]
---

# One hook core, thin per-host adapters for multi-CLI plugin packaging

## Context

Goal Loop began as a Cursor plugin: one manifest (`.cursor-plugin/plugin.json`), one stop hook (`hooks/goal-stop.mjs`) that returns `{}` to let the agent stop or `{ followup_message }` to make it continue. Shipping the same loop to Claude Code, Grok, Gemini, and Copilot surfaced two problems that look like packaging chores but are really design decisions.

First, the hosts disagree on both discovery and hook protocol. Each wants its own manifest in its own location, and Claude's Stop hook does not understand `followup_message` — it continues an agent by returning `{"decision": "block", "reason": ...}`. Second, a global installer that shells out to five CLIs will eventually hit one that prompts for input, and an installer that hangs mid-run leaves a half-wired system with no clear error.

## Guidance

Keep exactly one implementation of the behavior and translate at the edges.

**Adapters translate, they do not decide.** `hooks/goal-stop-claude.sh` shells into the same `goal-stop.mjs` and maps its one meaningful output to the host's shape. All the loop logic — reading state, running the check, incrementing the iteration — stays in the Node hook:

```bash
RESULT="$(printf '%s' '{"status":"completed"}' | node "${ROOT}/hooks/goal-stop.mjs" 2>/dev/null || echo '{}')"
MSG="$(printf '%s' "${RESULT}" | jq -r '.followup_message // empty' 2>/dev/null || true)"
if [[ -n "${MSG}" ]]; then
  jq -n --arg reason "${MSG}" '{"decision": "block", "reason": $reason}'
fi
```

The payoff is that any new loop outcome that ends the run produces `{}` from the core hook, and the adapter needs no new branch — it already emits nothing when there is no `followup_message`.

**Fail open at every translation point.** The adapter exits 0 when `node` is missing, when `jq` is missing, and when the hook errors. A hook that cannot run should let the agent stop, never trap it in a loop it cannot exit.

**Resolve the plugin root through a fallback chain, not one variable.** Each host exports a different root variable, and a manually linked install exports none, so resolve `CLAUDE_PLUGIN_ROOT` → `GOAL_LOOP_ROOT` → the script's own directory. The installer rewrites all three placeholder forms when it bakes absolute paths into copied command files.

**Install to one stable root, then link.** `scripts/install-global.mjs` copies the plugin tree to `~/.local/share/goal-loop` once and points every host at that path. Hosts get symlinks or generated config rather than five copies that drift.

**Every host install needs a fallback ladder.** Native install first, then a manual link of skills, commands, and agents into the host's own directories. Copilot tries a local path, then two GitHub slugs, then writes prompts and a plugin tree by hand. Gemini skips the CLI entirely when no binary is present and links `~/.gemini/extensions/goal-loop` directly.

**Make every subprocess non-interactive and time-bounded.** The shared `run()` helper sets `CI=1`, `npm_config_yes=true`, `NO_COLOR=1`, and a 45-second default timeout, converting an `ETIMEDOUT` into an ordinary failed result so the ladder can fall through to the next rung:

```js
const result = spawnSync(cmd, args, {
  env: { ...process.env, CI: "1", npm_config_yes: "true", NO_COLOR: "1" },
  timeout: opts.timeout ?? 45000
});
if (result.error?.code === "ETIMEDOUT") {
  return { ok: false, status: null, stdout: result.stdout || "", stderr: "(timeout)" };
}
```

## Why This Matters

Duplicating the loop per host multiplies the surface where the completion contract can drift, and a drifted contract is worse than an unsupported host — the operator believes the check owns completion everywhere when it does not. A translating adapter keeps one place where behavior can change.

The installer rules are what make the packaging usable rather than merely correct. Before timeouts and `CI=1`, `npx @google/gemini-cli` blocked on an interactive prompt and the whole install stalled with no diagnostic. Before the fallback ladder, a host whose plugin subcommand changed name simply ended up uninstalled.

## When to Apply

- Adding a new host CLI: write a manifest and, only if the hook protocol differs, a translating adapter. Never a second copy of the loop.
- Extending hook output: add fields the core hook emits, and check whether existing adapters can ignore them.
- Any installer that shells into third-party CLIs, whether or not this project.

## Examples

Per-host manifests, one implementation behind them:

```
.cursor-plugin/plugin.json     Cursor
.claude-plugin/plugin.json     Claude Code (+ marketplace.json)
.plugin/plugin.json            Copilot
gemini-extension.json          Gemini (+ GEMINI.md)
hooks/goal-stop.mjs            the only loop implementation
hooks/goal-stop-claude.sh      translator for Claude/Grok/Copilot
hooks/hooks-cursor.json        Cursor hook wiring
hooks/hooks-claude.json        Claude hook wiring
```

Fallback ladder, Copilot:

```js
let result = run(copilotBin, ["plugin", "install", INSTALL_ROOT], { timeout: 60000 });
if (!result.ok) result = run(copilotBin, ["plugin", "install", "bodecloud/goal-loop"], { timeout: 60000 });
if (!result.ok) {
  // link the skill, write prompt files, copy the plugin tree by hand
}
```

## Related

- `docs/other-agents.md` — host-by-host setup notes
- `docs/goal-contract.md` — the state file every host reads
- `scripts/validate-plugin.mjs` — asserts every manifest stays in sync
