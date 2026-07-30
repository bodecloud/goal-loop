import { compareDriftLevel, formatDriftPrompt, recordDriftHistory } from "../scripts/goal-lib.mjs";
import { strict as assert } from "assert";

export const tests = [
  {
    name: "compareDriftLevel detects exact match (no drift)",
    fn: () => {
      const result = compareDriftLevel("Learn PotPlayer renderer internals", "Learn PotPlayer renderer internals");
      assert.equal(result.isDrift, false);
      assert.equal(result.level, "exact");
    }
  },
  {
    name: "compareDriftLevel detects contradiction (drift)",
    fn: () => {
      const result = compareDriftLevel("Learn PotPlayer renderer internals", "Full cross-platform PotPlayer rewrite");
      assert.equal(result.isDrift, true);
      assert.equal(result.level, "contradiction");
    }
  },
  {
    name: "formatDriftPrompt returns user-facing message",
    fn: () => {
      const prompt = formatDriftPrompt("Rewrite all", "Learn internals");
      assert(prompt.includes("Rewrite all"));
      assert(prompt.includes("Learn internals"));
      assert(prompt.includes("Update"));
    }
  },
  {
    name: "recordDriftHistory adds entry and updates goal",
    fn: () => {
      const goal = { version: 1, objective: "New", drift_history: [] };
      const updated = recordDriftHistory(goal, "Old", "New", true);
      assert.equal(updated.drift_history.length, 1);
      assert.equal(updated.drift_history[0].previous_objective, "Old");
      assert.equal(updated.drift_history[0].new_objective, "New");
      assert.equal(updated.drift_history[0].user_approved, true);
      assert(updated.drift_history[0].detected_at);
    }
  }
];

// Run all tests
for (const test of tests) {
  try {
    test.fn();
    console.log(`✓ ${test.name}`);
  } catch (err) {
    console.error(`✗ ${test.name}: ${err.message}`);
    process.exit(1);
  }
}
