# Goal Loop Self-Healing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task inline, or superpowers:subagent-driven-development for parallel dispatch.

**Goal:** Implement autonomous goal drift detection and correction so Goal Loop never re-asserts a stale goal when the user has explicitly stated a new one.

**Architecture:** A session-start hook detects divergence between active.json and user's current intent, prompts for lightweight confirmation, and syncs the goal state. Elevated goal framing via instruction hierarchy + emotional language + position bias exploitation ensures the goal is unmissable in subsequent agent prompts.

**Tech Stack:** Node.js (goal-lib.mjs), shell hooks, YAML/JSON for state, Claude system prompts with U-shaped attention positioning.

## Global Constraints

- Goal-loop version: ^0.1.0 (from ~/.claude/plugins/cache/goal-loop/)
- Node.js: >= 16 (existing in goal-loop runtime)
- JSON state format: goal-loop's existing schema + new drift_history array field
- Hook registration: via .cursor/goal/hooks/hooks.json (existing mechanism)
- Prompt framing: Use research-backed instruction hierarchy + emotional language
- Test scenarios: 4 required (happy path, 3 edge cases from spec)

---

### Task 1: Extend goal-lib.mjs with Drift Detection Utils

**Files:**
- Modify: `/run/media/brunner56/MyBook/Workspaces/goal-loop/scripts/goal-lib.mjs` (extend existing exports)
- Test: `/run/media/brunner56/MyBook/Workspaces/goal-loop/test/goal-drift.test.mjs` (create)

**Interfaces:**
- Consumes: Existing goal-lib exports (readJsonFile, writeJsonFile, normalizeStringArray)
- Produces: 
  - `compareDriftLevel(statement, activeGoal)` → `{ isDrift: boolean, level: 'exact' | 'partial' | 'contradiction' }`
  - `formatDriftPrompt(oldObjective, newObjective)` → string (user-facing prompt)
  - `recordDriftHistory(goal, previousObjective, newObjective, approved)` → goal (mutated with history entry)

- [ ] **Step 1: Write failing test for drift detection**

Create `test/goal-drift.test.mjs`:

```javascript
import { compareDriftLevel, formatDriftPrompt, recordDriftHistory } from "../scripts/goal-lib.mjs";
import { strict as assert } from "assert";

export const tests = [
  {
    name: "compareDriftLevel detects exact match (no drift)",
    fn: () => {
      const result = compareDriftLevel("Learn PotPlayer renderer internals", "Learn PotPlayer renderer internals");
      assert.equal(result.isDrift, false);
      assert.equal(result.level, "exact");
    }
  },
  {
    name: "compareDriftLevel detects contradiction (drift)",
    fn: () => {
      const result = compareDriftLevel("Learn PotPlayer renderer internals", "Full cross-platform PotPlayer rewrite");
      assert.equal(result.isDrift, true);
      assert.equal(result.level, "contradiction");
    }
  },
  {
    name: "formatDriftPrompt returns user-facing message",
    fn: () => {
      const prompt = formatDriftPrompt("Rewrite all", "Learn internals");
      assert(prompt.includes("Rewrite all"));
      assert(prompt.includes("Learn internals"));
      assert(prompt.includes("Update"));
    }
  },
  {
    name: "recordDriftHistory adds entry and updates goal",
    fn: () => {
      const goal = { version: 1, objective: "New", drift_history: [] };
      const updated = recordDriftHistory(goal, "Old", "New", true);
      assert.equal(updated.drift_history.length, 1);
      assert.equal(updated.drift_history[0].previous_objective, "Old");
      assert.equal(updated.drift_history[0].new_objective, "New");
      assert.equal(updated.drift_history[0].user_approved, true);
      assert(updated.drift_history[0].detected_at);
    }
  }
];

// Run all tests
for (const test of tests) {
  try {
    test.fn();
    console.log(`✓ ${test.name}`);
  } catch (err) {
    console.error(`✗ ${test.name}: ${err.message}`);
    process.exit(1);
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/goal-drift.test.mjs`
Expected: FAIL with "compareDriftLevel is not defined"

- [ ] **Step 3: Implement drift detection functions**

Add to end of `/run/media/brunner56/MyBook/Workspaces/goal-loop/scripts/goal-lib.mjs`:

```javascript
export function compareDriftLevel(userStatement, activeObjective) {
  const normalize = (s) => s.toLowerCase().trim();
  const user = normalize(userStatement);
  const active = normalize(activeObjective);
  
  if (user === active) {
    return { isDrift: false, level: "exact" };
  }
  
  // Contradiction: completely different goal
  const hasCommonCore = user.split(" ").some(word => active.includes(word) && word.length > 3);
  
  if (!hasCommonCore) {
    return { isDrift: true, level: "contradiction" };
  }
  
  // Partial: related but different scope
  return { isDrift: true, level: "partial" };
}

export function formatDriftPrompt(oldObjective, newObjective) {
  return `Goal drift detected.

Current active goal:
${oldObjective}

Your stated goal:
${newObjective}

Update goal to match your statement?`;
}

export function recordDriftHistory(goal, previousObjective, newObjective, approved) {
  if (!goal.drift_history) {
    goal.drift_history = [];
  }
  
  goal.drift_history.push({
    detected_at: nowIso(),
    previous_objective: previousObjective,
    new_objective: newObjective,
    user_approved: approved
  });
  
  return goal;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/goal-drift.test.mjs`
Expected: PASS (all tests ✓)

- [ ] **Step 5: Commit**

```bash
git add scripts/goal-lib.mjs test/goal-drift.test.mjs
git commit -m "feat(goal-loop): add drift detection utilities (compareDriftLevel, formatDriftPrompt, recordDriftHistory)"
```

---

### Task 2: Create Drift Detection Hook

**Files:**
- Create: `/.cursor/goal/hooks/detect-drift.mjs` (project-local hook)
- Create: `/.cursor/goal/hooks/hooks-detect-drift.json` (hook config)
- Test: Verify hook runs without blocking on SessionStart

**Interfaces:**
- Consumes: Active goal state, compareDriftLevel/formatDriftPrompt from goal-lib
- Produces: Hook result with followup_message if drift detected

- [ ] **Step 1: Create detect-drift.mjs hook**

Create `/.cursor/goal/hooks/detect-drift.mjs`:

```javascript
#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ACTIVE_PATH, readJsonFile, writeJsonFile, compareDriftLevel, formatDriftPrompt, recordDriftHistory } from "../scripts/goal-lib.mjs";

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

async function detectDrift() {
  try {
    // This hook receives no stdin in current goal-loop flow
    // It reads active.json directly
    const goal = readJsonFile(ACTIVE_PATH);
    
    if (!goal || goal.status !== "active") {
      printHookResult({});
      return;
    }
    
    // Session start: check if goal might be stale
    // In a real integration, we'd parse recent conversation history
    // For now, this hook serves as a detection point that can be triggered
    // by a parent hook passing the user's current stated goal via stdin
    
    const input = await readStdin();
    if (!input.userStatement) {
      // No statement to compare against
      printHookResult({});
      return;
    }
    
    const userStatement = input.userStatement;
    const drift = compareDriftLevel(userStatement, goal.objective);
    
    if (!drift.isDrift) {
      printHookResult({});
      return;
    }
    
    // Drift detected: prepare confirmation message
    const confirmationPrompt = formatDriftPrompt(goal.objective, userStatement);
    
    printHookResult({
      drift_detected: true,
      drift_level: drift.level,
      old_objective: goal.objective,
      new_objective: userStatement,
      confirmation_prompt: confirmationPrompt,
      followup_message: `${confirmationPrompt}\n\nRespond with 'yes' to update, or 'no' to keep current goal.`
    });
    
  } catch (error) {
    console.error(`[detect-drift] error: ${error.message}`);
    printHookResult({});
  }
}

await detectDrift();
```

- [ ] **Step 2: Register hook in hooks.json**

Update `/.cursor/goal/hooks/hooks.json` (if doesn't exist, create it):

```json
{
  "description": "Goal Loop drift detection — autonomous sync when goal diverges from user intent",
  "hooks": {
    "Start": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/.cursor/goal/hooks/detect-drift.mjs\""
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Verify hook runs**

Run: `node .cursor/goal/hooks/detect-drift.mjs`
Expected: Writes empty JSON `{}` (no input, no drift to detect)

Test with input:
```bash
echo '{"userStatement": "New goal"}' | node .cursor/goal/hooks/detect-drift.mjs
```
Expected: Outputs hook result with drift_detected flag

- [ ] **Step 4: Commit**

```bash
git add .cursor/goal/hooks/detect-drift.mjs .cursor/goal/hooks/hooks.json
git commit -m "feat(goal-loop): add drift detection hook for autonomous goal sync"
```

---

### Task 3: Update Goal-Verifier Agent Prompt with Instruction Hierarchy Framing

**Files:**
- Modify: `~/.claude/plugins/cache/goal-loop/goal-loop/0.1.0/agents/goal-verifier.md` (plugin, not project local)
- Impact: Applies to all projects using goal-loop

**Interfaces:**
- Consumes: Active goal state, check output
- Produces: Structured goal verification result with goal hierarchy awareness

- [ ] **Step 1: Read current goal-verifier.md**

Read the agent prompt at the plugin location to understand current structure.

- [ ] **Step 2: Update agent prompt with instruction hierarchy framing**

Modify `agents/goal-verifier.md` to add this after the "Purpose" section:

```markdown
## Goal Authority

The active objective from `.cursor/goal/active.json` represents the **System-level authority** for this session. This goal is derived from the user's most recent explicit statement and overrides all other directives.

**Hierarchy:**
- System: Active goal objective (non-negotiable)
- Developer: This agent's verification framework
- User: Check output and context
- Tool: Fallback logs and auxiliary data

When interpreting check failures, never reframe or redirect the goal. If the user has explicitly stated a different goal since this one was created, note it — but your job is to interpret the **current active goal**, not to override it.

```

Add this to the "Output format" section, as the first line:

```
goal_authority_acknowledged: true (confirms System-level goal was consulted)
```

- [ ] **Step 3: Verify changes**

Read the modified file to confirm instruction hierarchy language is present and clear.

- [ ] **Step 4: Commit changes**

```bash
git -C ~/.claude/plugins/cache/goal-loop/goal-loop/0.1.0 add agents/goal-verifier.md
git -C ~/.claude/plugins/cache/goal-loop/goal-loop/0.1.0 commit -m "feat: add instruction hierarchy framing to goal-verifier agent"
```

---

### Task 4: Inject Goal Elevation Language into Agent System Prompts

**Files:**
- Modify: Claude Code's main system prompt (via settings.json or agent directives)
- Create: `.claude/goal-elevation.prompt` (local goal framing template)

**Interfaces:**
- Consumes: Active goal state (objective + stated_at)
- Produces: System-reminder injection for active agent sessions

- [ ] **Step 1: Create local goal elevation prompt template**

Create `.claude/goal-elevation.prompt`:

```
# THE GOAL IS THE NORTH STAR OF THIS SESSION

## Objective
${GOAL_OBJECTIVE}

## Authority
This objective is derived from the user's most recent explicit statement at ${GOAL_STATED_AT}.

## Status
ACTIVE. Do not contradict or reframe this objective without explicit user instruction.

## What Success Looks Like
This goal represents the user's highest-priority intent. Your work succeeds when this objective is met. When in doubt about scope or direction, return to this objective.

## During Verification
When check output suggests reframing or redirecting the goal, resist that instinct. The goal is fixed. Your job is to make the current approach work toward this objective, or to identify concrete blockers that require the user's decision to change the goal.
```

- [ ] **Step 2: Create hook to inject goal elevation**

Create `.claude/goal-injection.mjs` (helper for local use):

```javascript
import { readJsonFile } from ".cursor/goal/scripts/goal-lib.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function getGoalElevationReminder() {
  const goal = readJsonFile(".cursor/goal/active.json");
  if (!goal || goal.status !== "active") {
    return "";
  }
  
  const template = readFileSync(".claude/goal-elevation.prompt", "utf8");
  const reminder = template
    .replace("${GOAL_OBJECTIVE}", goal.objective)
    .replace("${GOAL_STATED_AT}", goal.stated_at);
  
  return `<system-reminder>\n${reminder}\n</system-reminder>`;
}
```

- [ ] **Step 3: Document goal elevation in agent handoff**

Create `.claude/GOAL_LOOP.md`:

```markdown
# Goal Loop Integration

When a goal-loop session is active, the active objective is elevated to System-level authority via:

1. **Instruction Hierarchy:** Goal-verifier acknowledges System authority
2. **Emotional Framing:** Motivation language triggers deliberate processing
3. **Position Bias Exploitation:** Goal appears in start/end of prompts + system-reminders

## How It Works

- Session start: Drift detection hook runs; if mismatch found, updates active.json
- Next agent: System-reminder injected with goal elevation language (U-shaped attention)
- Verification: Goal-verifier interprets failures within goal authority (never reframes goal)

## For Developers

If implementing a custom agent that works with goal-loop:
1. Read `.cursor/goal/active.json` at session start
2. Inject goal elevation reminder if goal is active
3. Honor System-level authority: the goal is non-negotiable
4. Never suggest reframing the goal unless explicitly asked
```

- [ ] **Step 4: Verify prompt template**

Read `.claude/goal-elevation.prompt` and `.claude/GOAL_LOOP.md` to confirm they're clear and actionable.

- [ ] **Step 5: Commit**

```bash
git add .claude/goal-elevation.prompt .claude/goal-injection.mjs .claude/GOAL_LOOP.md
git commit -m "docs(goal-loop): add goal elevation language and agent integration guide"
```

---

### Task 5: Implement Goal State Sync on Confirmation

**Files:**
- Modify: `.cursor/goal/scripts/goal-lib.mjs` (add syncGoal function)
- Create: `.cursor/goal/hooks/goal-sync.mjs` (sync handler)

**Interfaces:**
- Consumes: User confirmation (yes/no), new objective, old goal state
- Produces: Updated active.json with drift_history entry

- [ ] **Step 1: Write failing test for goal sync**

Add test to `test/goal-drift.test.mjs`:

```javascript
{
  name: "syncGoal updates active.json and records drift",
  fn: () => {
    // Mock active goal
    const oldGoal = {
      version: 1,
      status: "active",
      objective: "Old goal",
      started_at: "2026-07-30T12:00:00Z",
      iteration: 5,
      drift_history: []
    };
    
    // Simulate sync
    const newGoal = syncGoal(oldGoal, "New goal", true);
    
    assert.equal(newGoal.objective, "New goal");
    assert.equal(newGoal.drift_history.length, 1);
    assert.equal(newGoal.iteration, 0); // Reset on goal change
    assert.equal(newGoal.status, "active");
  }
}
```

- [ ] **Step 2: Implement syncGoal function**

Add to `scripts/goal-lib.mjs`:

```javascript
export function syncGoal(oldGoal, newObjective, approved) {
  // Record drift, reset iteration count
  const updated = recordDriftHistory(oldGoal, oldGoal.objective, newObjective, approved);
  
  updated.objective = newObjective;
  updated.iteration = 0; // Reset: new goal, new iteration count
  updated.stated_at = nowIso();
  updated.synced_from_conversation = true;
  
  return updated;
}
```

- [ ] **Step 3: Create goal-sync.mjs hook**

Create `.cursor/goal/hooks/goal-sync.mjs`:

```javascript
#!/usr/bin/env node
import { ACTIVE_PATH, readJsonFile, writeJsonFile, syncGoal } from "../scripts/goal-lib.mjs";

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

async function handleSync() {
  try {
    const input = await readStdin();
    
    if (!input.approved || !input.newObjective) {
      printHookResult({});
      return;
    }
    
    const goal = readJsonFile(ACTIVE_PATH);
    if (!goal) {
      printHookResult({ error: "No active goal found" });
      return;
    }
    
    const updated = syncGoal(goal, input.newObjective, input.approved);
    writeJsonFile(ACTIVE_PATH, updated);
    
    printHookResult({
      synced: true,
      goal_updated_at: updated.stated_at,
      new_objective: updated.objective,
      drift_recorded: true
    });
    
  } catch (error) {
    console.error(`[goal-sync] error: ${error.message}`);
    printHookResult({ error: error.message });
  }
}

await handleSync();
```

- [ ] **Step 4: Run test**

Run: `node test/goal-drift.test.mjs`
Expected: PASS (including new syncGoal test)

- [ ] **Step 5: Commit**

```bash
git add scripts/goal-lib.mjs .cursor/goal/hooks/goal-sync.mjs test/goal-drift.test.mjs
git commit -m "feat(goal-loop): implement goal state sync with drift history tracking"
```

---

### Task 6: Integration Test & Verification

**Files:**
- Create: `test/goal-loop-integration.test.mjs` (end-to-end test)
- Modify: `.cursor/goal/defaults.json` (add test verification command)

**Interfaces:**
- Consumes: Complete drift detection → sync → elevation flow
- Produces: Passing integration tests for all 4 scenarios from spec

- [ ] **Step 1: Create integration test suite**

Create `test/goal-loop-integration.test.mjs`:

```javascript
import { readJsonFile, writeJsonFile, compareDriftLevel, formatDriftPrompt, recordDriftHistory, syncGoal } from "../scripts/goal-lib.mjs";
import { strict as assert } from "assert";
import { existsSync, rmSync, mkdirSync } from "node:fs";

const TEST_GOAL_DIR = ".cursor/goal-test";
const TEST_ACTIVE = `${TEST_GOAL_DIR}/active.json`;

function setupTestEnv() {
  if (existsSync(TEST_GOAL_DIR)) rmSync(TEST_GOAL_DIR, { recursive: true });
  mkdirSync(TEST_GOAL_DIR, { recursive: true });
}

function teardownTestEnv() {
  if (existsSync(TEST_GOAL_DIR)) rmSync(TEST_GOAL_DIR, { recursive: true });
}

const tests = [
  {
    name: "Happy Path: User corrects goal and system syncs",
    fn: () => {
      setupTestEnv();
      
      // Initial goal
      let goal = {
        version: 1,
        status: "active",
        objective: "Goal A",
        started_at: "2026-07-30T12:00:00Z",
        stated_at: "2026-07-30T12:00:00Z",
        iteration: 3,
        drift_history: []
      };
      
      // User states new goal
      const drift = compareDriftLevel("Goal B", goal.objective);
      assert.equal(drift.isDrift, true);
      
      // Sync confirmed
      goal = syncGoal(goal, "Goal B", true);
      
      assert.equal(goal.objective, "Goal B");
      assert.equal(goal.iteration, 0); // Reset
      assert.equal(goal.drift_history.length, 1);
      assert.equal(goal.drift_history[0].user_approved, true);
      
      teardownTestEnv();
    }
  },
  {
    name: "Edge Case: Stale goal at session start",
    fn: () => {
      setupTestEnv();
      
      // Goal from previous session (2 days old)
      let goal = {
        version: 1,
        status: "active",
        objective: "Old goal from before",
        started_at: "2026-07-28T12:00:00Z",
        stated_at: "2026-07-28T12:00:00Z",
        iteration: 15,
        drift_history: []
      };
      
      // Current session: user says something different
      const drift = compareDriftLevel("New goal for today", goal.objective);
      assert.equal(drift.isDrift, true);
      assert.equal(drift.level, "contradiction");
      
      // Sync
      goal = syncGoal(goal, "New goal for today", true);
      assert.equal(goal.objective, "New goal for today");
      assert.equal(goal.iteration, 0);
      
      teardownTestEnv();
    }
  },
  {
    name: "Edge Case: Goal change mid-verification doesn't reset state incorrectly",
    fn: () => {
      setupTestEnv();
      
      let goal = {
        version: 1,
        status: "active",
        objective: "Goal A",
        started_at: "2026-07-30T12:00:00Z",
        stated_at: "2026-07-30T12:00:00Z",
        iteration: 5,
        verify: { commands: ["test-cmd"] },
        drift_history: []
      };
      
      // Mid-verification, goal changes
      goal = syncGoal(goal, "Goal B", true);
      
      // Verify commands still present
      assert(goal.verify);
      assert.equal(goal.verify.commands[0], "test-cmd");
      
      // Iteration reset
      assert.equal(goal.iteration, 0);
      
      teardownTestEnv();
    }
  },
  {
    name: "Error Path: User dismisses drift confirmation",
    fn: () => {
      setupTestEnv();
      
      let goal = {
        version: 1,
        status: "active",
        objective: "Current goal",
        started_at: "2026-07-30T12:00:00Z",
        stated_at: "2026-07-30T12:00:00Z",
        iteration: 2,
        drift_history: []
      };
      
      // Drift detected
      const drift = compareDriftLevel("Different goal", goal.objective);
      assert.equal(drift.isDrift, true);
      
      // User says NO: record but don't sync
      goal = recordDriftHistory(goal, goal.objective, "Different goal", false);
      
      // Goal unchanged
      assert.equal(goal.objective, "Current goal");
      // But drift is logged
      assert.equal(goal.drift_history.length, 1);
      assert.equal(goal.drift_history[0].user_approved, false);
      
      teardownTestEnv();
    }
  }
];

// Run all tests
console.log("Running goal-loop integration tests...\n");
let passed = 0;
for (const test of tests) {
  try {
    test.fn();
    console.log(`✓ ${test.name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${test.name}: ${err.message}`);
  }
}

console.log(`\n${passed}/${tests.length} tests passed`);
if (passed !== tests.length) {
  process.exit(1);
}
```

- [ ] **Step 2: Run integration tests**

Run: `node test/goal-loop-integration.test.mjs`
Expected: PASS (4/4 tests passed)

- [ ] **Step 3: Configure goal-loop defaults for testing**

Create/update `.cursor/goal/defaults.json`:

```json
{
  "verify": {
    "commands": ["npm test"],
    "cwd": ".",
    "timeout_ms": 300000
  },
  "limits": {
    "max_iterations": 20,
    "max_wall_ms": 7200000
  }
}
```

- [ ] **Step 4: Verify all tests pass**

Run full test suite:
```bash
node test/goal-drift.test.mjs && node test/goal-loop-integration.test.mjs
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add test/goal-loop-integration.test.mjs .cursor/goal/defaults.json
git commit -m "test: add goal-loop integration tests for drift detection and sync"
```

---

## Verification Checklist

- [ ] **U1:** Drift detection utils (compareDriftLevel, formatDriftPrompt, recordDriftHistory) exist and pass unit tests
- [ ] **U2:** detect-drift.mjs hook created and registered; runs without blocking
- [ ] **U3:** goal-verifier.md updated with instruction hierarchy framing
- [ ] **U4:** Goal elevation language added to system prompts; .claude/GOAL_LOOP.md documents integration
- [ ] **U5:** syncGoal function exists; updates active.json and records drift_history
- [ ] **U6:** All 4 integration test scenarios pass (happy path + 3 edge cases)

## Next Steps

1. Run all tests: `npm test 2>&1 | grep -E "(pass|fail|error)"`
2. Verify `.cursor/goal/active.json` is updated when `/goal` command is used
3. Test with real goal-loop session: start a goal, then state a different goal, confirm drift is detected
4. Monitor goal-verifier output for instruction hierarchy acknowledgment

## Known Implementation-Time Questions

These were explicitly deferred in the spec and may be decided during execution:

1. **Session Start Detection:** Check if `active.json` is > N hours old before confirming drift? (Current: always check if statement differs)
2. **Verification Command Sync:** On drift, prompt to confirm old commands still apply? (Current: auto-carry forward)
3. **Drift History Retention:** Cap drift_history to last 10 entries? (Current: unlimited)
4. **Non-Interactive Mode:** For CI/automation, auto-approve drift? (Current: requires explicit approval)

Current implementation defaults to maximum transparency + explicit approval.
