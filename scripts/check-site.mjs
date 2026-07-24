#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const siteDir = resolve("site");
const requiredFiles = ["index.html", "styles.css", "theme.js", "favicon.svg"];
const requiredAnchors = [
  "top",
  "model",
  "setup",
  "usage",
  "contract",
  "verifier",
  "limits",
  "troubleshooting",
  "docs-map",
  "checklists",
  "review",
  "evidence",
  "authoring",
  "adoption",
  "examples",
  "backlog"
];
const requiredDocs = [
  "README.md",
  "docs/index.md",
  "docs/cursor.md",
  "docs/goal-contract.md",
  "docs/verifier-design.md",
  "docs/evidence-map.md",
  "docs/examples.md",
  "docs/operator-checklists.md",
  "docs/reviewer-guide.md",
  "docs/authoring-standard.md",
  "docs/troubleshooting.md",
  "docs/faq.md",
  "docs/adoption-playbook.md",
  "docs/other-agents.md"
];

for (const file of requiredFiles) {
  const path = resolve(siteDir, file);
  if (!existsSync(path)) {
    throw new Error(`Missing site file: ${path}`);
  }
}

for (const file of requiredDocs) {
  const path = resolve(file);
  if (!existsSync(path)) {
    throw new Error(`Missing required doc file: ${path}`);
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
  throw new Error("Missing canonical GitHub Pages URL for bodecloud.github.io/goal-loop/");
}

if (existsSync(resolve(siteDir, "CNAME"))) {
  throw new Error(
    "site/CNAME must not exist for the project Pages URL bodecloud.github.io/goal-loop/"
  );
}

const readme = readFileSync(resolve("README.md"), "utf8");
const docLinks = [...readme.matchAll(/\((docs\/[^)]+\.md)\)/g)].map((match) => match[1]);
for (const link of docLinks) {
  const target = resolve(link);
  if (!existsSync(target)) {
    throw new Error(`Broken README doc link: ${link}`);
  }
}

const gitignore = readFileSync(resolve(".gitignore"), "utf8");
for (const pattern of [
  ".cursor/goal/active.json",
  ".cursor/goal/draft.json",
  ".cursor/goal/runs/"
]) {
  if (!gitignore.includes(pattern)) {
    throw new Error(`Missing runtime-state ignore pattern: ${pattern}`);
  }
}

for (const doc of requiredDocs.filter((file) => file.endsWith(".md"))) {
  const body = readFileSync(resolve(doc), "utf8");
  const links = [...body.matchAll(/\((?!https?:\/\/|mailto:|#)([^)]+\.(?:md|json|txt))\)/g)].map(
    (match) => match[1]
  );
  for (const link of links) {
    const target = resolve(dirname(resolve(doc)), link.split("#")[0]);
    if (!existsSync(target)) {
      throw new Error(`Broken doc link in ${doc}: ${link}`);
    }
  }
}

process.stdout.write("Site and docs validation passed.\n");
