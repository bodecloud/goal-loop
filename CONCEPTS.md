# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Relationships

A Goal owns exactly one Objective and one Check. The Goal Contract is the Goal's durable form on disk; the Stop Hook is the only process that advances it. Each Stop Hook run consumes one Iteration and produces one Run Log. Only a passing Check moves a Goal to Completed — no other actor may.

## The goal

### Goal
A single durable objective the agent works toward across turns, paired with the shell command that proves it is met. A Goal is the unit of everything here: one Goal, one Objective, one Check, one lifecycle.

### Objective
The human-readable statement of what the Goal is trying to achieve. It tells the agent what to work on; it never decides whether the work is finished.

### Goal Contract
The Goal's state written to a file inside the workspace being worked on, holding the objective, check, limits, iteration count, and lifecycle status. It lives in the project rather than inside the plugin so a human or another tool can read the loop's state directly, and so any wrapper honoring the same fields behaves identically.

### Check
The shell command or commands that decide whether the Objective has been met. A Check either passes or fails by exit code, and its verdict is authoritative: agent prose claiming success never marks a Goal complete. Commands run in order and stop at the first failure.
*Avoid:* verifier, verification

### Limits
The ceilings that stop a Goal from running forever — a maximum number of Iterations and a maximum elapsed wall time since the Goal started. Hitting a limit ends the loop as Aborted, which is a stop, not a success.

## The loop

### Stop Hook
The process that runs after each completed agent turn: it reads the Goal Contract, consumes an Iteration, runs the Check, and decides whether the agent may stop. It is the only component that advances a Goal's lifecycle during a run.

### Iteration
One Stop Hook cycle against a Goal. The count increments before the Check runs, so a Check that passes on its first post-turn run still consumes an Iteration, and limit enforcement happens against the incremented count.

### Followup Message
The Stop Hook's instruction back to the agent when the Check failed — the objective, where the run stands, the log location, and a tail of the failing output. Emitting one is how the loop continues; emitting nothing is how the agent is allowed to stop.

### Run Log
The full combined output of one Iteration's Check, written to the workspace and referenced by that Iteration's result. It is the evidence behind a continue-or-stop decision, readable by both the agent and a human.

### Fail-Open
The rule that a Stop Hook which errors must let the agent stop rather than continue. A broken loop releases the agent and records the error; it never traps it. Every new behavior in the hook inherits this rule.

## Goal lifecycle

### Draft
A Goal that has been shaped but not activated. The Stop Hook ignores Drafts entirely, so no Check runs and no loop continues. Activation is a deliberate act, not an automatic promotion.

### Active
A Goal the Stop Hook enforces. An Active Goal must carry at least one Check command, since a Goal with nothing to prove it cannot be completed honestly.

### Paused
A Goal the Stop Hook skips. Iteration count and limits stay as they were. Resume returns the Goal to Active without resetting progress.

### Blocked
An honest stop earned when the same Check failure repeats across consecutive Iterations. Blocked never means the Objective was met. After the operator intervenes, Resume clears the repeat-failure counter and returns the Goal to Active.

### Completed
The terminal success state, reached only when a Check passes. This is the one state that asserts the Objective was actually met.

### Aborted
The terminal state for a Goal that stopped without success — cancelled by the user or ended by a Limit. It carries no claim that the Objective was met.

## Packaging

### Host CLI
Any agent command-line tool the plugin ships into. Hosts differ in where they discover plugins and in what a hook must return to continue an agent, but they share one Goal Contract.

### Host Adapter
A thin translator that lets a Host CLI drive the loop without a second implementation of it. An adapter converts the Stop Hook's output into the shape its host expects and decides nothing on its own; when the hook says stop, the adapter stays silent.

## Flagged ambiguities

- "Verifier" and "check" were both used for the thing that proves an Objective. Check is the term; verifier survives only in the name of the helper agent that helps a user write one.
- Soft-stop / budget-limited is not a lifecycle state yet — limit exhaustion still ends as Aborted.
