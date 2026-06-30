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
