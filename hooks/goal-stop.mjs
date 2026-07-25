#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
import {
  ACTIVE_PATH,
  appendProgressEntry,
  computeFailureSignature,
  ensureGoalDirs,
  logPathForIteration,
  nowIso,
  readJsonFile,
  RUNS_DIR,
  validateGoal,
  writeJsonFile
} from "../scripts/goal-lib.mjs";

const MAX_FOLLOWUP_LOG_CHARS = 6000;
const DEFAULT_VERIFY_TIMEOUT_MS = 600000;
const DEFAULT_MAX_REPEAT_FAILURES = 3;
const HOOK_ERROR_LOG = `${RUNS_DIR}/hook-errors.log`;

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
    HOOK_ERROR_LOG,
    `[${nowIso()}] ${error.stack || error.message || String(error)}\n`,
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

    function settle(result) {
      clearTimeout(timer);
      resolve({
        command,
        timed_out: timedOut,
        duration_ms: Date.now() - startedAt,
        output,
        ...result
      });
    }

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      settle({ ok: false, exit_code: null, output: error.message });
    });
    child.on("close", (code, signal) => {
      settle({ ok: code === 0 && !timedOut, exit_code: code, signal });
    });
  });
}

async function runVerify(goal) {
  const cwd = goal.verify.cwd || ".";
  const timeoutMs = goal.verify.timeout_ms || DEFAULT_VERIFY_TIMEOUT_MS;
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
  return text.slice(-maxChars);
}

function primaryFailureReason(result) {
  const failed = result.command_results.find((item) => !item.ok);
  if (!failed) {
    return "check failed";
  }
  if (failed.timed_out) {
    return `timed out: ${failed.command}`;
  }
  return `exit ${failed.exit_code}: ${failed.command}`;
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

function applyRepeatFailureTracking(goal, result) {
  const signature = computeFailureSignature(result.exit_codes, result.combinedLog);
  if (signature && signature === goal.last_failure_signature) {
    goal.repeat_failure_count = (goal.repeat_failure_count || 0) + 1;
  } else {
    goal.last_failure_signature = signature;
    goal.repeat_failure_count = 1;
  }

  const configured = goal.limits.max_repeat_failures;
  const threshold =
    typeof configured === "number" && configured > 0 ? configured : DEFAULT_MAX_REPEAT_FAILURES;

  if (goal.repeat_failure_count >= threshold) {
    goal.status = "blocked";
    goal.blocked_at = nowIso();
    goal.blocked_reason = primaryFailureReason(result);
    return true;
  }
  return false;
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
    // paused, blocked, completed, aborted, draft — never run the check.
    if (goal.status !== "active") {
      printHookResult({});
      return;
    }

    goal.iteration += 1;
    const startedAtMs = Date.parse(goal.started_at);
    const wallMs = Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : 0;

    const overIterations = goal.iteration > goal.limits.max_iterations;
    if (overIterations || wallMs > goal.limits.max_wall_ms) {
      goal.status = "aborted";
      goal.aborted_at = nowIso();
      goal.abort_reason = overIterations ? "max_iterations" : "max_wall_ms";
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
      `Started: ${nowIso()}`,
      result.combinedLog
    ].join("\n");
    appendFileSync(logPath, logBody, "utf8");

    goal.last_verify = {
      ok: result.ok,
      exit_codes: result.exit_codes,
      command_results: result.command_results,
      log_path: logPath,
      completed_at: nowIso()
    };

    appendProgressEntry(goal, {
      iteration: goal.iteration,
      ok: result.ok,
      exit_codes: result.exit_codes,
      reason: result.ok ? "check passed" : primaryFailureReason(result),
      log_path: logPath
    });

    if (result.ok) {
      goal.status = "completed";
      goal.completed_at = nowIso();
      goal.repeat_failure_count = 0;
      goal.last_failure_signature = null;
      writeJsonFile(ACTIVE_PATH, goal);
      printHookResult({});
      return;
    }

    const blocked = applyRepeatFailureTracking(goal, result);
    writeJsonFile(ACTIVE_PATH, goal);
    if (blocked) {
      // Honest stop — do not continue the agent.
      printHookResult({});
      return;
    }

    printHookResult({
      followup_message: buildFollowup(goal, result, logPath)
    });
  } catch (error) {
    appendHookError(error);
    printHookResult({});
  }
}

await main();
