---
date: 2026-07-25
topic: goal-loop-durable-handoff
---

# Goal Loop — durable handoff (soft-stop + checkpoint)

## Summary

Add a Codex-shaped soft-stop and a required checkpoint handoff so a long Goal Loop run can end cleanly when limits approach, leave a resume packet on disk, and pick up later without treating the stop as success, stuck, or abort. Wave 1 (pause / blocked / progress / coaching) stays separate; this wave makes overnight and limit-bounded runs survivable.

## Problem Frame

Wave 1 covers steering: pause, earned `blocked`, a readable progress trail, and weak-check coaching. That still leaves the failure mode Ralph and Codex both treat as table stakes after lifecycle: the run hits a wall (iteration, wall-clock, or later usage) mid-work and either burns the last turns uselessly or dies without a trustworthy next-step packet.

Today Goal Loop only hard-stops on limits (`aborted` when max iterations / wall time trip). Adjacent practice already separates that from success:

- Codex `/goal` uses a `budget_limited` soft-stop: wrap up, do not start new substantive work, do not fake-complete ([Follow a goal](https://developers.openai.com/codex/use-cases/follow-goals), [budget_limited semantics](https://github.com/openai/codex/pull/18076)).
- Ralph and community quota guards write checkpoint / resume files before the meter or session dies ([Ralph technique](https://ralphloop.sh/blog/what-is-the-ralph-technique/), [agent-quota-guard](https://github.com/raysonmeng/agent-quota-guard)).
- Goal Loop's own `PLAN.md` already lists a `usageLimited`-style soft-stop and a fresh-context runner as unshipped gaps; this wave takes the soft-stop path and leaves the runner deferred.

## Key Decisions

- **Soft-stop is not completion, blocked, or abort.** A limit-driven stop enters a distinct lifecycle state (e.g. `budget_limited` / `limit_reached`) meaning "stop continuing and leave a handoff," never "objective met," never "stuck on the same failure."
- **v1 soft-stop signal is the limits Goal Loop already owns.** Trigger from approaching `max_iterations` and/or `max_wall_ms`. Live token/subscription usage APIs are deferred until a reliable host signal exists; inventing fake token accounting is out of scope.
- **A checkpoint handoff is mandatory on soft-stop.** Before the loop stops continuing, the run must leave a short disk-backed packet: what was tried, what the check last said, what to do next, and where the evidence lives. Status and resume read that packet.
- **Thin external memory, not a second product.** The checkpoint extends Wave 1's progress trail into something resume depends on; it is not a task graph, plan file editor, or multi-goal board.
- **Stay a control plane.** No fresh-context outer runner in this wave. The stop hook and project-local contract remain the runtime; the shell check still owns `completed`.
- **Fail-open is preserved.** Soft-stop and checkpoint failures must not trap the agent; prefer writing what we can and returning `{}` over blocking forever.

## Requirements

### Soft-stop lifecycle

R1. When an active goal is within a small configurable margin of its iteration or wall-clock limit (default: last allowed iteration, or wall time nearly exhausted), the loop enters a distinct soft-stop state and stops continuing after the wrap-up turn.

R2. Soft-stop is distinct from `completed`, `blocked`, `paused`, and hard `aborted`: it never implies the objective was met, never implies the same check failure earned a stuck stop, and is visible in `/goal-status`.

R3. On soft-stop, the agent is steered to wrap up only: summarize progress, update the checkpoint, name blockers and next step; it must not start new substantive work or claim completion.

R4. A soft-stopped goal is resumable: resume returns it to `active` with iteration/limits accounting carried forward (or explicitly reset only if the user asks), and the next turn must read the checkpoint first.

### Checkpoint handoff

R5. Soft-stop writes a short human-readable checkpoint (what each recent attempt did, last check outcome, blocker if any, recommended next action, pointers to run logs / progress trail) that a human or later agent can skim without raw logs.

R6. `/goal-status` on a soft-stopped (or recently resumed) goal reports the soft-stop reason, limit remaining or exhausted, and the checkpoint location.

R7. Resume injects or points at the checkpoint as the starting context for the next turn; it does not require rehydrating the full prior chat transcript.

### Compatibility with Wave 1 and the check contract

R8. Soft-stop never marks `completed`. Only a passing shell check marks `completed`.

R9. Soft-stop does not replace earned `blocked`: repeated identical failures still follow the Wave 1 blocked rule when that work is present; limit soft-stop fires when limits approach regardless of failure signature.

R10. Fail-open: if checkpoint write or soft-stop transition fails, the hook logs the error and does not trap the agent.

## Key Flows

F1. **Limit approaches → soft-stop.** Goal is active near max iterations → next stop event runs the check if needed, then enters soft-stop, writes checkpoint, returns no continuation → `/goal-status` shows soft-stop + checkpoint path.

F2. **Resume from soft-stop.** User resumes → status is `active` again → agent reads checkpoint first → continues against the same objective and check.

F3. **Pass still wins.** A check that passes on the wrap-up turn marks `completed`; soft-stop does not override a passing check.

## Acceptance Examples

AE1. **Covers R1, R2, R5.** A goal at iteration 19 of `max_iterations: 20` fails the check. The loop enters soft-stop (not `completed`), writes a checkpoint naming the failure and next step, and does not continue.

AE2. **Covers R4, R7.** After soft-stop, resume returns the goal to `active` and the next working turn begins from the checkpoint contents without requiring the prior transcript.

AE3. **Covers R8, F3.** On the final wrap-up turn the check passes → status is `completed`, not soft-stop.

AE4. **Covers R6.** `/goal-status` after soft-stop reports the stop reason, exhausted or remaining limit, and checkpoint location without opening a raw log.

## Scope Boundaries

### Deferred for later

- Live token / subscription usage soft-stop (`usageLimited` with host quota APIs).
- Fresh-context / CLI outer runner that restarts the agent each iteration.
- Broad multi-CLI parity polish beyond reflecting the new state wherever `/goal-status` already works.
- Mid-run `/goal edit` of the objective (adjacent Codex feature; not required for durable handoff).
- Git commit-on-green / iteration tags as an audit trail.

### Outside this product's identity

- No multi-agent orchestration, task graph, or planner.
- Soft-stop never becomes a substitute completion oracle; the shell check still decides done.
- Checkpoint is not a second goal system or a project management board.

## Dependencies / Assumptions

- Assumes Wave 1 lifecycle states (`paused`, `blocked`, progress trail) either ship first or this wave extends the same additive contract; naming of the soft-stop status is planning-owned.
- Assumes `limits.max_iterations` and `limits.max_wall_ms` remain the v1 soft-stop signals; no token meter is required for v1.
- Assumes the operator (or Auto-run) can resume after soft-stop; unattended overnight value is highest when a later runner or watchdog exists, which stays deferred.
- Evidence for the problem frame is prior art + Goal Loop's own deferred list in `PLAN.md` and the Wave 1 brainstorm, not a new user incident log (user repeatedly asked the agent to determine improvements).

## Outstanding Questions

### Deferred to planning

- Exact status string (`budget_limited` vs `limit_reached` vs similar) and whether hard limit abort remains for pathological cases after soft-stop already fired.
- Exact soft-stop margin (last iteration only vs N-before-last heads-up).
- Whether the checkpoint lives as a dedicated file, an extension of the Wave 1 progress trail, or both (product rule: resume must read it; layout is planning).

## Sources / Research

- Codex `/goal` lifecycle and budget soft-stop: https://developers.openai.com/codex/use-cases/follow-goals
- Codex cookbook (goals + budgets): https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex
- `budget_limited` semantics: https://github.com/openai/codex/pull/18076
- Ralph technique (disk memory, fresh context): https://ralphloop.sh/blog/what-is-the-ralph-technique/
- Quota soft-stop UX pattern: https://github.com/raysonmeng/agent-quota-guard
- Long-running agent harness essay: https://nicolasbustamante.com/blog/long-running-agent-engineering
- Existing deferred gaps: `PLAN.md`, `docs/brainstorms/2026-07-25-goal-loop-trust-and-control-requirements.md`
