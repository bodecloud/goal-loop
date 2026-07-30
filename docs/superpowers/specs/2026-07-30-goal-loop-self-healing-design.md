---
title: Goal Loop Self-Healing Mechanism
date: 2026-07-30
author: Claude Code (Research-Grounded Design)
status: draft
scope: goal-loop plugin autonomous drift detection and correction
---

# Goal Loop Self-Healing Mechanism

## Problem Statement

Goal Loop persists goal state in `.cursor/goal/active.json` but has no mechanism to detect or correct **goal drift** — when the persistent goal state contradicts the user's current explicit statement in conversation.

**Failure Mode:** User states a new goal twice. Goal-loop keeps re-asserting the stale goal from `active.json`. Result: infinite loop where system contradicts user's clear intent.

**Root Cause:** Goal state (persistent, Tool-level) and user intent (conversational, User-level) have no hierarchy. When they conflict, there's no principled authority to resolve it.

---

## Research Foundation

This design applies findings from peer-reviewed research on instruction hierarchy, LLM bias, and agentic goal alignment:

### 1. Instruction Hierarchy in LLMs (GEND)
- **Core principle:** Instructions have priority levels: System > Developer > User > Tool
- **Why it matters:** Higher-priority instructions are treated as more authoritative; conflicts resolve by hierarchy, not ambiguity
- **Application here:** User's current explicit statement (elevated to System level) > persisted state (Tool level)

### 2. Emotional + Motivational Framing (PromptHub)
- **Finding:** Emotional framings improve LLM adherence by 8–115% across tasks
- **Mechanism:** Not manipulation; deeper processing triggered by motivational language
- **Application:** Frame the goal as foundational ("The Goal is the north star") to trigger more deliberate processing

### 3. Position Bias & U-Shaped Attention (IntuitionLabs / Medium)
- **Finding:** LLMs focus most on prompt start and end (U-shaped curve); middle content receives less attention
- **Finding:** Repetition at start AND end is not redundant—it's deliberate use of recency bias
- **Application:** Goal appears at top and bottom of agent prompts; refresh via `<system-reminder>` mid-conversation

### 4. Agent System Prompt Structure (Medium)
- **Finding:** Prompts under 6K tokens with structured sections outperform verbose prose in adherence testing
- **Finding:** `<system-reminder>` tags injected during conversation refresh rules via recency bias
- **Finding:** "IMPORTANT:" and "NEVER/MUST NOT" prefixes receive extra weight due to Claude's instruction-hierarchy training
- **Application:** Goal constraints use absolute language; refreshed via system-reminders

---

## Design: "The Goal Is Sacred" Pattern

### Core Principle

Goal state hierarchy is explicitly ranked. User's current explicit intent (System/Developer level) always overrides persisted state (Tool level).

### Detection: When Is Goal Drift Triggered?

Goal drift detection runs at two points:

#### 1. Session Start (Lightweight Audit)
- **Condition:** `active.json` exists and contains an active goal
- **Check:** Scan recent conversation context for explicit goal statements
- **Signal:** If user's statement differs from `active.json`, flag for confirmation
- **Non-blocking:** Detection doesn't halt execution; confirmation is a lightweight prompt

#### 2. On Explicit Goal Statement (Immediate)
- **Condition:** User says "my goal is X" or answers a clarifying question affirmatively
- **Trigger:** Hook or agent detects explicit statement
- **Action:** Immediate drift check + sync proposal
- **Non-blocking:** User can approve, skip, or override

### Synchronization: The Correction Flow

When drift is detected (new statement ≠ active.json):

```
User states goal X
    ↓
System detects divergence (statement ≠ active.json)
    ↓
Lightweight confirmation: "Update goal from [old] to [X]?"
    ↓
User approves (or implicitly proceeds if non-blocking)
    ↓
active.json updated to {objective: X, ...}
    ↓
Inject <system-reminder> about new goal
    ↓
Next agent execution sees goal at System level (via reminder)
```

### Authority Structure

| Level | Source | Authority |
|-------|--------|-----------|
| **System** | User's current explicit statement | Highest (overrides all) |
| **Developer** | Goal-loop defaults & verification strategy | Override only by explicit user statement |
| **User** | Conversation context & tool interactions | Advisory only |
| **Tool** | Persistent `active.json` state | Read-only cache of last confirmed intent |

**Rule:** User's current explicit statement is always System-level authority. The file is a cache, not the source of truth.

### Elevation via Prompt Engineering

To make the goal unmissable, the system uses three evidence-backed techniques:

#### Technique 1: Instruction Hierarchy Framing
Goal appears in system-level instructions with absolute language:
```
THE GOAL IS THE NORTH STAR OF THIS SESSION.
Objective: [user's current stated goal]
Authority: This objective is derived from the user's most recent explicit statement.
Status: Active. Do not contradict this without explicit user instruction.
```

#### Technique 2: Emotional + Motivational Framing
Language triggers deliberate processing:
```
This goal represents the user's highest-priority intent for this session.
Your work succeeds when this objective is met.
When in doubt about scope or direction, return to this objective.
```

#### Technique 3: Position Bias Exploitation
Goal appears at start + end of relevant prompts:
- **Top** of agent system prompt (primacy: first thing seen)
- **Bottom** of goal verification steps (recency: last thing before action)
- **Mid-conversation via `<system-reminder>`** when goal changes (refresh via recency bias)

---

## Implementation Strategy

### Phase 1: Core Self-Healing (Required)

**Component:** Goal Drift Detection Hook

- **Trigger:** At session start + when user explicitly states new goal
- **Detection:** Compare user's statement vs. `active.json.objective`
- **Confirmation:** Lightweight yes/no prompt (non-blocking)
- **Update:** On confirmation, overwrite `active.json`, inject system-reminder
- **Files to create/modify:**
  - `.cursor/goal/hooks/detect-drift.mjs` (new)
  - `.cursor/goal/goal-lib.mjs` (extend with drift detection utils)
  - Goal-verifier agent prompt (update with hierarchy framing)
  - Main agent system prompt (add goal elevation language)

**Verification:** 
- Drift detection runs without blocking execution
- On drift confirmation, `active.json` updates before next agent interaction
- Goal appears in next agent's system-reminder

### Phase 2: Continuous Monitoring (Optional, Deferred)

**Component:** Real-Time Drift Detection

- Runs when user explicitly changes goal mid-session
- Detects contradictions in agent feedback vs. active goal
- Surfaces reframing suggestions via goal-verifier

### Phase 3: Advanced Self-Correction (Optional, Deferred)

**Component:** Brainstorming on Failure

- When verification fails repeatedly, goal-verifier asks: "Should we reframe the goal?"
- Proposes adjusted objectives based on what's been learned
- User approves or rejects reframing

---

## Data Model

### Goal State Structure (active.json)

```json
{
  "version": 1,
  "status": "active",
  "objective": "string - user's stated goal",
  "stated_by": "user's explicit statement (for audit trail)",
  "stated_at": "ISO timestamp",
  "synced_from_conversation": true,
  "verify": {
    "commands": ["array of verification commands"],
    "cwd": "directory",
    "timeout_ms": 600000
  },
  "limits": {
    "max_iterations": 20,
    "max_wall_ms": 7200000
  },
  "iteration": 0,
  "started_at": "ISO timestamp",
  "last_verify": { ... },
  "drift_history": [
    {
      "detected_at": "ISO timestamp",
      "previous_objective": "string",
      "new_objective": "string",
      "user_approved": true
    }
  ]
}
```

### New Fields (Drift Tracking)

- `stated_by`: What the user said (audit trail for "where did this come from?")
- `stated_at`: When they said it (detect stale goals)
- `synced_from_conversation`: Boolean (true = synced from user's explicit statement, false = created from `/goal` command)
- `drift_history`: Array of drift corrections (for transparency + learning)

---

## Test Scenarios

### Happy Path: User Corrects Goal
1. User states goal A
2. System creates `active.json` with objective A
3. User later states goal B (contradicts A)
4. Hook detects drift
5. Confirmation prompt: "Update to goal B?" → User approves
6. `active.json.objective` updated to B
7. Next agent sees goal B in system-reminder
8. **Verification:** Goal-verifier never re-asserts goal A

### Edge Case: Stale Goal at Session Start
1. Previous session created goal X (days ago)
2. Current session: user says "new goal is Y"
3. Hook detects `active.json` still has X
4. Confirms drift: "Update from X to Y?"
5. User approves
6. Session proceeds with Y
7. **Verification:** No infinite loop re-asserting X

### Edge Case: Goal Change During Verification
1. Active goal A, verification running
2. User says "actually, let's do goal B instead"
3. Hook detects mid-iteration change
4. Updates `active.json`, injects system-reminder
5. Next agent cycle uses goal B
6. **Verification:** Iteration counter doesn't reset; goal shift is tracked

### Error Path: User Dismisses Drift Confirmation
1. Drift detected: "Update goal?"
2. User says "no, keep old goal"
3. System logs dismissal in drift_history
4. `active.json` unchanged
5. **Verification:** No auto-correction without consent

---

## Success Criteria

### Prevents Infinite Loop
- **Metric:** Goal-verifier re-asserts stale goal → 0 times (was frequent)
- **How:** Drift detection updates state before next agent execution

### Detects Real Divergence
- **Metric:** System catches case where user states goal twice + old goal contradicts new → detection rate 100%
- **How:** Hook runs on explicit statement + session start

### Non-Intrusive
- **Metric:** Confirmation prompt doesn't block execution
- **How:** Lightweight yes/no, non-blocking flow

### Transparent
- **Metric:** User can audit goal changes via drift_history
- **How:** Every correction logged with timestamp + old/new objective

### Elevated Goal Awareness
- **Metric:** After correction, goal appears in agent's first 200 tokens + system-reminder
- **How:** U-shaped attention curve exploitation + position bias techniques

---

## Scope Boundaries

**Out of Scope (Explicitly Deferred):**
- Automatic verification command updates (user decides if old commands fit new goal)
- Goal suggestion engine (deferred to Phase 3)
- Slack/email notifications of goal changes (deferred)
- Goal history across sessions (current: drift_history tracks within-session only)

**In Scope:**
- Detecting goal drift at session start + on explicit statement
- Lightweight sync proposal (yes/no)
- Updating active.json + injecting system-reminder
- Audit trail via drift_history

---

## Implementation Order

1. **U1:** Extend goal-lib.mjs with drift detection utils (compareObjectives, formatDriftPrompt)
2. **U2:** Create detect-drift.mjs hook (session-start + on-statement trigger)
3. **U3:** Update goal-verifier agent prompt (instruction hierarchy framing)
4. **U4:** Update main system prompt (goal elevation language)
5. **U5:** Test drift detection end-to-end (happy path + edge cases)
6. **U6:** Add drift_history tracking to goal state model

---

## References

- GEND: Instruction Hierarchy in LLMs (https://www.gend.co/blog/instruction-hierarchy-llms-safety)
- PromptHub: Emotional Framing (https://www.prompthub.us/blog/getting-emotional-with-llms)
- Medium: Agent System Prompts Reverse Engineering (https://medium.com/@fengliu_367/the-complete-guide-to-writing-agent-system-prompts-lessons-from-reverse-engineering-claude-code-09ecd87c7cc1)
- Intuition Labs: Position Bias in Prompts (https://intuitionlabs.ai/pdfs/llm-position-bias-primacy-and-recency-effects-in-prompts.pdf)

---

## Open Questions for Implementation

1. **Session Start Detection:** Should the hook run on every session, or only if `active.json` modification time is older than N hours?
2. **Verification Command Sync:** On goal drift, should we prompt user to confirm old verification commands still apply, or silently carry forward?
3. **Drift History Retention:** Should drift_history be capped (e.g., last 10 entries) or retain full history?
4. **Non-Interactive Mode:** If running in CI/automation without user prompts, how should drift confirmation be handled?

These are implementation-time questions; the design is complete without them.
