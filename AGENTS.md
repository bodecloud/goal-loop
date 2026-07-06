# Repository Guidelines

## Project Structure & Module Organization

Goal Loop is a Cursor plugin packaged from the repository root. Plugin metadata lives in `.cursor-plugin/plugin.json`. User-facing command prompts are in `commands/`, the Cursor skill is in `skills/cursor-goal/`, and the verifier helper agent prompt is in `agents/`. Runtime hook code is in `hooks/`, shared CLI/state logic is in `scripts/`, and reusable JSON/rule templates are in `templates/`. Tests live in `tests/`. Documentation is split between `README.md`, `docs/`, and the static site under `site/`; visual assets are in `assets/`.

## Build, Test, and Development Commands

- `npm test`: runs the Node test suite with `node --test`.
- `npm run validate`: checks plugin packaging expectations, manifest paths, hook wiring, and version metadata.
- `npm run verify`: runs tests and plugin validation; use this as the default pre-PR proof command.
- `npm run docs:check`: validates static site documentation links/content expectations with `scripts/check-site.mjs`.

For local plugin experiments, use:

```bash
cursor-agent --plugin-dir "$PWD" --workspace /path/to/project
```

## Coding Style & Naming Conventions

This repo uses ESM JavaScript (`"type": "module"`) and Node 18+. Match the existing style: two-space indentation, semicolons, double quotes in JavaScript, and small focused functions. Use kebab-case for command and documentation filenames such as `goal-status.md`; use `.mjs` for executable Node scripts. Keep command prompts direct and operational rather than broad autonomy language.

## Testing Guidelines

Tests use Node's built-in `node:test` and `node:assert/strict`. Place tests in `tests/` with the `*.test.mjs` suffix. Prefer temp project directories for filesystem behavior, as in `goalctl.test.mjs` and `goal-stop.test.mjs`. Add tests when changing goal state transitions, hook output, verifier execution, defaults resolution, or manifest validation.

## Commit & Pull Request Guidelines

Recent history uses concise Conventional Commit-style subjects: `ci: use standard pages deployment`, `docs: add github pages api site`, and `feat: release goal loop v0.1.0`. Follow that pattern with a lowercase type and imperative summary.

Pull requests should describe the behavior change, list the verification run, and call out any changes to plugin packaging, hook semantics, state schema, or public docs. Include screenshots only for `site/` visual changes.

## Agent-Specific Instructions

Goal Loop's core contract is that the verifier, not agent prose, decides completion. Preserve the `.cursor/goal/active.json` state model, fail-open hook behavior, and log-backed `followup_message` semantics unless the docs and tests are updated together.
