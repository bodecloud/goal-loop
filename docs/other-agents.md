# Adapting Goal Loop to other agents

Goal Loop is packaged for Cursor first, but the idea is not Cursor-only.

The core loop is portable: keep goal state, run a check after each finished turn, continue only when that check fails, and stop when it passes or when limits are hit.

This page describes the minimum behavior another agent wrapper must copy.

## What must stay the same

If you want Goal Loop behavior outside Cursor, keep these rules:

1. A project-local goal contract exists.
2. The agent works toward `objective`.
3. The check runs after completed turns.
4. The check uses shell commands, or something equally mechanical.
5. Failure produces the next instruction.
6. Success stops the loop.
7. The agent does not get to declare itself done.

If you drop any of those, you no longer have the same contract.

## Minimal external loop

The abstract loop looks like:

```text
read active goal
agent turn runs
turn ends
run the check
if the check passes: stop
if the check fails: send follow-up and continue
if limits are exceeded: abort
```

That is all a wrapper needs conceptually.

## Contract compatibility

The easiest path is to reuse the same state files:

```text
.cursor/goal/
├── active.json
├── draft.json
└── runs/
```

You can rename or remap these inside your wrapper, but compatibility is best if you still read and write the same schema.

## Codex

Some Codex environments already have goal primitives. Goal Loop is still useful when you want:

- the same check-backed state file shared across tools
- a portable audit trail
- one narrow contract for Codex and non-Codex workflows alike

In that model:

- Codex may own the surrounding lifecycle
- Goal Loop's `objective` and `verify.commands` still decide when the work is done

## Claude Code or similar CLI agents

A CLI wrapper can implement the same pattern:

```text
agent turn ends
  -> wrapper reads active.json
  -> wrapper runs the check commands
  -> pass: stop
  -> fail: send a follow-up with the log path and failure tail
```

The important constraint is not the product name of the agent. It is who decides completion.

If the agent can override the check with prose, the adaptation is no longer faithful.

## Calling `goal-stop.mjs` directly

Some wrappers may be able to call `hooks/goal-stop.mjs` directly.

Current expectations:

- the working directory is the project root
- stdin may contain a JSON object
- if stdin contains `{"status":"completed"}`, the hook considers running the check
- if stdin contains another status, the hook returns `{}`

Outputs:

- `{}` means stop or no continuation
- `{ "followup_message": "..." }` means continue with that instruction

The hook returns `{"followup_message": "..."}` only when an active goal's check actually ran and failed. In all stop cases it returns `{}`. If the hook crashes, it fails open: it returns `{}` and writes `.cursor/goal/runs/hook-errors.log`.

## Required behavior if you reimplement the wrapper

If you reimplement instead of calling `goal-stop.mjs`, keep these behaviors:

- run check commands one after another
- stop at the first failing command
- apply a per-command timeout
- write inspectable run logs
- increment `iteration`
- abort when `max_iterations` is hit
- abort when `max_wall_ms` is hit
- fail open on unexpected wrapper-level exceptions

These details matter. Without them you can build a loop that looks similar but fails differently.

## What Goal Loop does not require from a port

You do not need to copy Cursor's packaging exactly.

You do not need:

- the same plugin packaging
- the same command names
- the same UI flow

You do need:

- the same rule about who decides completion
- the same stop and continue semantics
- the same inspectable evidence trail

## Integration checklist

- Read and write the goal contract.
- Preserve iteration and wall-clock limits.
- Store run logs in a path you can inspect.
- Feed check failure output back to the agent.
- Stop when the check passes.
- Do not let agent prose bypass the mechanical check.

## When not to port it

Do not port Goal Loop into another environment if that environment cannot reliably:

- run a post-turn hook or equivalent wrapper step
- run a shell check
- feed real failure output back into the next turn

Without those capabilities, the behavior will drift too far from the current product.
