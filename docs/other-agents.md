# Adapting Goal Loop to Other Agents

Goal Loop is Cursor-first in packaging, but not Cursor-exclusive in concept.

The core idea is portable because the runtime contract is simple: persist goal state, run verification after each completed turn, continue only on verifier failure, and stop on verifier success or loop-stop conditions.

This document explains what is essential to preserve when adapting Goal Loop elsewhere.

## What Must Stay the Same

If you want "Goal Loop behavior" outside Cursor, preserve these invariants:

1. A project-local goal contract exists.
2. The agent works toward `objective`.
3. Verification runs after completed turns.
4. Verification uses deterministic shell commands or an equally mechanical equivalent.
5. Failure produces the next instruction.
6. Success stops the loop.
7. The agent does not get to self-certify completion.

If any of those are removed, you no longer have the same behavioral contract.

## Minimal External Loop

The abstract loop looks like:

```text
read active goal
agent turn runs
turn ends
run verifier
if verifier passes: stop
if verifier fails: send follow-up and continue
if limits exceeded: abort
```

That is all a wrapper needs conceptually.

## Contract Compatibility

The easiest path is to reuse the exact same state files:

```text
.cursor/goal/
├── active.json
├── draft.json
└── runs/
```

You can rename or remap these internally, but compatibility is best if your wrapper can still read and write the same schema.

## Codex

Some Codex environments already have goal primitives. Goal Loop is still useful when you want:

- the same verifier-backed state file shared across tools
- a portable audit trail
- one narrow contract for non-Codex and Codex workflows alike

In that model:

- Codex may own the surrounding lifecycle
- Goal Loop's `objective` and `verify.commands` remain the completion authority

## Claude Code or Similar CLI Agents

A CLI wrapper can implement the same pattern:

```text
agent turn ends
  -> wrapper reads active.json
  -> wrapper runs verifier commands
  -> pass: stop
  -> fail: send follow-up containing the log path and failure tail
```

The important constraint is not the product name of the agent. It is the authority boundary.

If the agent can override the verifier with prose, the adaptation is no longer faithful.

## Direct Reuse of `goal-stop.mjs`

Some wrappers may be able to call `hooks/goal-stop.mjs` directly.

Current expectations:

- the working directory is the project root
- stdin may contain a JSON object
- if stdin contains `{"status":"completed"}`, the hook considers verification
- if stdin contains another status, the hook returns `{}`

Outputs:

- `{}` means stop or no continuation
- `{ "followup_message": "..." }` means continue with that instruction

## Required Operational Features in Another Wrapper

If you are reimplementing instead of directly calling `goal-stop.mjs`, keep these behaviors:

- sequential command execution
- stop on first failed verifier command
- per-command timeout
- persisted run logs
- iteration incrementing
- max iteration abort
- max wall-clock abort
- fail-open strategy for unexpected hook-level exceptions

These details matter. Without them, you may create a superficially similar loop with different failure semantics.

## Honest Non-Goals

Goal Loop does not require every external wrapper to mimic Cursor exactly.

You do not need:

- the exact same plugin packaging
- the same command names
- the same UI flow

You do need:

- the same truth model about completion
- the same stop/continue semantics
- the same inspectable evidence trail

## Integration Checklist

- Read and write the goal contract.
- Preserve iteration and wall-clock limits.
- Store run logs in an inspectable path.
- Feed verifier failure output back to the agent.
- Stop on verifier success.
- Do not let agent prose bypass mechanical completion.

## When Not to Port It

Do not port Goal Loop into another environment if that environment cannot reliably:

- run a post-turn hook or equivalent wrapper step
- run shell verification
- feed deterministic failure output back into the next turn

Without those capabilities, the behavior will drift too far from the current product.
