# Cross-Artifact Analysis: Android 2.1 Release Recovery

**Date:** 2026-08-11  
**Mode:** read-only Spec Kit analysis after recovery rewrite  
**Canonical artifacts:** `spec.md`, `plan.md`, one specification-quality and eight domain checklist files, `tasks.md`, `roadmap.md`, `recovery-audit.md`, `full-diff-review.md`, `legacy-task-evidence-ledger.md`, `best-practices-packet.md`, `owner-external-gates.md`, `release-feasibility.md`, `research.md`, `people-first-app-threat-model.md`  
**Implementation/convergence:** not run; not authorized

## 1. Analysis verdict

| Question | Result |
|---|---|
| Is the requested correction represented without fictitious rewards? | PASS in canonical planning artifacts |
| Is ADR-MON-001 selected or implemented? | No; correctly `ASK/OFF` |
| Do habit completion and journal save depend on ads? | Specification forbids it; runtime is `UNVERIFIED` |
| Are legacy reward constants/callbacks/UI activated/deleted? | No audit change; classified `LEGACY / UNVERIFIED` |
| Is public all-ages social treated as a separate high-risk program? | PASS in spec/roadmap/tasks/threat model; implementation `STOP` |
| Are motion baselines/concepts/variants/owner selection explicit? | PASS as tasks; artifacts/selection `UNVERIFIED` |
| Are all five platforms and eight locales addressed? | PASS as requirements/tasks; runtime/human parity `UNVERIFIED` |
| Is every old task classified? | PASS: 160/160, arithmetic reconciled |
| Does every new task have the required fields? | PASS: 74/74, IDs T161–T234 unique and contiguous; priority plus tri-state status present |
| Does every new task use only `VERIFIED` / `FAIL` / `UNVERIFIED` as its authoritative evidence status? | PASS: 4 / 8 / 62 |
| Are there one specification-quality and eight domain checklists? | PASS: 9 total |
| Is the stopped-chat diff adjudicated path by path? | PASS for coverage: 463/463 rows; semantic status is 12 `FAIL`, 451 `UNVERIFIED`, 0 `VERIFIED` |
| Did Spec Kit prerequisites locate the existing feature/tasks? | PASS |
| Is the feature implementation- or release-ready? | NO — `STOP` |

No unresolved **internal critical contradiction** remains among the canonical planning artifacts. This is not a release PASS: current external, runtime, security, schema, artifact, human and owner gates remain material blockers.

## 2. Requirement-to-task coverage

| Requirement group | Canonical requirements | Tasks | Checklist |
|---|---|---|---|
| Core save/ad independence | FR-001–FR-005 | T175–T180, T213, T218–T219 | AdMob/UMP; Data/Sync |
| Data/sync/types/privacy | FR-006–FR-007, FR-031–FR-032 | T167–T174, T172–T180, T198–T209, T212–T224 | Data/Sync/Security |
| Android/API36/nav/layout | FR-008–FR-009, FR-026–FR-028 | T181–T190 | Android UX/Nav/A11y |
| Exact AAB/release/ops | FR-010–FR-013, FR-033–FR-035 | T225–T234 | Release/AAB; Operations/Rollout |
| Public social/all ages | FR-014–FR-019 | T197–T210 | All Ages/Families/UGC |
| Monetization | FR-020–FR-025 | T211–T224 | AdMob/UMP/Monetization |
| Motion/visual integrity | FR-028–FR-030 | T191–T196 plus T187/T189 | Motion/Visual |
| Legal/store truth | FR-034 plus US8 acceptance | T197–T198, T208, T224, T228–T234 | Legal/Store |

Coverage gaps are evidence/authority gaps, not missing plan rows. Every implementation group remains gated by T162/T166 and relevant G-xxx owner/external decisions.

## 2a. Detailed requirement coverage

| Requirement key | Has task? | Canonical task IDs | Analysis note |
|---|:---:|---|---|
| FR-001 | YES | T175, T176, T180, T213 | Explicit reference present in task ledger. |
| FR-002 | YES | T170 | Explicit reference present in task ledger. |
| FR-003 | YES | T175 | Explicit reference present in task ledger. |
| FR-004 | YES | T176, T177, T180, T195, T213 | Explicit reference present in task ledger. |
| FR-005 | YES | T178 | Explicit reference present in task ledger. |
| FR-006 | YES | T167, T168, T170, T171, T173, T174, T209 | Explicit reference present in task ledger. |
| FR-007 | YES | T167, T169 | Explicit reference present in task ledger. |
| FR-008 | YES | T182, T183, T184, T185, T190 | Explicit reference present in task ledger. |
| FR-009 | YES | T181, T182, T183, T184, T190 | Explicit reference present in task ledger. |
| FR-010 | YES | T189, T225, T226, T227 | Explicit reference present in task ledger. |
| FR-011 | YES | T227 | Explicit reference present in task ledger. |
| FR-012 | YES | T226, T229, T231, T232, T233 | Explicit reference present in task ledger. |
| FR-013 | YES | T189, T230, T231, T232, T233 | Explicit reference present in task ledger. |
| FR-014 | YES | T197, T199, T210 | Explicit reference present in task ledger. |
| FR-015 | YES | T198, T200, T201 | Explicit reference present in task ledger. |
| FR-016 | YES | T202 | Explicit reference present in task ledger. |
| FR-017 | YES | T203, T204, T206 | Explicit reference present in task ledger. |
| FR-018 | YES | T199, T200, T201, T202, T207, T208, T209 | Explicit reference present in task ledger. |
| FR-019 | YES | T197, T203, T204, T205, T206, T210 | Explicit reference present in task ledger. |
| FR-020 | YES | T179, T211, T220, T221, T222 | Explicit reference present in task ledger. |
| FR-021 | YES | T212 | Explicit reference present in task ledger. |
| FR-022 | YES | T212, T220, T222 | Explicit reference present in task ledger. |
| FR-023 | YES | T213, T221, T223, T224 | Explicit reference present in task ledger. |
| FR-024 | YES | T180, T214, T215, T216, T217, T218, T219, T223 | Explicit reference present in task ledger. |
| FR-025 | YES | T178, T179, T211, T213, T218, T219, T221, T222, T224 | Explicit reference present in task ledger. |
| FR-026 | YES | T181, T186, T190 | Explicit reference present in task ledger. |
| FR-027 | YES | T184, T185, T187, T188 | Explicit reference present in task ledger. |
| FR-028 | YES | T181, T187, T190, T191 | Explicit reference present in task ledger. |
| FR-029 | YES | T192, T193, T194, T195 | Explicit reference present in task ledger. |
| FR-030 | YES | T188, T191, T192, T193, T196 | Explicit reference present in task ledger. |
| FR-031 | YES | T168, T171, T172, T176, T177, T195, T199, T206, T209 | Explicit reference present in task ledger. |
| FR-032 | YES | T168, T198, T215, T216, T222 | Explicit reference present in task ledger. |
| FR-033 | YES | T208, T230, T233 | Explicit reference present in task ledger. |
| FR-034 | YES | T166, T210, T224, T225, T228, T229, T231 | Explicit reference present in task ledger. |
| FR-035 | YES | T161, T162, T163, T164, T165, T172, T174, T234 | Explicit reference present in task ledger. |

All 35 functional requirements have at least one explicit task reference; all 74 tasks reference at least one FR. This is traceability coverage only. It does not convert an unchecked task or failed gate into completion proof.

## 3. Monetization consistency analysis

### Canonical decision

- target wording is exactly the owner-directed concept: an owner-selected, verified policy-safe monetization model without fictitious rewards and with fresh runtime evidence;
- A is a new genuine reward product scope;
- B is an exact voluntary non-reward format that must be honest without a reward and separately policy-proven;
- C keeps ads fail-closed/OFF;
- no option is selected;
- OFF is the safe default and does not block core app behavior.

### Source reachability evidence

- production shell mounts `AdProvider`;
- settings has a reachable rewarded-video preference/consent path;
- SDK initialization can be permitted by consent, entitlement, platform and service gate;
- reward constants/callback/attempt-ledger sources exist in the dirty lane;
- `RewardedAdPrompt` has no production import in the audited source tree;
- no production import was found that automatically inserts that prompt into habit completion or journal save;
- current remote gate/entitlement population and test/live runtime are not proven.

Therefore “unreachable prompt” does not mean “all ad code unreachable,” while “reachable provider” does not mean “valid reward/model/runtime.” The only defensible status is `LEGACY / UNVERIFIED`, OFF.

### Contradiction scan

Canonical files contain the terms treats/XP/rewarded/watch-and-earn only in prohibitions, historical facts, superseded-goal records, task failure statements or research explaining why the existing format is inapplicable without a real reward. No canonical row claims reward readiness or creates reward amounts/value.

## 4. Public-social consistency analysis

The previous challenge-only ranking contract is explicitly superseded. The canonical future scope includes public profiles/search, global ranking, challenge ranking, Friends/Challenges, codes, links and QR. It is consistently gated by:

- owner product/age decisions;
- neutral owner-bound age state;
- child/unknown OFF default;
- server/RLS/RPC authority and rank integrity;
- anti-IDOR/enumeration/scraping/rate-limit controls;
- inert decode and explicit confirmation before any write;
- report/block/terms/moderation/appeals;
- published child-safety standards/contact and qualified operations;
- deletion/tombstone/privacy/offline behavior;
- five-platform, eight-locale, store/legal/runtime proof.

No document authorizes public enablement, dependency installation, RPC/migration work, QR/camera use or console declaration changes. Threat-model residual risk remains high and current verdict is `STOP`.

## 5. Motion consistency analysis

- canonical orb family remains frozen and regression-only;
- non-orb production reachability inventory and fresh baseline videos precede ideation;
- 4–6 specific directions, three Gratitude Bloom variants and three Let Go variants are required;
- concepts must cover reduced motion, lifecycle cleanup, focus/Back, RTL/reflow, privacy and numeric performance limits;
- implementation stops until explicit owner artistic selection;
- Technical, Visual Runtime, Artistic/Craft, Motion, Model and Plan are separated.

Current motion status is `UNVERIFIED`; no concept or artistic PASS was manufactured during the audit.

## 6. Old evidence analysis

| Population | Fresh | Stale | Claim only | Superseded | Owner/external | Unverified | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Previously checked | 6 | 112 | 2 | 14 | 0 | 0 | 134 |
| Previously open | 0 | 0 | 0 | 3 | 16 | 7 | 26 |
| Combined | 6 | 112 | 2 | 17 | 16 | 7 | 160 |

The six fresh rows are bounded snapshot/research/AdMob observations. None proves the exact release artifact or feature completion. Historical files now carry explicit status headers. `convergence.md` is excluded from current completion because implementation did not occur.

## 7. Fresh local verification analysis

| Evidence | Result | Analysis |
|---|---|---|
| Edit doctor | FAIL | dirty lane cannot be implementation/release base |
| Inspection doctor with explicit dirty allowance | PASS | read-only recovery audit only |
| RAG preflight | PASS | retrieved `agent_rules`/`sync_auth`; direct sources filled missed Android/ads/social/motion context |
| Constitution authority status | PASS | proposal is not ratified/binding |
| `doc-counts` | PASS | bounded generated-count check |
| `constitution:check` | FAIL | +10 tests, +60 CSS LOC, +4 god-components |
| `check:types-fresh` | FAIL | generated Supabase types predate automation migration |
| migration prefixes | PASS | 82 scanned; legacy groups unchanged |
| production-data-integrity diff | PASS | 2,220 scanned / 841 reachable / 0 errors; dirty diff scope only |
| sync contract | PASS | 409 local invariants; not remote/runtime proof |
| npm audit high+ | PASS | 0 current npm advisory findings |
| Spec Kit prerequisites | PASS | existing feature and tasks resolved |
| new-task structural validator | PASS | 74 tasks, 4 audit-checked, 70 open; all required fields, explicit priority, and tri-state evidence status present |
| requirement coverage validator | PASS | FR-001–FR-035 all present in spec and mapped to tasks/analysis |
| legacy ID validator | PASS | 134 checked + 26 open; T001–T160 each once by population, no overlap |
| `check:no-ai-templates` | PASS | policy/guardrail/template-marker invariants only; no human quality claim |
| `check:best-practices` | PASS | 66 gate invariants; not platform/runtime proof |
| `npm run check:all` | PASS | typecheck, lint, 8×3,661-key i18n/parity/deep/translation, colors, canonical orb/logo/static visual guards; no runtime/human claim |
| full Vitest, one worker | FAIL | 8/795 files failed; 23/9,634 tests failed, 9,604 passed, 7 todo; 518.48 s |
| focused rerun of all failed files | FAIL reproduced | same 8 files and 23 failures; 43 tests passed; 4.81 s |
| `git diff --check` | PASS | no whitespace error at check time |

Failures remain blockers; no baseline/threshold/test was weakened or regenerated to hide them.

### Fresh one-worker failure ledger

| Failed file | Failed tests | Current diagnosis boundary | Planned owner/task |
|---|---:|---|---|
| `src/__tests__/IntentionalSingleLineTextContract.test.ts` | 1 | new unapproved `whitespace-nowrap` occurrence in challenge details | UI/a11y owner; T181/T187 |
| `scripts/__tests__/android21ForwardRollback.test.ts` | 1 | code/runbook no longer satisfy the v11-aware forward-only contract | release/data owner; T171/T230 |
| `src/features/journal/__tests__/JournalModule.headerStatic.test.ts` | 2 | diary title wrapping contract and accessible mobile toolbar contract mismatch | journal/a11y owner; T186/T187 |
| `src/__tests__/EssentialTextReflowContract.test.ts` | 1 | Friends panel expected reflow contract mismatch | social/UI owner; T187/T200 |
| `src/components/__tests__/ChallengeCompletionTextReflow.static.test.ts` | 1 | invite habit/creator independent wrapping contract mismatch | social/UI owner; T187/T203 |
| `src/components/__tests__/ChallengeStatsTextReflow.static.test.ts` | 1 | challenge modal header shrink/wrap contract mismatch | social/UI owner; T187/T202 |
| `src/features/journal/__tests__/JournalAndroidTouchTargets.static.test.ts` | 1 | Android-only 48px interactive-control rule mismatch | journal/a11y owner; T187 |
| `src/pages/nav-v2/habits/__tests__/metrics-wiring.test.tsx` | 15 | test render lacks the newly required `FeatureFlagsProvider`, so all Habits analytics scenarios abort before assertions | Habits/QA owner; T175/T190 |

The focused rerun reproduces the same 23 failures outside the long suite. The Habits block is currently a test-harness/provider integration failure, not proof that all 15 production analytics behaviors are broken or correct; each behavior remains `UNVERIFIED` until the harness is repaired and assertions run. No fix was authorized in this audit.

## 8. Security suite and finding validation

Command: local security suite `--profile auto --strict` on the recovery worktree. Overall exit: `1`, therefore **not PASS**.

| Tool | Result | Validated interpretation |
|---|---|---|
| Snyk agent scan | exit 0 | bounded agent-surface scan only |
| Snyk Code | exit 1; 23 SARIF results | 21 notes + 2 warnings; requires disposition, not clean PASS |
| Gitleaks | exit 0 | no finding in scanner scope |
| TruffleHog | exit 0 | no finding in scanner scope |
| Trivy | exit 0 | bounded scanner result |
| Checkov | exit 0 | bounded IaC result |
| KICS | exit 0 | bounded IaC result |
| Terrascan | exit 4 | scanner parsed `node_modules/.bin/yaml` and old `.playwright-cli/*.yml` as IaC and errored; no validated security finding, but Terrascan remains `UNVERIFIED` |
| ModelScan | skipped | no model-serialization files detected; N/A for current planning diff |

Snyk validation:

- 17 hardcoded-secret notes point to test fixtures. They are not evidence of a real credential; Gitleaks/TruffleHog returned zero findings. Exact fixture values were not reproduced.
- one postMessage note points to `authTransitionCoordinator.ts`; inspected code checks the incoming `MessageEvent.origin` against `window.location.origin` and parses a bounded event. The reported “no origin check” path is not reproduced from the inspected source, so this result is currently a likely scanner false positive, not a PASS for the entire auth flow.
- three path-traversal notes point to shared-build-lock cleanup. Inspected cleanup accepts only a module-issued lease present in an in-memory `ACTIVE_LEASES` set, verifies owner metadata/path and permits only the single lock-owner entry before unlink/rmdir. Snyk did not model that capability boundary; no exploitable path was validated in this audit.
- one HTTP warning is in an inherited unchanged local test helper; one is in the untracked PWA-update helper. Both bind to `127.0.0.1`; the PWA helper also rejects non-loopback peers and bounds paths. This limits exposure to local test tooling but does not make the strict scan green. The untracked helper requires a future explicit test-only/bundle-reachability decision; it must not enter production runtime.

No production security fix was authorized or made. Security release status remains `STOP/UNVERIFIED` until the dirty diff is isolated, Snyk findings are formally accepted/fixed in scope, Terrascan is rerun against a valid tracked-IaC scope, and exact-candidate/runtime threats are verified.

## 9. Authenticated console analysis

### Play

- production release: 34 / 1.7.2, 100%, target SDK 35;
- console API 36 action date: 2026-08-30 in current UI;
- current target audience: 13–15, 16–17, 18+;
- app content UI shows 11 declarations with no current attention flag;
- app access says all functionality freely available, conflicting with authenticated/OAuth product paths.

### AdMob

- account/app UI says approved/open/Ready and serving enabled;
- top warning says account has been inactive for over five months and six months without impressions can auto-deactivate;
- one rewarded and one rewarded-interstitial unit exist, with no app/unit frequency caps shown;
- policy center shows no violations;
- one EEA and one US-state message are active;
- no recent requests, impressions or revenue and no app-ads.txt request/crawl data were shown.

These are fresh read-only UI observations, not runtime or legal/policy acceptance. No identifier, credential, private financial state or console mutation is included.

## 10. Platform analysis

| Platform | Current planning impact | Fresh proof | Release status |
|---|---|---|---|
| Web/Vite | shared core/data/social/motion; ads OFF/default | static/local checks only | UNVERIFIED |
| Installed PWA | update/restart/link/storage/social matrix | inherited receipts stale | UNVERIFIED |
| Android/Capacitor | API 36, Back/layout/lifecycle, exact AAB, Play/AdMob | console read-only + local static; exact candidate absent | STOP |
| iOS/WKWebView | shared core/data/UI; links/camera/motion/ad parity | not freshly exercised | UNVERIFIED |
| Desktop/Tauri | shared core/data/UI; protocol/camera/motion decision | not freshly exercised | UNVERIFIED |

No platform row is inferred from Android or browser evidence.

## 10a. Final change-boundary check

- collapsed porcelain remains exactly the original 349 entries;
- the expanded status outside `specs/002-android-2-1-connected-release/**` remains byte-for-byte identical to the pre-recovery snapshot;
- no outside-feature path was added or removed by the audit;
- inside the already-untracked feature directory, recovery planning/evidence files were added; three obsolete checklist paths were removed, the stale requirements checklist was replaced, and the canonical set is now one specification-quality plus eight domain checklists;
- exact current feature-file paths, byte sizes and hashes are bound only by the final `recovery-planning-manifest.md`; this analysis does not freeze an intermediate file count;
- the temporary `.skill-routing-token` is ignored and is not part of the deliverable;
- no production source, dependency, migration, Edge Function, native config, secret, build output or external state was changed by this recovery pass.

## 11. Remaining ambiguities and owner gates

Not defects in the planning packet, but hard execution gates:

- ADR-MON-001 A/B/C;
- whether under-13 is intended and exact neutral age experience;
- public profile fields, rank formula/eligibility and cohort visibility;
- moderation/appeals/child-safety operator, SLA, retention and escalation;
- legal/operator/jurisdiction/retention/lawful-basis/transfer facts and qualified translations;
- exact QR dependency/license/version and social backend RPC/migration plan;
- motion concept/artistic selection;
- authoritative schema/type source, signing/Firebase inputs;
- Play/AdMob/store corrections, internal upload, testers;
- incident operator/alerts and every rollout promotion;
- Git commit/push/PR authorization.

The safe default for every unresolved optional feature is OFF; the safe default for release is STOP.

## 12. Final feasibility and next gate

The full scope cannot be truthfully delivered and rolled out by the operational deadline from this state. A narrower core Android 2.1 candidate with ads/public-social additions OFF may be assessed after:

1. T162 clean lane;
2. T167–T174 schema/type/data truth;
3. T175–T190 core/API36 proof;
4. T225–T230 exact AAB/store/internal/operations gates.

The first implementation request must name one bounded slice and authorize it. It must not be “implement all tasks,” “turn on ads,” “launch public social,” “build/upload AAB,” or “converge.”

## 13. Intentional exclusions

- no subagents, as explicitly required by the owner;
- no independent Role 10 Pass A/B; status `UNVERIFIED`;
- no DAST/red-team target;
- no live Supabase/ad/user smoke;
- no build/AAB/device traversal;
- no legal/human/artistic acceptance;
- no `speckit-implement` or `speckit-converge`;
- no console/backend/Git/publication/rollout side effect.
