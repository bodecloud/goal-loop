#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "index.html",
  "styles.css",
  "app.js",
  "src/game.js",
  "package.json"
];

const missing = required.filter((file) => !existsSync(resolve(root, file)));
if (missing.length > 0) {
  process.stderr.write(`Build failed: missing files: ${missing.join(", ")}\n`);
  process.exit(1);
}

process.stdout.write("minesweeper build ok\n");
