#!/usr/bin/env bash
# Claude Code / Grok / Copilot Stop adapter for Goal Loop.
# Translates Cursor followup_message output into Claude's decision:block shape.
# Paused and blocked goals end the loop via {} from goal-stop.mjs, so this
# adapter needs no special branches for those statuses — empty followup means stop.
set -euo pipefail

# Consume Claude Stop hook stdin (session metadata). Goal Loop does not need it.
cat >/dev/null || true

ROOT="${CLAUDE_PLUGIN_ROOT:-${GOAL_LOOP_ROOT:-}}"
if [[ -z "${ROOT}" ]]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Goal Loop: node is required for the stop hook" >&2
  exit 0
fi

RESULT="$(printf '%s' '{"status":"completed"}' | node "${ROOT}/hooks/goal-stop.mjs" 2>/dev/null || echo '{}')"

if ! command -v jq >/dev/null 2>&1; then
  # Fail open if jq is missing — never trap the agent.
  exit 0
fi

MSG="$(printf '%s' "${RESULT}" | jq -r '.followup_message // empty' 2>/dev/null || true)"
if [[ -n "${MSG}" ]]; then
  jq -n \
    --arg reason "${MSG}" \
    --arg msg "Goal Loop: check failed — continue the objective" \
    '{
      "decision": "block",
      "reason": $reason,
      "systemMessage": $msg
    }'
fi

exit 0
