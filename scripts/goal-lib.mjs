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
      max_wall_ms: asPositiveInteger(limits.max_wall_ms, 7200000, "limits.max_wall_ms")
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
      max_wall_ms: asPositiveInteger(maxWallMs, defaults.limits.max_wall_ms, "limits.max_wall_ms")
    },
    completion_promise: completionPromise,
    started_at: nowIso(),
    iteration: 0,
    last_verify: null
  };
}

export function validateGoal(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("goal must be an object");
  }
  if (raw.version !== 1) {
    throw new Error("goal.version must be 1");
  }
  if (!["active", "draft", "completed", "aborted"].includes(raw.status)) {
    throw new Error("goal.status must be active, draft, completed, or aborted");
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
  if (!Number.isSafeInteger(raw.iteration) || raw.iteration < 0) {
    throw new Error("goal.iteration must be a non-negative integer");
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
