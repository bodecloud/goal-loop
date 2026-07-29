#!/usr/bin/env node
// goal-loop — removes state goal-loop wrote outside the plugin's own files:
// the mode flag, the config file, and any statusLine entry it added to
// settings.json. Plugin files themselves are removed by each host's own
// uninstall command; this only cleans up what those commands cannot see.

const fs = require('fs');
const path = require('path');

const STATUSLINE_SCRIPT = 'goal-stop-claude.sh';

function removeIfExists(filePath, label) {
  try {
    fs.unlinkSync(filePath);
    console.log(`Removed ${label}: ${filePath}`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

const claudeDir = path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.claude');
removeIfExists(path.join(claudeDir, '.goal-loop-active'), 'mode flag');
removeIfExists(path.join(claudeDir, 'settings.json'), 'settings.json (statusLine only)');

const settingsPath = path.join(claudeDir, 'settings.json');
try {
  const raw = fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '');
  const settings = JSON.parse(raw);
  const cmd = settings.statusLine && settings.statusLine.command;
  if (typeof cmd === 'string' && cmd.includes(STATUSLINE_SCRIPT)) {
    const parts = cmd
      .split(/&&|;/)
      .map((s) => s.trim())
      .filter(Boolean);
    const others = parts.filter((s) => !s.includes(STATUSLINE_SCRIPT));
    if (others.length === 0) {
      delete settings.statusLine;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`Removed goal-loop statusLine entry from ${settingsPath}`);
    } else {
      settings.statusLine.command = others.join(' && ');
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`Removed goal-loop statusLine segment from ${settingsPath}`);
    }
  }
} catch (e) {
  if (e.code === 'ENOENT') {
    // no settings.json — nothing to clean
  } else if (e instanceof SyntaxError) {
    console.warn(`settings.json is malformed — could not remove the goal-loop statusLine entry. Remove it manually from: ${settingsPath} (${e.message})`);
  } else {
    throw e;
  }
}