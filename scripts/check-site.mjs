#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const siteDir = resolve("site");
const requiredFiles = ["index.html", "styles.css", "script.js"];
const requiredAnchors = [
  "top",
  "quickstart",
  "commands",
  "contract",
  "schema",
  "hook",
  "install",
  "other-agents"
];

for (const file of requiredFiles) {
  const path = resolve(siteDir, file);
  if (!existsSync(path)) {
    throw new Error(`Missing site file: ${path}`);
  }
}

const html = readFileSync(resolve(siteDir, "index.html"), "utf8");

for (const id of requiredAnchors) {
  if (!html.includes(`id="${id}"`)) {
    throw new Error(`Missing required section anchor: ${id}`);
  }
}

const localLinks = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
for (const link of localLinks) {
  if (
    link.startsWith("http://") ||
    link.startsWith("https://") ||
    link.startsWith("mailto:") ||
    link.startsWith("#")
  ) {
    continue;
  }

  const withoutHash = link.split("#")[0];
  if (!withoutHash) continue;

  const target = resolve(dirname(resolve(siteDir, "index.html")), withoutHash);
  if (!existsSync(target)) {
    throw new Error(`Broken local site link: ${link}`);
  }
}

if (!html.includes("https://bodecloud.github.io/goal-loop/")) {
  throw new Error("Missing canonical GitHub Pages URL");
}

process.stdout.write("Site validation passed.\n");
