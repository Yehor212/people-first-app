# Android 2.1 Release Recovery Audit

**Audit date:** 2026-08-11  
**Mode:** audit and planning only  
**Implementation authority:** `STOP`  
**Production/external-write authority:** `STOP`

## 1. Frozen recovery snapshot

| Evidence | Fresh result | Status |
|---|---|---|
| Worktree | `/Users/yehor/Projects/ZenFlow/worktrees/codex-android-2-1-connected-release` | PASS |
| Branch | `codex/android-2-1-connected-release` | PASS |
| HEAD / `origin/main` | `13ca51a80d23220574deba762851fe5a32372e46` / same commit | PASS |
| Upstream | not configured | UNVERIFIED |
| Collapsed porcelain | 349 entries: 241 modified, 2 deleted, 106 untracked paths | PASS as snapshot; STOP for implementation |
| Expanded porcelain | 463 entries: 241 modified, 2 deleted, 220 untracked files | PASS as snapshot; STOP for implementation |
| Conflicts | none in `git ls-files -u` | PASS |
| Tracked diff | 243 files, 9,733 insertions, 3,463 deletions | PASS as inventory; semantic acceptance UNVERIFIED |
| Edit doctor | `STOP` because the lane is dirty | FAIL |
| Inspection doctor | `GO` only with explicit `--allow-dirty` | PASS for read-only audit |
| Previous task ledger | 160 tasks: 134 checked, 26 open | PASS as count |

Initial feature-artifact SHA-256 values retained before this recovery rewrite:

- `spec.md`: `c89f41b0612e8ffd42e7bfababe35cebb18e95687cf85588fd1716f00dc40fc7`
- `plan.md`: `d7069846c3cc9e1ebc669d6c012bb2260a639e6a05cd538d2c29489bc96d4b04`
- `tasks.md`: `c15cf840d62796ae0d315a3c3a9c4a39b08a7482f86a83ab0e44df0311975d20`
- `analysis.md`: `a228aad08446a3ef241a1a2644d9a045a1f569a095dac4dd7c5157b51f80f564`
- `convergence.md`: `08e3ec847d6e2bdcd4232737034e662a83e919532ad60a8ca97f4f2abfc250c1`

The exact pre-recovery collapsed/expanded porcelain and tracked numstat are retained in [recovery-worktree-snapshot.md](recovery-worktree-snapshot.md). It is a path/count receipt, not semantic acceptance.

`convergence.md` is retained as historical evidence only. It was not rerun because no implementation was authorized and convergence after an audit-only pass would be false proof.

### Expanded manifest domain routing

The 463 expanded paths were assigned once by a deterministic path-first routing pass so the audit would not silently focus only on ads or Android. Counts are inventory, not semantic acceptance:

| Primary routed domain | Paths |
|---|---:|
| Agent/governance | 3 |
| Android/native/release | 25 |
| Ads/consent/monetization | 32 |
| Social/Friends/Challenges | 38 |
| Data/sync/automation/storage | 114 |
| UI/navigation/i18n/motion | 126 |
| Tests/e2e | 59 |
| Release docs/evidence/specs | 20 |
| Tooling/config/dependencies | 11 |
| Other | 35 |
| **Total** | **463** |

The full path receipt and tracked numstat are in `recovery-worktree-snapshot.md`. The one-row-per-path adjudication is in `full-diff-review.md`: all 463 stopped-chat paths are present exactly once, with 12 paths tied to fresh failing gates, 451 kept `UNVERIFIED`, and zero promoted to path-level `VERIFIED` merely because a broad scan passed. Semantic release acceptance remains `UNVERIFIED`; targeted source audit, local gates, primary research, threat modeling and console inspection cover only the named high-risk boundaries.

## 2. Current local gates

| Check | Result | Interpretation |
|---|---|---|
| `npm run rag:preflight -- <task>` | exit 0; task hash begins `8b6c7115`; groups `agent_rules`, `sync_auth` | PASS for retrieval; Android/ads/social/motion required direct source audit |
| Constitution status script | `PROPOSED`, not ratified/binding | PASS as authority classification |
| `npm run doc-counts` | 76 hooks, 9 stores, `Index.tsx` 284 LOC | PASS |
| `npm run constitution:check` | +10 test files, +60 `index.css` LOC, +4 god-components | FAIL |
| `npm run check:types-fresh` | generated Supabase types older than the automation migration | FAIL |
| `npm run check:supabase-migration-prefixes` | 82 files; legacy groups unchanged | PASS |
| `npm run check:production-data-integrity:diff` | 2,220 scanned / 841 reachable / 0 errors | PASS for the dirty diff only |
| `npm run check:sync-contract` | 409 invariants | PASS for static/local contract only |
| `npm audit --audit-level=high` | 0 vulnerabilities | PASS for npm advisory snapshot only |
| `npm run check:no-ai-templates` | guard/policy/template invariants pass | PASS for durable-output guardrails only |
| `npm run check:best-practices` | 66 invariants | PASS for packet/gate structure only |
| `npm run check:all` | typecheck, lint, eight-locale checks, colors, canonical orb/logo/static visual guards | PASS for static/local scope; runtime/human still UNVERIFIED |
| Full Vitest with `--maxWorkers=1` | 8/795 files failed; 23/9,634 tests failed; 9,604 passed; 7 todo | FAIL; same 23 failures reproduced in focused 8-file rerun |
| Local security suite `auto --strict` | exit 1: Snyk findings + Terrascan scope error | FAIL/UNVERIFIED; validated detail in `analysis.md` |
| `git diff --check` | no whitespace errors | PASS |

No row above proves an exact signed AAB, a store declaration, live sync, a real user flow, human accessibility acceptance, policy approval, or production readiness.

## 3. Inherited evidence disposition

The retained `output/android21/**` corpus contains 1,324 files and occupies about 1.2 GiB, including screenshots, videos, logs, JSON receipts, browser matrices, emulator results, and performance captures. Its largest routed groups include 317 five-destination files, 211 device files, 202 performance files and several reflow/social groups. It is useful provenance, but it predates this recovery snapshot and is not automatically current. The canonical per-task disposition is in [legacy-task-evidence-ledger.md](legacy-task-evidence-ledger.md).

Recovery rules:

1. An old checked box is not completion proof.
2. Only evidence rerun against the frozen snapshot can be `FRESH_VERIFIED`.
3. Reward/rewarded claims and the challenge-only social scope are `SUPERSEDED` by the owner's current direction.
4. Console mutations, upload, legal approval, artistic selection, qualified moderation operations, rollout, and publication remain `OWNER/EXTERNAL`.
5. Missing exact-artifact, device, authenticated cloud, human, or production evidence remains `UNVERIFIED`.

## 4. Monetization reachability audit

### Fresh source facts

- `src/pages/Index.tsx:38,265–277` mounts `AdProvider` in the production V2 shell; `:134` sets `V2_REWARDS_ENABLED = false`, while `:266–267` supplies consent and premium state.
- `src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx:23–95` exposes a rewarded-video preference. `src/contexts/AdContext.tsx:171–198` gates initialization on consent plus current entitlement/service/platform decisions.
- The dirty lane contains `optional_rewards` reachability in `AdContext.tsx:111–300`, a durable attempt ledger, and `src/lib/adConfig.ts:108–122` constants equivalent to 20 treats and 25 XP.
- `RewardedAdPrompt.tsx:2–51` contains reward-oriented copy/callback use, but repository search found imports only in tests; this particular UI is currently source-unreachable from production.
- The reachable provider/settings/SDK path and the unreachable prompt are different facts. Neither proves a successful runtime ad nor a legitimate reward.
- No automatic `RewardedAdPrompt` import was found in habit completion or journal save. The specification nevertheless makes the no-ad completion rule explicit so future work cannot introduce it.

### Mandatory classification

All existing reward constants, callbacks, UI, attempt-ledger behavior, service gates, and related task claims are **`LEGACY / UNVERIFIED`**. Nothing in that path may be activated, deleted, repurposed, or called production-ready without a separate owner decision and fresh reachability/runtime proof.

### Fresh authenticated read-only console facts

| Surface | Observation | Status |
|---|---|---|
| Play production | current release `34 (1.7.2)`, target SDK 35, 100% rollout, last release 2026-02-19 | PASS as console observation |
| Play policy | console shows an API 36 action deadline of 2026-08-30 in the current locale | FAIL for 2.1 readiness |
| Play app content | 11 declarations show no current attention request | PASS as UI observation; truth parity UNVERIFIED |
| Play audience | declared `13–15`, `16–17`, `18+`; under-13 is not currently selected | PASS as current declaration; conflicts with proposed all-ages scope |
| Play app access | declares all functionality freely available | FAIL against authenticated/local product paths |
| AdMob account | approved/open UI plus inactivity warning; auto-deactivation warning after six months without impressions | FAIL as operational risk |
| AdMob app | Play-linked, verified, Ready, ad serving enabled | PASS as console-readiness metadata only |
| AdMob units | one rewarded and one rewarded-interstitial unit exist; no unit/app frequency cap shown | PASS as inventory; STOP for activation |
| AdMob policy center | no violations shown | PASS as current UI observation only |
| Privacy & messaging | one active EEA message and one active US-state message | PASS as inventory; locale/age/runtime parity UNVERIFIED |
| Traffic | no recent requests, impressions, or revenue; no app-ads.txt request data | UNVERIFIED runtime monetization |

`Ready` does not prove a policy-safe product model, a reward, consent correctness, a child-safe ad request, app-ads.txt crawl, a test-device flow, or live serving. Ads therefore remain fail-closed/OFF.

## 5. Monetization decision record

**ADR-MON-001 — status: OWNER DECISION REQUIRED; no option selected.**

| Option | Meaning | Preconditions | Current verdict |
|---|---|---|---|
| A | Design a genuine reward system with demonstrable user value | separate product scope, value research, economy/abuse/privacy/accessibility design, owner approval | ASK; do not implement |
| B | Use a voluntary policy-safe ad format with no fictitious reward | exact format must not depend on a reward; Play/AdMob/Families/all-ages/consent/UX/legal and fresh runtime evidence must prove admissibility | ASK; currently UNVERIFIED |
| C | Keep all ads fail-closed/OFF | retain graceful core-app behavior and prevent SDK/request/CTA activation | Safe default; owner selection still required for durable product policy |

The target is now: **a verified policy-safe monetization model without fictitious rewards, selected by the product owner and confirmed by fresh runtime evidence**.

Until ADR-MON-001 is decided:

- habit completion and journal save finish before, and independently of, any ad path;
- no automatic interstitial follows either action;
- no ad appears before a committed user-data save;
- no ad or CTA appears inside private journal text or emotionally sensitive flows;
- no copy says “watch and earn” or equivalent;
- an opt-in concept may be planned only outside private content;
- frequency, age, consent, geography, network failure, duplicate callback, process death, and restart are separate gates;
- the absence of an honest model blocks ads, not the core app.

## 6. Scope conflicts recovered

| Conflict | Recovery decision |
|---|---|
| Previous “rewarded-only” goal vs no production reward system | previous goal is superseded; legacy artifacts stay untouched and OFF |
| Existing challenge-scoped ranking vs requested global leaderboard/public search/profile | previous social scope is superseded; new public-social work becomes a high-risk sub-spec and is not implementation-authorized |
| Current Play audience excludes under-13 vs proposed all-ages product | child/unknown public social and ads remain OFF until declarations, neutral age screen, safety, moderation, legal and runtime evidence agree |
| Existing checked release tasks vs dirty, drifted lane | checked boxes become historical evidence labels, not current completion |
| 2026-08-31 external deadline vs console 2026-08-30 | use 2026-08-30 as operational deadline and the official 2026-08-31 rule as policy context |
| User requests all ten audit lenses but prohibits subagents | apply the ten lenses inline; independent Role 10 isolation and specialist invocation remain UNVERIFIED |

## 7. Ten-role disposition

No subagents were launched, per the owner's explicit constraint. “Selected” below means an inline audit lens, not an independent specialist execution.

| Role | Disposition | Evidence focus | Result |
|---|---|---|---|
| 1 Coordinator | SELECTED inline | scope, conflict and evidence ledgers | PASS for planning |
| 2 Psychology/human factors | SELECTED inline | emotional flows, pressure, interruption, children | ads in sensitive/private flows prohibited; human acceptance UNVERIFIED |
| 3 Logic/state coherence | SELECTED inline | save-before-ads, offline/restart, task-state contradictions | contradictions recorded; runtime proof UNVERIFIED |
| 4 Accessibility/localization | SELECTED inline | eight locales, RTL, 200%, Back, child comprehension | source requirements present; human AT UNVERIFIED |
| 5 Architecture/data | SELECTED inline | Dexie local truth, sync/tombstones, native parity | 409 local invariants PASS; cloud/exact artifact UNVERIFIED |
| 6 Security/privacy | SELECTED inline | public social/QR/UGC/consent/diary boundaries | threat model updated; operational controls UNVERIFIED |
| 7 Reliability/operations | SELECTED inline | exact artifact, vitals, rollout/halt/rollback | release STOP |
| 8 QA/evidence | SELECTED inline | old task/receipt reconciliation | ledger created; independent review UNVERIFIED |
| 9 Product/visual craft | SELECTED inline | user value, motion concept gate, kill criteria | owner artistic selection UNVERIFIED |
| 10 Blind-spot sentinel | EXCLUDED from execution | isolated Pass A/B and hash-bound closure | UNVERIFIED because subagents were forbidden |

## 8. Release verdict

### Full requested Android 2.1 scope by the deadline: `STOP`

Blocking facts include:

- target API 36 candidate/exact signed AAB is absent;
- generated Supabase types are stale and the migration/cloud parity is not proved;
- constitution drift is unresolved;
- public all-ages social/search/global ranking/QR requires a new safety, moderation, legal, declaration, backend and runtime program;
- monetization has no owner-selected honest model and must remain OFF;
- Play app-access and proposed audience truth do not match the product scope;
- exact-AAB signing, bundle/splits/upgrade, release profiles, native libraries, Firebase config, internal test, pre-launch, physical-device, human AT/craft and staged-rollout evidence are missing;
- incident operator, alert route and authorized rollback/halt drills are not bound.

### Core app with ads OFF: `UNVERIFIED`, not blocked by monetization alone

The core app may follow a narrower release path only after the non-ad blockers are cleared against the exact same signed AAB. No release action is authorized in this audit.

## 9. Audit boundary

The completed `specify → clarify → plan → checklist → tasks → analyze` receipt is `spec-kit-cycle.md`. It records 35 requirements, 74 canonical tasks, nine requirement-quality checklists, the 463-path stopped-chat ledger and the explicit prohibition on implement/converge.

No production source, dependency, migration, Edge Function, AAB, console value, rollout, Git history, remote branch, PR, key, secret, or user data was changed by this recovery audit. No implementation or convergence phase was run.
