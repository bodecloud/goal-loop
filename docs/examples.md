# Examples

## File Creation Proof

Use this to prove Goal Loop itself is working:

```text
/goal Create .cursor/goal/proof.txt --verify "test -f .cursor/goal/proof.txt"
```

Expected behavior:

1. First hook run fails if the file does not exist.
2. Cursor receives a follow-up with the verifier log.
3. The agent creates the file.
4. The next hook run passes and stops the loop.

## Build Gate

```text
/goal Fix the app build --verify "npm run build"
```

Good for framework projects where the build is the release health check.

## Focused Test Gate

```text
/goal Fix auth regression --verify "npm test -- --testPathPattern=auth"
```

Good for a bounded defect where full-suite runs are slow.

## Multi-Step Verification

```text
/goal Finish the release checklist --verify "npm test" --verify "npm run build"
```

Commands run sequentially. The first failure stops the verifier and becomes the follow-up.

## Custom Smoke Probe

```text
/goal Fix static export route behavior --verify "scripts/ralph-cloudflare-loop.sh"
```

Custom probes work well when tests alone do not prove the real deployment surface.
