# Living plan (active)

### Delta Update (2026-07-24)

- Landed: Dogfood `/goal create minesweeper, full feature parity` via a subagent one-shot. `examples/minesweeper/` was built. `.cursor/goal/active.json` reached `completed` with `npm test` and `npm run build` as the checks. No Goal Loop code changes were required.
- Partial: Pause, resume, blocked status, and a fresh-context CLI runner remain unshipped. Those are product gaps, not blockers for this dogfood.
- Next: Add lifecycle or CLI work only when a real gap shows up. Optionally break remaining research into strategy-backed implementation units.

---

# Codex /goal on Cursor

Research map for moving a Codex-style goal onto Cursor, Ralph-style loops, and what Goal Loop v0.1.0 already covers.

## Verdict

Cursor does not ship a `/goal` command. There is no thread-persisted objective with Codex-style status (`active` / `paused` / `budget_limited` / `complete`), token-budget accounting, or system-injected continuation prompts.

What Cursor does support that can approximate "keep going until done":

| Layer | What it is | Closest to `/goal`? |
| --- | --- | --- |
| Long-running Cloud Agents | Cursor product harness for multi-hour/day autonomous work | Closest product intent |
| Official ralph-loop plugin | In-chat stop-hook loop; re-feeds the same prompt | Closest in-IDE slash-like loop |
| External Ralph (CLI) | Bash/`agent -p` outer loop; fresh context each iter | Closest engineering parity for long AFK runs |
| `/loop` skill | Time/event recurring wakeups | Not goal-until-done |

Ralph is the community standard substitute. It is not identical to `/goal`. The sections below map Codex goal behavior so you do not drop fields when you switch.

Goal Loop v0.1.0 is this repo's Cursor-native answer: a project-local contract and a stop hook where a shell check decides when the work is done. See the conclusion at the end.

## What Codex /goal does

### Official commands

Sources: [Codex CLI reference](https://developers.openai.com/codex/cli/reference.md), [Follow a goal](https://developers.openai.com/codex/use-cases/follow-goals), [Using Goals in Codex (cookbook)](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex), OpenAI product video *Run long tasks in Codex using goals*.

| Command | Effect |
| --- | --- |
| `/goal <objective>` | Set/attach a durable objective to the current thread |
| `/goal` | View current goal |
| `/goal edit` | Revise objective |
| `/goal pause` | Pause looping; retain state |
| `/goal resume` | Resume |
| `/goal clear` | Remove goal |

Constraints from the CLI reference:

- Objective must be non-empty
- Max 4,000 characters
- Longer instructions → put details in a file and point the goal at that file

Availability: Codex ≥ 0.128; also in Codex app / IDE extension (product messaging: hours–days; OpenAI has claimed runs on the order of ~100 hours for some goals).

### How to think about it

```text
Normal prompt:  ask → work → result → WAIT for user
Goal:           work → evidence-check → CONTINUE or COMPLETE
```

A Goal is a user-controlled completion contract, not unbounded autonomy.

### Six fields of a strong goal (cookbook)

1. Outcome — what must be true when done
2. Verification — test/benchmark/artifact/command that proves it
3. Constraints — what must not regress
4. Boundaries — allowed files/tools/data
5. Iteration policy — how to choose the next action after each attempt
6. Blocked stop condition — when to stop and what to report

Canonical pattern:

```text
/goal <desired end state> verified by <specific evidence> while preserving <constraints>.
Use <allowed inputs, tools, or boundaries>.
Between iterations, <how Codex should choose the next best action>.
If blocked or no valid paths remain, <what Codex should report and what would unlock progress>.
```

### Internal architecture

Primary sources: [`continuation.md`](https://github.com/openai/codex/blob/main/codex-rs/ext/goal/templates/goals/continuation.md), [`budget_limit.md`](https://github.com/openai/codex/blob/main/codex-rs/ext/goal/templates/goals/budget_limit.md), [implementation notes gist](https://gist.github.com/patleeman/b1b5768393f9bf2f60865b1defeeb819).

Persistence: SQLite `thread_goals` — one goal per thread; statuses:

- `active`
- `paused`
- `budget_limited` (terminal for substantive work)
- `complete` (terminal)

Model tools (asymmetric):

| Tool | Model can? |
| --- | --- |
| `create_goal` | Yes (when user/system asks) |
| `update_goal(complete)` | Yes, only when evidence supports it |
| `get_goal` | Yes |
| pause / resume / budget_limit | No — user/system only |

Continuation prompt rules (paraphrased from `continuation.md`):

- Treat worktree + external state as authoritative
- Do not shrink the objective to an easier subset
- Before complete: requirement-by-requirement evidence audit
- Weak/indirect/missing evidence → keep working
- `blocked`: only after the same blocker repeats ≥ 3 consecutive goal turns
- Do not mark complete because budget is nearly exhausted

Budget: optional token budget; on exhaustion inject `budget_limit.md` — summarize, do not start new substantive work, do not fake-complete.

Stop conditions (product + runtime):

1. Evidence proves complete → `update_goal(complete)`
2. Budget exhausted → `budget_limited`
3. User pause/clear/interrupt
4. Strict blocked threshold met
5. Safety: no-tool continuation can suppress the next auto-continue (anti-spin)

## What Cursor supports

### No `/goal`

Confirmed by:

- Absence from Cursor slash/docs inventory
- Forum feature request: [Introduce ralph in cursor](https://forum.cursor.com/t/introduce-ralph-in-cursor/147764)
- Cursor’s own answer path: plugins + CLI harnesses + Cloud Agents

### Official Cursor hooks API

Source: [Cursor Hooks docs](https://cursor.com/docs/hooks)

Relevant events:

| Event | Role for Ralph |
| --- | --- |
| `afterAgentResponse` | Inspect final assistant text; detect `<promise>…</promise>` |
| `stop` | On turn end, optionally return `{"followup_message":"..."}` to auto-submit next user message |

Critical options from official docs:

| Option | Default | Meaning |
| --- | --- | --- |
| `loop_limit` | `5` | Max auto follow-ups per stop script |
| `loop_limit: null` | — | No cap from Cursor’s side |

Official docs (paraphrased): When `followup_message` is provided, Cursor submits it as the next user message. Default limit is 5; set `loop_limit` to `null` to remove the cap.

Implication: Older forum advice that “Cursor hard-caps at 5” applies to default hooks. The official Ralph plugin sets `"loop_limit": null`, so it can exceed 5 — your safety net must be `--max-iterations` / cancel.

### Official Cursor ralph-loop plugin

Sources:

- Repo: [github.com/cursor/plugins/ralph-loop](https://github.com/cursor/plugins/tree/main/ralph-loop)
- Install help: [forum.cursor.com/t/how-to-install-ralph-plugin/153727](https://forum.cursor.com/t/how-to-install-ralph-plugin/153727)
- Marketplace listing: [cursor.directory/plugins/ralph-loop](https://cursor.directory/plugins/ralph-loop)

Install (Cursor ≥ 2.5):

```text
/add-plugin ralph-loop@https://github.com/cursor/plugins
```

or:

```text
agent install ralph-loop
```

Staff note: may not be on Marketplace autocomplete; GitHub install is the supported path.

How it works:

1. Skill writes `.cursor/ralph/scratchpad.md`:

```text
---
iteration: 1
max_iterations: <N or 0>
completion_promise: "<TEXT>" or null
---

<your full task prompt>
```

2. `afterAgentResponse` → `capture-response.sh`
   - Looks for `<promise>TEXT</promise>` in response
   - Exact match to `completion_promise` → creates `.cursor/ralph/done`

3. `stop` → `stop-hook.sh` (`loop_limit: null`)
   - No state file → stop
   - Done flag → clean state, stop
   - `iteration >= max_iterations` (if max > 0) → stop
   - Else increment iteration, emit:

```json
{"followup_message": "[Ralph loop iteration N. ...]\n\n<ORIGINAL PROMPT UNCHANGED>"}
```

Skills:

- Start: natural language `Start a ralph loop: "…" --max-iterations N --completion-promise "COMPLETE"`
- Cancel: remove `.cursor/ralph`
- Help: technique explanation

Important: Promise matching is exact string inside `<promise>…</promise>`. There is no separate SUCCESS vs BLOCKED promise (same limitation as Claude’s Ralph plugin).

### Cursor `/loop` skill (not a substitute)

Built-in skill: recurring/interval or event-based wake (`/loop 5m …`). It is a scheduler, not an evidence-gated completion contract. Do not use it as `/goal`.

### Long-running Cloud Agents

Sources: [cursor.com/blog/long-running-agents](https://cursor.com/blog/long-running-agents), [Cloud Agents docs](https://cursor.com/docs/cloud-agent)

- Research-preview long-running harness; Ultra/Teams/Enterprise for the long-running preview path
- Plan-first, multi-agent follow-through, hours–days (examples: 25–36h)
- Needs a real env (`.cursor/environment.json` / snapshot / Dockerfile) so tests can run
- Repo hooks in `.cursor/hooks.json` run in cloud; user-level `~/.cursor/hooks.json` does not
- Kick off: Desktop Cloud dropdown, [cursor.com/agents](https://cursor.com/agents), Slack/GitHub/Linear `@cursor`, API/SDK

This is the closest Cursor-native product to “work until the objective is done,” but it is not `/goal` lifecycle UX.

### Headless CLI

Source: [Headless CLI](https://cursor.com/docs/cli/headless)

```bash
curl https://cursor.com/install -fsS | bash
export CURSOR_API_KEY=...
agent -p --force "…"
```

This is what external Ralph harnesses wrap.

## Ecosystem map

Everything that implements “until done”:

| Project | Host | Mechanism | Install / invoke |
| --- | --- | --- | --- |
| Codex `/goal` | OpenAI Codex | Thread goal + continuation templates | `/goal …` |
| Cursor ralph-loop | Cursor IDE | `stop` + `afterAgentResponse` hooks | `/add-plugin ralph-loop@https://github.com/cursor/plugins` |
| Claude Code Ralph | Anthropic official plugin | Stop hook | `/ralph-loop "…" --completion-promise …` |
| Gemini Ralph | [gemini-cli-extensions/ralph](https://github.com/gemini-cli-extensions/ralph) | AfterAgent hook | `/ralph:loop "…"` |
| agrimsingh/ralph-wiggum-cursor | Cursor CLI | Fresh cursor-agent + rotate | `curl …/install.sh \| bash` |
| Th0rgal/open-ralph-wiggum | Multi-agent | Outer ralph CLI | `npm i -g @th0rgal/ralph-wiggum` then `ralph --agent cursor-agent` |
| @pageai/ralph-loop | Cursor in Docker | Task list + fresh agent | `npx @pageai/ralph-loop` |
| DIY bash | Any | `while` + `agent -p` + external verify | [Forum Ralph Cursor Guide](https://forum.cursor.com/t/ralph-cursor-guide/149998) |
| Subagent PRD pattern | Cursor `.cursor/agents/` | Manual/semi-auto story loop | [metalogico.dev guide](https://metalogico.dev/blog/ralph-loop-cursor/) |
| Original technique | Any agent | `while :; do cat PROMPT.md \| agent; done` | [ghuntley.com/ralph](https://ghuntley.com/ralph/) |

Open Ralph hybrid note: `RALPH_CODEX_GOAL=1` can nest Codex `/goal` inside each Ralph iteration — useful if you still have Codex, irrelevant if you want Cursor-only.

## /goal vs Ralph vs Cloud Agent

| Dimension | Codex `/goal` | Cursor official Ralph | External CLI Ralph | Long-running Cloud Agent |
| --- | --- | --- | --- | --- |
| Trigger | `/goal` | Skill + hooks | Shell wrapper | Cloud UI / `@cursor` |
| Objective storage | SQLite thread state | `.cursor/ralph/scratchpad.md` | `RALPH_TASK.md` / prompt file | Prompt + plan in cloud session |
| Context | Same thread accumulates | Same chat; prompt re-injected each turn | Fresh context each iter (ideal Ralph) | Long cloud session + harness |
| Memory of progress | Chat + tools + goal state | Files/git + chat | Files/git (primary) | Cloud workspace + PR |
| Done signal | Evidence audit + `update_goal(complete)` | Exact `<promise>TEXT</promise>` | Checkboxes / tests / promise / grep | Agent + harness judgment + PR |
| Budget | Token budget | `--max-iterations` | `-n` / max iters + token rotate | Spend limits / plan |
| Pause/resume | First-class | Cancel + restart same prompt | Kill/restart scripts | Stop/follow-up in cloud UI |
| Blocked | Strict 3-turn rule + status | Document only (no promise) | `BLOCKED.md` / max iters | Agent stops / asks |
| Cap | Budget / complete / blocked | `max_iterations` (plugin has `loop_limit: null`) | Iteration + rotate | Product/runtime limits |

Geoffrey Huntley’s pure Ralph ([ghuntley.com/ralph](https://ghuntley.com/ralph/)):

```bash
while :; do cat PROMPT.md | agent ; done
```

Design rules he emphasizes:

- One important thing per loop
- Specs/plan on disk every loop
- Progress in git, not chat
- Tune “signs” (guardrails) when the agent misbehaves
- Prefer fresh context; avoid gutter

In-session Cursor Ralph (stop-hook) keeps the same conversation, so it is a relative of Ralph, not pure Ralph. For true fresh-context Ralph, use CLI harnesses.

## Decision tree

```text
Need Codex-identical lifecycle (/goal pause|resume|budget|evidence tools)?
  └─ Stay on Codex CLI/app. Cursor cannot replicate the control plane.

Need multi-hour AFK inside Cursor product with PR/artifacts?
  └─ Long-running Cloud Agent + strong goal text + working environment.json

Need in-IDE “keep iterating in this chat until promise”?
  └─ Official ralph-loop plugin (Path A)

Need hours of work with fresh context, gutter detection, cheap models?
  └─ agrimsingh/ralph-wiggum-cursor or open-ralph-wiggum --agent cursor-agent (Path B/C)

Need mechanical migration (grep/tsc gates)?
  └─ DIY external verify loop (Path E) — strongest “done” semantics
```

For a Cursor-native shell-check loop in this chat, Goal Loop is the Path E idea packaged as a plugin (see conclusion).

## Converting /goal to Ralph without dropping fields

### Field-by-field map

| Codex field | Must appear in Ralph as | Rules (no gaps) |
| --- | --- | --- |
| Outcome | `## Outcome` | Paste verbatim. Do not soften metrics. |
| Verification | `## Verification` | Paste every command, threshold, artifact, suite name. Add: “Promise only after these commands succeed and their output is shown in this turn.” |
| Constraints | `## Constraints` | Paste all “while preserving …” items. |
| Boundaries | `## Boundaries` | Paste allowed + add explicit forbiddens if implied. |
| Iteration policy | `## Between iterations` | Paste Codex wording plus “at start of each iteration: re-read Outcome/Verification; inspect git + progress.md; pick one next action.” |
| Blocked condition | `## If blocked` | Paste Codex wording. Add: never emit completion promise when blocked; write `BLOCKED.md` with attempted paths, evidence, blocker, unlock. |
| Token budget | `--max-iterations N` | Map budget → iterations (estimate). Optional: also write a soft token note in the prompt for CLI Ralph rotate. |
| File-backed long goal (>4k in Codex) | Keep pointing at the same file | Ralph prompt: “Read and obey path/to/GOAL.md in full; that file is the objective.” Paste path into Outcome. |
| Progress log (recommended by OpenAI use-case) | `## Progress log` | Require append-only `progress.md` each iteration. |
| Evidence-complete | Promise gated by Verification | Copy Codex audit spirit into prompt (see template below). |
| `/goal pause` | Cancel Ralph / stop agent | Do not delete progress files. |
| `/goal resume` | Restart Ralph with identical prompt | First line: “Resume from disk/git/progress.md; do not restart from scratch.” |
| `/goal edit` | Cancel → edit prompt/GOAL.md → restart | New scratchpad with edited body. |
| `/goal clear` | Cancel + `rm -rf .cursor/ralph` | Optionally keep `progress.md` for humans. |
| `budget_limited` wrap-up | On max-iterations stop | Prompt: “If this is the last allowed iteration, summarize progress, blockers, next step; do not promise.” |
| Blocked ≥3 turns | Emulate in prompt | “Only treat as terminal blocked after the same blocker persists across 3 consecutive iterations; then write `BLOCKED.md` and stop promising; keep looping until max unless user cancels.” |

### Master Ralph prompt template

Use this as the string inside `Start a ralph loop: "…"` or as `PROMPT.md` / body of `RALPH_TASK.md`.

```text
## Resume rule
If progress.md, BLOCKED.md, or relevant commits already exist, RESUME from them.
Do not wipe or redo completed verified work. Prefer the smallest next change that moves Outcome.

## Outcome
<<< PASTE CODEX OUTCOME VERBATIM >>>

## Verification
Success is TRUE only when ALL of the following hold in the CURRENT worktree:
<<< PASTE EVERY VERIFICATION COMMAND / ARTIFACT / THRESHOLD VERBATIM >>>

Completion audit (mandatory before promising):
- Derive every explicit requirement from Outcome, Verification, Constraints, and any referenced
  files/plans/issues.
- For EACH requirement, identify authoritative evidence and inspect current state (files, command output,
  tests, artifacts).
- Classify each: proves | contradicts | incomplete | weak/indirect | missing.
- Weak, indirect, or missing evidence = NOT done. Keep working.
- Do not use a narrow check to claim a broad requirement.
- Do not mark done from intent, memory, or “looks plausible.”

## Constraints
<<< PASTE ALL CONSTRAINTS VERBATIM >>>

## Boundaries
Allowed:
<<< PASTE BOUNDARIES VERBATIM >>>
Forbidden: anything outside Allowed.

## Between iterations
<<< PASTE CODEX ITERATION POLICY VERBATIM >>>
Additionally, at the start of EVERY iteration:
1. Read git status and recent commits.
2. Read progress.md (create if missing) and BLOCKED.md if present.
3. Re-run or re-check Verification-related commands as needed for current truth.
4. Choose the single highest-value next action under Boundaries.
5. Implement it; then re-check Verification.

## Progress log
After each meaningful step, append to progress.md:
- timestamp / iteration
- checkpoint name
- what changed (files)
- verification commands + summarized results
- what remains
- blocked? yes/no + why

## If blocked
<<< PASTE CODEX BLOCKED STOP CONDITION VERBATIM >>>
Never emit the completion promise when blocked.
Write/update BLOCKED.md with: attempted paths, evidence gathered, blocker, next input needed to unlock.
Only treat the goal as terminal-blocked after the SAME blocker has persisted across at least 3 consecutive
iterations.
Until max iterations, keep seeking any valid path under Boundaries.

## Last-iteration / budget behavior
If you are at or near the final allowed iteration and Verification is not yet true:
- Do not emit the completion promise.
- Summarize progress, remaining work, blockers, and the single best next step for a human.

## Completion promise rule
Output <promise>COMPLETE</promise> ONLY when the Verification section is unequivocally satisfied AND
Constraints hold.
Never emit it to escape the loop, when partially done, when blocked, or because iterations are running out.
```

Replace `COMPLETE` everywhere if you choose another promise string — it must match `--completion-promise` exactly.

### Worked conversion

Codex:

```text
/goal Reduce p95 checkout latency below 120 ms, verified by the checkout benchmark,
while keeping the correctness suite green. Use only the checkout service, benchmark
fixtures, and related tests. Between iterations, record what changed, what the
benchmark showed, and the next best experiment to try. If the benchmark cannot run
or no valid paths remain, stop with the attempted paths, the evidence gathered,
the blocker, and the next input needed.
```

Ralph invocation (Cursor official plugin):

```text
Start a ralph loop: "
## Resume rule
If progress.md, BLOCKED.md, or relevant commits already exist, RESUME from them.
Do not wipe or redo completed verified work.

## Outcome
Reduce p95 checkout latency below 120 ms.

## Verification
Success is TRUE only when ALL hold in the CURRENT worktree:
1. The checkout benchmark reports p95 < 120 ms.
2. The correctness suite is green.
3. Both command outputs are pasted in the turn that claims completion.

Completion audit (mandatory before promising):
- Derive every explicit requirement from Outcome, Verification, Constraints, and referenced fixtures/tests.
- For EACH requirement, identify authoritative evidence and inspect current state.
- Classify each: proves | contradicts | incomplete | weak/indirect | missing.
- Weak, indirect, or missing evidence = NOT done.
- Do not mark done from intent, memory, or plausibility.

## Constraints
Keep the correctness suite green; do not regress correctness for latency gains.

## Boundaries
Allowed: the checkout service, benchmark fixtures, and related tests only.
Forbidden: anything outside Allowed.

## Between iterations
Record what changed, what the benchmark showed, and the next best experiment to try.
Additionally, at the start of EVERY iteration:
1. Read git status and recent commits.
2. Read progress.md (create if missing) and BLOCKED.md if present.
3. Re-check benchmark and correctness evidence for current truth.
4. Choose the single highest-value next experiment under Boundaries.
5. Implement it; then re-check Verification.

## Progress log
Append to progress.md each iteration: change, benchmark numbers, correctness result, next experiment,
blocked?

## If blocked
If the benchmark cannot run or no valid paths remain: stop with the attempted paths, the evidence gathered,
the blocker, and the next input needed.
Never emit the completion promise when blocked.
Write/update BLOCKED.md with attempted paths, evidence, blocker, unlock needed.
Only treat as terminal-blocked after the SAME blocker persists across ≥3 consecutive iterations.

## Last-iteration / budget behavior
If on the final allowed iteration and Verification is not true: summarize progress, remaining work,
blockers, next step; do not promise.

## Completion promise rule
Output <promise>COMPLETE</promise> ONLY when Verification is unequivocally satisfied and Constraints hold.
" --max-iterations 40 --completion-promise "COMPLETE"
```

Every clause from the original `/goal` is present. Additions are only Ralph lifecycle mechanics (resume, audit echo, promise gate, last-iteration, files).

## Path A — Official Cursor ralph-loop

### Prerequisites

- Cursor 2.5+
- Agent mode in a project
- Prefer git so progress survives

### Install

```text
/add-plugin ralph-loop@https://github.com/cursor/plugins
```

### Start

Convert your goal with the field map above, then:

```text
Start a ralph loop: "<FULL TEMPLATE>" --max-iterations 40 --completion-promise "COMPLETE"
```

Always set `--max-iterations`. Plugin default `0` = unlimited from the skill’s POV; with `loop_limit: null` that can burn spend indefinitely ([runaway reports](https://forum.cursor.com/t/ralph-loop-running-non-stop/160898)).

### While running

- You will see followups prefixed like `[Ralph loop iteration N. …]`
- Watch `.cursor/ralph/scratchpad.md` for iteration counter
- Maintain `progress.md` / `BLOCKED.md` as required by the prompt

### Pause (= Codex `/goal pause`)

1. Stop the agent in the UI, or run cancel-ralph skill / ask to cancel
2. Cancel removes `.cursor/ralph/` — your code and `progress.md` remain if you put them outside that dir (put progress at repo root or `.ralph/`)

Recommended: keep progress at repo root (`progress.md`) so cancel doesn’t eat history. The plugin only owns `.cursor/ralph/`.

### Resume (= `/goal resume`)

1. Ensure `progress.md` still exists
2. Start the same Ralph prompt again (include Resume rule)
3. New scratchpad starts at iteration 1 unless you manually seed frontmatter — that’s OK; disk state carries truth

### Edit (= `/goal edit`)

1. Cancel
2. Edit `GOAL.md` / prompt text
3. Start Ralph again with the edited body

### Clear (= `/goal clear`)

```bash
rm -rf .cursor/ralph
```

(or cancel-ralph skill)

### Emergency stop

- New empty chat (hooks may still fire if state file exists — delete `.cursor/ralph`)
- If a different Ralph/hooks install left entries in project `.cursor/hooks.json`, remove those entries and restart Cursor ([forum](https://forum.cursor.com/t/ralph-loop-running-non-stop/160898))

### Cloud Agent caveat

If you also run Cloud Agents: only repo `.cursor/hooks.json` applies there; the marketplace plugin’s hooks may not automatically be what you expect in cloud. Prefer Cloud Agents with a goal-shaped prompt without relying on local Ralph state, unless you commit a project-level Ralph hook setup intentionally.

## Path B — agrimsingh/ralph-wiggum-cursor (true fresh-context Ralph)

Source: [github.com/agrimsingh/ralph-wiggum-cursor](https://github.com/agrimsingh/ralph-wiggum-cursor)

### Install

```bash
cd your-project
curl -fsSL https://raw.githubusercontent.com/agrimsingh/ralph-wiggum-cursor/main/install.sh | bash
# Cursor CLI
curl https://cursor.com/install -fsS | bash
# auth
agent login   # or CURSOR_API_KEY
```

### Convert `/goal` into `RALPH_TASK.md`

Map Outcome → task title + Success Criteria checkboxes.  
Map Verification → `test_command` frontmatter and criteria.  
Map Constraints/Boundaries/Iteration/Blocked into sections of the same file — do not delete any clause.

Example structure:

```text
---
task: Reduce p95 checkout latency below 120 ms
test_command: "<your correctness suite command>"
---

# Task

## Outcome
Reduce p95 checkout latency below 120 ms.

## Success Criteria
1. [ ] Checkout benchmark p95 < 120 ms
2. [ ] Correctness suite green
3. [ ] progress.md records final numbers

## Constraints
…

## Boundaries
…

## Between iterations
…

## If blocked
…

## Notes
Completion promise / signs / etc.
```

Ralph tracks unchecked `[ ]` → `[x]`. Put every verification gate as a checkbox so “done” is mechanical.

### Run

```bash
./.cursor/ralph-scripts/ralph-setup.sh
# or non-interactive:
./.cursor/ralph-scripts/ralph-loop.sh -n 40 -m <model> -y
```

Behavior: token WARN ~70k, ROTATE ~80k, gutter detection, `progress.md` / `guardrails.md`, optional `--branch` / `--pr` / `--parallel`.

### Lifecycle mapping

| Codex | Here |
| --- | --- |
| pause | Ctrl-C / kill loop |
| resume | re-run setup/loop; state in `.ralph/` + git |
| edit | edit `RALPH_TASK.md`, restart |
| clear | reset task file / `.ralph` as needed |
| budget | `-n` iterations + rotate thresholds |

## Path C — open-ralph-wiggum with Cursor Agent

```bash
npm install -g @th0rgal/ralph-wiggum
ralph "<FULL PROMPT including <promise>COMPLETE</promise>>" \
  --agent cursor-agent \
  --max-iterations 40
```

Supports `--status`, `--add-context` mid-loop, `--tasks`. Same conversion rules as the field map above.

## Path D — Long-running Cloud Agent

1. Connect GitHub/GitLab/etc.
2. Configure environment ([setup docs](https://cursor.com/docs/cloud-agent/setup.md)) so Verification commands actually run
3. Paste the master prompt body without Ralph promise tags (or keep them harmlessly)
4. Prefer: “Do not finish until Verification commands pass; open a PR with evidence in the description”
5. Start from Cloud dropdown or [cursor.com/agents](https://cursor.com/agents)
6. Approve plan; walk away; review PR/artifacts

Lifecycle: pause/follow-up via cloud UI, not `/goal pause`.

## Path E — DIY external-verify loop (strongest “done”)

From [Ralph Cursor Guide](https://forum.cursor.com/t/ralph-cursor-guide/149998):

1. Plan Mode: produce before/after patterns + grep/tsc/test gate that returns success only when done
2. Write a script:

```bash
#!/usr/bin/env bash
set -euo pipefail
MAX=50
PROMPT=$(cat PROMPT.md)   # full converted goal content
i=0
while (( i < MAX )); do
  # EXTERNAL truth — not the model
  if <VERIFICATION_COMMAND_FROM_GOAL>; then
    echo "GOAL ACHIEVED"
    exit 0
  fi
  agent -p --force "$PROMPT"
  i=$((i+1))
done
echo "BUDGET/ITERATIONS EXHAUSTED"
exit 1
```

This is the closest semantic match to Codex’s “evidence decides,” because the shell owns completion, not `<promise>`. Goal Loop packages that idea for in-chat Cursor stop hooks: the check runs after each turn; agent prose does not declare done.

## Emulating Codex lifecycle outside Codex

| Codex action | Cursor Ralph (plugin) | CLI Ralph | Cloud Agent |
| --- | --- | --- | --- |
| Set goal | Start ralph loop + full prompt | Write task file + run loop | Paste goal + start cloud |
| View goal | Read scratchpad / PROMPT | Read `RALPH_TASK.md` | Open agent page |
| Edit | Cancel → edit → restart | Edit file → restart | Follow-up message / new run |
| Pause | Stop agent; keep progress files | Kill process | Stop in UI |
| Resume | Same prompt + resume rule | Re-run script | Resume/follow-up |
| Clear | `rm -rf .cursor/ralph` | Reset task/state | End agent |
| Budget | `--max-iterations` | `-n` + rotate | Spend limit |
| Complete | `<promise>…</promise>` or external verify | checkboxes/tests | PR + artifacts |
| Blocked | `BLOCKED.md`; no promise | same | agent asks / stops |

## Failure modes and safeguards

1. False promise — Model emits `<promise>COMPLETE</promise>` early. Mitigate: verification audit text + prefer Path E external gates (or Goal Loop’s shell check).
2. No promise configured — Loop never self-stops except max iterations / manual cancel.
3. Unlimited iterations — `max_iterations: 0` + `loop_limit: null` = spend runaway. Always set N.
4. Typing in chat resets some loop counters (forum reports on older/community hooks). Prefer cancel + state delete.
5. In-session Ralph context rot — Same chat grows; for long goals prefer CLI fresh-context Ralph.
6. Cloud hooks ≠ local plugin — Don’t assume marketplace Ralph runs in cloud VMs the same way.
7. Windows bash — Claude Ralph docs need Git Bash paths; Cursor plugin scripts are bash too.
8. Vague goals — Same failure as Codex; both systems need measurable Verification.
9. “One thing per loop” — Huntley rule; if Ralph thrashing, narrow Boundaries to one next story.
10. Assuming code missing — Huntley: instruct “search before assuming unimplemented.”

## What still has no Cursor equivalent

These Codex facilities have no first-class Cursor twin:

- `/goal` slash UX + status bar goal chip
- SQLite thread goal with `goal_id` versioning
- Token budget accounting with `budget_limited` steering template
- Model tools `create_goal` / `update_goal` / `get_goal` with system-only pause
- Built-in 3-turn blocked status protocol
- Automatic idle continuation driven by goal runtime (vs stop-hook re-prompt or outer bash)

You can emulate them with prompt + files + scripts (conversion + Paths A–E), but not with a native control plane.

Goal Loop adds a Cursor `/goal`-style command and a check-backed stop hook. It does not add Codex pause/resume/`budget_limited`/blocked protocol as first-class system state.

## References

### Codex `/goal`

- https://developers.openai.com/codex/cli/reference.md
- https://developers.openai.com/codex/use-cases/follow-goals
- https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex
- https://github.com/openai/codex/blob/main/codex-rs/ext/goal/templates/goals/continuation.md
- https://github.com/openai/codex/blob/main/codex-rs/ext/goal/templates/goals/budget_limit.md
- https://gist.github.com/patleeman/b1b5768393f9bf2f60865b1defeeb819

### Cursor

- https://cursor.com/docs/hooks
- https://cursor.com/docs/cli/headless
- https://cursor.com/docs/cloud-agent
- https://cursor.com/blog/long-running-agents
- https://github.com/cursor/plugins/tree/main/ralph-loop
- https://forum.cursor.com/t/how-to-install-ralph-plugin/153727
- https://forum.cursor.com/t/introduce-ralph-in-cursor/147764
- https://forum.cursor.com/t/ralph-cursor-guide/149998
- https://forum.cursor.com/t/ralph-loop-running-non-stop/160898

### Ralph technique and ports

- https://ghuntley.com/ralph/
- https://github.com/agrimsingh/ralph-wiggum-cursor
- https://github.com/Th0rgal/open-ralph-wiggum
- https://github.com/anthropics/claude-plugins-official (ralph-loop)
- https://github.com/gemini-cli-extensions/ralph
- https://ralphloop.sh/blog/ralph-loop-with-cursor-cli/
- https://metalogico.dev/blog/ralph-loop-cursor/

## Practical bottom line

1. There is no Cursor `/goal` in the product itself. Goal Loop is a plugin that adds a check-backed `/goal` loop.
2. For Codex-like “keep going until verified done” in Cursor Agent chat with Ralph: install ralph-loop, convert with the field map (every field pasted, no summarization), always set `--max-iterations`, gate `<promise>COMPLETE</promise>` on Verification.
3. For multi-hour AFK with healthier context: use CLI Ralph (Path B/C) or external verify (Path E).
4. For Cursor’s own long-horizon product: long-running Cloud Agents + the same goal contract text.
5. If you need pause/resume/budget as first-class system state: stay on Codex `/goal`.

## Conclusion for Goal Loop v0.1.0

Goal Loop v0.1.0 is a feasible Cursor-native, check-backed loop. A shell check decides when the work is done. The minesweeper dogfood shows that path works without changing Goal Loop code.

Remaining gaps are lifecycle features (pause / resume / blocked) and an optional fresh-context CLI runner. Those are not blockers for the dogfood proof.
