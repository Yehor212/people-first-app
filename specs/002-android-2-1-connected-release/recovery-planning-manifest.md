# Recovery Planning Manifest

**Bound at:** 2026-08-11 after final audit-and-planning edits and read-only analyze
**Branch:** `codex/android-2-1-connected-release`
**HEAD / `origin/main`:** `13ca51a80d23220574deba762851fe5a32372e46` / same commit
**Upstream / divergence:** no upstream configured / `HEAD...origin/main = 0 0`
**Manifest scope:** 34 feature files; this manifest excludes its own hash.
**Planning verdict:** VERIFIED for the bounded audit-and-planning packet; product implementation and release remain STOP.

## Verification ledger

| Check | Result |
|---|---|
| Spec Kit prerequisites | VERIFIED: current feature/spec/plan/tasks resolved |
| Spec Kit cycle | VERIFIED through `specify → clarify → plan → checklist → tasks → analyze`; implement/converge SKIP by owner prohibition |
| Clarify | VERIFIED: 5 direct owner answers, 0 unresolved placeholder markers |
| Canonical tasks | VERIFIED for structure: 74 unique contiguous IDs; P0 43 / P1 29 / P2 2; evidence 4 VERIFIED / 8 FAIL / 62 UNVERIFIED |
| Legacy tasks | VERIFIED for classification: 134 checked + 26 open = T001–T160; 160 unique IDs, no gap |
| Functional requirements | VERIFIED for traceability: FR-001–FR-035 present; 35/35 have explicit tasks; 74/74 tasks reference an FR |
| Requirement-quality checklists | VERIFIED for writing coverage: 1 specification-quality + 8 domain files; 125 checkbox items |
| Stopped-chat expanded diff | VERIFIED for path coverage: 463/463 exact paths, no missing/extra/duplicate; path evidence 0 VERIFIED / 12 FAIL / 451 UNVERIFIED |
| Official primary-source research | Refreshed 2026-08-11; source applicability recorded without claiming ZenFlow compliance |
| Monetization contradiction scan | VERIFIED: matches are only prohibitions or the explicitly superseded old objective; no 20-treat/25-XP/readiness assertion |
| `npm run check:all` | PASS: exit 0; typecheck, lint, 8×3,661 i18n values, translation, colors, orb/logo/static visual guards |
| Focused current failed-file Vitest rerun | FAIL: 8/8 files; 23 failed / 43 passed; same failure classes retained |
| Full one-worker Vitest on the unchanged source snapshot | FAIL: 8/795 files; 23/9,634 tests; 9,604 passed; 7 todo |
| Constitution freshness | FAIL: +10 tests, +60 `index.css` LOC, +4 god components |
| Supabase type freshness | FAIL: generated types precede the type-affecting automation migration |
| Production-data-integrity diff | PASS: 2,220 scanned / 841 reachable / 0 errors |
| Sync contract | PASS: 409 local invariants |
| npm high+ audit | PASS: 0 vulnerabilities |
| Local security suite on the unchanged source snapshot | FAIL/UNVERIFIED: Snyk results plus Terrascan invalid-scope parser error; validated boundaries in `analysis.md` |
| No-AI-templates guard | PASS |
| Best-practices guard | PASS: 66 invariants |
| `git diff --check` before manifest rewrite | PASS |
| Worktree boundary | VERIFIED: collapsed status still 349 and byte-identical to intake; current expanded 477 vs intake 463; outside feature directory byte-identical |
| Git/external side effects | VERIFIED absent for this recovery pass: no commit, push, PR, deploy, AAB, console/backend write or rollout |

## SHA-256 / byte-size inventory

```text
ef15ddc7f3335ef4fdd716637548a4fb67ff307c605fb3d718444e72c6b2cd0a  6928  specs/002-android-2-1-connected-release/ads-data-safety-evidence.md
eba3d791b7857458e486170cef0c4c10129130f465283f8d1d3be8982886e42e  21898  specs/002-android-2-1-connected-release/analysis.md
d19a182ddfe0bc1550f7d8931ee2cb94958b0b96b0ebfd9313e1569d378f8465  11785  specs/002-android-2-1-connected-release/best-practices-packet.md
7e0f80a7cedf766d8028bf271db8e4231813f3acaa28c31a8e83e4560e37de1d  5715  specs/002-android-2-1-connected-release/checklists/admob-ump-monetization.md
18711fd8162d6a071e1b81bf35a798ad87719f9d91b0b836285ed3ce27df44de  4824  specs/002-android-2-1-connected-release/checklists/all-ages-families-ugc.md
13dd9666eaa20090ec485eafaa205e00c160d42e8e7a3c2386db2188c3e73ebd  4186  specs/002-android-2-1-connected-release/checklists/android-ux-nav-a11y.md
03b41f80638bb9b6c424243b88736e8ac26f89794f0e738efe61e655f8929a9d  4644  specs/002-android-2-1-connected-release/checklists/data-sync-security.md
97bdb2e6bcde42a303b9142e4b4c498f764127410ce7794c128af8c044ef962e  4534  specs/002-android-2-1-connected-release/checklists/legal-store.md
152112d255203b5f20fa7a2b964a52faa506bb520b88091f3c64dd0b55527732  4143  specs/002-android-2-1-connected-release/checklists/motion-visual.md
46e5a08d09339540021f3e6c7e0a3514a4128db219be2b03c3db1085c81416e5  4479  specs/002-android-2-1-connected-release/checklists/operations-rollout.md
4961c6dcbf85947d98723a99e832429e4cfe363b29ec03668b4f52def629eae9  4202  specs/002-android-2-1-connected-release/checklists/release-aab.md
9199626f163405ff7d2a26f2c5d0676c8bee61fe5b8e6609240353724cff9838  2804  specs/002-android-2-1-connected-release/checklists/requirements.md
8a7b575b60c83008f8913ffae97f8d56c018efa0faf258ac3b4350c91c12458f  1840  specs/002-android-2-1-connected-release/contracts/automation-transaction.schema.json
16191bb72ea9b53dda5c7e9539af3f9c334fc67196a0a79ccdf1b83433addad2  4871  specs/002-android-2-1-connected-release/contracts/legal-admob-truth.md
d9f0cc1f0a18b00c75e9b7d32aecc38a849672ab92a5a445fda3bab865bacb46  4644  specs/002-android-2-1-connected-release/contracts/non-orb-motion.md
6bda4622f3087863289bc33c36f6a25cd3105ea2ab92ddc9c72e0a1b8683a4b9  7316  specs/002-android-2-1-connected-release/contracts/social-invitations.md
c5061ae33063f6863d564cd0f5243f6a2f4db6334def1728c343bf7a4e8b1706  5446  specs/002-android-2-1-connected-release/contracts/storage-incident-reflow.md
385aca366a6a3f0570244a4afd8760426c2626fd28c1af049d7a6d77db6ea61a  52270  specs/002-android-2-1-connected-release/convergence.md
f65de93a4d54b2d473a6838f2b6e9af3a2760e890cbe3bda4c89b94f2534a43a  22379  specs/002-android-2-1-connected-release/data-model.md
27202decf82b5c2bb76080207d524300a6bec9d08bb4ff64a776e6b7f10965a3  99407  specs/002-android-2-1-connected-release/full-diff-review.md
d62d68b3116a16b9cabdb805728c44c528276c24cfbeed2739427f9ec94dd2d9  12984  specs/002-android-2-1-connected-release/handoff.md
0a9e9300903871a86798fc73e4bacba6f8a6940f0e770142a2182b0ad97c57b2  6838  specs/002-android-2-1-connected-release/legacy-task-evidence-ledger.md
f4401ff02e98f49d6801117b4017a27db4baa8263970a5343d6ede67b4591681  5847  specs/002-android-2-1-connected-release/owner-external-gates.md
4b2aa532e03e642923cc94788424504b79b1df267f6001af4bf0f3dad0753780  16464  specs/002-android-2-1-connected-release/people-first-app-threat-model.md
4f583af79519b8884b3f7431ab7cc03c0ac57125b219d8305e7e552fa95f58d2  16457  specs/002-android-2-1-connected-release/plan.md
12b82aaaa2ca5869aba1b8640e45c21916c65258a105a4834258588e55b891fe  9272  specs/002-android-2-1-connected-release/quickstart.md
57f513cb4762a0ec9fb138f0bd293a0b5fe1200367c69d2edef0e4b2b53a313d  15469  specs/002-android-2-1-connected-release/recovery-audit.md
ef4f32e9ec67945b7be5738f79cb77f04f576525a0b8436ffe4c265f7c853f22  51468  specs/002-android-2-1-connected-release/recovery-worktree-snapshot.md
f391d5118e42604cc55a528986de57953c0ac15274e8bc37d465446d8ec67484  5481  specs/002-android-2-1-connected-release/release-feasibility.md
06eda0a70f8717250c403872a6313d207e2d6f8f27c61af7de064624a26e2b1b  11629  specs/002-android-2-1-connected-release/research.md
2984e941b34f8a5c6dd2fd206f66dd09e45573439962e982a3e4f7df86196da0  4432  specs/002-android-2-1-connected-release/roadmap.md
b98f1a4faf1440735f646e205b0517c893bfce611fe73fee886c44f35ab57517  4162  specs/002-android-2-1-connected-release/spec-kit-cycle.md
ebd4bb26392c9cb2777f7dcf891514e5e7ae1b749a381b6a61f4b72211787c5b  21585  specs/002-android-2-1-connected-release/spec.md
e860195589f43a9daeffc4bf8e0b2b30e21d9bf36cfc3384aef9521ee03e099b  75063  specs/002-android-2-1-connected-release/tasks.md
```

## Boundary

The hashes bind planning/evidence content only. Historical files explicitly marked STALE remain in the inventory for provenance and are not current completion proof. The manifest does not hash itself, so its own wording is not a tamper-proof external attestation. No production code, dependency, migration, Edge Function, native configuration, build artifact, console value, Git publication or rollout is authorized or represented as changed by this manifest.
