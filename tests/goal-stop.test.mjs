import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = resolve(import.meta.dirname, "..");
const hook = resolve(repoRoot, "hooks/goal-stop.mjs");

function tempProject() {
  const dir = mkdtempSync(resolve(tmpdir(), "goal-loop-hook-"));
  return {
    dir,
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

function writeActive(projectDir, overrides = {}) {
  const goal = {
    version: 1,
    status: "active",
    objective: "Prove hook behavior",
    verify: {
      commands: ["true"],
      cwd: ".",
      timeout_ms: 5000
    },
    limits: {
      max_iterations: 20,
      max_wall_ms: 7200000
    },
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
  const project = tempProject();
  try {
    const result = runHook(project.dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
  } finally {
    project.cleanup();
  }
});

test("passing verifier marks goal completed and returns empty object", () => {
  const project = tempProject();
  try {
    writeActive(project.dir, { verify: { commands: ["true"], cwd: ".", timeout_ms: 5000 } });
    const result = runHook(project.dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    const active = readActive(project.dir);
    assert.equal(active.status, "completed");
    assert.equal(active.iteration, 1);
    assert.equal(active.last_verify.ok, true);
  } finally {
    project.cleanup();
  }
});

test("failing verifier returns followup_message and writes a log", () => {
  const project = tempProject();
  try {
    writeActive(project.dir, {
      verify: {
        commands: ["node -e \"console.error('boom'); process.exit(7)\""],
        cwd: ".",
        timeout_ms: 5000
      }
    });
    const result = runHook(project.dir);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.match(parsed.followup_message, /Goal Loop verification failed/);
    assert.match(parsed.followup_message, /boom/);
    const active = readActive(project.dir);
    assert.equal(active.status, "active");
    assert.equal(active.iteration, 1);
    assert.equal(active.last_verify.ok, false);
    assert.equal(active.last_verify.exit_codes[0], 7);
    assert.match(readFileSync(resolve(project.dir, active.last_verify.log_path), "utf8"), /boom/);
  } finally {
    project.cleanup();
  }
});

test("max iterations aborts without followup", () => {
  const project = tempProject();
  try {
    writeActive(project.dir, {
      iteration: 20,
      limits: { max_iterations: 20, max_wall_ms: 7200000 },
      verify: { commands: ["false"], cwd: ".", timeout_ms: 5000 }
    });
    const result = runHook(project.dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    const active = readActive(project.dir);
    assert.equal(active.status, "aborted");
    assert.equal(active.abort_reason, "max_iterations");
  } finally {
    project.cleanup();
  }
});

test("non-completed hook status does not run verifier", () => {
  const project = tempProject();
  try {
    writeActive(project.dir, { verify: { commands: ["false"], cwd: ".", timeout_ms: 5000 } });
    const result = runHook(project.dir, { status: "aborted" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    const active = readActive(project.dir);
    assert.equal(active.iteration, 0);
  } finally {
    project.cleanup();
  }
});

test("malformed input fails open and writes hook error log", () => {
  const project = tempProject();
  try {
    const result = spawnSync(process.execPath, [hook], {
      cwd: project.dir,
      input: "{bad json",
      encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    assert.match(
      readFileSync(resolve(project.dir, ".cursor/goal/runs/hook-errors.log"), "utf8"),
      /SyntaxError/
    );
  } finally {
    project.cleanup();
  }
});

test("paused goal produces empty result and runs no check", () => {
  const project = tempProject();
  try {
    writeActive(project.dir, {
      status: "paused",
      iteration: 4,
      verify: { commands: ["false"], cwd: ".", timeout_ms: 5000 }
    });
    const result = runHook(project.dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    const active = readActive(project.dir);
    assert.equal(active.status, "paused");
    assert.equal(active.iteration, 4);
    assert.equal(active.last_verify, null);
  } finally {
    project.cleanup();
  }
});

test("failing iteration appends a progress entry", () => {
  const project = tempProject();
  try {
    writeActive(project.dir, {
      verify: {
        commands: ["node -e \"console.error('boom'); process.exit(7)\""],
        cwd: ".",
        timeout_ms: 5000
      }
    });
    const result = runHook(project.dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(JSON.parse(result.stdout).followup_message, /verification failed/);
    const active = readActive(project.dir);
    assert.equal(active.progress.length, 1);
    assert.equal(active.progress[0].iteration, 1);
    assert.equal(active.progress[0].ok, false);
    assert.equal(active.progress[0].exit_codes[0], 7);
    assert.ok(active.last_verify.log_path);
  } finally {
    project.cleanup();
  }
});

test("three identical failures transition to blocked", () => {
  const project = tempProject();
  try {
    writeActive(project.dir, {
      verify: {
        commands: ["node -e \"console.error('same-fail'); process.exit(3)\""],
        cwd: ".",
        timeout_ms: 5000
      },
      limits: { max_iterations: 20, max_wall_ms: 7200000, max_repeat_failures: 3 }
    });

    for (let i = 0; i < 2; i += 1) {
      const result = runHook(project.dir);
      assert.equal(result.status, 0, result.stderr);
      assert.match(JSON.parse(result.stdout).followup_message || "", /verification failed/);
      assert.equal(readActive(project.dir).status, "active");
    }

    const third = runHook(project.dir);
    assert.equal(third.status, 0, third.stderr);
    assert.deepEqual(JSON.parse(third.stdout), {});
    const active = readActive(project.dir);
    assert.equal(active.status, "blocked");
    assert.equal(active.repeat_failure_count, 3);
    assert.match(active.blocked_reason, /exit 3/);
    assert.notEqual(active.status, "completed");
  } finally {
    project.cleanup();
  }
});

test("two identical then different failure does not block", () => {
  const project = tempProject();
  try {
    writeActive(project.dir, {
      verify: {
        commands: ["node -e \"console.error('aaa'); process.exit(1)\""],
        cwd: ".",
        timeout_ms: 5000
      },
      limits: { max_iterations: 20, max_wall_ms: 7200000, max_repeat_failures: 3 }
    });
    assert.equal(runHook(project.dir).status, 0);
    assert.equal(runHook(project.dir).status, 0);

    writeActive(project.dir, {
      ...readActive(project.dir),
      verify: {
        commands: ["node -e \"console.error('bbb'); process.exit(2)\""],
        cwd: ".",
        timeout_ms: 5000
      }
    });
    const third = runHook(project.dir);
    assert.equal(third.status, 0, third.stderr);
    assert.match(JSON.parse(third.stdout).followup_message, /verification failed/);
    const active = readActive(project.dir);
    assert.equal(active.status, "active");
    assert.equal(active.repeat_failure_count, 1);
  } finally {
    project.cleanup();
  }
});

test("fail then pass marks completed never blocked", () => {
  const project = tempProject();
  try {
    writeActive(project.dir, {
      verify: {
        commands: ["node -e \"process.exit(1)\""],
        cwd: ".",
        timeout_ms: 5000
      },
      limits: { max_iterations: 20, max_wall_ms: 7200000, max_repeat_failures: 3 }
    });
    assert.equal(runHook(project.dir).status, 0);

    writeActive(project.dir, {
      ...readActive(project.dir),
      verify: { commands: ["true"], cwd: ".", timeout_ms: 5000 }
    });
    const result = runHook(project.dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    const active = readActive(project.dir);
    assert.equal(active.status, "completed");
  } finally {
    project.cleanup();
  }
});

test("max_repeat_failures of 2 blocks on second identical failure", () => {
  const project = tempProject();
  try {
    writeActive(project.dir, {
      verify: {
        commands: ["node -e \"console.error('x'); process.exit(9)\""],
        cwd: ".",
        timeout_ms: 5000
      },
      limits: { max_iterations: 20, max_wall_ms: 7200000, max_repeat_failures: 2 }
    });
    assert.equal(runHook(project.dir).status, 0);
    const second = runHook(project.dir);
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(JSON.parse(second.stdout), {});
    assert.equal(readActive(project.dir).status, "blocked");
  } finally {
    project.cleanup();
  }
});
