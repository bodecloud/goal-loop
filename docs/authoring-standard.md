# Documentation authoring standard

This page is the writing rule for Goal Loop docs. The other docs in this folder should follow it.

Docs regress most often by drifting back into vague claims, marketing tone, and wording that sounds helpful without being specific enough to use.

## Plain-language rules

Write for a competent engineer who has never seen this project.

- Use short sentences.
- Use active voice.
- Address the reader as "you".
- Prefer everyday words over jargon.
- Prefer "you" over "operator" unless you truly mean a role.
- Use sentence-case headings that say what the section answers.
- For FAQ entries, use real questions as headings and put a direct answer in the first sentence.
- Do not use emojis.
- Do not pad. Keep pages roughly the same length, or slightly shorter, when you rewrite.

Avoid these words and habits:

- leverage, utilize, orchestration
- "surface" as a noun
- delve, seamless, robust, comprehensive
- marketing language and autonomy theater

When these ideas appear, use the plain replacements:

- "deterministic verification" / "verifier" -> "a command that either passes or fails" / "a repeatable check"
- "completion authority" / "self-certify" -> "decides when the work is done" / "declare itself done"
- "product boundary" / "non-scope" -> "What Goal Loop does not do"
- "claim boundaries" -> "What this repo proves, and what it doesn't"
- "command surface" -> "commands"

## What to optimize for

Prefer documentation that helps a reader answer one of these questions:

- What does Goal Loop actually do?
- What does it not do?
- What does a passing check really prove?
- How should I choose a check?
- How do I debug or review loop behavior?
- What current repo evidence supports this claim?

If a paragraph does not help answer a real question, remove it.

## Preserve exact technical facts

Do not paraphrase facts into something different, and do not invent new ones.

Keep these exact when they appear:

- Paths: `.cursor/goal/active.json`, `.cursor/goal/draft.json`, `.cursor/goal/defaults.json`, `.cursor/goal/progress.md`, `.cursor/goal/runs/NNN.log`, `.cursor/goal/runs/hook-errors.log`, `hooks/hooks.json`, `hooks/goal-stop.mjs`, `scripts/`, `templates/`, `tests/`
- JSON keys and values: `version`, `status`, `objective`, `verify.commands`, `verify.cwd`, `verify.timeout_ms`, `limits.max_iterations`, `limits.max_wall_ms`, `completion_promise`, `started_at`, `iteration`, `last_verify` (with `ok`, `exit_codes`, `command_results`, `log_path`, `completed_at`)
- Numbers: `loop_limit: 20`, `max_iterations: 20`, `max_wall_ms: 7200000`, `timeout_ms: 600000`
- Status names: `draft`, `active`, `completed`, `aborted`
- Hook returns: `{}` in all stop cases; `{"followup_message": "..."}` only when an active goal's check actually ran and failed; fail open on crash (`{}` plus `hook-errors.log`)
- Check commands run one after another and stop at the first failure
- Commands: `/goal`, `/plan`, `/goal-status`, `/goal-abort` (and `/goal-abort --remove`)
- Repo commands: `npm test`, `npm run validate`, `npm run verify`, `npm run docs:check`
- Version and scope: v0.1.0 is deliberately narrow

## Keep honest caveats

Never delete caveats to make the product sound larger.

Restate them plainly. Examples that must stay honest:

- this repo does not prove marketplace publication state
- this repo does not prove the current Cursor IDE local-plugin experience beyond the plugin shape here
- a passing check is not proof of semantic correctness
- v0.1.0 does not include richer planner workflows, multiple simultaneous active goals, understanding of code diffs, custom dashboards, non-shell check backends, or distributed orchestration

## Claims standard

Every important claim should fall into one of these buckets.

### Directly supported by the repository

Examples: current hook behavior, CLI behavior, state-file schema, test-covered behaviors, static site structure.

These claims should be traceable to code, tests, or validated artifacts. Use the [evidence map](evidence-map.md) when a claim needs a pointer.

### Explicitly bounded or conditional

Examples: marketplace install after publication, Cursor IDE details outside what the repo proves, whether a chosen check is enough for a human request.

Frame these carefully. Do not overstate them.

## Link rules

Keep relative markdown links pointing at files that exist.

Inside `docs/`, link only to files that are actually there, plus `../README.md` when needed. A validator checks every relative link ending in `.md`, `.json`, or `.txt` and fails if the target is missing.

If you mention a path that is not a file in this repo (for example `.cursor/goal/active.json` in a user's project), write it in backticks. Do not turn it into a markdown link.

## Example standard

Examples must teach judgment, not just syntax.

A good example should clarify:

- when to use the pattern
- when not to use it
- what the check proves
- what the check does not prove

An example that only shows a command without that context is too weak for this repo.

## Reviewer checklist

Before merging a docs change, ask:

1. Is this claim supported by the repo?
2. If not, is it explicitly bounded?
3. Does this wording overstate what Goal Loop proves?
4. Does this change reduce ambiguity or reintroduce it?
5. Would a reader make a better decision after reading this?
6. Does the prose follow the plain-language rules above?

If the answers to the last items are weak, the change is not ready.

## Relationship to validation

Automated checks in this repo can catch:

- broken links
- missing required docs files
- missing site sections
- missing runtime-state ignore patterns

They cannot catch:

- subtle overclaiming
- weak examples
- vague reasoning
- misleading proof language

That is why human review still matters.

## When to add new pages

Add a new page only when at least one of these is true:

- the information serves a distinct reader need
- the existing page would become unfocused if you added the material there
- the new page clarifies a real decision or proof boundary

Do not add pages just to look complete.

## Repository-specific principle

Prefer documentation that is:

- smaller in product claim
- larger in clarity
- stricter about proof
- more honest about limits

That is the intended style going forward.
