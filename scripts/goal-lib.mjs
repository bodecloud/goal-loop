import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const GOAL_DIR = ".cursor/goal";
export const ACTIVE_PATH = `${GOAL_DIR}/active.json`;
export const DRAFT_PATH = `${GOAL_DIR}/draft.json`;
export const DEFAULTS_PATH = `${GOAL_DIR}/defaults.json`;
export const RUNS_DIR = `${GOAL_DIR}/runs`;

export function nowIso() {
  return new Date().toISOString();
}

export function readJsonFile(path, fallback = null) {
  if (!existsSync(path)) {
    return fallback;
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJsonFile(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tempPath, path);
}

export function ensureGoalDirs() {
  mkdirSync(RUNS_DIR, { recursive: true });
}

export function normalizeStringArray(value, fieldName) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${fieldName} must be an array of strings`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function asPositiveInteger(value, fallback, fieldName) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function asNonNegativeInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return parsed;
}

export const GOAL_STATUSES = ["active", "draft", "completed", "aborted", "paused", "blocked"];
export const MAX_PROGRESS_ENTRIES = 40;
const FAILURE_TAIL_CHARS = 2000;

export function loadDefaults() {
  const defaults = readJsonFile(DEFAULTS_PATH, {});
  const verify = defaults.verify && typeof defaults.verify === "object" ? defaults.verify : {};
  const limits = defaults.limits && typeof defaults.limits === "object" ? defaults.limits : {};
  return {
    verify: {
      commands: normalizeStringArray(verify.commands, "verify.commands"),
      cwd: typeof verify.cwd === "string" && verify.cwd.trim() ? verify.cwd : ".",
      timeout_ms: asPositiveInteger(verify.timeout_ms, 600000, "verify.timeout_ms")
    },
    limits: {
      max_iterations: asPositiveInteger(limits.max_iterations, 20, "limits.max_iterations"),
      max_wall_ms: asPositiveInteger(limits.max_wall_ms, 7200000, "limits.max_wall_ms"),
      max_repeat_failures: asPositiveInteger(
        limits.max_repeat_failures,
        3,
        "limits.max_repeat_failures"
      )
    }
  };
}

export function createGoal({
  objective,
  status = "active",
  commands = [],
  cwd,
  timeoutMs,
  maxIterations,
  maxWallMs,
  completionPromise = null
}) {
  const trimmedObjective = typeof objective === "string" ? objective.trim() : "";
  if (!trimmedObjective) {
    throw new Error("objective is required");
  }
  if (!["active", "draft"].includes(status)) {
    throw new Error("status must be active or draft");
  }

  const defaults = loadDefaults();
  const verifyCommands = normalizeStringArray(commands, "verify.commands");
  const finalCommands = verifyCommands.length > 0 ? verifyCommands : defaults.verify.commands;

  if (status === "active" && finalCommands.length === 0) {
    throw new Error(
      "at least one verifier command is required; pass --verify or add .cursor/goal/defaults.json"
    );
  }

  return {
    version: 1,
    status,
    objective: trimmedObjective,
    verify: {
      commands: finalCommands,
      cwd: cwd ?? defaults.verify.cwd,
      timeout_ms: asPositiveInteger(timeoutMs, defaults.verify.timeout_ms, "verify.timeout_ms")
    },
    limits: {
      max_iterations: asPositiveInteger(
        maxIterations,
        defaults.limits.max_iterations,
        "limits.max_iterations"
      ),
      max_wall_ms: asPositiveInteger(maxWallMs, defaults.limits.max_wall_ms, "limits.max_wall_ms"),
      max_repeat_failures: defaults.limits.max_repeat_failures
    },
    completion_promise: completionPromise,
    started_at: nowIso(),
    iteration: 0,
    last_verify: null,
    progress: []
  };
}

/**
 * Normalize check log text so timestamps and absolute paths do not change the
 * failure signature between otherwise-identical failures.
 */
export function normalizeFailureLogTail(logText = "") {
  return String(logText)
    .replace(/\r\n/g, "\n")
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, "<ts>")
    .replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\w+\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\b/gi, "<ts>")
    .replace(/(?:\/(?:[\w.-]+))+\/[\w.-]+/g, (match) => {
      // Keep relative-looking short paths; strip long absolute-ish path prefixes.
      const parts = match.split("/").filter(Boolean);
      return parts.length > 2 ? `<path>/${parts[parts.length - 1]}` : match;
    })
    .replace(/\s+/g, " ")
    .trim()
    .slice(-FAILURE_TAIL_CHARS);
}

/**
 * Build a stable signature for a failed check: exit codes + normalized log tail.
 */
export function computeFailureSignature(exitCodes = [], logTail = "") {
  const codes = (Array.isArray(exitCodes) ? exitCodes : [])
    .map((code) => (code === null || code === undefined ? "null" : String(code)))
    .join(",");
  const normalized = normalizeFailureLogTail(logTail);
  return `${codes}|${normalized}`;
}

/**
 * Append a compact progress entry, trimming oldest entries when over the bound.
 */
export function appendProgressEntry(goal, entry) {
  const progress = Array.isArray(goal.progress) ? goal.progress.slice() : [];
  progress.push({
    iteration: entry.iteration,
    ok: Boolean(entry.ok),
    exit_codes: Array.isArray(entry.exit_codes) ? entry.exit_codes : [],
    reason: typeof entry.reason === "string" ? entry.reason.slice(0, 240) : "",
    log_path: typeof entry.log_path === "string" ? entry.log_path : null,
    at: entry.at || nowIso()
  });
  while (progress.length > MAX_PROGRESS_ENTRIES) {
    progress.shift();
  }
  goal.progress = progress;
  return goal;
}

/**
 * Advisory-only heuristics for weak checks. Never blocks goal creation.
 */
export function assessCheckStrength(objective, commands = []) {
  const warnings = [];
  const objectiveText = typeof objective === "string" ? objective.trim() : "";
  const cmds = Array.isArray(commands) ? commands.filter((c) => typeof c === "string" && c.trim()) : [];
  if (!objectiveText || cmds.length === 0) {
    return warnings;
  }

  const behavioral =
    /\b(fix|implement|make\b.+\bwork|accessible|pass(?:es|ing)?|behavio[u]?r|quality|correct|bug|test)\b/i.test(
      objectiveText
    );
  const existenceOnly = cmds.every((cmd) =>
    /^\s*(?:test\s+-[ef]|ls(?:\s|$)|stat(?:\s|$)|\[(?:\s+-?[ef]))/i.test(cmd)
  );
  const existenceObjective = /\b(file|path|exist|create|generate|write|touch)\b/i.test(objectiveText);

  if (behavioral && existenceOnly && !existenceObjective) {
    warnings.push(
      "Check looks existence-only (test -f / ls / stat) while the objective names a behavioral or quality outcome. Prefer a test, build, or lint command that can fail for the wrong behavior."
    );
  }

  const objectiveTokens = new Set(
    objectiveText
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2)
  );
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "npm",
    "run",
    "node",
    "test",
    "true",
    "false"
  ]);
  for (const cmd of cmds) {
    const cmdTokens = cmd
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !stop.has(token));
    const overlap = cmdTokens.some((token) => objectiveTokens.has(token));
    if (!overlap && cmdTokens.length > 0 && objectiveTokens.size > 0) {
      warnings.push(
        `Check command "${cmd}" shares no topical tokens with the objective. Confirm it actually proves the goal.`
      );
      break;
    }
  }

  return warnings;
}

export function validateGoal(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("goal must be an object");
  }
  if (raw.version !== 1) {
    throw new Error("goal.version must be 1");
  }
  if (!GOAL_STATUSES.includes(raw.status)) {
    throw new Error(
      "goal.status must be active, draft, completed, aborted, paused, or blocked"
    );
  }
  if (typeof raw.objective !== "string" || raw.objective.trim() === "") {
    throw new Error("goal.objective is required");
  }
  if (!raw.verify || typeof raw.verify !== "object") {
    throw new Error("goal.verify is required");
  }
  const commands = normalizeStringArray(raw.verify.commands, "verify.commands");
  if (raw.status === "active" && commands.length === 0) {
    throw new Error("active goals require verify.commands");
  }
  if (typeof raw.verify.cwd !== "string" || raw.verify.cwd.trim() === "") {
    throw new Error("verify.cwd must be a non-empty string");
  }
  asPositiveInteger(raw.verify.timeout_ms, 600000, "verify.timeout_ms");
  if (!raw.limits || typeof raw.limits !== "object") {
    throw new Error("goal.limits is required");
  }
  asPositiveInteger(raw.limits.max_iterations, 20, "limits.max_iterations");
  asPositiveInteger(raw.limits.max_wall_ms, 7200000, "limits.max_wall_ms");
  if (raw.limits.max_repeat_failures !== undefined && raw.limits.max_repeat_failures !== null) {
    asPositiveInteger(raw.limits.max_repeat_failures, 3, "limits.max_repeat_failures");
  }
  if (!Number.isSafeInteger(raw.iteration) || raw.iteration < 0) {
    throw new Error("goal.iteration must be a non-negative integer");
  }
  // Optional additive fields — tolerate absence for back-compat.
  if (raw.repeat_failure_count !== undefined && raw.repeat_failure_count !== null) {
    asNonNegativeInteger(raw.repeat_failure_count, "repeat_failure_count");
  }
  if (raw.progress !== undefined && raw.progress !== null) {
    if (!Array.isArray(raw.progress)) {
      throw new Error("goal.progress must be an array");
    }
  }
  if (
    raw.last_failure_signature !== undefined &&
    raw.last_failure_signature !== null &&
    typeof raw.last_failure_signature !== "string"
  ) {
    throw new Error("goal.last_failure_signature must be a string");
  }
  if (
    raw.blocked_reason !== undefined &&
    raw.blocked_reason !== null &&
    typeof raw.blocked_reason !== "string"
  ) {
    throw new Error("goal.blocked_reason must be a string");
  }
  return raw;
}

export function readActiveGoal() {
  return validateGoal(readJsonFile(ACTIVE_PATH));
}

export function absoluteFromProject(path) {
  return resolve(process.cwd(), path);
}

export function logPathForIteration(iteration) {
  return `${RUNS_DIR}/${String(iteration).padStart(3, "0")}.log`;
}
