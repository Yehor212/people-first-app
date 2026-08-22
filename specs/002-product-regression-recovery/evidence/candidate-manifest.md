# Candidate Manifest: Epic 002 Wave 1

**Frozen**: 2026-08-04T07:43:22Z
**Base**: `13ca51a80d23220574deba762851fe5a32372e46`
**Branch**: `codex/002-product-regression-recovery`
**State**: isolated Wave 1 journal-recovery candidate; this manifest is
excluded from its own digest

## Candidate identity

| Component | Count / SHA-256 |
| --- | --- |
| Staged paths changed from `origin/main`, excluding this manifest | `123` |
| Binary full-index staged diff, excluding this manifest | `0b5f838f76d170f723834dee66e42dca4e31cfbc408191f269f2e6ffbe04b701` |
| Base + staged candidate identity | `a5d24a8fe112a52b36d34bb3f5878753679b708bbc9b51ef03592584d0ba93aa` |

## Recompute contract

The staged diff digest is:

```text
git diff --cached --binary --full-index origin/main -- . \
  ':(exclude)specs/002-product-regression-recovery/evidence/candidate-manifest.md'
```

The candidate identity is SHA-256 of exactly these newline-terminated fields:

```text
base=13ca51a80d23220574deba762851fe5a32372e46
staged=0b5f838f76d170f723834dee66e42dca4e31cfbc408191f269f2e6ffbe04b701
```

At freeze, every intended Wave 1 path other than this manifest was staged, no
unmerged path existed, and no tracked working-tree delta remained. Ignored
dependencies, builds, coverage, browser output, native derived data, and
scanner reports are outside the Git candidate and are cited only by scoped
command result or retained path/hash.

Any change to a staged file other than this manifest invalidates the digest and
requires a new freeze plus fresh specialist closure. This identity proves
subject integrity only; it does not prove live Supabase behavior, physical
devices, Windows/Tauri runtime, human acceptance, GitHub CI, merge, deployment,
or production-data safety.
