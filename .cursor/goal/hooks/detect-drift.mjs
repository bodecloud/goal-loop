#!/usr/bin/env node
import { readJsonFile, writeJsonFile, compareDriftLevel, formatDriftPrompt, recordDriftHistory, ACTIVE_PATH } from "../../../scripts/goal-lib.mjs";

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input.trim() ? JSON.parse(input) : {};
}

function printHookResult(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function detectDrift() {
  try {
    // This hook receives no stdin in current goal-loop flow
    // It reads active.json directly
    const goal = readJsonFile(ACTIVE_PATH);

    if (!goal || goal.status !== "active") {
      printHookResult({});
      return;
    }

    // Session start: check if goal might be stale
    // In a real integration, we'd parse recent conversation history
    // For now, this hook serves as a detection point that can be triggered
    // by a parent hook passing the user's current stated goal via stdin

    const input = await readStdin();
    if (!input.userStatement) {
      // No statement to compare against
      printHookResult({});
      return;
    }

    const userStatement = input.userStatement;
    const drift = compareDriftLevel(userStatement, goal.objective);

    if (!drift.isDrift) {
      printHookResult({});
      return;
    }

    // Drift detected: prepare confirmation message
    const confirmationPrompt = formatDriftPrompt(goal.objective, userStatement);

    printHookResult({
      drift_detected: true,
      drift_level: drift.level,
      old_objective: goal.objective,
      new_objective: userStatement,
      confirmation_prompt: confirmationPrompt,
      followup_message: `${confirmationPrompt}\n\nRespond with 'yes' to update, or 'no' to keep current goal.`
    });

  } catch (error) {
    console.error(`[detect-drift] error: ${error.message}`);
    printHookResult({});
  }
}

await detectDrift();
