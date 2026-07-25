#!/usr/bin/env node
/**
 * Install Goal Loop globally into Cursor, Claude Code, Grok, Gemini, and Copilot CLIs.
 *
 * Copies the plugin to ~/.local/share/goal-loop and wires each agent that is present.
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  lstatSync,
  unlinkSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const HOME = homedir();
const INSTALL_ROOT = join(HOME, ".local", "share", "goal-loop");
const report = [];

function log(msg) {
  process.stdout.write(`${msg}\n`);
  report.push(msg);
}

function which(bin) {
  const result = spawnSync("bash", ["-lc", `command -v ${bin}`], { encoding: "utf8" });
  const path = (result.stdout || "").trim();
  return path || null;
}

function run(cmd, args, opts = {}) {
  const timeout = opts.timeout ?? 45000;
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      CI: "1",
      npm_config_yes: "true",
      GEMINI_CLI_NONINTERACTIVE: "1",
      NO_COLOR: "1"
    },
    ...opts,
    timeout
  });
  if (result.error?.code === "ETIMEDOUT") {
    return {
      ok: false,
      status: null,
      stdout: result.stdout || "",
      stderr: `${result.stderr || ""}\n(timeout after ${timeout}ms)`.trim()
    };
  }
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function ensureLink(target, linkPath) {
  mkdirSync(dirname(linkPath), { recursive: true });
  if (existsSync(linkPath) || (lstatSync(linkPath, { throwIfNoEntry: false })?.isSymbolicLink())) {
    try {
      unlinkSync(linkPath);
    } catch {
      rmSync(linkPath, { recursive: true, force: true });
    }
  }
  symlinkSync(target, linkPath);
}

function rewritePluginRoot(text, root) {
  return text
    .replaceAll("${CURSOR_PLUGIN_ROOT}", root)
    .replaceAll("${CLAUDE_PLUGIN_ROOT}", root)
    .replaceAll("${GOAL_LOOP_ROOT}", root);
}

function copyInstallTree() {
  if (existsSync(INSTALL_ROOT)) {
    rmSync(INSTALL_ROOT, { recursive: true, force: true });
  }
  mkdirSync(INSTALL_ROOT, { recursive: true });

  const include = [
    ".cursor-plugin",
    ".claude-plugin",
    ".plugin",
    "agents",
    "assets",
    "commands",
    "hooks",
    "scripts",
    "skills",
    "templates",
    "gemini-extension.json",
    "GEMINI.md",
    "package.json",
    "README.md",
    "LICENSE"
  ];

  for (const name of include) {
    const src = join(REPO_ROOT, name);
    if (!existsSync(src)) continue;
    cpSync(src, join(INSTALL_ROOT, name), { recursive: true });
  }

  // Make adapters executable in the install tree.
  try {
    execFileSync("chmod", ["+x", join(INSTALL_ROOT, "hooks", "goal-stop-claude.sh")]);
  } catch {
    // ignore
  }

  writeFileSync(
    join(INSTALL_ROOT, "INSTALL.json"),
    `${JSON.stringify(
      {
        installed_at: new Date().toISOString(),
        source: REPO_ROOT,
        version: "0.1.0"
      },
      null,
      2
    )}\n`
  );
  log(`Installed copy: ${INSTALL_ROOT}`);
}

function installCursor() {
  const cursorDir = join(HOME, ".cursor");
  if (!existsSync(cursorDir)) {
    log("Cursor: skipped (no ~/.cursor)");
    return;
  }

  // Local plugin symlink for Cursor Agent plugin discovery.
  const localPlugin = join(cursorDir, "plugins", "local", "goal-loop");
  ensureLink(INSTALL_ROOT, localPlugin);
  log(`Cursor: plugin linked at ${localPlugin}`);

  // Global stop hook (works even when plugin marketplace is unavailable).
  const hooksPath = join(cursorDir, "hooks.json");
  let hooks = { version: 1, hooks: {} };
  if (existsSync(hooksPath)) {
    try {
      hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
    } catch {
      hooks = { version: 1, hooks: {} };
    }
  }
  if (!hooks.hooks || typeof hooks.hooks !== "object") hooks.hooks = {};
  const stopCmd = `node ${join(INSTALL_ROOT, "hooks", "goal-stop.mjs")}`;
  const existingStop = Array.isArray(hooks.hooks.stop) ? hooks.hooks.stop : [];
  const filtered = existingStop.filter(
    (entry) => !(typeof entry?.command === "string" && entry.command.includes("goal-stop.mjs"))
  );
  filtered.push({ command: stopCmd, loop_limit: 20 });
  hooks.hooks.stop = filtered;
  hooks.version = hooks.version || 1;
  writeFileSync(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);
  log(`Cursor: wired stop hook in ${hooksPath}`);

  // Commands / skill / agent with absolute plugin root baked in.
  for (const file of [
    "goal.md",
    "plan.md",
    "goal-status.md",
    "goal-abort.md",
    "goal-pause.md",
    "goal-resume.md"
  ]) {
    const src = join(INSTALL_ROOT, "commands", file);
    const dest = join(cursorDir, "commands", file);
    mkdirSync(dirname(dest), { recursive: true });
    const body = rewritePluginRoot(readFileSync(src, "utf8"), INSTALL_ROOT);
    writeFileSync(dest, body);
  }
  log("Cursor: installed /goal /plan /goal-status /goal-pause /goal-resume /goal-abort commands");

  ensureLink(join(INSTALL_ROOT, "skills", "cursor-goal"), join(cursorDir, "skills", "cursor-goal"));
  ensureLink(
    join(INSTALL_ROOT, "agents", "goal-verifier.md"),
    join(cursorDir, "agents", "goal-verifier.md")
  );
  log("Cursor: linked cursor-goal skill and goal-verifier agent");
}

function installClaude() {
  const claudeBin = which("claude");
  if (!claudeBin) {
    log("Claude: skipped (claude binary not found)");
    return;
  }

  // Remove prior marketplace registration if present, then add local marketplace.
  run(claudeBin, ["plugin", "marketplace", "remove", "goal-loop"]);
  const add = run(claudeBin, ["plugin", "marketplace", "add", INSTALL_ROOT, "--scope", "user"]);
  if (!add.ok) {
    log(`Claude: marketplace add failed: ${(add.stderr || add.stdout).trim()}`);
    // Fallback: symlink into skills-dir style components.
    ensureLink(join(INSTALL_ROOT, "skills", "cursor-goal"), join(HOME, ".claude", "skills", "cursor-goal"));
    mkdirSync(join(HOME, ".claude", "commands"), { recursive: true });
    for (const file of [
    "goal.md",
    "plan.md",
    "goal-status.md",
    "goal-abort.md",
    "goal-pause.md",
    "goal-resume.md"
  ]) {
      const body = rewritePluginRoot(
        readFileSync(join(INSTALL_ROOT, "commands", file), "utf8"),
        INSTALL_ROOT
      ).replaceAll(INSTALL_ROOT, "${CLAUDE_PLUGIN_ROOT}");
      // Keep CLAUDE_PLUGIN_ROOT for plugin installs; for direct commands use absolute.
      writeFileSync(
        join(HOME, ".claude", "commands", file),
        rewritePluginRoot(readFileSync(join(INSTALL_ROOT, "commands", file), "utf8"), INSTALL_ROOT)
      );
    }
    log("Claude: fallback installed commands + skill under ~/.claude");
    return;
  }
  log("Claude: marketplace added from local install");

  const install = run(claudeBin, ["plugin", "install", "goal-loop@goal-loop", "-s", "user"]);
  if (!install.ok) {
    // Some Claude versions want just the plugin name after marketplace add.
    const retry = run(claudeBin, ["plugin", "install", "goal-loop", "-s", "user"]);
    if (!retry.ok) {
      log(`Claude: plugin install failed: ${(retry.stderr || install.stderr || retry.stdout).trim()}`);
      return;
    }
  }
  run(claudeBin, ["plugin", "enable", "goal-loop@goal-loop"]);
  run(claudeBin, ["plugin", "enable", "goal-loop"]);

  // Ensure settings.json marks it enabled.
  const settingsPath = join(HOME, ".claude", "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
      settings.enabledPlugins = settings.enabledPlugins || {};
      settings.enabledPlugins["goal-loop@goal-loop"] = true;
      writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
      log("Claude: enabled goal-loop@goal-loop in settings.json");
    } catch (error) {
      log(`Claude: could not update settings.json: ${error.message}`);
    }
  }

  const listed = run(claudeBin, ["plugin", "list"]);
  if (listed.stdout.includes("goal-loop")) {
    log("Claude: plugin list includes goal-loop");
  } else {
    log("Claude: installed, but plugin list did not echo goal-loop (check next session)");
  }
}

function installGrok() {
  const grokBin = which("grok") || join(HOME, ".grok", "bin", "grok");
  if (!existsSync(grokBin) && !which("grok")) {
    log("Grok: skipped (grok binary not found)");
    return;
  }
  const bin = which("grok") || grokBin;
  run(bin, ["plugin", "uninstall", "goal-loop"]);
  const result = run(bin, ["plugin", "install", INSTALL_ROOT, "--trust"]);
  if (!result.ok) {
    log(`Grok: install failed: ${(result.stderr || result.stdout).trim()}`);
    // Fallback: skills + agents + enable in config
    ensureLink(join(INSTALL_ROOT, "skills", "cursor-goal"), join(HOME, ".grok", "skills", "cursor-goal"));
    ensureLink(
      join(INSTALL_ROOT, "agents", "goal-verifier.md"),
      join(HOME, ".grok", "agents", "goal-verifier.md")
    );
    log("Grok: fallback linked skill + agent");
    return;
  }
  run(bin, ["plugin", "enable", "goal-loop"]);
  log("Grok: plugin installed and enabled");
}

function installGeminiManually() {
  const extDir = join(HOME, ".gemini", "extensions", "goal-loop");
  mkdirSync(dirname(extDir), { recursive: true });
  rmSync(extDir, { recursive: true, force: true });
  ensureLink(INSTALL_ROOT, extDir);

  // Also put the skill where Gemini already discovers skills.
  ensureLink(
    join(INSTALL_ROOT, "skills", "cursor-goal"),
    join(HOME, ".gemini", "skills", "cursor-goal")
  );

  // Register in config/plugins if that layout is in use.
  const pluginDir = join(HOME, ".gemini", "config", "plugins", "goal-loop");
  mkdirSync(dirname(pluginDir), { recursive: true });
  rmSync(pluginDir, { recursive: true, force: true });
  ensureLink(INSTALL_ROOT, pluginDir);
  writeFileSync(
    join(HOME, ".gemini", "config", "plugins", "goal-loop-installed.json"),
    `${JSON.stringify(
      {
        name: "goal-loop",
        version: "0.1.0",
        path: INSTALL_ROOT,
        linked: true,
        installed_at: new Date().toISOString()
      },
      null,
      2
    )}\n`
  );
  log(`Gemini: linked extension at ${extDir} and skill at ~/.gemini/skills/cursor-goal`);
}

function installGemini() {
  const geminiBin = which("gemini");
  if (!geminiBin) {
    // npx @google/gemini-cli often prompts interactively; prefer a durable manual link.
    installGeminiManually();
    log("Gemini: no local gemini binary; used manual ~/.gemini link (install gemini CLI for full hooks)");
    return;
  }

  run(geminiBin, ["extensions", "uninstall", "goal-loop"], { timeout: 20000 });
  const linked = run(geminiBin, ["extensions", "link", INSTALL_ROOT], { timeout: 30000 });
  if (!linked.ok) {
    const installed = run(geminiBin, ["extensions", "install", INSTALL_ROOT, "--auto-update"], {
      timeout: 60000
    });
    if (!installed.ok) {
      log(
        `Gemini: CLI link/install failed: ${(installed.stderr || linked.stderr || installed.stdout).trim()}`
      );
      installGeminiManually();
      return;
    }
    log("Gemini: extension installed from local path");
  } else {
    log("Gemini: extension linked from local install");
  }

  run(geminiBin, ["extensions", "enable", "goal-loop"], { timeout: 20000 });
  run(geminiBin, ["hooks", "migrate", "--from-claude"], { timeout: 20000 });
}

function installCopilot() {
  const copilotBin = which("copilot");
  if (!copilotBin) {
    log("Copilot: skipped (copilot binary not found)");
    return;
  }

  // Local path works today; GitHub install needs the packaging manifests on the default branch.
  let result = run(copilotBin, ["plugin", "install", INSTALL_ROOT], { timeout: 60000 });
  if (!result.ok) {
    result = run(copilotBin, ["plugin", "install", "bodencrouch/goal-loop"], { timeout: 60000 });
  }
  if (!result.ok) {
    result = run(copilotBin, ["plugin", "install", "bodecloud/goal-loop"], { timeout: 60000 });
  }
  if (!result.ok) {
    const skillsDest = join(HOME, ".copilot", "skills", "cursor-goal");
    ensureLink(join(INSTALL_ROOT, "skills", "cursor-goal"), skillsDest);
    const promptsDir = join(HOME, ".copilot", "prompts");
    mkdirSync(promptsDir, { recursive: true });
    for (const file of [
    "goal.md",
    "plan.md",
    "goal-status.md",
    "goal-abort.md",
    "goal-pause.md",
    "goal-resume.md"
  ]) {
      const body = rewritePluginRoot(
        readFileSync(join(INSTALL_ROOT, "commands", file), "utf8"),
        INSTALL_ROOT
      );
      writeFileSync(join(promptsDir, file), body);
    }
    const localPlugin = join(HOME, ".copilot", "installed-plugins", "goal-loop");
    rmSync(localPlugin, { recursive: true, force: true });
    cpSync(INSTALL_ROOT, localPlugin, { recursive: true });
    log(
      `Copilot: plugin install failed (${(result.stderr || result.stdout).trim().slice(0, 160)}); installed local skill/prompts/plugin tree`
    );
    return;
  }
  log("Copilot: plugin installed");
}

function writeEnvHint() {
  const hint = join(INSTALL_ROOT, "env.sh");
  writeFileSync(
    hint,
    `# Goal Loop environment helper
export GOAL_LOOP_ROOT="${INSTALL_ROOT}"
export CURSOR_PLUGIN_ROOT="\${CURSOR_PLUGIN_ROOT:-$GOAL_LOOP_ROOT}"
export CLAUDE_PLUGIN_ROOT="\${CLAUDE_PLUGIN_ROOT:-$GOAL_LOOP_ROOT}"
# Optional: source this from your shell rc
# source "${hint}"
`
  );
  log(`Env helper: ${hint}`);
}

function main() {
  log(`Source repo: ${REPO_ROOT}`);
  copyInstallTree();
  writeEnvHint();
  installCursor();
  installClaude();
  installGrok();
  installGemini();
  installCopilot();
  log("");
  log("Done. Restart each CLI / IDE session so plugins and hooks reload.");
  log(`Stable install root: ${INSTALL_ROOT}`);
}

main();
