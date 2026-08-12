# Research: Authoritative Schema and Types

**Task**: T167
**Date**: 2026-08-12
**Research mode**: Read-only source selection; no replay, generation, admission, installation, remote access, or external write

## Evidence Boundary

The R0/T162 receipt is valid JSON, 11,573 bytes, and SHA-256 `6b63cb7b880c2be1086c878c26ff09b812ebc339092ac9588d565114a4baa0f4`. Its result is `GO_R0_T162_GIT_VISIBLE_SCOPE`; it grants no security, privacy, production, release, remote, or Git-publication waiver.

Before feature writes, the clean lane matched the authorized identity:

- absolute path: `/Users/yehor/Projects/ZenFlow/worktrees/codex-android-2-1-r1-schema-types-20260811`
- branch: `codex/android-2-1-r1-schema-types-20260811`
- HEAD, base, local `origin/main`, remote `origin/main`, and merge-base: `13ca51a80d23220574deba762851fe5a32372e46`
- tree: `36fe8707f1ffded6ef1ccfd04898b0e1be5bba7e`
- divergence: `0/0`
- upstream: absent
- same-name remote branch: absent
- lane: locked with the expected reason
- normal and ignored status counts: `0/0`
- `package-lock.json`: 674,331 bytes; SHA-256 `b1a56e1cf983022d47562ddc848bef86222d5c01e9af11a99a5988e0657156bc`
- workspace descriptor: mode `0600`, valid one-folder descriptor, 485 bytes; SHA-256 `9d6f7eeceb65017f017bcf550dbfaaa820ce76665b2ab4f612615ada111f3a0c`
- edit doctor: exit 0 and `GO` before writes

The task-specific Free RAG preflight ran in no-write mode through an already installed external `tsx` binary. It reported `writes:false`, task SHA-256 `8f312443ed0a7592b5ed6a27ec4e2210472d280926de29d8b3c93f0f8a63298e`, and the `agent_rules` plus `sync_auth` groups. Retrieved excerpts were used only to locate current source documents. No dependency was installed and no RAG artifact was written into the clean lane.

## Decision 1: Select the clean tracked baseline

**Decision**: The current authoritative schema baseline is the tracked-clean clean-lane `supabase/config.toml` plus exactly the 80 tracked `supabase/migrations/*.sql` files at the authorized base.

**Binding**:

- configuration: 19,088 bytes; SHA-256 `5e36eafc7f63960a80c8c304c246a076d9153973cfde3476c3150e03ed49b8d5`
- migration Git tree: `685b1d2803cf41d0c270ed8b1eca9a45ff781476`
- canonical inventory format: sorted `path<TAB>bytes<TAB>sha256<LF>`
- canonical inventory SHA-256: `5d5d7013b7d41efa5b27fb5e317e8e5cb50325ef7cc192ec3120dc3ba1682c1f`
- first file: `supabase/migrations/001_initial_schema.sql`, 15,752 bytes
- last file: `supabase/migrations/20260722213200_restore_owner_bound_legacy_push_claim.sql`, 1,274 bytes
- generated target held read-only: `src/types/supabase.ts`, 53,988 bytes; SHA-256 `eb6139d9a5786e25b4898ad05f167479cac19dbeabb6ab2af3149138b323168e`

**Rationale**: These are the only schema inputs simultaneously present, tracked, clean, and bound to the authorized lane identity. A future T168 admission invalidates this count and digest and requires a new exact review before replay.

**Rejected alternatives**:

- Dirty umbrella as source: rejected because unrelated and unreviewed modifications share the worktree.
- Filename ordering alone: rejected because it does not establish admission, content integrity, or review ownership.
- Generated-file timestamp freshness: rejected because file times do not prove semantic parity.
- Remote or linked Supabase project: rejected because it introduces mutable external state, credentials, target ambiguity, and unauthorized side effects.

## Decision 2: Keep both dirty migration candidates out

**Decision**: Record both dirty-umbrella migration candidates as evidence-bound `NOT_ADMITTED`; do not copy, stage, replay, semantically review, or modify them in T167.

| Candidate | Dirty source state | Bytes | SHA-256 | Owner |
| --- | --- | ---: | --- | --- |
| `supabase/migrations/20260808000000_automation_transaction_ledger.sql` | untracked | 101,304 | `87fbf947ef82b995b044d84ab73a1763cfeb2df6646d1afcf177f86a927b8939` | T168 admission and contract review |
| `supabase/migrations/20260808010000_journal_sync_event_privacy.sql` | untracked | 2,321 | `7b590d541de83b04d903083cd29f9940bb547a712c61436575e8ea39132168f2` | Not admitted by T167; no follow-on authority granted |

The dirty `supabase/config.toml` is also excluded: it is tracked-modified, 19,137 bytes, SHA-256 `1f5d049efc39bc515bc9ce70cbf18f6e56d66db83ce0a28b4c71614101c2c854`, and its observed diff adds an unrelated `rewarded-ads-gate` function setting.

The umbrella task and recovery-manifest provenance inputs remain read-only:

| Input | State | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `specs/002-android-2-1-connected-release/tasks.md` | untracked | 75,063 | `e860195589f43a9daeffc4bf8e0b2b30e21d9bf36cfc3384aef9521ee03e099b` |
| `specs/002-android-2-1-connected-release/recovery-planning-manifest.md` | untracked | 8,349 | `d949df5990ce2d15bfa4baaa677587bcac0b4725795133521646f023a1289fe9` |

## Decision 3: Select disposable local replay for later execution

**Decision**: After T168 admits and hash-binds its reviewed migration, a separately authorized executor must use a fresh disposable local Supabase instance, disable seed execution, and generate TypeScript declarations from that local instance.

**Future command contract, recorded but not executed in T167**:

```sh
supabase db reset --local --no-seed
supabase gen types typescript --local
```

**Rationale**: A local replay makes the generation source reviewable and avoids selecting or mutating hosted project state. `--no-seed` prevents the configured seed behavior from becoming an undeclared schema-generation input.

**Rejected alternatives**:

- `--project-id` or linked-project generation: outside the authorized local-only boundary.
- Manual edits to `src/types/supabase.ts`: not reproducible and owned by neither T167 nor the selected generator path.
- Using the current 80-file digest after T168 admission: stale by definition.
- Running reset/generation now for convenience: explicitly starts T169 work and violates T167.

## Decision 4: Treat tool availability as a future prerequisite

**Decision**: Supabase CLI and Docker CLI were absent from the current clean lane/PATH. Record local replay and generation as `DEFERRED` and their execution prerequisite as `UNVERIFIED`; do not install or invoke anything in T167.

**Rationale**: Tool absence prevents runtime proof, not the evidence-backed choice of a safe future path. Installation can change dependencies, binaries, network state, or trust and requires separate authority.

## Freshness Evidence Classification

- Dirty umbrella: `npm run check:types-fresh` exited 1 because `src/types/supabase.ts` was 2,455 minutes older than `20260808000000_automation_transaction_ledger.sql`.
- Clean lane: `npm run check:types-fresh -- --print` exited 0 with zero-minute drift from `20260714120403_journal_cloud_write_integrity.sql`, using Git-log time.

Both are freshness-heuristic observations. The dirty result reproduces the motivating signal; the clean result shows only that the current checker does not report timestamp drift. Neither result proves generated declarations semantically match the selected schema.

## Outcome

The local-only authoritative path is selected for T167. Replay, schema semantics, type generation, runtime behavior, production/live state, native clients, public deployment, release, and human acceptance remain outside the evidence boundary and must not inherit `PASS` from this research.
