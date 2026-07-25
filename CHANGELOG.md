# Changelog

## Unreleased

- Added pause, resume, and an earned `blocked` stop when the same check failure repeats.
- Added a bounded progress trail and richer `/goal-status` trend readout.
- Added advisory weak-check coaching at `/goal` and `/plan` start time (never overrides the check).
- Added multi-CLI packaging: `.claude-plugin/`, `.plugin/`, `gemini-extension.json`, and a Claude Stop-hook adapter.
- Added `npm run install:global` to install into Cursor, Claude Code, Grok, Gemini, and Copilot CLIs.

## v0.1.0 - 2026-06-30

- Initial Cursor plugin release with `/goal`, `/plan`, `/goal-status`, and `/goal-abort`.
- Added a check-backed Cursor stop hook with `followup_message` continuation.
- Added project-local goal state, check logs, iteration limits, and timeout handling.
- Added reusable goal contract documentation for adapting the pattern to other agents.
- Added unit tests and plugin manifest validation.
