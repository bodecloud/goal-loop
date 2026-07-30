#!/usr/bin/env node
import { readJsonFile, writeJsonFile, syncGoal, ACTIVE_PATH } from "../../../scripts/goal-lib.mjs";

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

async function handleSync() {
  try {
    const input = await readStdin();

    if (!input.approved || !input.newObjective) {
      printHookResult({});
      return;
    }

    const goal = readJsonFile(ACTIVE_PATH);
    if (!goal) {
      printHookResult({ error: "No active goal found" });
      return;
    }

    const updated = syncGoal(goal, input.newObjective, input.approved);
    writeJsonFile(ACTIVE_PATH, updated);

    printHookResult({
      synced: true,
      goal_updated_at: updated.stated_at,
      new_objective: updated.objective,
      drift_recorded: true
    });

  } catch (error) {
    console.error(`[goal-sync] error: ${error.message}`);
    printHookResult({ error: error.message });
  }
}

await handleSync();
