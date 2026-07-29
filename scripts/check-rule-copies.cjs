#!/usr/bin/env node
// Rule-copy consistency guard. ponytail checks that every host adapter
// file matches the canonical AGENTS.md body. goal-loop does the same.
//
// When changing the shared ruleset in AGENTS.md, every copy must stay
// aligned. This check reads AGENTS.md, strips host-specific frontmatter
// where needed, and compares against the canonical body.
//
// Run:  node scripts/check-rule-copies.js

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8').replace(/\r\n/g, '\n').trim();
}

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
}

const agents = read('AGENTS.md');

const copies = [
  ['.cursor/rules/goal-loop.mdc', stripFrontmatter],
  ['.qoder/rules/goal-loop.md', text => text.trim()],
  ['.windsurf/rules/goal-loop.md', text => text.trim()],
  ['.clinerules/goal-loop.md', text => text.trim()],
  ['.agents/rules/goal-loop.md', text => text.trim()],
  ['.kiro/steering/goal-loop.md', stripFrontmatter],
];

let failed = false;

for (const [relPath, normalize] of copies) {
  try {
    const actual = normalize(read(relPath));
    if (actual !== agents) {
      console.error(`${relPath} drifted from AGENTS.md`);
      failed = true;
    }
  } catch (e) {
    console.error(`${relPath}: ${e.message}`);
    failed = true;
  }
}

if (failed) {
  console.error('Update the copied rule text, AGENTS.md, or the host adapter so the shared rules match.');
  process.exit(1);
}

console.log(`Rule copies match AGENTS.md; all ${copies.length} adapter files are aligned.`);