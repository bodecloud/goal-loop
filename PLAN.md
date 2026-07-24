# Living plan (active)

### Delta Update (2026-07-24)
- Landed: Dogfood `/goal create minesweeper, full feature parity` via subagent one-shot; `examples/minesweeper/` built; `.cursor/goal/active.json` → `completed` with `npm test` + `npm run build` verifying; no Goal Loop code changes required.
- Partial: Research dump below is still the Codex↔Ralph map, not a rewritten implementation plan; pause/resume/blocked/CLI runner remain unshipped product gaps (not blockers for this dogfood).
- Next: Optional — rewrite this file into strategy-backed implementation units; add lifecycle/CLI only when a real gap appears.

---

Codex /goal → Cursor: complete reference and instructions

  1. Verdict

  Cursor does not ship a /goal command. There is no thread-persisted objective with Codex-style status (active /
  paused / budget_limited / complete), token-budget accounting, or system-injected continuation prompts.

  What Cursor does support that can approximate “keep going until done”:

  ┌───────────────────────┬─────────────────────────────────────────────────┬─────────────────────────────────────┐
  │ Layer                 │ What it is                                      │ Closest to /goal?                   │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────┤
  │ Long-running Cloud    │ Cursor product harness for multi-hour/day       │ Closest product intent              │
  │ Agents                │ autonomous work                                 │                                     │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────┤
  │ Official ralph-loop   │ In-chat stop-hook loop; re-feeds the same       │ Closest in-IDE slash-like loop      │
  │ plugin                │ prompt                                          │                                     │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────┤
  │ External Ralph (CLI)  │ Bash/agent -p outer loop; fresh context each    │ Closest engineering parity for long │
  │                       │ iter                                            │ AFK runs                            │
  ├───────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────┤
  │ /loop skill           │ Time/event recurring wakeups                    │ Not goal-until-done                 │
  └───────────────────────┴─────────────────────────────────────────────────┴─────────────────────────────────────┘

  Ralph is the community standard substitute. It is not identical to /goal. Below is a lossless mapping so nothing
  from a Codex goal is dropped when you switch.

  ────────────────────────────────────────

  2. What Codex /goal is (full behavior)

  2.1 Official surface

  Sources: Codex CLI reference (https://developers.openai.com/codex/cli/reference.md), Follow a goal 
  (https://developers.openai.com/codex/use-cases/follow-goals), Using Goals in Codex (cookbook) 
  (https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex), OpenAI product video Run long tasks
  in Codex using goals.

  ┌───────────────────┬──────────────────────────────────────────────────────┐
  │ Command           │ Effect                                               │
  ├───────────────────┼──────────────────────────────────────────────────────┤
  │ /goal <objective> │ Set/attach a durable objective to the current thread │
  ├───────────────────┼──────────────────────────────────────────────────────┤
  │ /goal             │ View current goal                                    │
  ├───────────────────┼──────────────────────────────────────────────────────┤
  │ /goal edit        │ Revise objective                                     │
  ├───────────────────┼──────────────────────────────────────────────────────┤
  │ /goal pause       │ Pause looping; retain state                          │
  ├───────────────────┼──────────────────────────────────────────────────────┤
  │ /goal resume      │ Resume                                               │
  ├───────────────────┼──────────────────────────────────────────────────────┤
  │ /goal clear       │ Remove goal                                          │
  └───────────────────┴──────────────────────────────────────────────────────┘

  Constraints from the CLI reference:

  • Objective must be non-empty
  • Max 4,000 characters
  • Longer instructions → put details in a file and point the goal at that file

  Availability: Codex ≥ 0.128; also in Codex app / IDE extension (product messaging: hours–days; OpenAI has claimed
  runs on the order of ~100 hours for some goals).

  2.2 Mental model

     1 │Normal prompt:  ask → work → result → WAIT for user
     2 │Goal:           work → evidence-check → CONTINUE or COMPLETE

  A Goal is a user-controlled completion contract, not unbounded autonomy.

  2.3 Six fields of a strong Goal (cookbook)

  1. Outcome — what must be true when done
  2. Verification surface — test/benchmark/artifact/command that proves it
  3. Constraints — what must not regress
  4. Boundaries — allowed files/tools/data
  5. Iteration policy — how to choose the next action after each attempt
  6. Blocked stop condition — when to stop and what to report

  Canonical pattern:

     1 │/goal <desired end state> verified by <specific evidence> while preserving <constraints>.
     2 │Use <allowed inputs, tools, or boundaries>.
     3 │Between iterations, <how Codex should choose the next best action>.
     4 │If blocked or no valid paths remain, <what Codex should report and what would unlock progress>.

  2.4 Internal architecture (OpenAI source + reverse-engineering)

  Primary: continuation.md in openai/codex 
  (https://github.com/openai/codex/blob/main/codex-rs/ext/goal/templates/goals/continuation.md), budget_limit.md 
  (https://github.com/openai/codex/blob/main/codex-rs/ext/goal/templates/goals/budget_limit.md), implementation
  notes (gist summarizing PRs (https://gist.github.com/patleeman/b1b5768393f9bf2f60865b1defeeb819)).

  Persistence: SQLite thread_goals — one goal per thread; statuses:

  • active
  • paused
  • budget_limited (terminal for substantive work)
  • complete (terminal)

  Model tools (asymmetric):

  ┌───────────────────────────────┬─────────────────────────────────────┐
  │ Tool                          │ Model can?                          │
  ├───────────────────────────────┼─────────────────────────────────────┤
  │ create_goal                   │ Yes (when user/system asks)         │
  ├───────────────────────────────┼─────────────────────────────────────┤
  │ update_goal(complete)         │ Yes, only when evidence supports it │
  ├───────────────────────────────┼─────────────────────────────────────┤
  │ get_goal                      │ Yes                                 │
  ├───────────────────────────────┼─────────────────────────────────────┤
  │ pause / resume / budget_limit │ No — user/system only               │
  └───────────────────────────────┴─────────────────────────────────────┘

  Continuation prompt rules (paraphrased from continuation.md):

  • Treat worktree + external state as authoritative
  • Do not shrink the objective to an easier subset
  • Before complete: requirement-by-requirement evidence audit
  • Weak/indirect/missing evidence → keep working
  • blocked: only after the same blocker repeats ≥ 3 consecutive goal turns
  • Do not mark complete because budget is nearly exhausted

  Budget: optional token budget; on exhaustion inject budget_limit.md — summarize, do not start new substantive
  work, do not fake-complete.

  Stop conditions (product + runtime):

  1. Evidence proves complete → update_goal(complete)
  2. Budget exhausted → budget_limited
  3. User pause/clear/interrupt
  4. Strict blocked threshold met
  5. Safety: no-tool continuation can suppress the next auto-continue (anti-spin)

  ────────────────────────────────────────

  3. What Cursor supports (exhaustive)

  3.1 No /goal

  Confirmed by:

  • Absence from Cursor slash/docs inventory
  • Forum feature request: “Introduce ralph in cursor” 
    (https://forum.cursor.com/t/introduce-ralph-in-cursor/147764)
  • Cursor’s own answer path: plugins + CLI harnesses + Cloud Agents

  3.2 Official Cursor hooks API (the mechanism Ralph uses)

  Source: Cursor Hooks docs (https://cursor.com/docs/hooks)

  Relevant events:

  ┌───────────────────┬───────────────────────────────────────────────────────────────────────────────────────────┐
  │ Event             │ Role for Ralph                                                                            │
  ├───────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ afterAgentRespons │ Inspect final assistant text; detect <promise>…</promise>                                 │
  │ e                 │                                                                                           │
  ├───────────────────┼───────────────────────────────────────────────────────────────────────────────────────────┤
  │ stop              │ On turn end, optionally return {"followup_message":"..."} to auto-submit next user        │
  │                   │ message                                                                                   │
  └───────────────────┴───────────────────────────────────────────────────────────────────────────────────────────┘

  Critical options from official docs:

  ┌──────────────────┬─────────┬─────────────────────────────────────┐
  │ Option           │ Default │ Meaning                             │
  ├──────────────────┼─────────┼─────────────────────────────────────┤
  │ loop_limit       │ 5       │ Max auto follow-ups per stop script │
  ├──────────────────┼─────────┼─────────────────────────────────────┤
  │ loop_limit: null │ —       │ No cap from Cursor’s side           │
  └──────────────────┴─────────┴─────────────────────────────────────┘

  Official docs quote (paraphrased accurately): When followup_message is provided, Cursor submits it as the next 
  user message. Default limit is 5; set loop_limit to null to remove the cap.

  Implication: Older forum advice that “Cursor hard-caps at 5” applies to default hooks. The official Ralph plugin
  sets "loop_limit": null, so it can exceed 5 — your safety net must be --max-iterations / cancel.

  3.3 Official Cursor ralph-loop plugin

  Sources:

  • Repo: github.com/cursor/plugins/ralph-loop (https://github.com/cursor/plugins/tree/main/ralph-loop)  
  • Install help: forum.cursor.com/t/how-to-install-ralph-plugin/153727 
    (https://forum.cursor.com/t/how-to-install-ralph-plugin/153727)
  • Marketplace listing: cursor.directory/plugins/ralph-loop (https://cursor.directory/plugins/ralph-loop)  

  Install (Cursor ≥ 2.5):

  /add-plugin ralph-loop@https://github.com/cursor/plugins

  (or)

  agent install ralph-loop

  Staff note: may not be on Marketplace autocomplete; GitHub install is the supported path.

  How it works (exact):

  1. Skill writes .cursor/ralph/scratchpad.md:

     1 │---
     2 │iteration: 1
     3 │max_iterations: <N or 0>
     4 │completion_promise: "<TEXT>" or null
     5 │---
     6 │
     7 │<your full task prompt>

  2. afterAgentResponse → capture-response.sh
    • Looks for <promise>TEXT</promise> in response
    • Exact match to completion_promise → creates .cursor/ralph/done

  3. stop → stop-hook.sh (loop_limit: null)
    • No state file → stop
    • Done flag → clean state, stop
    • iteration >= max_iterations (if max > 0) → stop
    • Else increment iteration, emit:

  {"followup_message": "[Ralph loop iteration N. ...]\n\n<ORIGINAL PROMPT UNCHANGED>"}

  Skills:

  • Start: natural language Start a ralph loop: "…" --max-iterations N --completion-promise "COMPLETE"
  • Cancel: remove .cursor/ralph
  • Help: technique explanation

  Important: Promise matching is exact string inside <promise>…</promise>. There is no separate SUCCESS vs BLOCKED
  promise (same limitation as Claude’s Ralph plugin).

  3.4 Cursor /loop skill (not a substitute)

  Built-in skill: recurring/interval or event-based wake (/loop 5m …). It is a scheduler, not an evidence-gated
  completion contract. Do not use it as /goal.

  3.5 Long-running Cloud Agents

  Sources: cursor.com/blog/long-running-agents (https://cursor.com/blog/long-running-agents), Cloud Agents docs 
  (https://cursor.com/docs/cloud-agent)

  • Research-preview long-running harness; Ultra/Teams/Enterprise for the long-running preview path
  • Plan-first, multi-agent follow-through, hours–days (examples: 25–36h)
  • Needs a real env (.cursor/environment.json / snapshot / Dockerfile) so tests can run
  • Repo hooks in .cursor/hooks.json run in cloud; user-level ~/.cursor/hooks.json does not
  • Kick off: Desktop Cloud dropdown, cursor.com/agents (https://cursor.com/agents), Slack/GitHub/Linear @cursor, 
    API/SDK

  This is the closest Cursor-native product to “work until the objective is done,” but it is not /goal lifecycle
  UX.

  3.6 Headless CLI (outer-loop building block)

  Source: Headless CLI (https://cursor.com/docs/cli/headless)

     1 │curl https://cursor.com/install -fsS | bash
     2 │export CURSOR_API_KEY=...
     3 │agent -p --force "…"

  This is what external Ralph harnesses wrap.

  ────────────────────────────────────────

  4. Ecosystem map (everything that implements “until done”)

  ┌───────────────┬───────────────────────────────────┬───────────────────┬───────────────────────────────────────┐
  │ Project       │ Host                              │ Mechanism         │ Install / invoke                      │
  ├───────────────┼───────────────────────────────────┼───────────────────┼───────────────────────────────────────┤
  │ Codex /goal   │ OpenAI Codex                      │ Thread goal +     │ /goal …                               │
  │               │                                   │ continuation      │                                       │
  │               │                                   │ templates         │                                       │
  ├───────────────┼───────────────────────────────────┼───────────────────┼───────────────────────────────────────┤
  │ Cursor        │ Cursor IDE                        │ stop +            │ /add-plugin                           │
  │ ralph-loop    │                                   │ afterAgentRespons │ ralph-loop@https://github.com/cursor/ │
  │               │                                   │ e                 │ plugins                               │
  │               │                                   │ hooks             │                                       │
  ├───────────────┼───────────────────────────────────┼───────────────────┼───────────────────────────────────────┤
  │ Claude Code   │ Anthropic official plugin         │ Stop hook         │ /ralph-loop "…" --completion-promise  │
  │ Ralph         │                                   │                   │ …                                     │
  ├───────────────┼───────────────────────────────────┼───────────────────┼───────────────────────────────────────┤
  │ Gemini Ralph  │ gemini-cli-extensions/ralph       │ AfterAgent hook   │ /ralph:loop "…"                       │
  │               │ (https://github.com/gemini-cli-ex │                   │                                       │
  │               │ tensions/ralph)                   │                   │                                       │
  ├───────────────┼───────────────────────────────────┼───────────────────┼───────────────────────────────────────┤
  │ agrimsingh/ra │ Cursor CLI                        │ Fresh             │ curl …/install.sh | bash              │
  │ lph-wiggum-cu │                                   │ cursor-agent +    │                                       │
  │ rsor          │                                   │ rotate            │                                       │
  ├───────────────┼───────────────────────────────────┼───────────────────┼───────────────────────────────────────┤
  │ Th0rgal/open- │ Multi-agent                       │ Outer ralph CLI   │ npm i -g @th0rgal/ralph-wiggum then   │
  │ ralph-wiggum  │                                   │                   │ ralph --agent cursor-agent            │
  ├───────────────┼───────────────────────────────────┼───────────────────┼───────────────────────────────────────┤
  │ @pageai/ralph │ Cursor in Docker                  │ Task list + fresh │ npx @pageai/ralph-loop                │
  │ -loop         │                                   │ agent             │                                       │
  ├───────────────┼───────────────────────────────────┼───────────────────┼───────────────────────────────────────┤
  │ DIY bash      │ Any                               │ while + agent -p  │ Forum Ralph Cursor Guide              │
  │               │                                   │ + external verify │ (https://forum.cursor.com/t/ralph-cur │
  │               │                                   │                   │ sor-guide/149998)                     │
  ├───────────────┼───────────────────────────────────┼───────────────────┼───────────────────────────────────────┤
  │ Subagent PRD  │ Cursor .cursor/agents/            │ Manual/semi-auto  │ metalogico.dev guide                  │
  │ pattern       │                                   │ story loop        │ (https://metalogico.dev/blog/ralph-lo │
  │               │                                   │                   │ op-cursor/)                           │
  ├───────────────┼───────────────────────────────────┼───────────────────┼───────────────────────────────────────┤
  │ Original      │ Any agent                         │ while :; do cat   │ ghuntley.com/ralph                    │
  │ technique     │                                   │ PROMPT.md |       │ (https://ghuntley.com/ralph/)         │
  │               │                                   │ agent; done       │                                       │
  └───────────────┴───────────────────────────────────┴───────────────────┴───────────────────────────────────────┘

  Open Ralph hybrid note: RALPH_CODEX_GOAL=1 can nest Codex /goal inside each Ralph iteration — useful if you still
  have Codex, irrelevant if you want Cursor-only.

  ────────────────────────────────────────

  5. /goal vs Ralph vs Cloud Agent (precise differences)

  ┌────────────┬────────────────────────┬─────────────────────────────┬───────────────────────┬───────────────────┐
  │ Dimension  │ Codex /goal            │ Cursor official Ralph       │ External CLI Ralph    │ Long-running      │
  │            │                        │                             │                       │ Cloud Agent       │
  ├────────────┼────────────────────────┼─────────────────────────────┼───────────────────────┼───────────────────┤
  │ Trigger    │ /goal                  │ Skill + hooks               │ Shell wrapper         │ Cloud UI /        │
  │            │                        │                             │                       │ @cursor           │
  ├────────────┼────────────────────────┼─────────────────────────────┼───────────────────────┼───────────────────┤
  │ Objective  │ SQLite thread state    │ .cursor/ralph/scratchpad.md │ RALPH_TASK.md /       │ Prompt + plan in  │
  │ storage    │                        │                             │ prompt file           │ cloud session     │
  ├────────────┼────────────────────────┼─────────────────────────────┼───────────────────────┼───────────────────┤
  │ Context    │ Same thread            │ Same chat; prompt           │ Fresh context each    │ Long cloud        │
  │            │ accumulates            │ re-injected each turn       │ iter (ideal Ralph)    │ session + harness │
  ├────────────┼────────────────────────┼─────────────────────────────┼───────────────────────┼───────────────────┤
  │ Memory of  │ Chat + tools + goal    │ Files/git + chat            │ Files/git (primary)   │ Cloud workspace + │
  │ progress   │ state                  │                             │                       │ PR                │
  ├────────────┼────────────────────────┼─────────────────────────────┼───────────────────────┼───────────────────┤
  │ Done       │ Evidence audit +       │ Exact                       │ Checkboxes / tests /  │ Agent + harness   │
  │ signal     │ update_goal(complete)  │ <promise>TEXT</promise>     │ promise / grep        │ judgment + PR     │
  ├────────────┼────────────────────────┼─────────────────────────────┼───────────────────────┼───────────────────┤
  │ Budget     │ Token budget           │ --max-iterations            │ -n / max iters +      │ Spend limits /    │
  │            │                        │                             │ token rotate          │ plan              │
  ├────────────┼────────────────────────┼─────────────────────────────┼───────────────────────┼───────────────────┤
  │ Pause/resu │ First-class            │ Cancel + restart same       │ Kill/restart scripts  │ Stop/follow-up in │
  │ me         │                        │ prompt                      │                       │ cloud UI          │
  ├────────────┼────────────────────────┼─────────────────────────────┼───────────────────────┼───────────────────┤
  │ Blocked    │ Strict 3-turn rule +   │ Document only (no promise)  │ BLOCKED.md / max      │ Agent stops /     │
  │            │ status                 │                             │ iters                 │ asks              │
  ├────────────┼────────────────────────┼─────────────────────────────┼───────────────────────┼───────────────────┤
  │ Cap        │ Budget / complete /    │ max_iterations (plugin has  │ Iteration + rotate    │ Product/runtime   │
  │            │ blocked                │ loop_limit: null)           │                       │ limits            │
  └────────────┴────────────────────────┴─────────────────────────────┴───────────────────────┴───────────────────┘

  Geoffrey Huntley’s pure Ralph (ghuntley.com/ralph (https://ghuntley.com/ralph/)):

  while :; do cat PROMPT.md | agent ; done

  Design rules he emphasizes:

  • One important thing per loop
  • Specs/plan on disk every loop
  • Progress in git, not chat
  • Tune “signs” (guardrails) when the agent misbehaves
  • Prefer fresh context; avoid gutter

  In-session Cursor Ralph (stop-hook) keeps the same conversation, so it is a relative of Ralph, not pure Ralph.
  For true fresh-context Ralph, use CLI harnesses.

  ────────────────────────────────────────

  6. Decision tree

     1 │Need Codex-identical lifecycle (/goal pause|resume|budget|evidence tools)?
     2 │  └─ Stay on Codex CLI/app. Cursor cannot replicate the control plane.
     3 │
     4 │Need multi-hour AFK inside Cursor product with PR/artifacts?
     5 │  └─ Long-running Cloud Agent + strong goal text + working environment.json
     6 │
     7 │Need in-IDE “keep iterating in this chat until promise”?
     8 │  └─ Official ralph-loop plugin (Path A)
     9 │
    10 │Need hours of work with fresh context, gutter detection, cheap models?
    11 │  └─ agrimsingh/ralph-wiggum-cursor or open-ralph-wiggum --agent cursor-agent (Path B/C)
    12 │
    13 │Need mechanical migration (grep/tsc gates)?
    14 │  └─ DIY external verify loop (Path E) — strongest “done” semantics

  ────────────────────────────────────────

  7. Lossless /goal → Ralph conversion (no omissions)

  7.1 Field-by-field map

  ┌───────────────────┬────────────────┬──────────────────────────────────────────────────────────────────────────┐
  │ Codex field       │ Must appear in │ Rules (no gaps)                                                          │
  │                   │ Ralph as       │                                                                          │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ Outcome           │ ## Outcome     │ Paste verbatim. Do not soften metrics.                                   │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ Verification      │ ##             │ Paste every command, threshold, artifact, suite name. Add: “Promise only │
  │                   │ Verification   │ after these commands succeed and their output is shown in this turn.”    │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ Constraints       │ ## Constraints │ Paste all “while preserving …” items.                                    │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ Boundaries        │ ## Boundaries  │ Paste allowed + add explicit forbiddens if implied.                      │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ Iteration policy  │ ## Between     │ Paste Codex wording plus “at start of each iteration: re-read            │
  │                   │ iterations     │ Outcome/Verification; inspect git + progress.md; pick one next action.”  │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ Blocked condition │ ## If blocked  │ Paste Codex wording. Add: never emit completion promise when blocked;    │
  │                   │                │ write BLOCKED.md with attempted paths, evidence, blocker, unlock.        │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ Token budget      │ --max-iteratio │ Map budget → iterations (estimate). Optional: also write a soft token    │
  │                   │ ns             │ note in the prompt for CLI Ralph rotate.                                 │
  │                   │ N              │                                                                          │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ File-backed long  │ Keep pointing  │ Ralph prompt: “Read and obey path/to/GOAL.md in full; that file is the   │
  │ goal (>4k in      │ at the same    │ objective.” Paste path into Outcome.                                     │
  │ Codex)            │ file           │                                                                          │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ Progress log      │ ## Progress    │ Require append-only progress.md each iteration.                          │
  │ (recommended by   │ log            │                                                                          │
  │ OpenAI use-case)  │                │                                                                          │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ Evidence-complete │ Promise gated  │ Copy Codex audit spirit into prompt (see §7.2).                          │
  │                   │ by             │                                                                          │
  │                   │ Verification   │                                                                          │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ /goal pause       │ Cancel Ralph / │ Do not delete progress files.                                            │
  │                   │ stop agent     │                                                                          │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ /goal resume      │ Restart Ralph  │ First line: “Resume from disk/git/progress.md; do not restart from       │
  │                   │ with identical │ scratch.”                                                                │
  │                   │ prompt         │                                                                          │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ /goal edit        │ Cancel → edit  │ New scratchpad with edited body.                                         │
  │                   │ prompt/GOAL.md │                                                                          │
  │                   │ → restart      │                                                                          │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ /goal clear       │ Cancel + rm    │ Optionally keep progress.md for humans.                                  │
  │                   │ -rf            │                                                                          │
  │                   │ .cursor/ralph  │                                                                          │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ budget_limited    │ On             │ Prompt: “If this is the last allowed iteration, summarize progress,      │
  │ wrap-up           │ max-iterations │ blockers, next step; do not promise.”                                    │
  │                   │ stop           │                                                                          │
  ├───────────────────┼────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ Blocked ≥3 turns  │ Emulate in     │ “Only treat as terminal blocked after the same blocker persists across 3 │
  │                   │ prompt         │ consecutive iterations; then write BLOCKED.md and stop promising; keep   │
  │                   │                │ looping until max unless user cancels.”                                  │
  └───────────────────┴────────────────┴──────────────────────────────────────────────────────────────────────────┘

  7.2 Master Ralph prompt template (drop your /goal text into the slots)

  Use this as the string inside Start a ralph loop: "…" or as PROMPT.md / body of RALPH_TASK.md.

     1 │## Resume rule
     2 │If progress.md, BLOCKED.md, or relevant commits already exist, RESUME from them.
     3 │Do not wipe or redo completed verified work. Prefer the smallest next change that moves Outcome.
     4 │
     5 │## Outcome
     6 │<<< PASTE CODEX OUTCOME VERBATIM >>>
     7 │
     8 │## Verification
     9 │Success is TRUE only when ALL of the following hold in the CURRENT worktree:
    10 │<<< PASTE EVERY VERIFICATION COMMAND / ARTIFACT / THRESHOLD VERBATIM >>>
    11 │
    12 │Completion audit (mandatory before promising):
    13 │- Derive every explicit requirement from Outcome, Verification, Constraints, and any referenced
       │files/plans/issues.
    14 │- For EACH requirement, identify authoritative evidence and inspect current state (files, command output,
       │tests, artifacts).
    15 │- Classify each: proves | contradicts | incomplete | weak/indirect | missing.
    16 │- Weak, indirect, or missing evidence = NOT done. Keep working.
    17 │- Do not use a narrow check to claim a broad requirement.
    18 │- Do not mark done from intent, memory, or “looks plausible.”
    19 │
    20 │## Constraints
    21 │<<< PASTE ALL CONSTRAINTS VERBATIM >>>
    22 │
    23 │## Boundaries
    24 │Allowed:
    25 │<<< PASTE BOUNDARIES VERBATIM >>>
    26 │Forbidden: anything outside Allowed.
    27 │
    28 │## Between iterations
    29 │<<< PASTE CODEX ITERATION POLICY VERBATIM >>>
    30 │Additionally, at the start of EVERY iteration:
    31 │1. Read git status and recent commits.
    32 │2. Read progress.md (create if missing) and BLOCKED.md if present.
    33 │3. Re-run or re-check Verification-related commands as needed for current truth.
    34 │4. Choose the single highest-value next action under Boundaries.
    35 │5. Implement it; then re-check Verification.
    36 │
    37 │## Progress log
    38 │After each meaningful step, append to progress.md:
    39 │- timestamp / iteration
    40 │- checkpoint name
    41 │- what changed (files)
    42 │- verification commands + summarized results
    43 │- what remains
    44 │- blocked? yes/no + why
    45 │
    46 │## If blocked
    47 │<<< PASTE CODEX BLOCKED STOP CONDITION VERBATIM >>>
    48 │Never emit the completion promise when blocked.
    49 │Write/update BLOCKED.md with: attempted paths, evidence gathered, blocker, next input needed to unlock.
    50 │Only treat the goal as terminal-blocked after the SAME blocker has persisted across at least 3 consecutive
       │iterations.
    51 │Until max iterations, keep seeking any valid path under Boundaries.
    52 │
    53 │## Last-iteration / budget behavior
    54 │If you are at or near the final allowed iteration and Verification is not yet true:
    55 │- Do not emit the completion promise.
    56 │- Summarize progress, remaining work, blockers, and the single best next step for a human.
    57 │
    58 │## Completion promise rule
    59 │Output <promise>COMPLETE</promise> ONLY when the Verification section is unequivocally satisfied AND
       │Constraints hold.
    60 │Never emit it to escape the loop, when partially done, when blocked, or because iterations are running out.

  Replace COMPLETE everywhere if you choose another promise string — it must match --completion-promise exactly.

  7.3 Worked conversion (full)

  Codex:

     1 │/goal Reduce p95 checkout latency below 120 ms, verified by the checkout benchmark,
     2 │while keeping the correctness suite green. Use only the checkout service, benchmark
     3 │fixtures, and related tests. Between iterations, record what changed, what the
     4 │benchmark showed, and the next best experiment to try. If the benchmark cannot run
     5 │or no valid paths remain, stop with the attempted paths, the evidence gathered,
     6 │the blocker, and the next input needed.

  Ralph invocation (Cursor official plugin):

     1 │Start a ralph loop: "
     2 │## Resume rule
     3 │If progress.md, BLOCKED.md, or relevant commits already exist, RESUME from them.
     4 │Do not wipe or redo completed verified work.
     5 │
     6 │## Outcome
     7 │Reduce p95 checkout latency below 120 ms.
     8 │
     9 │## Verification
    10 │Success is TRUE only when ALL hold in the CURRENT worktree:
    11 │1. The checkout benchmark reports p95 < 120 ms.
    12 │2. The correctness suite is green.
    13 │3. Both command outputs are pasted in the turn that claims completion.
    14 │
    15 │Completion audit (mandatory before promising):
    16 │- Derive every explicit requirement from Outcome, Verification, Constraints, and referenced fixtures/tests.
    17 │- For EACH requirement, identify authoritative evidence and inspect current state.
    18 │- Classify each: proves | contradicts | incomplete | weak/indirect | missing.
    19 │- Weak, indirect, or missing evidence = NOT done.
    20 │- Do not mark done from intent, memory, or plausibility.
    21 │
    22 │## Constraints
    23 │Keep the correctness suite green; do not regress correctness for latency gains.
    24 │
    25 │## Boundaries
    26 │Allowed: the checkout service, benchmark fixtures, and related tests only.
    27 │Forbidden: anything outside Allowed.
    28 │
    29 │## Between iterations
    30 │Record what changed, what the benchmark showed, and the next best experiment to try.
    31 │Additionally, at the start of EVERY iteration:
    32 │1. Read git status and recent commits.
    33 │2. Read progress.md (create if missing) and BLOCKED.md if present.
    34 │3. Re-check benchmark and correctness evidence for current truth.
    35 │4. Choose the single highest-value next experiment under Boundaries.
    36 │5. Implement it; then re-check Verification.
    37 │
    38 │## Progress log
    39 │Append to progress.md each iteration: change, benchmark numbers, correctness result, next experiment,
       │blocked?
    40 │
    41 │## If blocked
    42 │If the benchmark cannot run or no valid paths remain: stop with the attempted paths, the evidence gathered,
       │the blocker, and the next input needed.
    43 │Never emit the completion promise when blocked.
    44 │Write/update BLOCKED.md with attempted paths, evidence, blocker, unlock needed.
    45 │Only treat as terminal-blocked after the SAME blocker persists across ≥3 consecutive iterations.
    46 │
    47 │## Last-iteration / budget behavior
    48 │If on the final allowed iteration and Verification is not true: summarize progress, remaining work,
       │blockers, next step; do not promise.
    49 │
    50 │## Completion promise rule
    51 │Output <promise>COMPLETE</promise> ONLY when Verification is unequivocally satisfied and Constraints hold.
    52 │" --max-iterations 40 --completion-promise "COMPLETE"

  Every clause from the original /goal is present. Additions are only Ralph lifecycle mechanics (resume, audit
  echo, promise gate, last-iteration, files).

  ────────────────────────────────────────

  8. Path A — Official Cursor ralph-loop (step-by-step)

  8.1 Prerequisites

  • Cursor 2.5+
  • Agent mode in a project
  • Prefer git so progress survives

  8.2 Install

  /add-plugin ralph-loop@https://github.com/cursor/plugins

  8.3 Start

  Convert your goal with §7, then:

  Start a ralph loop: "<FULL TEMPLATE FROM §7.2>" --max-iterations 40 --completion-promise "COMPLETE"

  Always set --max-iterations. Plugin default 0 = unlimited from the skill’s POV; with loop_limit: null that can
  burn spend indefinitely (runaway reports (https://forum.cursor.com/t/ralph-loop-running-non-stop/160898)).

  8.4 While running

  • You will see followups prefixed like [Ralph loop iteration N. …]
  • Watch .cursor/ralph/scratchpad.md for iteration counter
  • Maintain progress.md / BLOCKED.md as required by the prompt

  8.5 Pause (= Codex /goal pause)

  1. Stop the agent in the UI, or run cancel-ralph skill / ask to cancel
  2. Cancel removes .cursor/ralph/ — your code and progress.md remain if you put them outside that dir (put
     progress at repo root or .ralph/)

  Recommended: keep progress at repo root (progress.md) so cancel doesn’t eat history. The plugin only owns
  .cursor/ralph/.

  8.6 Resume (= /goal resume)

  1. Ensure progress.md still exists
  2. Start the same Ralph prompt again (include Resume rule)
  3. New scratchpad starts at iteration 1 unless you manually seed frontmatter — that’s OK; disk state carries
     truth

  8.7 Edit (= /goal edit)

  1. Cancel
  2. Edit GOAL.md / prompt text
  3. Start Ralph again with the edited body

  8.8 Clear (= /goal clear)

  rm -rf .cursor/ralph

  (or cancel-ralph skill)

  8.9 Emergency stop

  • New empty chat (hooks may still fire if state file exists — delete .cursor/ralph)
  • If a different Ralph/hooks install left entries in project .cursor/hooks.json, remove those entries and
    restart Cursor (forum (https://forum.cursor.com/t/ralph-loop-running-non-stop/160898))

  8.10 Cloud Agent caveat

  If you also run Cloud Agents: only repo .cursor/hooks.json applies there; the marketplace plugin’s hooks may not
  automatically be what you expect in cloud. Prefer Cloud Agents with a goal-shaped prompt without relying on local
  Ralph state, unless you commit a project-level Ralph hook setup intentionally.

  ────────────────────────────────────────

  9. Path B — agrimsingh/ralph-wiggum-cursor (true fresh-context Ralph)

  Source: github.com/agrimsingh/ralph-wiggum-cursor (https://github.com/agrimsingh/ralph-wiggum-cursor)

  9.1 Install

     1 │cd your-project
     2 │curl -fsSL https://raw.githubusercontent.com/agrimsingh/ralph-wiggum-cursor/main/install.sh | bash
     3 │# Cursor CLI
     4 │curl https://cursor.com/install -fsS | bash
     5 │# auth
     6 │agent login   # or CURSOR_API_KEY

  9.2 Convert /goal into RALPH_TASK.md

  Map Outcome → task title + Success Criteria checkboxes.
  Map Verification → test_command frontmatter and criteria.
  Map Constraints/Boundaries/Iteration/Blocked into sections of the same file — do not delete any clause.

  Example structure:

     1 │---
     2 │task: Reduce p95 checkout latency below 120 ms
     3 │test_command: "<your correctness suite command>"
     4 │---
     5 │
     6 │# Task
     7 │
     8 │## Outcome
     9 │Reduce p95 checkout latency below 120 ms.
    10 │
    11 │## Success Criteria
    12 │1. [ ] Checkout benchmark p95 < 120 ms
    13 │2. [ ] Correctness suite green
    14 │3. [ ] progress.md records final numbers
    15 │
    16 │## Constraints
    17 │…
    18 │
    19 │## Boundaries
    20 │…
    21 │
    22 │## Between iterations
    23 │…
    24 │
    25 │## If blocked
    26 │…
    27 │
    28 │## Notes
    29 │Completion promise / signs / etc.

  Ralph tracks unchecked [ ] → [x]. Put every verification gate as a checkbox so “done” is mechanical.

  9.3 Run

     1 │./.cursor/ralph-scripts/ralph-setup.sh
     2 │# or non-interactive:
     3 │./.cursor/ralph-scripts/ralph-loop.sh -n 40 -m <model> -y

  Behavior: token WARN ~70k, ROTATE ~80k, gutter detection, progress.md / guardrails.md, optional --branch / --pr /
  --parallel.

  9.4 Lifecycle mapping

  ┌────────┬───────────────────────────────────────────┐
  │ Codex  │ Here                                      │
  ├────────┼───────────────────────────────────────────┤
  │ pause  │ Ctrl-C / kill loop                        │
  ├────────┼───────────────────────────────────────────┤
  │ resume │ re-run setup/loop; state in .ralph/ + git │
  ├────────┼───────────────────────────────────────────┤
  │ edit   │ edit RALPH_TASK.md, restart               │
  ├────────┼───────────────────────────────────────────┤
  │ clear  │ reset task file / .ralph as needed        │
  ├────────┼───────────────────────────────────────────┤
  │ budget │ -n iterations + rotate thresholds         │
  └────────┴───────────────────────────────────────────┘

  ────────────────────────────────────────

  10. Path C — open-ralph-wiggum with Cursor Agent

     1 │npm install -g @th0rgal/ralph-wiggum
     2 │ralph "<FULL §7.2 PROMPT including <promise>COMPLETE</promise>>" \
     3 │  --agent cursor-agent \
     4 │  --max-iterations 40

  Supports --status, --add-context mid-loop, --tasks. Same conversion rules as §7.

  ────────────────────────────────────────

  11. Path D — Long-running Cloud Agent (Cursor-native AFK)

  1. Connect GitHub/GitLab/etc.
  2. Configure environment (setup docs (https://cursor.com/docs/cloud-agent/setup.md)) so Verification commands 
     actually run
  3. Paste the §7.2 body without Ralph promise tags (or keep them harmlessly)
  4. Prefer: “Do not finish until Verification commands pass; open a PR with evidence in the description”
  5. Start from Cloud dropdown or cursor.com/agents (https://cursor.com/agents)  
  6. Approve plan; walk away; review PR/artifacts

  Lifecycle: pause/follow-up via cloud UI, not /goal pause.

  ────────────────────────────────────────

  12. Path E — DIY external-verify loop (strongest “done”)

  From Ralph Cursor Guide (https://forum.cursor.com/t/ralph-cursor-guide/149998):

  1. Plan Mode: produce before/after patterns + grep/tsc/test gate that returns success only when done
  2. Write a script:

     1 │#!/usr/bin/env bash
     2 │set -euo pipefail
     3 │MAX=50
     4 │PROMPT=$(cat PROMPT.md)   # full §7.2 content
     5 │i=0
     6 │while (( i < MAX )); do
     7 │  # EXTERNAL truth — not the model
     8 │  if <VERIFICATION_COMMAND_FROM_GOAL>; then
     9 │    echo "GOAL ACHIEVED"
    10 │    exit 0
    11 │  fi
    12 │  agent -p --force "$PROMPT"
    13 │  i=$((i+1))
    14 │done
    15 │echo "BUDGET/ITERATIONS EXHAUSTED"
    16 │exit 1

  This is the closest semantic match to Codex’s “evidence decides,” because the shell owns completion, not
  <promise>.

  ────────────────────────────────────────

  13. Emulating Codex lifecycle outside Codex (checklist)

  ┌─────────────┬─────────────────────────────────────────┬───────────────────────────┬───────────────────────────┐
  │ Codex       │ Cursor Ralph (plugin)                   │ CLI Ralph                 │ Cloud Agent               │
  │ action      │                                         │                           │                           │
  ├─────────────┼─────────────────────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Set goal    │ Start ralph loop + full prompt          │ Write task file + run     │ Paste goal + start cloud  │
  │             │                                         │ loop                      │                           │
  ├─────────────┼─────────────────────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ View goal   │ Read scratchpad / PROMPT                │ Read RALPH_TASK.md        │ Open agent page           │
  ├─────────────┼─────────────────────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Edit        │ Cancel → edit → restart                 │ Edit file → restart       │ Follow-up message / new   │
  │             │                                         │                           │ run                       │
  ├─────────────┼─────────────────────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Pause       │ Stop agent; keep progress files         │ Kill process              │ Stop in UI                │
  ├─────────────┼─────────────────────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Resume      │ Same prompt + resume rule               │ Re-run script             │ Resume/follow-up          │
  ├─────────────┼─────────────────────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Clear       │ rm -rf .cursor/ralph                    │ Reset task/state          │ End agent                 │
  ├─────────────┼─────────────────────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Budget      │ --max-iterations                        │ -n + rotate               │ Spend limit               │
  ├─────────────┼─────────────────────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Complete    │ <promise>…</promise> or external verify │ checkboxes/tests          │ PR + artifacts            │
  ├─────────────┼─────────────────────────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Blocked     │ BLOCKED.md; no promise                  │ same                      │ agent asks / stops        │
  └─────────────┴─────────────────────────────────────────┴───────────────────────────┴───────────────────────────┘

  ────────────────────────────────────────

  14. Failure modes and safeguards (exhaustive)

  1. False promise — Model emits <promise>COMPLETE</promise> early. Mitigate: verification audit text + prefer
     Path E external gates.
  2. No promise configured — Loop never self-stops except max iterations / manual cancel.
  3. Unlimited iterations — max_iterations: 0 + loop_limit: null = spend runaway. Always set N.
  4. Typing in chat resets some loop counters (forum reports on older/community hooks). Prefer cancel + state
     delete.
  5. In-session Ralph context rot — Same chat grows; for long goals prefer CLI fresh-context Ralph.
  6. Cloud hooks ≠ local plugin — Don’t assume marketplace Ralph runs in cloud VMs the same way.
  7. Windows bash — Claude Ralph docs need Git Bash paths; Cursor plugin scripts are bash too.
  8. Vague goals — Same failure as Codex; both systems need measurable Verification.
  9. “One thing per loop” — Huntley rule; if Ralph thrashing, narrow Boundaries to one next story.
  10. Assuming code missing — Huntley: instruct “search before assuming unimplemented.”

  ────────────────────────────────────────

  15. What still has no Cursor equivalent

  These Codex facilities have no first-class Cursor twin:

  • /goal slash UX + status bar goal chip
  • SQLite thread goal with goal_id versioning
  • Token budget accounting with budget_limited steering template
  • Model tools create_goal / update_goal / get_goal with system-only pause
  • Built-in 3-turn blocked status protocol
  • Automatic idle continuation driven by goal runtime (vs stop-hook re-prompt or outer bash)

  You can emulate them with prompt + files + scripts (§7–§12), but not with a native control plane.

  ────────────────────────────────────────

  16. References (primary)

  Codex /goal

  • https://developers.openai.com/codex/cli/reference.md  
  • https://developers.openai.com/codex/use-cases/follow-goals  
  • https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex  
  • https://github.com/openai/codex/blob/main/codex-rs/ext/goal/templates/goals/continuation.md  
  • https://github.com/openai/codex/blob/main/codex-rs/ext/goal/templates/goals/budget_limit.md  
  • https://gist.github.com/patleeman/b1b5768393f9bf2f60865b1defeeb819  

  Cursor

  • https://cursor.com/docs/hooks  
  • https://cursor.com/docs/cli/headless  
  • https://cursor.com/docs/cloud-agent  
  • https://cursor.com/blog/long-running-agents  
  • https://github.com/cursor/plugins/tree/main/ralph-loop  
  • https://forum.cursor.com/t/how-to-install-ralph-plugin/153727  
  • https://forum.cursor.com/t/introduce-ralph-in-cursor/147764  
  • https://forum.cursor.com/t/ralph-cursor-guide/149998  
  • https://forum.cursor.com/t/ralph-loop-running-non-stop/160898  

  Ralph technique & ports

  • https://ghuntley.com/ralph/  
  • https://github.com/agrimsingh/ralph-wiggum-cursor  
  • https://github.com/Th0rgal/open-ralph-wiggum  
  • https://github.com/anthropics/claude-plugins-official (ralph-loop)  
  • https://github.com/gemini-cli-extensions/ralph  
  • https://ralphloop.sh/blog/ralph-loop-with-cursor-cli/  
  • https://metalogico.dev/blog/ralph-loop-cursor/  

  ────────────────────────────────────────

  Practical bottom line

  1. There is no Cursor /goal.
  2. For Codex-like “keep going until verified done” in Cursor Agent chat: install ralph-loop, convert with §7 
     (every field pasted, no summarization), always set --max-iterations, gate <promise>COMPLETE</promise> on
     Verification.
  3. For multi-hour AFK with healthier context: use CLI Ralph (Path B/C) or external verify (Path E).
  4. For Cursor’s own long-horizon product: long-running Cloud Agents + the same goal contract text.
  5. If you need pause/resume/budget as first-class system state: stay on Codex /goal.
