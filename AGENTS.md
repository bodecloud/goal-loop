# Repository guidelines

## Project structure and module organization

Goal Loop is a Cursor plugin packaged from the repository root. Plugin metadata lives in `.cursor-plugin/plugin.json`. User-facing command prompts are in `commands/`. The Cursor skill is in `skills/cursor-goal/`. The verifier helper agent prompt is in `agents/`. Runtime hook code is in `hooks/`. Shared CLI and state logic is in `scripts/`. Reusable JSON and rule templates are in `templates/`. Tests live in `tests/`. Documentation is split between `README.md`, `docs/`, and the static site under `site/`. Visual assets are in `assets/`. `docs/solutions/` holds documented solutions to past problems (bugs, best practices, workflow patterns), organized by category with YAML frontmatter (`module`, `tags`, `problem_type`); it is relevant when implementing or debugging in an area someone has already worked through. `CONCEPTS.md` at the repository root holds the shared domain vocabulary (goal, check, stop hook, iteration, lifecycle states), useful when orienting to the codebase or naming things in docs and commits. `STRATEGY.md` records the product's target problem, approach, and current tracks.

## Build, test, and development commands

- `npm test`: runs the Node test suite with `node --test`.
- `npm run validate`: checks plugin packaging expectations, manifest paths, hook wiring, and version metadata.
- `npm run verify`: runs tests and plugin validation. Use this as the default pre-PR proof command.
- `npm run docs:check`: validates static site documentation links and content expectations with `scripts/check-site.mjs`.

For local plugin experiments, use:

```bash
cursor-agent --plugin-dir "$PWD" --workspace /path/to/project
```

## Coding style and naming conventions

This repo uses ESM JavaScript (`"type": "module"`) and Node 18+. Match the existing style: two-space indentation, semicolons, double quotes in JavaScript, and small focused functions. Use kebab-case for command and documentation filenames such as `goal-status.md`. Use `.mjs` for executable Node scripts. Keep command prompts direct and operational. Avoid broad autonomy language.

## Testing guidelines

Tests use Node's built-in `node:test` and `node:assert/strict`. Place tests in `tests/` with the `*.test.mjs` suffix. Prefer temp project directories for filesystem behavior, as in `goalctl.test.mjs` and `goal-stop.test.mjs`. Add tests when you change goal state transitions, hook output, check execution, defaults resolution, or manifest validation.

## Commit and pull request guidelines

Recent history uses concise Conventional Commit-style subjects: `ci: use standard pages deployment`, `docs: add github pages api site`, and `feat: release goal loop v0.1.0`. Follow that pattern with a lowercase type and imperative summary.

Pull requests should describe the behavior change, list the verification run, and call out any changes to plugin packaging, hook behavior, state schema, or public docs. Include screenshots only for `site/` visual changes.

## Agent-specific instructions

Goal Loop's core contract is that a shell check, not agent prose, decides completion. Preserve the `.cursor/goal/active.json` state model, fail-open hook behavior, and log-backed `followup_message` semantics unless the docs and tests are updated together.
