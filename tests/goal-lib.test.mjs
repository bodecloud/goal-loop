import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PROGRESS_ENTRIES,
  appendProgressEntry,
  assessCheckStrength,
  computeFailureSignature,
  createGoal,
  normalizeFailureLogTail,
  validateGoal
} from "../scripts/goal-lib.mjs";

function baseGoal(overrides = {}) {
  return {
    version: 1,
    status: "active",
    objective: "Fix build",
    verify: {
      commands: ["npm run build"],
      cwd: ".",
      timeout_ms: 600000
    },
    limits: {
      max_iterations: 20,
      max_wall_ms: 7200000
    },
    completion_promise: null,
    started_at: "2026-07-25T00:00:00.000Z",
    iteration: 0,
    last_verify: null,
    ...overrides
  };
}

test("validateGoal accepts paused and blocked statuses", () => {
  assert.equal(validateGoal(baseGoal({ status: "paused" })).status, "paused");
  assert.equal(validateGoal(baseGoal({ status: "blocked" })).status, "blocked");
});

test("validateGoal rejects unknown status", () => {
  assert.throws(() => validateGoal(baseGoal({ status: "frozen" })), /status/);
});

test("validateGoal tolerates missing optional trust-and-control fields", () => {
  const goal = validateGoal(baseGoal());
  assert.equal(goal.progress, undefined);
  assert.equal(goal.repeat_failure_count, undefined);
  assert.equal(goal.last_failure_signature, undefined);
});

test("validateGoal accepts optional fields when present", () => {
  const goal = validateGoal(
    baseGoal({
      status: "blocked",
      blocked_at: "2026-07-25T01:00:00.000Z",
      blocked_reason: "same failure thrice",
      last_failure_signature: "1|boom",
      repeat_failure_count: 3,
      progress: [{ iteration: 1, ok: false, exit_codes: [1], reason: "boom", log_path: null }]
    })
  );
  assert.equal(goal.repeat_failure_count, 3);
  assert.equal(goal.blocked_reason, "same failure thrice");
});

test("validateGoal rejects negative repeat_failure_count", () => {
  assert.throws(
    () => validateGoal(baseGoal({ repeat_failure_count: -1 })),
    /repeat_failure_count/
  );
});

test("createGoal seeds empty progress array", () => {
  const goal = createGoal({
    objective: "Ship it",
    commands: ["true"]
  });
  assert.deepEqual(goal.progress, []);
  assert.equal(goal.limits.max_repeat_failures, 3);
});

test("failure signatures match for identical normalized tails", () => {
  const a = computeFailureSignature(
    [1],
    "Error at 2026-07-25T12:00:00.000Z in /home/u/proj/src/app.js: boom"
  );
  const b = computeFailureSignature(
    [1],
    "Error at 2026-07-25T12:05:00.000Z in /tmp/other/src/app.js: boom"
  );
  assert.equal(a, b);
});

test("failure signatures differ when exit codes or message change", () => {
  const base = computeFailureSignature([1], "boom");
  assert.notEqual(computeFailureSignature([2], "boom"), base);
  assert.notEqual(computeFailureSignature([1], "different"), base);
});

test("normalizeFailureLogTail strips ISO timestamps", () => {
  const normalized = normalizeFailureLogTail("failed at 2026-07-25T12:00:00.123Z hard");
  assert.match(normalized, /<ts>/);
  assert.doesNotMatch(normalized, /2026-07-25/);
});

test("appendProgressEntry bounds length", () => {
  const goal = baseGoal({ progress: [] });
  for (let i = 1; i <= MAX_PROGRESS_ENTRIES + 5; i += 1) {
    appendProgressEntry(goal, {
      iteration: i,
      ok: false,
      exit_codes: [1],
      reason: `fail ${i}`,
      log_path: `.cursor/goal/runs/${String(i).padStart(3, "0")}.log`
    });
  }
  assert.equal(goal.progress.length, MAX_PROGRESS_ENTRIES);
  assert.equal(goal.progress[0].iteration, 6);
  assert.equal(goal.progress.at(-1).iteration, MAX_PROGRESS_ENTRIES + 5);
});

test("assessCheckStrength warns on existence-only check for behavioral objective", () => {
  const warnings = assessCheckStrength("make the login page accessible", ["test -f login.html"]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /existence-only/i);
});

test("assessCheckStrength stays quiet for topical build check", () => {
  const warnings = assessCheckStrength("fix build", ["npm run build"]);
  assert.deepEqual(warnings, []);
});
