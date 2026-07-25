---
date: 2026-07-25
status: completed
origin: docs/brainstorms/2026-07-25-goal-loop-trust-and-control-requirements.md
---

# feat: Goal Loop trust and control

## Summary

Add a human-steering layer to the existing check-backed loop: pause/resume, an earned `blocked` stop when the same check failure repeats, a readable progress trail plus a richer `/goal-status`, and advisory check coaching at start time. The work extends the current state model (`scripts/goal-lib.mjs`), CLI (`scripts/goalctl.mjs`), and stop hook (`hooks/goal-stop.mjs`) rather than rewriting them, and keeps the Claude/Grok/Copilot adapter (`hooks/goal-stop-claude.sh`) in parity. A passing shell check remains the only thing that marks a goal `completed`.

## Problem Frame

Goal Loop today has three loop outcomes: continue on failure, complete on a passing check, abort on a limit. The state machine in `scripts/goal-lib.mjs` recognizes only `active`, `draft`, `completed`, `aborted`, and the stop hook (`hooks/goal-stop.mjs`) increments `iteration`, runs the check, and returns `{}` or `{ followup_message }`. That leaves no way to pause a run, no distinction between "failing but progressing" and "stuck on the same failure," and no compact readout of where a run stands. The brainstorm (see origin) validated closing those gaps without turning Goal Loop into a runner or orchestrator. This plan implements that scope.

---

## Requirements traceability

Carried from origin:

- **Lifecycle** (R1, R2, R3, R4, R5): pause, resume, earned `blocked`, honest stop distinct from `completed`/`aborted`, all reflected in the contract and `/goal-status`.
- **Trust** (R6, R7, R8): compact status readout, skimmable progress trail, explicit stop-reason reporting.
- **Coaching** (R9, R10): high-precision weak-check warnings at `/goal` and `/plan`, advisory only.
- Key decisions preserved: control plane not runner; check still owns completion; blocked earned via mechanical repeat-failure fingerprint (3 consecutive); coaching is a small high-precision set; fail-open preserved.

---

## Key Technical Decisions

- **Extend the v1 contract additively; do not bump `version`.** New optional fields (`paused`/`blocked` status values, `abort_reason`-style `blocked_reason`, a `failure_signature`, and a progress trail) are added so existing `active.json` files still validate. `validateGoal` in `scripts/goal-lib.mjs` gains the new status values and tolerates missing new fields. Rationale: the contract is consumed by wrappers (see origin: `docs/other-agents.md`); an additive change keeps them working.
- **Repeat-failure detection is mechanical, computed in the hook.** The hook derives a `failure_signature` from the exit-code sequence plus a normalized fingerprint of the check log tail, and counts consecutive identical signatures. No model judgment. Prefer under-blocking: any signature change resets the counter.
- **Pause is a status the hook honors, not a separate flag.** `status: "paused"` makes the stop hook return `{}` without running the check (same shape as any non-`active` status today), so pause cannot trap the agent.
- **Coaching lives in the command prompts, not the hook.** `/goal` and `/plan` already run through `commands/*.md` guidance plus `goalctl`. Weak-check heuristics are applied when the goal is created (in `goalctl` start/draft path) and surfaced to the user; the hook is unchanged by coaching.
- **The Claude adapter stays a thin translator.** `hooks/goal-stop-claude.sh` continues to shell into `goal-stop.mjs` and only maps `followup_message` → `decision: block`. New stop reasons that end the loop (blocked, paused) produce `{}` from the hook, so the adapter needs no new branches.

---

## Implementation Units

### U1. Extend the state model and validation

**Goal:** Teach `scripts/goal-lib.mjs` the new lifecycle states and optional fields so every other unit can rely on them.

**Requirements:** R1, R2, R3, R4, R5.

**Dependencies:** none.

**Files:** `scripts/goal-lib.mjs`, `tests/goalctl.test.mjs` (extend), `tests/goal-lib.test.mjs` (new if not present).

**Approach:**
- Add `paused` and `blocked` to the allowed `status` values in `validateGoal`.
- Define optional contract fields, tolerated when absent: `paused_at`, `blocked_at`, `blocked_reason`, `last_failure_signature`, `repeat_failure_count`, and a `progress` array of compact per-iteration entries.
- Keep `version: 1`; do not reject old files missing the new fields.
- Add a small helper to append a progress entry and one to compute/compare a failure signature (pure function: given exit codes + log tail, return a normalized string), so U3 and U4 share it.

**Patterns to follow:** existing `asPositiveInteger`, `normalizeStringArray`, and the additive shape of `aborted_at` already written by `goalctl abort`.

**Test scenarios:**
- Happy path: a goal object carrying the new optional fields validates; a goal without them still validates (back-compat).
- `status: "paused"` and `status: "blocked"` pass validation; an unknown status still throws.
- Edge: `repeat_failure_count` non-integer or negative is rejected.
- Failure-signature helper: identical exit codes + identical normalized tail produce equal signatures; a changed tail produces a different signature; timestamps/paths in the tail are normalized so they don't cause false differences.

**Verification:** `npm test` covers new validation and the signature helper; existing goalctl tests still pass.

### U2. Pause and resume commands

**Goal:** Let a user pause an active goal and resume it later without losing progress.

**Requirements:** R1, R2, R5.

**Dependencies:** U1.

**Files:** `scripts/goalctl.mjs`, `commands/goal-pause.md` (new), `commands/goal-resume.md` (new), `.cursor-plugin/plugin.json` (commands dir already globbed — no change unless a manifest list needs it), `tests/goalctl.test.mjs`.

**Approach:**
- Add `pause` and `resume` subcommands to `goalctl` `parseArgs`/`main`.
- `pause`: read active goal, require `status === "active"`, set `status: "paused"` and `paused_at`, write back. No-op with a clear message if there is no active goal or it is not active.
- `resume`: require `status === "paused"`, restore `status: "active"` (iteration and limits untouched), clear `paused_at`. Clear message otherwise.
- Add the two command prompts mirroring the tone of `commands/goal-abort.md`.

**Patterns to follow:** the `abort` branch in `scripts/goalctl.mjs` (read → mutate status → `writeJsonFile` → `printJson`).

**Test scenarios:**
- Covers R1: `pause` on an active goal sets `paused`, retains `iteration` and `verify`.
- Covers R2: `resume` on a paused goal returns it to `active` at the same iteration.
- Error path: `pause` with no active goal, `resume` with no paused goal, `resume` on an active goal — each prints a clear non-crashing message.
- Edge: `pause` on an already-paused goal is a clear no-op.

**Verification:** `npm test`; manual `goalctl pause`/`resume` round-trip on a temp project shows retained iteration.

### U3. Hook honors pause and records the progress trail

**Goal:** Make the stop hook skip work while paused and append a compact progress entry each iteration.

**Requirements:** R1, R7, R8.

**Dependencies:** U1.

**Files:** `hooks/goal-stop.mjs`, `tests/goal-stop.test.mjs`.

**Approach:**
- Early-return `{}` when `status !== "active"` already exists; confirm `paused` and `blocked` fall through that guard and never run the check.
- After each check run, append a progress entry (iteration, ok/fail, exit codes, one-line reason, log path) via the U1 helper, capped to a bounded length so the file stays small.
- Keep the full per-run log write unchanged; the progress trail is the skimmable summary, not a replacement.

**Patterns to follow:** existing `last_verify` assembly and `appendFileSync` log write in `hooks/goal-stop.mjs`; fail-open `try/catch` stays intact.

**Test scenarios:**
- Covers R1: a `paused` goal produces `{}` and runs no check (assert the check command is not spawned / no new run log).
- Covers R7: after a failing iteration, a progress entry is appended with the iteration number and outcome.
- Covers R8: progress trail and `last_verify.log_path` are both present after a stop.
- Edge: progress trail is length-bounded (oldest trimmed) over many iterations.
- Fail-open preserved: malformed input still returns `{}` and writes `hook-errors.log`.

**Verification:** `npm test` (extends existing `goal-stop.test.mjs`); paused-goal case asserts no verifier execution.

### U4. Earned `blocked` stop

**Goal:** Enter `blocked` only after the same failure repeats across a configurable minimum (default 3) consecutive iterations.

**Requirements:** R3, R4.

**Dependencies:** U1, U3.

**Files:** `hooks/goal-stop.mjs`, `scripts/goal-lib.mjs` (signature helper from U1), `tests/goal-stop.test.mjs`.

**Approach:**
- On each failed check, compute the failure signature (U1 helper) from exit codes + normalized log tail.
- If it matches `last_failure_signature`, increment `repeat_failure_count`; otherwise reset to 1 and store the new signature.
- When `repeat_failure_count` reaches the threshold (default 3, read from an optional `limits.max_repeat_failures` with fallback), set `status: "blocked"`, write `blocked_reason` (the primary failure line), and return `{}` — the loop stops continuing. A blocked goal is resumable via U2 `resume`.
- Never set `blocked` on success and never on a single failure; a passing check still marks `completed`.

**Patterns to follow:** the existing limit-check block that sets `status: "aborted"` and returns `{}`.

**Test scenarios:**
- Covers R3: three consecutive identical failures transition to `blocked` on the third; two identical then a different failure does not block.
- Covers R4: a `blocked` goal is never `completed`; `blocked_reason` names the failure.
- Edge: a fail→pass sequence marks `completed`, never `blocked`.
- Edge: threshold is configurable; setting `max_repeat_failures: 2` blocks on the second identical failure.
- Boundary with limits: reaching `max_iterations` still aborts (not blocks) when signatures vary.

**Verification:** `npm test`; blocked transition asserted against consecutive-identical vs varied failures.

### U5. Richer `/goal-status` readout

**Goal:** Make `goalctl status` report the lifecycle state, last check result, trend, and progress-trail pointer in one compact readout.

**Requirements:** R6, R8.

**Dependencies:** U1, U3, U4.

**Files:** `scripts/goalctl.mjs`, `commands/goal-status.md`, `tests/goalctl.test.mjs`.

**Approach:**
- Extend `goalSummary` to include `status` (already), `paused_at`/`blocked_at`/`blocked_reason` when present, `repeat_failure_count`, and a derived `trend` field: `progressing` | `stuck` | `paused` | `blocked` | `completed` | `aborted`, computed from status + recent progress entries.
- Update `commands/goal-status.md` so the agent reports stop reason and trend in plain language and points at the progress trail and log path.

**Patterns to follow:** existing `goalSummary`/`printJson` in `scripts/goalctl.mjs`.

**Test scenarios:**
- Covers R6: status output includes lifecycle state and a `trend` for active, paused, blocked, and completed goals.
- Covers R8: for a blocked goal, output carries `blocked_reason` and the log path without reading a raw log.
- Edge: status with no active goal still returns the existing "No active goal" shape.

**Verification:** `npm test`; `goalctl status` on paused/blocked temp goals shows the new fields.

### U6. Weak-check coaching at start time

**Goal:** Warn when a chosen check is too weak to prove the objective, without ever overriding it.

**Requirements:** R9, R10.

**Dependencies:** U1.

**Files:** `scripts/goal-lib.mjs` (small pure `assessCheckStrength`), `scripts/goalctl.mjs` (surface warnings on `start`/`draft`), `commands/goal.md`, `commands/plan.md`, `tests/goalctl.test.mjs`.

**Approach:**
- Add a pure `assessCheckStrength(objective, commands)` returning zero or more advisory warnings, using only high-precision heuristics: (a) existence-only checks (`test -f`, `test -e`, `ls`, `stat`) when the objective text signals behavioral/quality outcomes (verbs like "fix", "implement", "make ... work", "accessible", "passes"); (b) a check command whose tokens have no overlap with the objective tokens.
- `goalctl start`/`draft` calls it and includes any warnings in the printed JSON (`warnings: [...]`); the goal is still created exactly as requested (R10).
- Update `commands/goal.md` and `commands/plan.md` to relay warnings to the user and suggest stronger checks, then proceed.

**Patterns to follow:** `normalizeStringArray` and the existing pure-function style in `scripts/goal-lib.mjs`; command-prompt tone in `commands/goal.md`.

**Test scenarios:**
- Covers R9: `start "make login accessible" --verify "test -f login.html"` returns a warning; `start "fix build" --verify "npm run build"` returns none.
- Covers R10: a warned goal is still created active with the exact check.
- Edge: no false positive when an existence check genuinely matches an existence objective (e.g., "generate report file" + `test -f report.json`).
- Edge: no-overlap heuristic does not fire for reasonable topical checks.

**Verification:** `npm test`; heuristic precision asserted on the good/bad pairs above.

### U7. Docs, validation, and adapter parity

**Goal:** Keep documentation, plugin validation, and the Claude/Grok/Copilot adapter consistent with the new lifecycle.

**Requirements:** R4, R5, R8 (surfacing); packaging integrity.

**Dependencies:** U2, U4, U5, U6.

**Files:** `docs/goal-contract.md`, `docs/cursor.md`, `docs/troubleshooting.md`, `docs/other-agents.md`, `skills/cursor-goal/reference.md`, `skills/cursor-goal/SKILL.md`, `commands/` (new pause/resume already added), `scripts/validate-plugin.mjs`, `hooks/goal-stop-claude.sh` (verify only), `CHANGELOG.md`.

**Approach:**
- Document the new states (`paused`, `blocked`), the pause/resume commands, the progress trail, and coaching, in plain language matching the existing docs voice.
- Confirm `hooks/goal-stop-claude.sh` needs no change: blocked/paused end the loop via `{}`, which the adapter already handles; add a comment noting this if helpful.
- Update `scripts/validate-plugin.mjs` only if a new command file must be asserted (mirror the existing `commandFiles` list to include `goal-pause.md`/`goal-resume.md`).
- Add a CHANGELOG entry under Unreleased.

**Patterns to follow:** existing doc structure and `scripts/check-site.mjs`/`validate-plugin.mjs` assertions.

**Test scenarios:** `Test expectation: none -- docs and manifest wiring; covered by `npm run verify` (tests + validation) and `npm run docs:check`.`

**Verification:** `npm run verify` and `npm run docs:check` pass; the new command files are asserted by validation.

---

## Sequencing

U1 → (U2, U3) → U4 → U5 → U6 → U7. U2 and U3 can proceed in parallel after U1; U4 needs U3's progress/signature wiring; U5 reads U3/U4 fields; U6 is independent of U3/U4 but needs U1; U7 lands last for docs and parity.

---

## Scope Boundaries

### Deferred for later (from origin)

- A fresh-context / CLI outer runner that restarts the agent each iteration while reusing `.cursor/goal/` state.
- A `usageLimited`-style budget soft-stop.
- Broad multi-CLI parity polish beyond making the new states visible where `/goal-status` already works.

### Outside this product's identity (from origin)

- No multi-agent orchestration, task graph, or planner.
- Coaching never becomes enforcement — Goal Loop never refuses or substitutes a user's check.

### Deferred to follow-up work

- A `goalctl progress` view dedicated to the trail (status readout covers the need for now).
- Surfacing lifecycle state in the static site UI.

---

## Risks & Dependencies

- **False-positive blocking.** An over-eager failure signature could block a run that is actually progressing. Mitigation: normalize the log tail (strip timestamps/paths), require consecutive identical signatures, default threshold 3, and prefer under-blocking. Covered by U4 test scenarios.
- **Contract back-compat.** Wrappers read `active.json` (see origin: `docs/other-agents.md`). Mitigation: additive fields, no `version` bump, validation tolerates missing fields (U1).
- **Coaching noise.** Broad heuristics would erode trust. Mitigation: two high-precision rules only, advisory-only, tested for false positives (U6).

---

## Open Questions (deferred to implementation)

- Exact command surface for pause/resume — new subcommands (assumed) vs flags. Assumed subcommands to mirror `abort`.
- Exact log-tail fingerprint recipe (how many trailing lines, which normalizations). Product rule is fixed (exit codes + normalized tail, 3 consecutive); the precise recipe is tuned during U4.
- Whether the progress trail lives inside `active.json` (assumed, bounded array) or a separate `progress.md`; U3 assumes the bounded in-contract array, revisit if it bloats the file.
