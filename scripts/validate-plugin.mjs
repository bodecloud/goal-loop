#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(".cursor-plugin/plugin.json", "utf8"));
const hooksPath = manifest.hooks || "hooks/hooks-cursor.json";
const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
const claudeHooks = JSON.parse(readFileSync("hooks/hooks.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const requiredManifestPaths = [
  manifest.logo,
  manifest.commands,
  manifest.skills,
  manifest.agents,
  hooksPath,
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".plugin/plugin.json",
  "gemini-extension.json",
  "hooks/goal-stop-claude.sh",
  "GEMINI.md"
];

for (const path of requiredManifestPaths) {
  if (!path || !existsSync(path)) {
    throw new Error(`manifest path missing: ${path}`);
  }
}

if (manifest.name !== "goal-loop") {
  throw new Error("manifest name must be goal-loop");
}
if (pkg.name !== "@bodecloud/goal-loop") {
  throw new Error("package name must be @bodecloud/goal-loop for GitHub Packages");
}
if (manifest.version !== "0.1.0") {
  throw new Error("manifest version must be 0.1.0");
}
if (!hooks.hooks?.stop?.[0]?.command?.includes("goal-stop.mjs")) {
  throw new Error("Cursor stop hook must run goal-stop.mjs");
}
if (hooks.hooks.stop[0].loop_limit !== 20) {
  throw new Error("stop hook loop_limit must be 20");
}
if (!claudeHooks.hooks?.Stop?.[0]?.hooks?.[0]?.command?.includes("goal-stop-claude.sh")) {
  throw new Error("Claude Stop hook must run goal-stop-claude.sh");
}

const commandFiles = [
  "goal.md",
  "plan.md",
  "goal-status.md",
  "goal-abort.md",
  "goal-pause.md",
  "goal-resume.md"
];
for (const file of commandFiles) {
  if (!existsSync(`commands/${file}`)) {
    throw new Error(`missing command: ${file}`);
  }
}

process.stdout.write("Plugin manifest validation passed.\n");
