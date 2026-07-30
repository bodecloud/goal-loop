# Goal Loop Integration

When a goal-loop session is active, the active objective is elevated to System-level authority via:

1. **Instruction Hierarchy:** Goal-verifier acknowledges System authority
2. **Emotional Framing:** Motivation language triggers deliberate processing
3. **Position Bias Exploitation:** Goal appears in start/end of prompts + system-reminders

## How It Works

- Session start: Drift detection hook runs; if mismatch found, updates active.json
- Next agent: System-reminder injected with goal elevation language (U-shaped attention)
- Verification: Goal-verifier interprets failures within goal authority (never reframes goal)

## For Developers

If implementing a custom agent that works with goal-loop:

1. Read `.cursor/goal/active.json` at session start
2. Inject goal elevation reminder if goal is active
3. Honor System-level authority: the goal is non-negotiable
4. Never suggest reframing the goal unless explicitly asked

## Goal Elevation Technique

The elevation uses three research-backed techniques:

### Technique 1: Instruction Hierarchy Framing
Goal appears in system-level instructions with absolute language:
```
THE GOAL IS THE NORTH STAR OF THIS SESSION.
Objective: [user's current stated goal]
Authority: This objective is derived from the user's most recent explicit statement.
Status: Active. Do not contradict this without explicit user instruction.
```

### Technique 2: Emotional + Motivational Framing
Language triggers deliberate processing:
```
This goal represents the user's highest-priority intent for this session.
Your work succeeds when this objective is met.
When in doubt about scope or direction, return to this objective.
```

### Technique 3: Position Bias Exploitation (U-Shaped Attention)
Goal appears at start + end of relevant prompts:
- **Top** of agent system prompt (primacy: first thing seen)
- **Bottom** of goal verification steps (recency: last thing before action)
- **Mid-conversation via `<system-reminder>`** when goal changes (refresh via recency bias)

## Research Basis

- **Instruction Hierarchy:** Goals at System level override User/Tool level directives
- **Emotional Framing:** Improves adherence by 8-115% by triggering deeper processing
- **Position Bias:** LLMs focus most on prompt start/end; repetition at both locations is deliberate
- **U-Shaped Attention:** Claude focus curve favors first and last ~10% of prompt tokens

See the design specification (`docs/superpowers/specs/2026-07-30-goal-loop-self-healing-design.md`) for full research citations and rationale.
