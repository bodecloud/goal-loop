import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = resolve(import.meta.dirname, "..");
const goalctl = resolve(repoRoot, "scripts/goalctl.mjs");

function withProject(run) {
  const dir = mkdtempSync(resolve(tmpdir(), "goal-loop-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runGoalctl(projectDir, args) {
  return spawnSync(process.execPath, [goalctl, ...args], {
    cwd: projectDir,
    encoding: "utf8"
  });
}

function activePath(projectDir) {
  return resolve(projectDir, ".cursor/goal/active.json");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

test("start creates an active goal with explicit verifier", () => {
  withProject((dir) => {
    const result = runGoalctl(dir, [
      "start",
      "Fix build",
      "--verify",
      "npm run build",
      "--timeout-ms",
      "1000"
    ]);
    assert.equal(result.status, 0, result.stderr);
    const active = readJson(activePath(dir));
    assert.equal(active.status, "active");
    assert.equal(active.objective, "Fix build");
    assert.deepEqual(active.verify.commands, ["npm run build"]);
    assert.equal(active.verify.timeout_ms, 1000);
  });
});

test("start uses project defaults when verifier is omitted", () => {
  withProject((dir) => {
    writeJson(resolve(dir, ".cursor/goal/defaults.json"), {
      verify: { commands: ["node --version"] }
    });

    const result = runGoalctl(dir, ["start", "Check node"]);
    assert.equal(result.status, 0, result.stderr);
    const active = readJson(activePath(dir));
    assert.deepEqual(active.verify.commands, ["node --version"]);
  });
});

test("status reports no active goal", () => {
  withProject((dir) => {
    const result = runGoalctl(dir, ["status"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.active, false);
  });
});

test("abort marks an active goal aborted", () => {
  withProject((dir) => {
    assert.equal(runGoalctl(dir, ["start", "Stop me", "--verify", "true"]).status, 0);
    const result = runGoalctl(dir, ["abort"]);
    assert.equal(result.status, 0, result.stderr);
    const active = readJson(activePath(dir));
    assert.equal(active.status, "aborted");
    assert.ok(active.aborted_at);
  });
});

test("active goal without verifier is rejected", () => {
  withProject((dir) => {
    const result = runGoalctl(dir, ["start", "No verifier"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /verifier command is required/);
  });
});

test("pause sets paused status and retains iteration", () => {
  withProject((dir) => {
    assert.equal(runGoalctl(dir, ["start", "Hold me", "--verify", "true"]).status, 0);
    const before = readJson(activePath(dir));
    writeJson(activePath(dir), { ...before, iteration: 4 });

    const result = runGoalctl(dir, ["pause"]);
    assert.equal(result.status, 0, result.stderr);
    const active = readJson(activePath(dir));
    assert.equal(active.status, "paused");
    assert.equal(active.iteration, 4);
    assert.deepEqual(active.verify.commands, ["true"]);
    assert.ok(active.paused_at);
  });
});

test("resume restores paused goal to active at same iteration", () => {
  withProject((dir) => {
    assert.equal(runGoalctl(dir, ["start", "Hold me", "--verify", "true"]).status, 0);
    const before = readJson(activePath(dir));
    writeJson(activePath(dir), { ...before, iteration: 4 });
    assert.equal(runGoalctl(dir, ["pause"]).status, 0);

    const result = runGoalctl(dir, ["resume"]);
    assert.equal(result.status, 0, result.stderr);
    const active = readJson(activePath(dir));
    assert.equal(active.status, "active");
    assert.equal(active.iteration, 4);
    assert.equal(active.paused_at, undefined);
  });
});

test("pause with no active goal returns a clear message", () => {
  withProject((dir) => {
    const result = runGoalctl(dir, ["pause"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, false);
    assert.match(parsed.message, /No active goal/);
  });
});

test("resume on active goal is a clear no-op error", () => {
  withProject((dir) => {
    assert.equal(runGoalctl(dir, ["start", "Already going", "--verify", "true"]).status, 0);
    const result = runGoalctl(dir, ["resume"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, false);
    assert.match(parsed.message, /already active/i);
  });
});

test("pause on already-paused goal is a clear no-op", () => {
  withProject((dir) => {
    assert.equal(runGoalctl(dir, ["start", "Hold me", "--verify", "true"]).status, 0);
    assert.equal(runGoalctl(dir, ["pause"]).status, 0);
    const result = runGoalctl(dir, ["pause"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, true);
    assert.match(parsed.message, /already paused/i);
  });
});

test("status includes trend for paused and blocked goals", () => {
  withProject((dir) => {
    assert.equal(runGoalctl(dir, ["start", "Watch me", "--verify", "true"]).status, 0);
    assert.equal(runGoalctl(dir, ["pause"]).status, 0);
    let result = runGoalctl(dir, ["status"]);
    assert.equal(result.status, 0, result.stderr);
    let parsed = JSON.parse(result.stdout);
    assert.equal(parsed.goal.status, "paused");
    assert.equal(parsed.goal.trend, "paused");

    writeJson(activePath(dir), {
      ...readJson(activePath(dir)),
      status: "blocked",
      blocked_reason: "exit 1: npm test",
      blocked_at: new Date().toISOString(),
      last_verify: {
        ok: false,
        exit_codes: [1],
        command_results: [],
        log_path: ".cursor/goal/runs/003.log",
        completed_at: new Date().toISOString()
      }
    });

    result = runGoalctl(dir, ["status"]);
    assert.equal(result.status, 0, result.stderr);
    parsed = JSON.parse(result.stdout);
    assert.equal(parsed.goal.status, "blocked");
    assert.equal(parsed.goal.trend, "blocked");
    assert.equal(parsed.goal.blocked_reason, "exit 1: npm test");
    assert.equal(parsed.goal.log_path, ".cursor/goal/runs/003.log");
  });
});

test("start warns on weak existence-only check but still creates the goal", () => {
  withProject((dir) => {
    const result = runGoalctl(dir, [
      "start",
      "make the login page accessible",
      "--verify",
      "test -f login.html"
    ]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.warnings.length, 1);
    assert.match(parsed.warnings[0], /existence-only/i);
    const active = readJson(activePath(dir));
    assert.equal(active.status, "active");
    assert.deepEqual(active.verify.commands, ["test -f login.html"]);
  });
});

test("start with topical build check returns no warnings", () => {
  withProject((dir) => {
    const result = runGoalctl(dir, ["start", "fix build", "--verify", "npm run build"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.deepEqual(parsed.warnings, []);
  });
});

test("resume from blocked clears repeat-failure tracking", () => {
  withProject((dir) => {
    assert.equal(runGoalctl(dir, ["start", "Unstick me", "--verify", "true"]).status, 0);
    const path = activePath(dir);
    const goal = readJson(path);
    goal.status = "blocked";
    goal.blocked_at = new Date().toISOString();
    goal.blocked_reason = "exit 1: npm test";
    goal.repeat_failure_count = 3;
    goal.last_failure_signature = "1|boom";
    goal.iteration = 5;
    writeJson(path, goal);

    const result = runGoalctl(dir, ["resume"]);
    assert.equal(result.status, 0, result.stderr);
    const active = readJson(path);
    assert.equal(active.status, "active");
    assert.equal(active.iteration, 5);
    assert.equal(active.repeat_failure_count, 0);
    assert.equal(active.last_failure_signature, null);
    assert.equal(active.blocked_reason, undefined);
  });
});

test("status trend is stuck when repeat_failure_count is at least 2", () => {
  withProject((dir) => {
    assert.equal(runGoalctl(dir, ["start", "Watch trend", "--verify", "true"]).status, 0);
    const path = activePath(dir);
    const goal = readJson(path);
    goal.repeat_failure_count = 2;
    goal.last_failure_signature = "1|same";
    writeJson(path, goal);

    const result = runGoalctl(dir, ["status"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.goal.trend, "stuck");
  });
});
