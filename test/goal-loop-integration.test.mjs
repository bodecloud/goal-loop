import { readJsonFile, writeJsonFile, compareDriftLevel, formatDriftPrompt, recordDriftHistory, syncGoal } from "../scripts/goal-lib.mjs";
import { strict as assert } from "assert";
import { existsSync, rmSync, mkdirSync } from "node:fs";

const TEST_GOAL_DIR = ".cursor/goal-test";
const TEST_ACTIVE = `${TEST_GOAL_DIR}/active.json`;

function setupTestEnv() {
  if (existsSync(TEST_GOAL_DIR)) rmSync(TEST_GOAL_DIR, { recursive: true });
  mkdirSync(TEST_GOAL_DIR, { recursive: true });
}

function teardownTestEnv() {
  if (existsSync(TEST_GOAL_DIR)) rmSync(TEST_GOAL_DIR, { recursive: true });
}

const tests = [
  {
    name: "Happy Path: User corrects goal and system syncs",
    fn: () => {
      setupTestEnv();

      // Initial goal
      let goal = {
        version: 1,
        status: "active",
        objective: "Goal A",
        started_at: "2026-07-30T12:00:00Z",
        stated_at: "2026-07-30T12:00:00Z",
        iteration: 3,
        drift_history: []
      };

      // User states new goal
      const drift = compareDriftLevel("Goal B", goal.objective);
      assert.equal(drift.isDrift, true);

      // Sync confirmed
      goal = syncGoal(goal, "Goal B", true);

      assert.equal(goal.objective, "Goal B");
      assert.equal(goal.iteration, 0); // Reset
      assert.equal(goal.drift_history.length, 1);
      assert.equal(goal.drift_history[0].user_approved, true);

      teardownTestEnv();
    }
  },
  {
    name: "Edge Case: Stale goal at session start",
    fn: () => {
      setupTestEnv();

      // Goal from previous session (2 days old)
      let goal = {
        version: 1,
        status: "active",
        objective: "Old goal from before",
        started_at: "2026-07-28T12:00:00Z",
        stated_at: "2026-07-28T12:00:00Z",
        iteration: 15,
        drift_history: []
      };

      // Current session: user says something different
      const drift = compareDriftLevel("New goal for today", goal.objective);
      assert.equal(drift.isDrift, true);
      // Level may be "contradiction" or "partial" depending on token overlap
      assert(["contradiction", "partial"].includes(drift.level));

      // Sync
      goal = syncGoal(goal, "New goal for today", true);
      assert.equal(goal.objective, "New goal for today");
      assert.equal(goal.iteration, 0);

      teardownTestEnv();
    }
  },
  {
    name: "Edge Case: Goal change mid-verification doesn't reset state incorrectly",
    fn: () => {
      setupTestEnv();

      let goal = {
        version: 1,
        status: "active",
        objective: "Goal A",
        started_at: "2026-07-30T12:00:00Z",
        stated_at: "2026-07-30T12:00:00Z",
        iteration: 5,
        verify: { commands: ["test-cmd"] },
        drift_history: []
      };

      // Mid-verification, goal changes
      goal = syncGoal(goal, "Goal B", true);

      // Verify commands still present
      assert(goal.verify);
      assert.equal(goal.verify.commands[0], "test-cmd");

      // Iteration reset
      assert.equal(goal.iteration, 0);

      teardownTestEnv();
    }
  },
  {
    name: "Error Path: User dismisses drift confirmation",
    fn: () => {
      setupTestEnv();

      let goal = {
        version: 1,
        status: "active",
        objective: "Current goal",
        started_at: "2026-07-30T12:00:00Z",
        stated_at: "2026-07-30T12:00:00Z",
        iteration: 2,
        drift_history: []
      };

      // Drift detected
      const drift = compareDriftLevel("Different goal", goal.objective);
      assert.equal(drift.isDrift, true);

      // User says NO: record but don't sync
      goal = recordDriftHistory(goal, goal.objective, "Different goal", false);

      // Goal unchanged
      assert.equal(goal.objective, "Current goal");
      // But drift is logged
      assert.equal(goal.drift_history.length, 1);
      assert.equal(goal.drift_history[0].user_approved, false);

      teardownTestEnv();
    }
  }
];

// Run all tests
console.log("Running goal-loop integration tests...\n");
let passed = 0;
for (const test of tests) {
  try {
    test.fn();
    console.log(`✓ ${test.name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${test.name}: ${err.message}`);
  }
}

console.log(`\n${passed}/${tests.length} tests passed`);
if (passed !== tests.length) {
  process.exit(1);
}
