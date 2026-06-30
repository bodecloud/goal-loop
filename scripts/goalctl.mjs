#!/usr/bin/env node
import { existsSync, rmSync } from "node:fs";
import {
  ACTIVE_PATH,
  DRAFT_PATH,
  createGoal,
  ensureGoalDirs,
  readJsonFile,
  validateGoal,
  writeJsonFile
} from "./goal-lib.mjs";

function usage() {
  return `Usage:
  node scripts/goalctl.mjs start <objective> [--verify <cmd>]... [--cwd <dir>] [--timeout-ms <ms>]
  node scripts/goalctl.mjs draft <objective> [--verify <cmd>]...
  node scripts/goalctl.mjs status
  node scripts/goalctl.mjs abort [--remove]
`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {
    verify: []
  };
  const positional = [];

  for (let i = 0; i < rest.length; i += 1) {
    const item = rest[i];
    if (item === "--verify") {
      const value = rest[++i];
      if (!value) {
        throw new Error("--verify requires a command");
      }
      flags.verify.push(value);
    } else if (item === "--cwd") {
      flags.cwd = rest[++i];
      if (!flags.cwd) {
        throw new Error("--cwd requires a directory");
      }
    } else if (item === "--timeout-ms") {
      flags.timeoutMs = rest[++i];
      if (!flags.timeoutMs) {
        throw new Error("--timeout-ms requires a value");
      }
    } else if (item === "--max-iterations") {
      flags.maxIterations = rest[++i];
      if (!flags.maxIterations) {
        throw new Error("--max-iterations requires a value");
      }
    } else if (item === "--max-wall-ms") {
      flags.maxWallMs = rest[++i];
      if (!flags.maxWallMs) {
        throw new Error("--max-wall-ms requires a value");
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

function goalSummary(goal) {
  return {
    status: goal.status,
    objective: goal.objective,
    iteration: goal.iteration,
    verify: goal.verify,
    limits: goal.limits,
    last_verify: goal.last_verify ?? null
  };
}

function main() {
  const { command, objective, flags } = parseArgs(process.argv.slice(2));
  ensureGoalDirs();

  if (command === "start" || command === "draft") {
    const goal = createGoal({
      objective,
      status: command === "start" ? "active" : "draft",
      commands: flags.verify,
      cwd: flags.cwd,
      timeoutMs: flags.timeoutMs,
      maxIterations: flags.maxIterations,
      maxWallMs: flags.maxWallMs
    });
    const targetPath = command === "start" ? ACTIVE_PATH : DRAFT_PATH;
    writeJsonFile(targetPath, goal);
    printJson({ ok: true, path: targetPath, goal: goalSummary(goal) });
    return;
  }

  if (command === "status") {
    const active = readJsonFile(ACTIVE_PATH);
    if (!active) {
      printJson({ ok: true, active: false, message: "No active goal." });
      return;
    }
    printJson({ ok: true, active: true, goal: goalSummary(validateGoal(active)) });
    return;
  }

  if (command === "abort") {
    if (!existsSync(ACTIVE_PATH)) {
      printJson({ ok: true, active: false, message: "No active goal to abort." });
      return;
    }
    if (flags.remove) {
      rmSync(ACTIVE_PATH, { force: true });
      printJson({ ok: true, active: false, removed: true });
      return;
    }
    const goal = validateGoal(readJsonFile(ACTIVE_PATH));
    goal.status = "aborted";
    goal.aborted_at = new Date().toISOString();
    writeJsonFile(ACTIVE_PATH, goal);
    printJson({ ok: true, active: false, goal: goalSummary(goal) });
    return;
  }

  throw new Error(command ? `unknown command: ${command}\n${usage()}` : usage());
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
