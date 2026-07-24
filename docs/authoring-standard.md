# Documentation Authoring Standard

This page defines the quality bar for future documentation changes in this repository.

It exists because the easiest way for docs to regress is not through missing pages, but through gradual return to vague claims, weak proof language, and content that sounds helpful without being operationally specific.

## Core Standard

A Goal Loop documentation change is good only if it is:

- accurate to the current repository state
- explicit about what is and is not being claimed
- grounded in the actual proof model
- useful to an operator, reviewer, or adopter making real decisions

If a change is polished but ambiguous, it does not meet the bar.

## What to Optimize For

Prefer documentation that helps a reader answer one of these questions:

- What does Goal Loop actually do?
- What does it not do?
- What does a passing verifier really prove?
- How should I choose a verifier?
- How do I debug or review loop behavior?
- What current repo evidence supports this claim?

If a paragraph does not help answer a real operator question, it is a candidate for removal.

## Claims Standard

Every important claim should fall into one of these buckets:

### Directly supported by the repository

Examples:

- current hook behavior
- current CLI behavior
- current state-file schema
- current test-covered behaviors
- current static site structure

These claims should be traceable to code, tests, or validated artifacts.

### Explicitly bounded or conditional

Examples:

- marketplace install path after publication
- Cursor IDE workflow details outside what the repo itself proves
- semantic sufficiency of any chosen verifier

These claims must be framed carefully and not overstated.

## Anti-Ambiguity Rules

Do not write:

- vague improvement language
- broad product claims the repo cannot support
- "just trust the tool" style phrasing
- claims that a verifier proves more than it actually checks
- generic autonomy rhetoric that ignores the verifier authority model

Prefer:

- explicit boundaries
- explicit tradeoffs
- concrete examples
- direct statements about proof surfaces
- narrow, reviewable language

## Example Standard

Examples must teach judgment, not just syntax.

A good example should clarify:

- when to use the pattern
- when not to use it
- what the verifier proves
- what the verifier does not prove

Examples that merely show a command without that context are too weak for this repo.

## Reviewer Standard

Before merging a docs change, reviewers should ask:

1. Is this claim supported by the repo?
2. If not, is it explicitly bounded?
3. Does this wording overstate what Goal Loop proves?
4. Does this change reduce ambiguity or reintroduce it?
5. Would an operator make a better decision after reading this?

If the answer to the last two questions is weak, the change is probably not good enough yet.

## Relationship to Validation

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

That is why human review standards still matter.

## When to Add New Pages

Add a new page only when at least one of these is true:

- the information serves a distinct operator/reviewer/adopter need
- the existing page would become unfocused if the material were added there
- the new page clarifies a genuine decision boundary or proof boundary

Do not add pages merely to look comprehensive.

## Repository-Specific Principle

This repo should prefer documentation that is:

- smaller in product claim
- larger in clarity
- stricter about proof
- more honest about boundaries

That is the intended style going forward.
