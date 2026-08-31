# Candidate Manifest: Epic 002

**Frozen**: 2026-08-04T05:17:12Z
**Base**: `13ca51a80d23220574deba762851fe5a32372e46`
**Branch**: `codex/002-product-regression-recovery-full-draft`
**State**: local full-epic draft checkpoint; not an independently reviewable wave and not cleared for push; this file is excluded from its own digest

## Candidate identity

| Component | Count / SHA-256 |
| --- | --- |
| Staged paths changed from `origin/main`, excluding this manifest | `154` |
| Binary full-index staged diff, excluding this manifest | `3102df431360d7122a300c9c2cf12d91504daf16a13b0a7c5a3a7893b2760357` |
| Base + staged candidate identity | `d6735aedb141bff1b6490d9ae0eef37cb7dafe2951160aa8a6c566493f48f85e` |

## Recompute contract

The staged diff digest is:

```text
git diff --cached --binary --full-index origin/main -- . \
  ':(exclude)specs/002-product-regression-recovery/evidence/candidate-manifest.md'
```

The candidate identity is SHA-256 of exactly these newline-terminated fields:

```text
base=13ca51a80d23220574deba762851fe5a32372e46
staged=3102df431360d7122a300c9c2cf12d91504daf16a13b0a7c5a3a7893b2760357
```

At freeze, every intended Epic path other than this manifest was staged, no unmerged path existed, and no tracked working-tree delta remained. Ignored dependencies, builds, coverage, browser output, and scanner reports are outside the Git candidate and are cited only by scoped command result or retained path/hash.

Any change to a staged file other than this manifest invalidates the digest and requires a new freeze plus fresh specialist closure. This identity proves subject integrity only; it does not prove live Supabase behavior, native devices, human acceptance, GitHub CI, merge, deployment, or production-data safety.
