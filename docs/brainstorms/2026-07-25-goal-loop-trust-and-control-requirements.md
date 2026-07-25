---
date: 2026-07-25
topic: goal-loop-trust-and-control
---

# Goal Loop — trust and control improvements

## Summary

Add the human-steering layer that lets you leave a Goal Loop running without babysitting it: pause and resume a goal, stop honestly when the agent is stuck instead of burning turns, surface a progress trail you can trust, and warn at start time when the chosen check is too weak to prove the objective. The shell check stays the thing that decides when the work is done.

## Problem Frame

Goal Loop v0.1.0 already does the hard part: a shell check, not agent prose, decides completion, and the minesweeper dogfood proved the loop works end to end without code changes. But the loop only has three real outcomes today — keep going on failure, stop on success, or abort on a limit. That leaves three gaps that show up the moment a run lasts more than a few minutes:

- You cannot pause a run and resume it later. If you need to stop (close the laptop, hit a decision that is yours to make), your only lever is abort, which throws away the run.
- The loop cannot tell "failing but making progress" from "stuck repeating the same failure." It keeps re-running a check that cannot pass until a hard iteration or wall-clock limit trips, which wastes turns and hides the real signal.
- You cannot glance at a run and trust where it is. State lives in `.cursor/goal/active.json` and per-run logs, but there is no compact, honest progress readout, so "is this going anywhere?" means reading logs.

Adjacent systems already treat these as table stakes. Codex `/goal` ships `pause`/`resume`, a `blocked` state entered only after repeated impasse, a `usageLimited` soft-stop, and guidance to keep a compact progress log you can trust ([Follow a goal](https://developers.openai.com/codex/use-cases/follow-goals), [blocked/usageLimited PR](https://github.com/openai/codex/pull/23094)). Ralph practice is blunter: a weak check plus a loop equals confident hallucinated "done," so the check quality is the whole game ([Ralph technique](https://ralphloop.sh/blog/what-is-the-ralph-technique/)). Goal Loop's own `PLAN.md` already names pause/resume/blocked as the unshipped gaps.

## Key Decisions

- **Stay a control plane, not a runner.** This work adds lifecycle states and steering to the existing stop-hook loop. It does not add a fresh-context / CLI outer runner (that is deferred), so the product stays small and the "check decides done" contract is untouched.
- **The check still owns completion.** Pause, resume, and blocked change *whether the loop continues*, never *whether the work is done*. Only a passing check marks a goal `completed`. Blocked is an honest stop, not a success.
- **Blocked is earned, not guessed.** The loop only reports blocked after the same failure repeats across multiple iterations, mirroring Codex's "at least three attempts" rule. A single failure still just continues.
- **Repeat failure is measured mechanically, not by AI judgment.** "Same failure" means the same exit-code sequence plus a stable fingerprint of the check log tail across consecutive failed iterations. Prefer false negatives (keep looping) over false positives (block too early).
- **Coach the check at start time, never silently override it.** When a check looks too weak for the objective, warn the user and suggest stronger checks, but run exactly what they chose. Goal Loop never swaps in its own check.
- **Coaching stays a small high-precision set.** Warn only on clear mismatches (e.g. existence-only check for a behavioral objective, or a check command with no topical overlap with the objective). Do not invent a broad scoring rubric.
- **Fail-open is preserved.** Every new state transition keeps the existing rule: if the hook crashes it returns `{}` and logs to `hook-errors.log`, so nothing new can trap the agent.

## Requirements

### Lifecycle: pause, resume, blocked

R1. A user can pause an active goal. While paused, the stop hook runs the check on no turn and continues nothing; the goal state and run history are retained intact.

R2. A user can resume a paused goal, returning it to active behavior with iteration count and limits carried forward (resume does not reset progress).

R3. The loop enters a `blocked` state, and stops continuing, only after the same check failure recurs across a configurable minimum number of consecutive iterations (default 3): sameness is exit-code sequence plus a stable fingerprint of the check log tail; a blocked goal is resumable after the user intervenes.

R4. `blocked` is a distinct, honest stop from `completed` and `aborted`: it means "the agent cannot get past this without help," names what is blocking, and never implies the objective was met.

R5. Pause, resume, and blocked are visible in `/goal-status` and reflected in the goal contract so any wrapper reading the same state observes the same lifecycle.

### Trust: progress you can read

R6. `/goal-status` reports a compact, honest run readout: current objective, iteration and limits, last check result, current lifecycle state, and whether the recent trend is progressing, stuck, paused, or blocked.

R7. The run keeps a short human-readable progress trail (what each iteration attempted and the check outcome) that a user can skim without reading raw logs, distinct from the full per-run log which stays available.

R8. When the loop stops for any reason (completed, aborted, paused, blocked, limit), the next human-visible summary states which reason applied and points at the evidence (log path, progress trail).

### Check coaching at start time

R9. At `/goal` and `/plan`, warn only on a small set of high-precision mismatches: (a) existence-only checks (`test -f`, `ls`, similar) when the objective names behavioral or quality outcomes, and (b) check commands with no topical overlap with the objective text; suggest stronger checks, then continue.

R10. Coaching is advisory only: the user's chosen check runs exactly as written, and starting with a weak check remains allowed after the warning.

## Key Flows

F1. **Pause and resume a long run.** User starts a goal → loop iterates → user pauses (needs to step away or make an owner-level decision) → loop continues nothing, state retained → user resumes later → loop picks up at the same iteration and limits.

F2. **Stuck run becomes an honest stop.** Check fails → loop continues and records the attempt → same failure recurs across the minimum blocked threshold → loop enters `blocked`, names the blocker, stops continuing → user intervenes and resumes, or aborts.

F3. **Weak check caught at start.** User runs `/goal "<behavioral objective>" --verify "<trivial check>"` → command flags the mismatch and suggests a stronger check → user either strengthens the check or proceeds as written → loop starts.

## Acceptance Examples

AE1. **Covers R1, R2.** A goal is active at iteration 4 of 20. User pauses; the next stop event runs no check and continues nothing. User resumes; the goal is active again at iteration 4 with the same limits, no progress lost.

AE2. **Covers R3, R4.** The same check fails with the same root failure on three consecutive iterations. The loop transitions to `blocked`, reports what is blocking, and does not mark the goal `completed`. A check that fails once then passes never triggers blocked.

AE3. **Covers R6, R8.** After a run stops, `/goal-status` shows the stop reason (e.g., `blocked`), the last check result, and the progress trail location, without the user opening a raw log.

AE4. **Covers R9, R10.** `/goal "make the login page accessible" --verify "test -f login.html"` warns that file existence cannot prove accessibility and suggests an accessibility or test-based check; if the user proceeds unchanged, the loop runs that exact check.

## Scope Boundaries

### Deferred for later

- A fresh-context / CLI outer runner that restarts the agent each iteration while reusing `.cursor/goal/` state (the Ralph-style long-run path). Revisit once the control plane proves out.
- A `usageLimited`-style soft-stop tied to token/budget accounting. Valuable, but depends on budget signals Goal Loop does not currently track.
- Broad multi-CLI parity polish beyond making the new lifecycle states visible wherever `/goal-status` already works.

### Outside this product's identity

- Goal Loop does not become a multi-agent orchestrator, task graph, or planner. Lifecycle states steer one loop against one check; they do not schedule or coordinate multiple goals.
- Coaching never becomes enforcement. Goal Loop will not refuse to run, or substitute, a user's chosen check.

## Dependencies / Assumptions

- Assumes the existing project-local contract (`.cursor/goal/active.json`) and fail-open stop hook remain the state model; new states extend it rather than replace it.
- Assumes consecutive failed iterations already write enough exit codes and log content to compute a stable fingerprint; if fingerprinting proves too noisy in practice, prefer under-blocking and tune the fingerprint, not a model-based "looks stuck" judgment.
- Unattended pause/resume value is highest with Cursor Agent Auto-run; without it the loop still records state honestly but a human drives continuation.

## Outstanding Questions

### Deferred to planning

- Exact command surface for pause/resume (new subcommands vs flags on existing commands).
- How the progress trail (R7) relates to the optional `progress.md` already described in the runtime layout.
- Exact fingerprint recipe for R3 (how much log tail, normalization of timestamps/paths) — product rule is fixed; algorithm detail is planning.

## Sources / Research

- Codex `/goal` lifecycle and progress guidance: https://developers.openai.com/codex/use-cases/follow-goals
- Codex `blocked` / `usageLimited` states and the three-attempt rule: https://github.com/openai/codex/pull/23094
- Verification-as-completion framing: https://codex.danielvaughan.com/2026/07/06/codex-cli-goal-mode-long-running-autonomous-agents-verification-trust-architecture/
- Ralph technique (fresh context, weak-check failure mode, completion on real proof): https://ralphloop.sh/blog/what-is-the-ralph-technique/
- Existing gap list and contract: `PLAN.md`, `docs/goal-contract.md`, `docs/other-agents.md`
