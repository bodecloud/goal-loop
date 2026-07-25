#!/usr/bin/env node
import { existsSync, rmSync } from "node:fs";
import {
  ACTIVE_PATH,
  DRAFT_PATH,
  assessCheckStrength,
  createGoal,
  ensureGoalDirs,
  nowIso,
  readJsonFile,
  validateGoal,
  writeJsonFile
} from "./goal-lib.mjs";

function usage() {
  return `Usage:
  node scripts/goalctl.mjs start <objective> [--verify <cmd>]... [--cwd <dir>] [--timeout-ms <ms>]
  node scripts/goalctl.mjs draft <objective> [--verify <cmd>]...
  node scripts/goalctl.mjs status
  node scripts/goalctl.mjs pause
  node scripts/goalctl.mjs resume
  node scripts/goalctl.mjs abort [--remove]
`;
}

const VALUE_FLAGS = {
  "--verify": { key: "verify", expects: "a command", repeatable: true },
  "--cwd": { key: "cwd", expects: "a directory" },
  "--timeout-ms": { key: "timeoutMs", expects: "a value" },
  "--max-iterations": { key: "maxIterations", expects: "a value" },
  "--max-wall-ms": { key: "maxWallMs", expects: "a value" }
};

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {
    verify: []
  };
  const positional = [];

  for (let i = 0; i < rest.length; i += 1) {
    const item = rest[i];
    const valueFlag = VALUE_FLAGS[item];

    if (valueFlag) {
      const value = rest[++i];
      if (!value) {
        throw new Error(`${item} requires ${valueFlag.expects}`);
      }
      if (valueFlag.repeatable) {
        flags[valueFlag.key].push(value);
      } else {
        flags[valueFlag.key] = value;
      }
    } else if (item === "--remove") {
      flags.remove = true;
    } else if (item.startsWith("--")) {
      throw new Error(`unknown flag: ${item}`);
    } else {
      positional.push(item);
    }
  }

  return {
    command,
    objective: positional.join(" "),
    flags
  };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

// Statuses that speak for themselves; only active goals get a computed trend.
const SELF_DESCRIBING_TRENDS = new Set(["paused", "blocked", "completed", "aborted", "draft"]);

function deriveTrend(goal) {
  if (SELF_DESCRIBING_TRENDS.has(goal.status)) {
    return goal.status;
  }

  const recent = (Array.isArray(goal.progress) ? goal.progress : []).slice(-3);
  if (recent.length < 2 || !recent.every((entry) => entry.ok === false)) {
    return "progressing";
  }
  const signatures = recent.map((entry) =>
    Array.isArray(entry.exit_codes) ? entry.exit_codes.join(",") : ""
  );
  return signatures.every((sig) => sig === signatures[0]) ? "stuck" : "progressing";
}

function goalSummary(goal) {
  const progress = Array.isArray(goal.progress) ? goal.progress : [];
  const summary = {
    status: goal.status,
    objective: goal.objective,
    iteration: goal.iteration,
    verify: goal.verify,
    limits: goal.limits,
    last_verify: goal.last_verify ?? null,
    trend: deriveTrend(goal),
    progress,
    progress_count: progress.length
  };
  if (goal.paused_at) summary.paused_at = goal.paused_at;
  if (goal.blocked_at) summary.blocked_at = goal.blocked_at;
  if (goal.blocked_reason) summary.blocked_reason = goal.blocked_reason;
  if (goal.abort_reason) summary.abort_reason = goal.abort_reason;
  if (goal.repeat_failure_count !== undefined) {
    summary.repeat_failure_count = goal.repeat_failure_count;
  }
  if (goal.last_verify?.log_path) {
    summary.log_path = goal.last_verify.log_path;
  }
  return summary;
}

function readActive() {
  const raw = readJsonFile(ACTIVE_PATH);
  return raw ? validateGoal(raw) : null;
}

function saveActive(goal) {
  writeJsonFile(ACTIVE_PATH, goal);
  printJson({ ok: true, active: true, goal: goalSummary(goal) });
}

function commandCreate(command, objective, flags) {
  const goal = createGoal({
    objective,
    status: command === "start" ? "active" : "draft",
    commands: flags.verify,
    cwd: flags.cwd,
    timeoutMs: flags.timeoutMs,
    maxIterations: flags.maxIterations,
    maxWallMs: flags.maxWallMs
  });
  const warnings = assessCheckStrength(goal.objective, goal.verify.commands);
  const targetPath = command === "start" ? ACTIVE_PATH : DRAFT_PATH;
  writeJsonFile(targetPath, goal);
  printJson({
    ok: true,
    path: targetPath,
    goal: goalSummary(goal),
    warnings
  });
}

function commandStatus() {
  const goal = readActive();
  if (!goal) {
    printJson({ ok: true, active: false, message: "No active goal." });
    return;
  }
  printJson({ ok: true, active: true, goal: goalSummary(goal) });
}

function commandPause() {
  const goal = readActive();
  if (!goal) {
    printJson({ ok: false, active: false, message: "No active goal to pause." });
    return;
  }
  if (goal.status === "paused") {
    printJson({
      ok: true,
      active: true,
      message: "Goal is already paused.",
      goal: goalSummary(goal)
    });
    return;
  }
  if (goal.status !== "active") {
    printJson({
      ok: false,
      active: true,
      message: `Cannot pause a goal with status "${goal.status}". Only active goals can be paused.`,
      goal: goalSummary(goal)
    });
    return;
  }
  goal.status = "paused";
  goal.paused_at = nowIso();
  saveActive(goal);
}

function commandResume() {
  const goal = readActive();
  if (!goal) {
    printJson({ ok: false, active: false, message: "No goal to resume." });
    return;
  }
  if (goal.status === "active") {
    printJson({
      ok: false,
      active: true,
      message: "Goal is already active.",
      goal: goalSummary(goal)
    });
    return;
  }
  if (goal.status !== "paused" && goal.status !== "blocked") {
    printJson({
      ok: false,
      active: true,
      message: `Cannot resume a goal with status "${goal.status}". Resume works on paused or blocked goals.`,
      goal: goalSummary(goal)
    });
    return;
  }
  goal.status = "active";
  delete goal.paused_at;
  delete goal.blocked_at;
  delete goal.blocked_reason;
  goal.repeat_failure_count = 0;
  goal.last_failure_signature = null;
  saveActive(goal);
}

function commandAbort(flags) {
  if (!existsSync(ACTIVE_PATH)) {
    printJson({ ok: true, active: false, message: "No active goal to abort." });
    return;
  }
  if (flags.remove) {
    rmSync(ACTIVE_PATH, { force: true });
    printJson({ ok: true, active: false, removed: true });
    return;
  }
  const goal = readActive();
  goal.status = "aborted";
  goal.aborted_at = nowIso();
  writeJsonFile(ACTIVE_PATH, goal);
  printJson({ ok: true, active: false, goal: goalSummary(goal) });
}

function main() {
  const { command, objective, flags } = parseArgs(process.argv.slice(2));
  ensureGoalDirs();

  switch (command) {
    case "start":
    case "draft":
      return commandCreate(command, objective, flags);
    case "status":
      return commandStatus();
    case "pause":
      return commandPause();
    case "resume":
      return commandResume();
    case "abort":
      return commandAbort(flags);
    default:
      throw new Error(command ? `unknown command: ${command}\n${usage()}` : usage());
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
