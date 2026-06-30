#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import {
  ACTIVE_PATH,
  ensureGoalDirs,
  logPathForIteration,
  readJsonFile,
  validateGoal,
  writeJsonFile
} from "../scripts/goal-lib.mjs";

const MAX_FOLLOWUP_LOG_CHARS = 6000;

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input.trim() ? JSON.parse(input) : {};
}

function printHookResult(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function appendHookError(error) {
  ensureGoalDirs();
  appendFileSync(
    ".cursor/goal/runs/hook-errors.log",
    `[${new Date().toISOString()}] ${error.stack || error.message || String(error)}\n`,
    "utf8"
  );
}

function runCommand(command, { cwd, timeoutMs }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000).unref();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        command,
        ok: false,
        exit_code: null,
        timed_out: timedOut,
        duration_ms: Date.now() - startedAt,
        output: error.message
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        command,
        ok: code === 0 && !timedOut,
        exit_code: code,
        signal,
        timed_out: timedOut,
        duration_ms: Date.now() - startedAt,
        output
      });
    });
  });
}

async function runVerify(goal) {
  const cwd = goal.verify.cwd || ".";
  const timeoutMs = goal.verify.timeout_ms || 600000;
  const command_results = [];
  let combinedLog = "";

  for (const command of goal.verify.commands) {
    combinedLog += `\n$ ${command}\n`;
    const result = await runCommand(command, { cwd, timeoutMs });
    command_results.push({
      command: result.command,
      ok: result.ok,
      exit_code: result.exit_code,
      signal: result.signal,
      timed_out: result.timed_out,
      duration_ms: result.duration_ms
    });
    combinedLog += result.output || "";
    if (!combinedLog.endsWith("\n")) {
      combinedLog += "\n";
    }
    if (!result.ok) {
      break;
    }
  }

  return {
    ok: command_results.every((result) => result.ok),
    exit_codes: command_results.map((result) => result.exit_code),
    command_results,
    combinedLog
  };
}

function tail(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(text.length - maxChars);
}

function buildFollowup(goal, result, logPath) {
  return `Goal Loop verification failed.

Objective:
${goal.objective}

Iteration: ${goal.iteration}/${goal.limits.max_iterations}
Log: ${logPath}

Verifier tail:
\`\`\`text
${tail(result.combinedLog, MAX_FOLLOWUP_LOG_CHARS)}
\`\`\`

Read the log, fix the root cause, avoid repeating the same failed approach, and end the turn only when the implementation is ready for the hook to verify again. Do not declare success yourself; the Goal Loop hook is the authority.`;
}

async function main() {
  try {
    const input = await readStdin();
    if (input.status && input.status !== "completed") {
      printHookResult({});
      return;
    }

    const rawGoal = readJsonFile(ACTIVE_PATH);
    if (!rawGoal) {
      printHookResult({});
      return;
    }

    const goal = validateGoal(rawGoal);
    if (goal.status !== "active") {
      printHookResult({});
      return;
    }

    goal.iteration += 1;
    const startedAtMs = Date.parse(goal.started_at);
    const wallMs = Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : 0;

    if (goal.iteration > goal.limits.max_iterations || wallMs > goal.limits.max_wall_ms) {
      goal.status = "aborted";
      goal.aborted_at = new Date().toISOString();
      goal.abort_reason =
        goal.iteration > goal.limits.max_iterations ? "max_iterations" : "max_wall_ms";
      writeJsonFile(ACTIVE_PATH, goal);
      printHookResult({});
      return;
    }

    ensureGoalDirs();
    const logPath = logPathForIteration(goal.iteration);
    const result = await runVerify(goal);
    const logBody = [
      `Goal: ${goal.objective}`,
      `Iteration: ${goal.iteration}`,
      `Started: ${new Date().toISOString()}`,
      result.combinedLog
    ].join("\n");
    appendFileSync(logPath, logBody, "utf8");

    goal.last_verify = {
      ok: result.ok,
      exit_codes: result.exit_codes,
      command_results: result.command_results,
      log_path: logPath,
      completed_at: new Date().toISOString()
    };

    if (result.ok) {
      goal.status = "completed";
      goal.completed_at = new Date().toISOString();
      writeJsonFile(ACTIVE_PATH, goal);
      printHookResult({});
      return;
    }

    writeJsonFile(ACTIVE_PATH, goal);
    printHookResult({
      followup_message: buildFollowup(goal, result, logPath)
    });
  } catch (error) {
    appendHookError(error);
    printHookResult({});
  }
}

await main();
