import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = resolve(import.meta.dirname, "..");
const goalctl = resolve(repoRoot, "scripts/goalctl.mjs");

function tempProject() {
  const dir = mkdtempSync(resolve(tmpdir(), "goal-loop-"));
  return {
    dir,
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

function runGoalctl(projectDir, args) {
  return spawnSync(process.execPath, [goalctl, ...args], {
    cwd: projectDir,
    encoding: "utf8"
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("start creates an active goal with explicit verifier", () => {
  const project = tempProject();
  try {
    const result = runGoalctl(project.dir, [
      "start",
      "Fix build",
      "--verify",
      "npm run build",
      "--timeout-ms",
      "1000"
    ]);
    assert.equal(result.status, 0, result.stderr);
    const active = readJson(resolve(project.dir, ".cursor/goal/active.json"));
    assert.equal(active.status, "active");
    assert.equal(active.objective, "Fix build");
    assert.deepEqual(active.verify.commands, ["npm run build"]);
    assert.equal(active.verify.timeout_ms, 1000);
  } finally {
    project.cleanup();
  }
});

test("start uses project defaults when verifier is omitted", () => {
  const project = tempProject();
  try {
    const defaultsPath = resolve(project.dir, ".cursor/goal/defaults.json");
    mkdirSync(dirname(defaultsPath), { recursive: true });
    writeFileSync(defaultsPath, JSON.stringify({ verify: { commands: ["node --version"] } }));

    const result = runGoalctl(project.dir, ["start", "Check node"]);
    assert.equal(result.status, 0, result.stderr);
    const active = readJson(resolve(project.dir, ".cursor/goal/active.json"));
    assert.deepEqual(active.verify.commands, ["node --version"]);
  } finally {
    project.cleanup();
  }
});

test("status reports no active goal", () => {
  const project = tempProject();
  try {
    const result = runGoalctl(project.dir, ["status"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.active, false);
  } finally {
    project.cleanup();
  }
});

test("abort marks an active goal aborted", () => {
  const project = tempProject();
  try {
    assert.equal(runGoalctl(project.dir, ["start", "Stop me", "--verify", "true"]).status, 0);
    const result = runGoalctl(project.dir, ["abort"]);
    assert.equal(result.status, 0, result.stderr);
    const active = readJson(resolve(project.dir, ".cursor/goal/active.json"));
    assert.equal(active.status, "aborted");
    assert.ok(active.aborted_at);
  } finally {
    project.cleanup();
  }
});

test("active goal without verifier is rejected", () => {
  const project = tempProject();
  try {
    const result = runGoalctl(project.dir, ["start", "No verifier"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /verifier command is required/);
  } finally {
    project.cleanup();
  }
});

test("pause sets paused status and retains iteration", () => {
  const project = tempProject();
  try {
    assert.equal(runGoalctl(project.dir, ["start", "Hold me", "--verify", "true"]).status, 0);
    const activePath = resolve(project.dir, ".cursor/goal/active.json");
    const before = readJson(activePath);
    before.iteration = 4;
    writeFileSync(activePath, `${JSON.stringify(before, null, 2)}\n`);

    const result = runGoalctl(project.dir, ["pause"]);
    assert.equal(result.status, 0, result.stderr);
    const active = readJson(activePath);
    assert.equal(active.status, "paused");
    assert.equal(active.iteration, 4);
    assert.deepEqual(active.verify.commands, ["true"]);
    assert.ok(active.paused_at);
  } finally {
    project.cleanup();
  }
});

test("resume restores paused goal to active at same iteration", () => {
  const project = tempProject();
  try {
    assert.equal(runGoalctl(project.dir, ["start", "Hold me", "--verify", "true"]).status, 0);
    const activePath = resolve(project.dir, ".cursor/goal/active.json");
    const before = readJson(activePath);
    before.iteration = 4;
    writeFileSync(activePath, `${JSON.stringify(before, null, 2)}\n`);
    assert.equal(runGoalctl(project.dir, ["pause"]).status, 0);

    const result = runGoalctl(project.dir, ["resume"]);
    assert.equal(result.status, 0, result.stderr);
    const active = readJson(activePath);
    assert.equal(active.status, "active");
    assert.equal(active.iteration, 4);
    assert.equal(active.paused_at, undefined);
  } finally {
    project.cleanup();
  }
});

test("pause with no active goal returns a clear message", () => {
  const project = tempProject();
  try {
    const result = runGoalctl(project.dir, ["pause"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, false);
    assert.match(parsed.message, /No active goal/);
  } finally {
    project.cleanup();
  }
});

test("resume on active goal is a clear no-op error", () => {
  const project = tempProject();
  try {
    assert.equal(runGoalctl(project.dir, ["start", "Already going", "--verify", "true"]).status, 0);
    const result = runGoalctl(project.dir, ["resume"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, false);
    assert.match(parsed.message, /already active/i);
  } finally {
    project.cleanup();
  }
});

test("pause on already-paused goal is a clear no-op", () => {
  const project = tempProject();
  try {
    assert.equal(runGoalctl(project.dir, ["start", "Hold me", "--verify", "true"]).status, 0);
    assert.equal(runGoalctl(project.dir, ["pause"]).status, 0);
    const result = runGoalctl(project.dir, ["pause"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, true);
    assert.match(parsed.message, /already paused/i);
  } finally {
    project.cleanup();
  }
});
