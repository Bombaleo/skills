# scripts/

Small utility scripts for the Flex Work v2 plan.

## `check-doc-alignment.mjs`

Keeps the three planning artifacts in lock-step:

| Artifact | File |
|---|---|
| Prototype | `index.html` |
| API reference | `Flex Work API Reference.html` |
| Architecture | `Flex Work 2.0 Architecture v<N.M>.html` (latest) |

The script hashes each tracked doc and stores the last-accepted hash in
`.doc-alignment.json` at the project root. When any file changes, the script
prints a per-doc review checklist and exits non-zero. A human signs off by
running `--accept`, which records the new hashes.

```bash
# In CI or pre-merge: fails on drift
node scripts/check-doc-alignment.mjs

# After reviewing cross-references, accept the new alignment baseline
node scripts/check-doc-alignment.mjs --accept

# Inspect current hashes without changing state
node scripts/check-doc-alignment.mjs --status
```

The architecture target auto-resolves to the highest-versioned
`Flex Work 2.0 Architecture v<N.M>.html` in the project root, so a v1.6 ship
just works — no script edit required.

### When you change one of the tracked docs

The PR **must** include either:

1. Corresponding edits to the other two tracked docs, **and** a `--accept`
   commit updating `.doc-alignment.json`, or
2. A one-line note in the PR body explaining why the other two are unaffected,
   **and** the `--accept` commit.

The checklist printed by the script is a forcing function, not a substitute
for the review. See §17 of the architecture doc for the human-readable version
of the contract.
