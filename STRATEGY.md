---
name: Goal Loop
last_updated: 2026-07-25
---

# Goal Loop Strategy

## Target problem

Coding agents decide for themselves when work is finished, so a confident "done" and a real one look identical to the operator. The crux is that the agent that did the work is also the judge of the work, and long unattended runs give the operator no honest place to intervene.

## Our approach

A shell command's exit code, not agent prose, decides when a goal is complete. Goal Loop keeps that contract in a small project-local state file and a fail-open stop hook, so the loop stays a control plane the operator can steer rather than a runtime that replaces the agent.

## Who it's for

**Primary:** Solo engineer running an agent CLI unattended - they're hiring Goal Loop to keep an agent working on one objective until a check they wrote actually passes, without babysitting the chat.

## Key metrics

- **Verified completion rate** - share of goals reaching `completed` via a passing check rather than abort or manual stop; read from `.cursor/goal/` run state.
- **False-done incidents** - runs marked complete where the objective was not actually met; counted manually from dogfood and user reports.
- **Unattended run length** - iterations or wall-clock time a goal survives before a human has to intervene; read from run logs.
- **Install-to-first-goal** - whether a new user gets from install to a started goal without reading source; tracked from issues and onboarding feedback.

## Tracks

### Trust and control

Lifecycle and visibility for a running goal: pause, resume, an earned `blocked` stop, a readable progress trail, and advisory coaching when a check looks too weak.

_Why it serves the approach:_ An operator will only leave a loop running if they can steer it and read where it stands.

### Durable handoff

Stopping cleanly when limits approach and leaving a checkpoint the next turn can resume from.

_Why it serves the approach:_ A run that dies at a wall without a handoff loses the work the check was supposed to protect.

### Multi-CLI reach

Keeping the same goal contract and operator experience working across Cursor, Claude, Grok, Gemini, and Copilot.

_Why it serves the approach:_ The completion contract is only valuable if it follows the operator to whichever agent they use.

## Not working on

- Multi-agent orchestration, task graphs, or scheduling more than one goal.
- Substituting or refusing a user's chosen check; coaching stays advisory.
- Becoming an agent runtime; Goal Loop steers the host agent rather than replacing it.

## Marketing

**One-liner:** Keep your coding agent working until a shell check actually passes.

**Key message:** Goal Loop gives any agent CLI a Codex-style `/goal` loop where a command exit code owns completion. State lives in your repo, the hook fails open, and you can pause, resume, or stop a run honestly.
