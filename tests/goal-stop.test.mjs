import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = resolve(import.meta.dirname, "..");
const hook = resolve(repoRoot, "hooks/goal-stop.mjs");

function withProject(run) {
  const dir = mkdtempSync(resolve(tmpdir(), "goal-loop-hook-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function verify(commands) {
  return { commands, cwd: ".", timeout_ms: 5000 };
}

function limits(overrides = {}) {
  return { max_iterations: 20, max_wall_ms: 7200000, ...overrides };
}

function writeActive(projectDir, overrides = {}) {
  const goal = {
    version: 1,
    status: "active",
    objective: "Prove hook behavior",
    verify: verify(["true"]),
    limits: limits(),
    completion_promise: null,
    started_at: new Date().toISOString(),
    iteration: 0,
    last_verify: null,
    ...overrides
  };
  const activePath = resolve(projectDir, ".cursor/goal/active.json");
  mkdirSync(dirname(activePath), { recursive: true });
  writeFileSync(activePath, `${JSON.stringify(goal, null, 2)}\n`);
  return activePath;
}

function runHook(projectDir, input = { status: "completed" }) {
  return spawnSync(process.execPath, [hook], {
    cwd: projectDir,
    input: JSON.stringify(input),
    encoding: "utf8"
  });
}

function readActive(projectDir) {
  return JSON.parse(readFileSync(resolve(projectDir, ".cursor/goal/active.json"), "utf8"));
}

test("returns empty object when no active goal exists", () => {
  withProject((dir) => {
    const result = runHook(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
  });
});

test("passing verifier marks goal completed and returns empty object", () => {
  withProject((dir) => {
    writeActive(dir, { verify: verify(["true"]) });
    const result = runHook(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    const active = readActive(dir);
    assert.equal(active.status, "completed");
    assert.equal(active.iteration, 1);
    assert.equal(active.last_verify.ok, true);
  });
});

test("failing verifier returns followup_message and writes a log", () => {
  withProject((dir) => {
    writeActive(dir, {
      verify: verify(["node -e \"console.error('boom'); process.exit(7)\""])
    });
    const result = runHook(dir);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.match(parsed.followup_message, /Goal Loop verification failed/);
    assert.match(parsed.followup_message, /boom/);
    const active = readActive(dir);
    assert.equal(active.status, "active");
    assert.equal(active.iteration, 1);
    assert.equal(active.last_verify.ok, false);
    assert.equal(active.last_verify.exit_codes[0], 7);
    assert.match(readFileSync(resolve(dir, active.last_verify.log_path), "utf8"), /boom/);
  });
});

test("max iterations aborts without followup", () => {
  withProject((dir) => {
    writeActive(dir, {
      iteration: 20,
      limits: limits(),
      verify: verify(["false"])
    });
    const result = runHook(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    const active = readActive(dir);
    assert.equal(active.status, "aborted");
    assert.equal(active.abort_reason, "max_iterations");
  });
});

test("non-completed hook status does not run verifier", () => {
  withProject((dir) => {
    writeActive(dir, { verify: verify(["false"]) });
    const result = runHook(dir, { status: "aborted" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    assert.equal(readActive(dir).iteration, 0);
  });
});

test("malformed input fails open and writes hook error log", () => {
  withProject((dir) => {
    const result = spawnSync(process.execPath, [hook], {
      cwd: dir,
      input: "{bad json",
      encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    assert.match(
      readFileSync(resolve(dir, ".cursor/goal/runs/hook-errors.log"), "utf8"),
      /SyntaxError/
    );
  });
});

test("paused goal produces empty result and runs no check", () => {
  withProject((dir) => {
    writeActive(dir, {
      status: "paused",
      iteration: 4,
      verify: verify(["false"])
    });
    const result = runHook(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    const active = readActive(dir);
    assert.equal(active.status, "paused");
    assert.equal(active.iteration, 4);
    assert.equal(active.last_verify, null);
  });
});

test("failing iteration appends a progress entry", () => {
  withProject((dir) => {
    writeActive(dir, {
      verify: verify(["node -e \"console.error('boom'); process.exit(7)\""])
    });
    const result = runHook(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(JSON.parse(result.stdout).followup_message, /verification failed/);
    const active = readActive(dir);
    assert.equal(active.progress.length, 1);
    assert.equal(active.progress[0].iteration, 1);
    assert.equal(active.progress[0].ok, false);
    assert.equal(active.progress[0].exit_codes[0], 7);
    assert.ok(active.last_verify.log_path);
  });
});

test("three identical failures transition to blocked", () => {
  withProject((dir) => {
    writeActive(dir, {
      verify: verify(["node -e \"console.error('same-fail'); process.exit(3)\""]),
      limits: limits({ max_repeat_failures: 3 })
    });

    for (let i = 0; i < 2; i += 1) {
      const result = runHook(dir);
      assert.equal(result.status, 0, result.stderr);
      assert.match(JSON.parse(result.stdout).followup_message || "", /verification failed/);
      assert.equal(readActive(dir).status, "active");
    }

    const third = runHook(dir);
    assert.equal(third.status, 0, third.stderr);
    assert.deepEqual(JSON.parse(third.stdout), {});
    const active = readActive(dir);
    assert.equal(active.status, "blocked");
    assert.equal(active.repeat_failure_count, 3);
    assert.match(active.blocked_reason, /exit 3/);
    assert.notEqual(active.status, "completed");
  });
});

test("two identical then different failure does not block", () => {
  withProject((dir) => {
    writeActive(dir, {
      verify: verify(["node -e \"console.error('aaa'); process.exit(1)\""]),
      limits: limits({ max_repeat_failures: 3 })
    });
    assert.equal(runHook(dir).status, 0);
    assert.equal(runHook(dir).status, 0);

    writeActive(dir, {
      ...readActive(dir),
      verify: verify(["node -e \"console.error('bbb'); process.exit(2)\""])
    });
    const third = runHook(dir);
    assert.equal(third.status, 0, third.stderr);
    assert.match(JSON.parse(third.stdout).followup_message, /verification failed/);
    const active = readActive(dir);
    assert.equal(active.status, "active");
    assert.equal(active.repeat_failure_count, 1);
  });
});

test("fail then pass marks completed never blocked", () => {
  withProject((dir) => {
    writeActive(dir, {
      verify: verify(['node -e "process.exit(1)"']),
      limits: limits({ max_repeat_failures: 3 })
    });
    assert.equal(runHook(dir).status, 0);

    writeActive(dir, { ...readActive(dir), verify: verify(["true"]) });
    const result = runHook(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    assert.equal(readActive(dir).status, "completed");
  });
});

test("max_repeat_failures of 2 blocks on second identical failure", () => {
  withProject((dir) => {
    writeActive(dir, {
      verify: verify(["node -e \"console.error('x'); process.exit(9)\""]),
      limits: limits({ max_repeat_failures: 2 })
    });
    assert.equal(runHook(dir).status, 0);
    const second = runHook(dir);
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(JSON.parse(second.stdout), {});
    assert.equal(readActive(dir).status, "blocked");
  });
});
