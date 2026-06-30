# Adapting Goal Loop to Other Agents

Goal Loop is Cursor-first, but the pattern is agent-agnostic.

## The Minimal Contract

Any agent environment can provide goal-like behavior if it can do four things:

1. Persist a goal contract.
2. Let the agent work on the objective.
3. Run deterministic verification at the end of an agent turn.
4. Feed verifier failure output back as the next instruction.

The contract file can stay at `.cursor/goal/active.json` for compatibility, or another wrapper can map it to its own state path.

## Codex

Codex has native goal primitives in some environments. Goal Loop is useful when you want the same verifier-backed state file to drive Cursor and Codex workflows. Use the `objective` and `verify.commands` fields as the shared contract, and let Codex own its native goal lifecycle.

## Claude Code

Claude Code users can adapt the same loop with a stop hook or wrapper script:

```text
agent turn ends
  -> wrapper runs verifier from active.json
  -> pass: stop
  -> fail: send "read this log and continue" as the next prompt
```

The important part is preserving the rule that the verifier, not the assistant's prose, decides completion.

## opencode and Custom CLIs

For CLIs with scripting support, run `hooks/goal-stop.mjs` after each agent turn and pass a JSON object on stdin:

```json
{ "status": "completed" }
```

If stdout is `{}`, stop. If stdout contains `followup_message`, submit that text as the next user message.

## Integration Checklist

- Read and write the same `active.json` schema.
- Preserve iteration and wall-clock limits.
- Store logs under `.cursor/goal/runs/` or an equivalent inspectable path.
- Return or submit the verifier log tail to the agent on failure.
- Do not let the agent mark the goal complete without verifier success.
