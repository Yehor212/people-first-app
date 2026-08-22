# Tasks: Android 2.1 Release Recovery

**Canonical current ledger:** T161–T234  
**Legacy ledger:** T001–T160 is preserved and classified in `legacy-task-evidence-ledger.md`  
**Authorization:** audit/planning only; unchecked implementation tasks are not authorized  
**Ads/public social defaults:** OFF

## Task field contract

Every task includes slice, user failure/requirement, exact surface, all five platforms, dependencies/owner, explicit priority, RED or characterization baseline, minimal change, GREEN proof, runtime and security/privacy/accessibility/i18n evidence, rollback/kill criteria, external side effect/approval, evidence path and one authoritative evidence status: `VERIFIED`, `FAIL`, or `UNVERIFIED`.

Priority semantics: `P0` blocks the core release, its truthful OFF posture, or the next authorized checkpoint; `P1` is required for the separately gated full social, motion, or monetization scope; `P2` is conditional product scope that must not begin without the named owner choice. Evidence-status semantics: `VERIFIED` means retained fresh completion proof for the task itself; `FAIL` means a named current acceptance gate ran and failed; `UNVERIFIED` means task-completion proof is absent or not run. Workflow words such as `BLOCKED` or `OWNER/EXTERNAL` may explain why, but never replace the tri-state status.

Platform notation: `W` Web/Vite, `P` installed PWA, `A` Android/Capacitor, `I` iOS/WKWebView, `D` Desktop/Tauri. `N/A` always includes a reason; otherwise an untested platform is `UNVERIFIED`.

Current task evidence summary:

| Evidence status | Count | Task IDs | Boundary |
|---|---:|---|---|
| `VERIFIED` | 4 | T161, T163, T164, T165 | audit receipts only |
| `FAIL` | 8 | T162, T169, T171, T187, T197, T214, T224, T225 | a named current acceptance/precondition gate failed |
| `UNVERIFIED` | 62 | every other T161–T234 ID | completion proof absent or not run |
| **Total** | **74** | contiguous T161–T234 | implementation remains unauthorized |

## R0 — Recovery isolation and evidence

- [x] T161 [R0] Freeze the recovery snapshot.
  - **Priority / evidence status:** P0 / VERIFIED.
  - **Failure / requirement:** mixed dirty work could be treated as a release candidate; FR-035.
  - **Surface / platforms:** Git/worktree/feature artifacts; W/P/A/I/D share source provenance.
  - **Dependencies / owner:** none; Codex read-only audit owner.
  - **Baseline → change → GREEN:** capture branch/HEAD/base/status/conflicts/counts/hashes → no repository behavior change → re-read exact receipt fields.
  - **Runtime & qualities:** no runtime claim; privacy scan excludes secrets/user content; a11y/i18n N/A because evidence metadata only.
  - **Rollback / kill / external:** planning receipt can be removed; kill on ambiguity/conflict; no external side effect.
  - **Evidence / workflow note:** `recovery-audit.md` §1; `PASS` as snapshot, implementation `STOP`.

- [ ] T162 [R0] Create the authorized clean implementation lane.
  - **Priority / evidence status:** P0 / FAIL.
  - **Failure / requirement:** edit doctor currently stops on 349 dirty entries; FR-035.
  - **Surface / platforms:** workspace protocol and intended diff; W/P/A/I/D shared source.
  - **Dependencies / owner:** T161 and explicit owner authorization; Codex workspace owner.
  - **RED → change → GREEN:** retain doctor `STOP` → create locked `codex/` worktree from approved base and attribute intended files → doctor GO with clean manifest.
  - **Runtime & qualities:** no app runtime; security checks lock/actor/base; privacy excludes secret files; a11y/i18n N/A.
  - **Rollback / kill / external:** remove only the new lane through approved workspace workflow; kill on unexplained/unrelated changes; no push/PR.
  - **Evidence / workflow note:** future `output/android21/recovery/workspace.json`; `BLOCKED` by authorization.

- [x] T163 [R0] Capture current policy/freshness baselines without repairing them.
  - **Priority / evidence status:** P0 / VERIFIED.
  - **Failure / requirement:** old green narratives hide current drift; FR-035.
  - **Surface / platforms:** architecture counts, constitution, types, migrations, sync/PDI/audit; shared W/P/A/I/D contracts.
  - **Dependencies / owner:** T161; Codex audit owner.
  - **Baseline → change → GREEN:** run named checks → no production change → record exact PASS/FAIL/UNVERIFIED boundaries.
  - **Runtime & qualities:** static/local only; security/privacy scanners are bounded; a11y/i18n runtime N/A.
  - **Rollback / kill / external:** remove receipt only; kill if failures are relabeled PASS; no external side effect.
  - **Evidence / workflow note:** `recovery-audit.md` §2; bounded `PASS`, with constitution/types `FAIL`.

- [x] T164 [R0] Adjudicate every legacy task/evidence claim.
  - **Priority / evidence status:** P0 / VERIFIED.
  - **Failure / requirement:** 134 checked boxes can be mistaken for fresh completion; FR-035.
  - **Surface / platforms:** T001–T160 and retained output corpus; platform claims W/P/A/I/D classified separately.
  - **Dependencies / owner:** T161; Codex audit owner.
  - **Baseline → change → GREEN:** count 134/26/160 → classify each ID once → arithmetic and ID coverage match source ledger.
  - **Runtime & qualities:** no inherited runtime/human/security claim promoted; privacy-safe artifact references only; a11y/i18n claims remain bounded.
  - **Rollback / kill / external:** remove recovery ledger; kill on missing/duplicate ID or stale receipt marked fresh; no external side effect.
  - **Evidence / workflow note:** `legacy-task-evidence-ledger.md`; `PASS` for classification only.

- [x] T165 [R0] Record audit-role and independence limits.
  - **Priority / evidence status:** P0 / VERIFIED.
  - **Failure / requirement:** inline judgment could be mislabeled independent specialist proof; FR-035.
  - **Surface / platforms:** ten-role routing/evidence ledger; W/P/A/I/D cross-domain review.
  - **Dependencies / owner:** owner prohibition on subagents; Codex coordinator.
  - **Baseline → change → GREEN:** no independent Role 10 session → apply inline lenses and label isolation UNVERIFIED → final report preserves limit.
  - **Runtime & qualities:** security/privacy/a11y/product lenses documented; no human/cultural claim.
  - **Rollback / kill / external:** remove ledger only; kill on fabricated specialist execution; no external side effect.
  - **Evidence / workflow note:** `recovery-audit.md` §7; inline planning `PASS`, Role 10 `UNVERIFIED`.

- [ ] T166 [R0] Authorize one bounded implementation slice.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** a large plan could be treated as blanket implementation/deployment approval; FR-034.
  - **Surface / platforms:** selected roadmap slice and write set; explicit W/P/A/I/D impacts.
  - **Dependencies / owner:** T162 plus relevant G-xxx decisions; product owner.
  - **Baseline → change → GREEN:** no authority → owner names slice/files/gates → fresh implementation preflight and RED plan accepted.
  - **Runtime & qualities:** selected slice must name runtime/security/privacy/a11y/i18n evidence.
  - **Rollback / kill / external:** no code before approval; kill on implicit scope expansion; external/Git rights remain separate.
  - **Evidence / workflow note:** future owner checkpoint; `ASK`.

## R1 — Authoritative schema, data and sync

- [ ] T167 [R1] Select the authoritative schema/type generation path.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** local migration and generated types disagree; FR-006/FR-007.
  - **Surface / platforms:** Supabase migration/type generation; W/P/A/I/D sync clients.
  - **Dependencies / owner:** T162, G-013; owner + data maintainer.
  - **RED → change → GREEN:** current `check:types-fresh` FAIL → authorize exact remote target or local replay → generation source/hash documented.
  - **Runtime & qualities:** no user data read; security uses least privilege; a11y/i18n N/A.
  - **Rollback / kill / external:** no migration apply without separate approval; kill on wrong project/stale source/printed secret; remote write is owner-gated.
  - **Evidence / workflow note:** future `output/android21/data/schema-source.json`; `OWNER/EXTERNAL`.

- [ ] T168 [R1] Revalidate automation migration, RLS and RPC contracts.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** schema/RLS mismatch can cross owners or corrupt automation history; FR-006/FR-031/FR-032.
  - **Surface / platforms:** migration/RPC/RLS/static contract; W/P/A/I/D cloud sync.
  - **Dependencies / owner:** T167; data/security owner.
  - **RED → change → GREEN:** rerun negative owner/CAS/tombstone/rollback contract tests → minimal reviewed migration correction if authorized → same tests and remote inventory agree.
  - **Runtime & qualities:** dedicated safe account only for live smoke; no diary prose in RPC/logs; a11y/i18n N/A.
  - **Rollback / kill / external:** forward-only corrective migration; kill on RLS bypass/non-atomic commit; remote apply requires owner approval.
  - **Evidence / workflow note:** future `output/android21/data/migration-contract.json`; `BLOCKED` by T167.

- [ ] T169 [R1] Regenerate and verify Supabase types.
  - **Priority / evidence status:** P0 / FAIL.
  - **Failure / requirement:** stale declarations can compile incorrect production calls; FR-007.
  - **Surface / platforms:** `src/types/supabase.ts` and consumers; W/P/A/I/D shared TS.
  - **Dependencies / owner:** T167–T168; data maintainer.
  - **RED → change → GREEN:** retain freshness FAIL → generate only from authoritative schema → freshness/typecheck/sync contract GREEN with reviewed diff.
  - **Runtime & qualities:** no schema invention; secret-free generation; a11y/i18n N/A.
  - **Rollback / kill / external:** revert only generated file in clean lane; kill on hand edits/schema mismatch; no remote side effect during generation.
  - **Evidence / workflow note:** future generated-file hash + check log; `BLOCKED`.

- [ ] T170 [R1] Reprove local commit, queue and owner/generation invariants.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** retries/restarts/account switches can duplicate or cross-apply state; FR-002/FR-006.
  - **Surface / platforms:** Dexie, automation repository, outbox/event sync; W/P/A/I/D lifecycle variants.
  - **Dependencies / owner:** T169; data owner.
  - **RED → change → GREEN:** characterize duplicate/reordered/full-queue/stale-owner paths → smallest correction → focused and 409-invariant blast checks GREEN.
  - **Runtime & qualities:** private canaries stay out of logs; accessibility/i18n N/A; platform lifecycle evidence named separately.
  - **Rollback / kill / external:** code revert/feature OFF; kill on duplicate/cross-owner/lost primary action; no production smoke without approval.
  - **Evidence / workflow note:** future `output/android21/data/local-sync-matrix.json`; `PLANNED`.

- [ ] T171 [R1] Reprove deletion, tombstone, purge, backup and forward-only behavior.
  - **Priority / evidence status:** P0 / FAIL.
  - **Failure / requirement:** deleted/private state can resurrect after offline/import/old binary; FR-006/FR-031.
  - **Surface / platforms:** deletion tracker, tombstones, backup/import, v11 rollback; W/P/A/I/D.
  - **Dependencies / owner:** T169–T170; data/privacy owner.
  - **RED → change → GREEN:** run resurrection/ABA/replace/N-1 cases → minimal correction → identical tests plus exact upgrade path GREEN.
  - **Runtime & qualities:** synthetic test fixtures only; no production-derived data; a11y/i18n only for user-facing confirmations.
  - **Rollback / kill / external:** forward-only correction; kill on resurrection/orphan/old-binary unsafe path; live deletion needs dedicated authorized account.
  - **Evidence / workflow note:** future `output/android21/data/deletion-backup.json`; `PLANNED`.

- [ ] T172 [R1] Reprove diagnostic and evidence privacy.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** diary/habit/auth/identity data can leak through errors, ads, QR, logs or receipts; FR-031/FR-035.
  - **Surface / platforms:** logger, Sentry/crash/native logs, ad/QR payloads, evidence tools; W/P/A/I/D.
  - **Dependencies / owner:** T162; privacy/security owner.
  - **RED → change → GREEN:** private-canary interception across sinks → minimal fixed-code/allowlist correction → zero canary leakage and bounded retention/clear proof.
  - **Runtime & qualities:** accessibility/i18n for visible diagnostic controls; no sensitive raw evidence retained.
  - **Rollback / kill / external:** disable external sink/revert scoped logger; kill on any content/token/PII leak; Sentry/console mutation separately authorized.
  - **Evidence / workflow note:** future `output/android21/security/diagnostic-privacy.json`; `PLANNED`.

- [ ] T173 [R1] Prove storage/sync lifecycle parity on all five platforms.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** web assumptions fail in installed/native/desktop lifecycle; FR-006 and platform matrix.
  - **Surface / platforms:** W browser reload; P update/restart; A process death; I WK lifecycle; D window/process lifecycle.
  - **Dependencies / owner:** T170–T172; platform owners.
  - **RED → change → GREEN:** per-platform interruption baseline → minimal platform-specific fix → primary/outbox/ack/deletion state exactly once.
  - **Runtime & qualities:** owner-bound synthetic fixtures; security/privacy canaries; UI recovery states cover a11y/i18n.
  - **Rollback / kill / external:** platform flag/revert; kill on lost/duplicate/stale-owner data; device/human access may be external.
  - **Evidence / workflow note:** future five-platform lifecycle matrix; W/P/A planned, I/D `UNVERIFIED` until exercised.

- [ ] T174 [R1] Run an authorized live sync/delete smoke.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** static contracts do not prove deployed schema or same-account behavior; FR-006/FR-035.
  - **Surface / platforms:** exact Supabase project and dedicated smoke account; W and A minimum live smoke, P/I/D explicitly `UNVERIFIED` until their own lifecycle run.
  - **Dependencies / owner:** T168–T173 and authenticated account flag; owner/data operator.
  - **RED → change → GREEN:** prove target/account/flag and empty scoped IDs → perform reversible synthetic smoke → verify sync/delete/tombstone/no-resurrection and cleanup.
  - **Runtime & qualities:** no real journal/habit data; least privilege; a11y/i18n N/A.
  - **Rollback / kill / external:** delete scoped smoke rows through approved path; kill on missing flag/target ambiguity; external writes require explicit approval.
  - **Evidence / workflow note:** redacted smoke receipt; `OWNER/EXTERNAL`.

## R2 — Core action completion without advertising

- [ ] T175 [R2] Prove habit completion commits before publication and has no ad dependency.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** completion can be lost/duplicated or interrupted by advertising; FR-001–FR-003.
  - **Surface / platforms:** habit persistence/handler/publication; W/P/A/I/D.
  - **Dependencies / owner:** T169–T173; habit/data owner.
  - **RED → change → GREEN:** interrupt before/after Dexie commit with ad gate denied/error → minimal ordering fix → exactly one durable completion and no ad invocation.
  - **Runtime & qualities:** offline/restart/process death; private fields absent from telemetry; visible success/error covers a11y/eight locales.
  - **Rollback / kill / external:** revert scoped handler/flag optional path OFF; kill on lost/duplicate action or ad call; no external side effect.
  - **Evidence / workflow note:** future `output/android21/core/habit-commit.json`; `PLANNED`.

- [ ] T176 [R2] Prove journal save commits before publication and has no ad dependency.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** private text can be lost/exposed/interrupted; FR-001–FR-004/FR-031.
  - **Surface / platforms:** journal transaction/outbox/editor exit; W/P/A/I/D.
  - **Dependencies / owner:** T169–T173; journal/privacy owner.
  - **RED → change → GREEN:** interrupt save at transaction/publication/restart with ads unavailable → minimal ordering fix → one encrypted/owner-bound save, no ad call, truthful recovery state.
  - **Runtime & qualities:** no prose in logs/ad/receipts; Back/focus/announcements/eight locales; process-death matrix.
  - **Rollback / kill / external:** revert scoped transaction change; kill on data loss/leak/duplicate/ad gating; no external side effect.
  - **Evidence / workflow note:** future `output/android21/core/journal-save.json`; `PLANNED`.

- [ ] T177 [R2] Enforce the sensitive/private advertising exclusion map.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** ads can exploit diary/emotional/recovery/error moments; FR-004/FR-031.
  - **Surface / platforms:** diary editor/detail, mood/emotional flows, recovery/errors, auth/private overlays; W/P/A/I/D.
  - **Dependencies / owner:** T179 reachability inventory and ADR still undecided; privacy/product owner.
  - **RED → change → GREEN:** source/runtime route test detects any prompt/request/init → minimal deny-map/gate correction → zero reachable ad surface/copy in every excluded route.
  - **Runtime & qualities:** keyboard/Back/AT/eight locales; no private payload; cross-platform graceful OFF.
  - **Rollback / kill / external:** optional ads stay OFF; kill on any excluded-route reachability; no console change.
  - **Evidence / workflow note:** future `output/android21/monetization/sensitive-route-matrix.json`; `PLANNED`.

- [ ] T178 [R2] Prove the core app works with monetization absent.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** missing plugin/consent/network/model can block primary functionality or tempt synthetic fallback records; FR-005/FR-025.
  - **Surface / platforms:** startup, habit, diary, mood, planning, settings; W/P/A/I/D.
  - **Dependencies / owner:** T175–T177; core platform owner.
  - **RED → change → GREEN:** exercise SDK absent/unsupported, consent denied, gate stale/OFF, network offline → smallest decoupling → all core paths complete with truthful states.
  - **Runtime & qualities:** no empty fake records; a11y/i18n/RTL/reduced motion in degraded states; privacy-safe logs.
  - **Rollback / kill / external:** default OFF/adapter no-op; kill if core blocks/crashes/degrades falsely; no external side effect.
  - **Evidence / workflow note:** future five-platform ads-off matrix; `PLANNED`.

- [ ] T179 [R2] Re-inventory legacy reward/rewarded production reachability without changing it.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** dead UI, reachable provider and legacy callbacks can be confused with readiness; FR-020–FR-025.
  - **Surface / platforms:** `Index`, settings, AdProvider/context/controller/config/prompt/ledger/gates; W/P/A/I/D.
  - **Dependencies / owner:** T162; security/product owner.
  - **Baseline → change → GREEN:** build import/call/state graph and bundle/runtime probes → no activation/deletion → each node labeled reachable/dead/gated/unknown with owner/data effects.
  - **Runtime & qualities:** no live ads/IDs/PII; UI copy/AT/i18n inventory; plugin parity per platform.
  - **Rollback / kill / external:** receipt only; kill on request/console mutation or readiness claim; none authorized.
  - **Evidence / workflow note:** current partial source result in `recovery-audit.md`; exact runtime `UNVERIFIED`.

- [ ] T180 [R2] Run the core failure/restart negative-control matrix.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** late ad callback or lifecycle event can mutate a completed action; FR-001–FR-004/FR-024.
  - **Surface / platforms:** habit/journal plus current legacy callbacks; W/P/A/I/D.
  - **Dependencies / owner:** T175–T179; QA/data owner.
  - **RED → change → GREEN:** inject network error/no-fill/dismiss/duplicate callback/process death/relaunch → minimal idempotency/decoupling → primary action remains exactly once and reward state unchanged/OFF.
  - **Runtime & qualities:** synthetic only; no private content; failure copy accessible and localized.
  - **Rollback / kill / external:** disable optional path/revert; kill on any primary mutation/fake reward; no live traffic.
  - **Evidence / workflow note:** future `output/android21/core/ad-failure-isolation.json`; `PLANNED`.

## R3 — Android 16 navigation, reflow, accessibility and performance

- [ ] T181 [R3] Generate the current overlay/table/five-destination ownership inventory.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** unowned takeovers create Back/focus/reflow traps; FR-009/FR-026–FR-028.
  - **Surface / platforms:** all production-reachable overlays/tables; W/P/A/I/D route applicability.
  - **Dependencies / owner:** T162; Android/UI owner.
  - **Baseline → change → GREEN:** current source traversal → no UI edit → every row binds route/trigger/owner/exit/Back/Escape/focus/scroll/safe-area/RTL/platform/evidence.
  - **Runtime & qualities:** privacy-safe route names; a11y/i18n fields mandatory; no human PASS.
  - **Rollback / kill / external:** inventory can be removed; kill on missing production owner/duplicate ambiguity; none.
  - **Evidence / workflow note:** future `docs/release/android-2.1-ui-inventory.json`; `PLANNED`.

- [ ] T182 [R3] Reprove Android Back and predictive Back ownership.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** Back can trigger an action, skip a level or trap the user; FR-008/FR-009.
  - **Surface / platforms:** native bridge, layer stack, five destinations/overlays; A primary, W/P/I/D analogs explicit.
  - **Dependencies / owner:** T181; Android/nav owner.
  - **RED → change → GREEN:** gesture/three-button/cancel/commit/root/recreate matrix → minimal existing-bridge fix → LIFO close and root delegation with zero accidental action.
  - **Runtime & qualities:** focus restore, RTL order, reduced motion; no user data; iOS/Desktop marked separate.
  - **Rollback / kill / external:** revert bridge/UI handler; kill on action activation/root interception/listener leak; device evidence required.
  - **Evidence / workflow note:** future `output/android21/android/back-matrix.json`; `PLANNED`.

- [ ] T183 [R3] Reprove process death, recreation, reload, external return and IME states.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** lifecycle interruptions lose state or leave overlays/keyboard stuck; FR-008/FR-009.
  - **Surface / platforms:** five destinations, auth/OAuth/settings, editors/sheets; W reload, P restart, A full matrix, I/D separate.
  - **Dependencies / owner:** T175–T182; platform owners.
  - **RED → change → GREEN:** cold/force-stop/recreate/WebView reload/OAuth/settings/IME baseline → minimal lifecycle fix → committed state retained and UI owner restored safely.
  - **Runtime & qualities:** private draft recovery bounded; focus/announcements/eight locales; no credentials in receipts.
  - **Rollback / kill / external:** revert scoped lifecycle adapter; kill on data loss/stale-owner loop/focus trap; auth requires user-completed sign-in.
  - **Evidence / workflow note:** future lifecycle matrix; `PLANNED`, OAuth/human gesture external.

- [ ] T184 [R3] Validate Android 16 edge-to-edge and system UI.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** content/actions can sit under bars, cutout or IME; FR-008/FR-009/FR-027.
  - **Surface / platforms:** MainActivity/themes/V2 shell/nav/sheets/editors/auth; A primary, W/P/I/D safe-area comparisons.
  - **Dependencies / owner:** T181; Android/UI owner.
  - **RED → change → GREEN:** direct geometry/screenshot assertions for bars/cutout/IME → minimal token/inset fix → zero obscured critical actions across theme/orientation.
  - **Runtime & qualities:** RTL, 200%, reduced motion, focus; no hardcoded colors; privacy-safe captures.
  - **Rollback / kill / external:** revert scoped style/native config; kill on opt-out/overlap/contrast regression; no external side effect.
  - **Evidence / workflow note:** future `output/android21/android/edge-to-edge.json`; `PLANNED`.

- [ ] T185 [R3] Validate adaptive windows and large screens.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** fixed orientation/aspect/table layouts clip or hide actions; FR-008/FR-027.
  - **Surface / platforms:** five destinations and overlay/table owners; W/D wide, P/A adaptive, I parity.
  - **Dependencies / owner:** T181/T184; responsive UI owner.
  - **RED → change → GREEN:** phone/tablet/sw600/landscape/split/freeform/foldable baseline → minimal layout correction → reflow/scroll/reading order stable.
  - **Runtime & qualities:** all locales/RTL/200%, keyboard/AT, safe areas; no fabricated content.
  - **Rollback / kill / external:** revert component-specific changes; kill on restricted-resizability opt-out or hidden critical action; device matrix required.
  - **Evidence / workflow note:** future adaptive-window matrix; `PLANNED`.

- [ ] T186 [R3] Verify eight-locale and RTL/bidi behavior.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** untranslated/fragmented/reversed copy changes meaning or hides actions; FR-026.
  - **Surface / platforms:** all affected copy/routes; W/P/A/I/D.
  - **Dependencies / owner:** selected UI changes; localization owner + reviewers.
  - **RED → change → GREEN:** parity/placeholders/deep scan plus `ar`/`he` component RED → natural reviewed values/layout fix → all automated gates and direct captures GREEN.
  - **Runtime & qualities:** no implementation jargon; bidi isolation/no concatenation; privacy-safe strings; cultural approval separate.
  - **Rollback / kill / external:** revert exact keys/layout; kill on placeholder/meaning/RTL break; human review external.
  - **Evidence / workflow note:** future i18n/RTL manifest; `PLANNED`.

- [ ] T187 [R3] Verify WCAG 2.2 reflow, focus, target and motion mechanics.
  - **Priority / evidence status:** P0 / FAIL.
  - **Failure / requirement:** users cannot see/reach/focus critical actions at 200% or reduced motion; FR-027/FR-028.
  - **Surface / platforms:** inventory rows and five destinations; W/P/A/I/D.
  - **Dependencies / owner:** T181–T186; accessibility/UI owner.
  - **RED → change → GREEN:** automated/keyboard/geometry baseline → smallest semantic/layout fix → 200% no critical loss, focus not obscured, targets/announcements/meaning pass.
  - **Runtime & qualities:** eight locales/RTL, safe areas/IME; no private text in captures; AT human gate separate.
  - **Rollback / kill / external:** revert scoped UI; kill on keyboard trap/hidden focus/motion-only completion; no external side effect.
  - **Evidence / workflow note:** future a11y matrix; `PLANNED`.

- [ ] T188 [R3] Obtain named human TalkBack/AT and cultural review.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** automated semantics do not prove usable traversal/comprehension; FR-027/FR-030.
  - **Surface / platforms:** selected critical routes; A TalkBack primary, W/P/I/D named applicability.
  - **Dependencies / owner:** T186–T187; qualified human reviewers.
  - **Baseline → change → GREEN:** reviewer script and exact candidate → log findings/minimal fixes → signed bounded acceptance with remaining limitations.
  - **Runtime & qualities:** no participant private data; all locales only where qualified; security/privacy briefing.
  - **Rollback / kill / external:** reject/revert failing UI; kill on critical blocker; human external gate.
  - **Evidence / workflow note:** retained reviewer record; `OWNER/EXTERNAL`.

- [ ] T189 [R3] Measure exact-candidate startup/frame/jank/profile behavior.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** inherited/invalid-environment metrics can hide slow/janky release; FR-010/FR-013.
  - **Surface / platforms:** exact AAB critical journeys; A primary, W/P/I/D separate budgets.
  - **Dependencies / owner:** T225–T227 exact artifact; performance owner.
  - **RED → change → GREEN:** predefined device/API/thermal/compilation/iteration thresholds → smallest non-degrading fix → repeated valid run meets thresholds with profiles packaged.
  - **Runtime & qualities:** reduced motion and premium visuals preserved; no PII; a11y/i18n journey neutrality.
  - **Rollback / kill / external:** revert perf change; kill on invalid environment/threshold failure/visual downgrade; physical device external.
  - **Evidence / workflow note:** exact performance manifest; `BLOCKED` by AAB.

- [ ] T190 [R3] Complete the five-destination cross-platform journey matrix.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** isolated screen tests miss nested route/state traps; FR-008/FR-009/FR-026–FR-028.
  - **Surface / platforms:** Orb/Habits/Diary/Planning/Settings; W/P/A/I/D.
  - **Dependencies / owner:** T175–T189; QA owner.
  - **RED → change → GREEN:** entry/exit/LIFO/state/200%/RTL/motion/platform matrix → focused fixes only → every selected candidate row has direct evidence or explicit N/A/follow-up.
  - **Runtime & qualities:** private routes use safe test account/content; security/privacy/a11y/i18n included; no platform inference.
  - **Rollback / kill / external:** per-fix revert/feature OFF; kill on any critical route trap/data loss; devices/human gates external.
  - **Evidence / workflow note:** future `output/android21/android/five-destination-matrix.json`; `PLANNED`.

## M1 — Non-orb motion concept gate

- [ ] T191 [M1] Inventory every production-reachable non-orb animation.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** hidden motion owners leak resources, obscure meaning or bypass reduced motion; FR-028–FR-030.
  - **Surface / platforms:** all non-orb animation owners; W/P/A/I/D.
  - **Dependencies / owner:** T162; motion/UI owner.
  - **Baseline → change → GREEN:** source/runtime reachability trace → no production edit → rows bind route/trigger/exit/timer/RAF/canvas/audio/lifecycle/focus/motion gate/platform/evidence.
  - **Runtime & qualities:** privacy-safe routes; a11y/i18n/RTL fields; canonical orb explicitly excluded.
  - **Rollback / kill / external:** inventory only; kill on missing owner or orb redesign scope; no external side effect.
  - **Evidence / workflow note:** future `docs/release/non-orb-motion-inventory.json`; `PLANNED`.

- [ ] T192 [M1] Capture fresh current-state normal/reduced motion baselines.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** redesign cannot be evaluated without candidate-bound before evidence; FR-029/FR-030.
  - **Surface / platforms:** inventory owners, especially Gratitude Bloom and Let Go; W/P/A primary, I/D explicit.
  - **Dependencies / owner:** T191 and production-equivalent build; motion QA.
  - **Baseline → change → GREEN:** capture current behavior with build/route/locale/viewport/motion metadata → no design edit → hash/count/video manifest validates.
  - **Runtime & qualities:** no private journal text; direct `en`/`ar`/`he`, focus/Back/cleanup observations; reduced path included.
  - **Rollback / kill / external:** remove evidence only; kill on synthetic/fake screen or unbound capture; no external side effect.
  - **Evidence / workflow note:** future `output/android21/motion/baseline-manifest.json`; `PLANNED`.

- [ ] T193 [M1] Produce 4–6 ZenFlow-specific motion directions.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** generic animation names do not solve the current user/control failure; FR-029/FR-030.
  - **Surface / platforms:** Gratitude/Let Go plus shared non-orb language; W/P/A/I/D constraints.
  - **Dependencies / owner:** T191–T192; product/motion designer.
  - **Baseline → change → GREEN:** derive failures from inventory/videos → create 4–6 directions with purpose/tradeoff/rejection/perf/a11y/platform notes → rubric completeness review.
  - **Runtime & qualities:** concepts include reduced motion, RTL, lifecycle and privacy; no production implementation or artistic PASS.
  - **Rollback / kill / external:** discard concepts; kill on generic template/visual downgrade/orb change; owner selection external.
  - **Evidence / workflow note:** future concept board; `PLANNED`.

- [ ] T194 [M1] Create three Gratitude Bloom variants.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** a single untested treatment forces an artistic decision without alternatives; FR-029.
  - **Surface / platforms:** Gratitude Bloom completion; W/P/A/I/D behavior notes.
  - **Dependencies / owner:** T193; motion designer.
  - **Baseline → change → GREEN:** current baseline → three distinct variants tied to gratitude completion semantics → storyboard/prototype review with reduced-motion equivalents.
  - **Runtime & qualities:** no private gratitude text in artifacts; focus/Back/RTL/i18n timing; performance budget specified.
  - **Rollback / kill / external:** concepts only; kill on shame/pressure, motion-only success or generic particle swap; owner choice required.
  - **Evidence / workflow note:** future `output/android21/motion/gratitude-variants/`; `PLANNED`.

- [ ] T195 [M1] Create three Let Go of a Thought variants.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** sensitive emotional content can be trivialized, exposed or made hard to exit; FR-004/FR-029/FR-031.
  - **Surface / platforms:** Let Go flow; W/P/A/I/D behavior notes.
  - **Dependencies / owner:** T193; motion designer + privacy/human-factors review.
  - **Baseline → change → GREEN:** current baseline → three variants with explicit cancel/close/semantic completion → storyboard/prototype review with reduced-motion equivalents.
  - **Runtime & qualities:** no real thought text; non-clinical copy; Back/focus/RTL/eight-locales constraints; resource cleanup budget.
  - **Rollback / kill / external:** concepts only; kill on pressure/shame/content exposure/forced animation; owner choice required.
  - **Evidence / workflow note:** future `output/android21/motion/let-go-variants/`; `PLANNED`.

- [ ] T196 [M1] Run visual integrity review and stop for owner selection.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** technical prototypes can be mistaken for chosen craft; FR-030.
  - **Surface / platforms:** T192–T195 artifact pack; W/P/A/I/D constraints.
  - **Dependencies / owner:** T192–T195; visual critic then product owner G-012.
  - **Baseline → change → GREEN:** review source/artifact integrity, specificity, hierarchy, motion and platform constraints → correct concept packet only → Technical/Runtime/Craft/Motion/Model/Plan ledger complete.
  - **Runtime & qualities:** human artistic acceptance remains owner-owned; a11y/privacy/culture limits explicit.
  - **Rollback / kill / external:** no production code; kill on missing baseline/variant or false artistic PASS; owner selection is external.
  - **Evidence / workflow note:** future critic report + owner decision; `BLOCKED` until artifacts.

## S1 — All-ages public social, rankings, invitations and QR

- [ ] T197 [S1] Resolve public-social scope and age cohorts.
  - **Priority / evidence status:** P0 / FAIL.
  - **Failure / requirement:** current 13+ declaration conflicts with requested all-ages public contact/discovery; FR-014–FR-019.
  - **Surface / platforms:** product policy, Play target audience, feature flags; W/P/A/I/D.
  - **Dependencies / owner:** G-005/G-006; product owner + qualified policy/legal review.
  - **Baseline → change → GREEN:** document current declaration/runtime → owner chooses surfaces/cohorts/under-13 intent → accepted sub-spec boundary and kill criteria.
  - **Runtime & qualities:** accessibility/child comprehension/locale implications; no user data; no enablement.
  - **Rollback / kill / external:** keep feature OFF; kill on implicit under-13/adult assumption; console edits separately gated.
  - **Evidence / workflow note:** owner decision record; `ASK`.

- [ ] T198 [S1] Design and prove a neutral age-state and cohort gate.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** unknown/child may receive adult public/ads behavior; FR-015/FR-032.
  - **Surface / platforms:** auth/profile/feature resolver; W/P/A/I/D.
  - **Dependencies / owner:** T197 + legal/privacy approval; identity owner.
  - **RED → change → GREEN:** unknown/stale/spoofed/account-switch/restore cases → minimal owner-approved neutral flow and server-bound state → child/unknown defaults OFF across restart/devices.
  - **Runtime & qualities:** collect minimum necessary data; child-readable accessible eight-locale copy; no dark pattern.
  - **Rollback / kill / external:** public/ad gates OFF; kill on client-only/spoofable/inferred-age bypass; declaration changes external.
  - **Evidence / workflow note:** future age-state contract/runtime matrix; `BLOCKED` by T197.

- [ ] T199 [S1] Specify authoritative social data, RLS/RPC and abuse limits.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** client-trusted relationships/ranks permit IDOR, forgery and cross-owner access; FR-014–FR-018/FR-031.
  - **Surface / platforms:** new Supabase schema/RPC/RLS/rate limits; W/P/A/I/D clients.
  - **Dependencies / owner:** T197–T198, G-011; data/security owner.
  - **RED → change → GREEN:** contract tests for owner/cohort/block/enumeration/replay → minimal reviewed schema/RPC → atomic/idempotent/RLS/rate-limit tests GREEN.
  - **Runtime & qualities:** bounded public fields; deletion/retention/audit privacy; UI a11y/i18n later.
  - **Rollback / kill / external:** feature OFF/forward migration; kill on IDOR/public raw IDs/unbounded query; migration apply owner-gated.
  - **Evidence / workflow note:** future social data model/threat controls; `BLOCKED`.

- [ ] T200 [S1] Implement public profiles and search behind safety gates.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** search enables enumeration, stalking, impersonation or child discovery; FR-015–FR-018.
  - **Surface / platforms:** social profile/search module; W/P/A/I/D.
  - **Dependencies / owner:** T198–T199, moderation/block controls; social owner.
  - **RED → change → GREEN:** IDOR/enumeration/rate/block/deleted/child/unknown/offline cases → minimal bounded search/profile UI → server-authorized results and truthful empty/error states.
  - **Runtime & qualities:** no fake people; privacy fields minimal; accessible eight locales/RTL; platform navigation/back.
  - **Rollback / kill / external:** feature flag OFF; kill on child/blocked/deleted exposure or scraping bypass; no console mutation.
  - **Evidence / workflow note:** future profile/search adversarial + UI matrix; `BLOCKED`.

- [ ] T201 [S1] Implement a server-authoritative global leaderboard.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** global ranking can leak identity, encourage pressure or be forged/scraped; FR-015–FR-018.
  - **Surface / platforms:** ranking RPC/cache/UI; W/P/A/I/D.
  - **Dependencies / owner:** T198–T200 and owner ranking rules; product/data/security owner.
  - **RED → change → GREEN:** forged score/enumeration/tie/pagination/block/age/delete/restart cases → minimal bounded server rank → deterministic authorized results and honest unavailable state.
  - **Runtime & qualities:** no fake ranks; opt-in/agency/child safety; accessible tables/reflow/eight locales; privacy-safe display names.
  - **Rollback / kill / external:** global rank OFF; kill on client authority, unbounded exposure, pressure/shame risk; product approval required.
  - **Evidence / workflow note:** future global-rank contract/runtime matrix; `BLOCKED`.

- [ ] T202 [S1] Implement challenge-specific ranking separately.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** challenge membership/ranks can leak across challenges or conflict with global ranking; FR-016–FR-018.
  - **Surface / platforms:** challenge membership/rank RPC and UI; W/P/A/I/D.
  - **Dependencies / owner:** T199 and challenge model; social/data owner.
  - **RED → change → GREEN:** nonmember/blocked/expired/removed/tie/replay cases → minimal challenge-scoped authority → only eligible members/ranks render.
  - **Runtime & qualities:** no hardcoded challenge/person/rank; accessible table/RTL/200%; privacy/deletion honored.
  - **Rollback / kill / external:** challenge rankings OFF; kill on cross-challenge/blocked exposure; backend changes owner-gated.
  - **Evidence / workflow note:** future challenge-rank matrix; `BLOCKED`.

- [ ] T203 [S1] Define versioned friend/challenge invitation and manual-code contracts.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** malformed/replayed/cross-type inputs can create unintended relationships; FR-017/FR-019.
  - **Surface / platforms:** canonical parser/resolver/RPC; W/P/A/I/D.
  - **Dependencies / owner:** T199; security/social owner.
  - **RED → change → GREEN:** unknown version/type, oversized, hostile, self, duplicate, expired, revoked, blocked, wrong account → bounded inert parser and explicit confirm → zero pre-confirm writes and idempotent authorized result.
  - **Runtime & qualities:** no identifiers in logs; accessible localized error/confirm states; offline/restart safe.
  - **Rollback / kill / external:** invitation gates OFF; kill on hidden write or hardcoded fallback record; RPC apply owner-gated.
  - **Evidence / workflow note:** future invitation contract/tests; `PLANNED after authorization`.

- [ ] T204 [S1] Define web/app/universal-link routing for invitations.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** hostile origins and lifecycle returns can bypass confirmation or route to wrong account; FR-017/FR-019.
  - **Surface / platforms:** W URL, P launch, A app link/Back, I universal link, D protocol/fallback.
  - **Dependencies / owner:** T203; platform/security owners.
  - **RED → change → GREEN:** origin/scheme/version/replay/install/sign-in/account-switch cases → one canonical resolver and pending intent → explicit confirmation after auth with no duplicate write.
  - **Runtime & qualities:** privacy-safe URL payload; accessible/localized pending/error states; platform parity independent.
  - **Rollback / kill / external:** disable link handlers; kill on auto-join/open redirect/account confusion; association files/store config external.
  - **Evidence / workflow note:** future five-platform link matrix; `BLOCKED`.

- [ ] T205 [S1] Approve the exact QR dependency and camera boundary.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** unreviewed scanner/library adds supply-chain, camera and parsing risk; FR-019.
  - **Surface / platforms:** dependency/license/provenance and platform camera support; W/P/A/I/D.
  - **Dependencies / owner:** G-010 and T203; product/security owner.
  - **Baseline → change → GREEN:** inventory local/curated options → owner approves exact source/version/license/destination → lockfile/provenance/security review accepted before install.
  - **Runtime & qualities:** permission minimization, no image retention, accessible fallback/manual code, RTL/i18n.
  - **Rollback / kill / external:** do not install until approval; kill on paid/unclear license/unmaintained/high-risk finding; dependency addition requires approval.
  - **Evidence / workflow note:** dependency decision record; `ASK`.

- [ ] T206 [S1] Implement static QR display and explicit-confirmation scanning.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** QR can leak identifiers or auto-write from hostile visual input; FR-017/FR-019/FR-031.
  - **Surface / platforms:** social invitation display/scanner/manual fallback; W/P/A/I/D capability matrix.
  - **Dependencies / owner:** T203–T205; social/platform/security owner.
  - **RED → change → GREEN:** malformed/oversized/replay/screenshot/cancel/permission-denied/background cases → minimal generator/scanner around canonical parser → inert decode, preview and explicit confirm only.
  - **Runtime & qualities:** no camera frame retention; accessible manual alternative/eight locales/RTL/Back; child/unknown gate.
  - **Rollback / kill / external:** QR flag OFF/uninstall approved dependency if safe; kill on auto-write/data leak/permission trap; camera/store declarations external.
  - **Evidence / workflow note:** future QR adversarial/platform matrix; `BLOCKED`.

- [ ] T207 [S1] Implement terms acceptance, report and block controls.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** users cannot protect themselves from objectionable or abusive public content/contact; FR-018.
  - **Surface / platforms:** social onboarding/profile/challenge/invite/report/block; W/P/A/I/D.
  - **Dependencies / owner:** T197–T200, qualified policy terms; trust/safety owner.
  - **RED → change → GREEN:** unaccepted terms, blocked interaction, report dedupe/offline/error/retaliation cases → minimal authoritative controls → immediate block effect and durable privacy-safe report state.
  - **Runtime & qualities:** child-readable, accessible/eight locales/RTL; evidence avoids unnecessary content; no fake success.
  - **Rollback / kill / external:** public social OFF if controls unavailable; kill on delayed block/false report success; policy publication external.
  - **Evidence / workflow note:** future UGC safety flow matrix; `BLOCKED`.

- [ ] T208 [S1] Establish moderation, appeals and child-safety operations.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** controls without staffed response cannot make public social safe; FR-018/FR-033.
  - **Surface / platforms:** moderation queue/runbook/escalation/public standards; runtime clients W/P/A/I/D.
  - **Dependencies / owner:** G-007–G-009 and T207; qualified trust/safety/legal operators.
  - **Baseline → change → GREEN:** no named operator/SLA → owner-approved staffing/process/standards/contact/drill → report-to-action/appeal/escalation evidence within thresholds.
  - **Runtime & qualities:** least data/retention/access/audit; accessible localized reporting; CSAE/CSAM handling qualified externally.
  - **Rollback / kill / external:** social OFF if capacity unavailable; kill on missed SLA/unsafe retention/no contact; external publication/operations required.
  - **Evidence / workflow note:** moderation/child-safety runbook + drill; `OWNER/EXTERNAL`.

- [ ] T209 [S1] Prove social deletion, privacy, sync and offline behavior.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** deleted/blocked/social data can resurrect or leak across devices; FR-006/FR-018/FR-031.
  - **Surface / platforms:** social stores/RPC/events/tombstones/cache; W/P/A/I/D.
  - **Dependencies / owner:** T199–T208; data/privacy owner.
  - **RED → change → GREEN:** delete/block/account-switch/offline/restart/backup/replay cases → minimal tombstone/generation/cache correction → no resurrection/contact/discovery and truthful offline state.
  - **Runtime & qualities:** no public data fabrication; privacy-safe audit; accessible/eight-locale deletion states.
  - **Rollback / kill / external:** social OFF/forward data correction; kill on resurrection/cross-owner leak; live smoke owner-gated.
  - **Evidence / workflow note:** future social sync/deletion matrix; `BLOCKED`.

- [ ] T210 [S1] Complete public-social cross-platform and store truth verification.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** one-platform demo can be misreported as all-ages production readiness; FR-014–FR-019/FR-034.
  - **Surface / platforms:** all social routes on W/P/A/I/D plus Play/privacy/Terms/Data safety/store assets.
  - **Dependencies / owner:** T197–T209 and exact candidate; QA + owner/qualified reviewers.
  - **RED → change → GREEN:** five-platform/eight-locale/age/block/report/link/QR matrix → minimal fixes → every row direct PASS or explicit N/A/follow-up and declarations match.
  - **Runtime & qualities:** security/privacy/a11y/human/child/cultural gates separate; safe accounts only.
  - **Rollback / kill / external:** feature OFF; kill on any child/unknown/public safety or declaration gap; console publication owner-gated.
  - **Evidence / workflow note:** social release evidence packet; `BLOCKED`.

## A1 — Honest monetization decision and policy/runtime gates

- [ ] T211 [A1] Record the owner's ADR-MON-001 selection.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** ad plumbing could silently choose a product model or invent value; FR-020–FR-025.
  - **Surface / platforms:** monetization product policy; W/P/A/I/D applicability.
  - **Dependencies / owner:** G-001; product owner.
  - **Baseline → change → GREEN:** A/B/C all unselected → owner selects one or explicitly defers → decision scope, exclusions, success/kill criteria and platform impacts signed.
  - **Runtime & qualities:** privacy/age/consent/accessibility/i18n implications named; no runtime activation.
  - **Rollback / kill / external:** ads remain OFF; kill on inferred/multiple/ambiguous option; no console/code side effect.
  - **Evidence / workflow note:** ADR-MON-001 owner record; `ASK`.

- [ ] T212 [A1] Build exact legacy reward/rewarded runtime and bundle reachability proof.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** source imports/gates and dead UI can be confused with production readiness; FR-021/FR-022.
  - **Surface / platforms:** provider/settings/controller/config/prompt/callback/ledger/service gate; W/P/A/I/D.
  - **Dependencies / owner:** T162/T179; security/monetization owner.
  - **RED or baseline → change → GREEN:** import/state/bundle graph plus safe runtime probe with requests blocked → no behavior change → reachable/dead/gated/unknown nodes and side effects proven.
  - **Runtime & qualities:** no live ad request/ID/secret/PII; copy/a11y/i18n/age routes inventoried.
  - **Rollback / kill / external:** evidence only; kill on activation/deletion or reward-readiness claim; no external write.
  - **Evidence / workflow note:** future legacy reachability report; `LEGACY / UNVERIFIED` until complete.

- [ ] T213 [A1] Enforce placement and save-order exclusions for any future option.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** ads interrupt or condition habit/journal/private/emotional actions; FR-001–FR-004/FR-023/FR-025.
  - **Surface / platforms:** habit/journal/emotional/private/error/recovery routes and any proposed opt-in surface; W/P/A/I/D.
  - **Dependencies / owner:** T175–T180 and selected option; product/privacy owner.
  - **RED → change → GREEN:** route/call tests prove current/proposed violation if any → minimal deny/placement gate → commit-first, no automatic interstitial, no excluded-route prompt/request.
  - **Runtime & qualities:** accessible eight-locale non-coercive copy only; no private data/ad payload; core works OFF.
  - **Rollback / kill / external:** ads OFF; kill on pre-save/post-action automatic/sensitive placement; no console change.
  - **Evidence / workflow note:** future placement matrix; `BLOCKED` by T211.

- [ ] T214 [A1] Decide and verify frequency limits independently.
  - **Priority / evidence status:** P1 / FAIL.
  - **Failure / requirement:** current AdMob inventory shows no app/unit frequency cap and repeated prompts can pressure users; FR-024.
  - **Surface / platforms:** selected format/prompt controller/durable clock/console; W/P/A/I/D applicability.
  - **Dependencies / owner:** T211 and exact format; product owner + policy review.
  - **RED → change → GREEN:** rapid repeat/time-shift/reinstall/restart/account-switch baseline → minimal durable cap with fail-closed clock handling → boundary and multi-session tests GREEN.
  - **Runtime & qualities:** no fingerprinting; clear accessible copy; child/unknown stricter/OFF; i18n/RTL.
  - **Rollback / kill / external:** format OFF; kill on unbounded/bypassable pressure; console cap mutation requires owner approval.
  - **Evidence / workflow note:** future frequency contract + redacted console/runtime receipt; `BLOCKED`.

- [ ] T215 [A1] Verify age treatment independently.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** child/unknown can receive an ineligible request or adult format; FR-024/FR-032.
  - **Surface / platforms:** age-state resolver, GMA/request configuration, proposed format; W/P/A/I/D.
  - **Dependencies / owner:** T197–T198, T211, qualified Families review.
  - **RED → change → GREEN:** child/unknown/teen/adult/stale/spoof/account-switch matrix → minimal server-bound fail-closed treatment → no child/unknown request unless explicitly proven eligible.
  - **Runtime & qualities:** minimum age data, no profiling inference; accessible child-readable copy/eight locales.
  - **Rollback / kill / external:** ads OFF; kill on unknown-as-adult or SDK/declaration mismatch; Play/AdMob changes owner-gated.
  - **Evidence / workflow note:** future age/ad-request matrix; `BLOCKED`.

- [ ] T216 [A1] Verify consent and withdrawal independently.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** stale/cached consent can initialize/request despite denial or changed choice; FR-024/FR-032.
  - **Surface / platforms:** UMP launch update, `canRequestAds`, privacy-options entry, app preference; A primary, W/P/I/D format-specific.
  - **Dependencies / owner:** T211/T215; privacy owner.
  - **RED → change → GREEN:** required/not-required/denied/error/offline/stale/withdraw/restart matrix → minimal current-state gate → zero request before current authorization and core remains usable.
  - **Runtime & qualities:** no consent dark pattern; reachable keyboard/Back/AT/eight-locales privacy path; privacy-safe logs.
  - **Rollback / kill / external:** ads OFF; kill on request-before-consent or withdrawal failure; message changes owner-gated.
  - **Evidence / workflow note:** future UMP consent matrix; `BLOCKED`.

- [ ] T217 [A1] Verify geography behavior independently.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** regional consent/message assumptions can authorize the wrong request; FR-024.
  - **Surface / platforms:** UMP debug geographies/message assignment/selected format; A primary; W/P/D OFF or N/A only with reason, I requires separate WKWebView/native consent parity; all W/P/A/I/D recorded.
  - **Dependencies / owner:** T216 and approved test-device setup; privacy/policy owner.
  - **RED → change → GREEN:** EEA/US-state/other/unknown/VPN-change/offline cases using official debug controls → minimal fail-closed resolver → correct message/privacy entry/request outcome.
  - **Runtime & qualities:** do not infer precise location or persist unnecessary geography; localized accessible messages; no live traffic.
  - **Rollback / kill / external:** ads OFF; kill on unknown geography authorization; AdMob message edits owner-gated.
  - **Evidence / workflow note:** future geography receipt; `BLOCKED`.

- [ ] T218 [A1] Verify network, no-fill, load/show/error and recovery independently.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** network/ad failure can hang UI, create fake success or affect core action; FR-024/FR-025.
  - **Surface / platforms:** selected format controller/opt-in surface; W/P/A/I/D applicability.
  - **Dependencies / owner:** T211/T213; monetization QA.
  - **RED → change → GREEN:** offline/timeout/DNS/no-fill/load error/show error/background cases → minimal bounded state machine → truthful retry/dismiss, zero core mutation and no reward.
  - **Runtime & qualities:** fixed-code privacy-safe errors; accessible/eight-locale states; reduced motion/Back.
  - **Rollback / kill / external:** format OFF; kill on spinner trap/fake completion/repeated request/core rollback; official test responses only.
  - **Evidence / workflow note:** future network/no-fill matrix; `BLOCKED`.

- [ ] T219 [A1] Verify duplicate callbacks, process death and restart independently.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** lifecycle races can duplicate side effects, bypass cap/consent or resurrect a prompt; FR-024/FR-025.
  - **Surface / platforms:** selected format attempt/session state; W/P/A/I/D lifecycle.
  - **Dependencies / owner:** T214–T218; data/monetization owner.
  - **RED → change → GREEN:** double/out-of-order/late callback, force-stop, reload, account switch, relaunch → minimal idempotent owner-bound state → at-most-once non-reward side effect and current gates rechecked.
  - **Runtime & qualities:** no private payload; accessible restored/cancel state; core data unchanged.
  - **Rollback / kill / external:** format OFF/clear only scoped safe state; kill on duplicate/bypass/stale-owner effect; no live traffic.
  - **Evidence / workflow note:** future lifecycle/callback matrix; `BLOCKED`.

- [ ] T220 [A2A] Specify a genuine reward product only if option A is selected.
  - **Priority / evidence status:** P2 / UNVERIFIED.
  - **Failure / requirement:** treats/XP/badges/unlocks invented for ads provide no validated user value; FR-020–FR-022.
  - **Surface / platforms:** new product discovery/economy spec; W/P/A/I/D.
  - **Dependencies / owner:** T211=A and G-002; product owner/research.
  - **Baseline → change → GREEN:** no production reward system → research real user value/agency/fairness/abuse/data/accessibility → owner accepts product requirements and kill criteria before implementation.
  - **Runtime & qualities:** no fake participant evidence; privacy/child/fairness/i18n/platform risks; no AdMob activation.
  - **Rollback / kill / external:** discard scope; kill if value exists only to justify ads or encourages pressure; owner research approval external.
  - **Evidence / workflow note:** new separately authorized spec; `BLOCKED unless A`.

- [ ] T221 [A2B] Prove an exact voluntary non-reward format feasible only if option B is selected.
  - **Priority / evidence status:** P2 / UNVERIFIED.
  - **Failure / requirement:** rewarded terminology/unit can be dishonestly relabeled and violate UX/policy; FR-020/FR-023–FR-025.
  - **Surface / platforms:** exact proposed format and opt-in placement; W/P/A/I/D applicability.
  - **Dependencies / owner:** T211=B and G-003, policy/legal/UX review.
  - **Baseline → change → GREEN:** name exact format → primary-source applicability/local reachability/tradeoff/rejection analysis → owner and qualified reviewers approve a test plan.
  - **Runtime & qualities:** outside private/core/sensitive flows; no reward copy; age/consent/a11y/i18n/privacy and core-OFF path.
  - **Rollback / kill / external:** do not implement/request; kill if format depends on reward/coercion or lacks policy fit; console unit changes separately approved.
  - **Evidence / workflow note:** option-B feasibility decision; `BLOCKED unless B`.

- [ ] T222 [A2C] Harden ads OFF only if option C is selected or while no choice exists.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** reachable provider/settings can initialize despite no honest model; FR-020/FR-022/FR-025/FR-032.
  - **Surface / platforms:** provider/settings/controller/native plugins and declarations; W/P/A/I/D.
  - **Dependencies / owner:** T211=C or safe default plus T212; core/platform owner.
  - **RED → change → GREEN:** detect any initialization/request/prompt under undecided/OFF → smallest fail-closed gate while preserving legacy files → zero SDK request and core paths GREEN.
  - **Runtime & qualities:** truthful accessible settings/copy in eight locales; no secret/PII; platform graceful N/A/OFF.
  - **Rollback / kill / external:** keep server/client kill switch OFF; kill on SDK request or core regression; declaration correction owner-gated.
  - **Evidence / workflow note:** future five-platform ads-off proof; `PLANNED after authorization`.

- [ ] T223 [A2] Run official test-ad and Ad Inspector evidence only after a model passes planning.
  - **Priority / evidence status:** P1 / UNVERIFIED.
  - **Failure / requirement:** console metadata/test callback can be mistaken for policy-safe runtime; FR-023/FR-024.
  - **Surface / platforms:** authorized A test device, exact candidate, UMP/test unit/Ad Inspector; W/P/D OFF or N/A only with reason, I separately `UNVERIFIED`; all W/P/A/I/D recorded.
  - **Dependencies / owner:** T211 plus T213–T222 applicable branch and exact artifact; owner/test operator.
  - **RED → change → GREEN:** prove test device/IDs/zero live traffic → run load/show/dismiss/error and inspect request → exact expected gated behavior with no fake reward/core effect.
  - **Runtime & qualities:** redacted receipts, no IDs/tokens; accessible exit; age/consent/geography evidence bound.
  - **Rollback / kill / external:** ads OFF/test config removed from release; kill on live request/demo ID in release/unexpected data; external device/AdMob access approved.
  - **Evidence / workflow note:** future redacted test-ad/Inspector packet; `OWNER/EXTERNAL`.

- [ ] T224 [A2] Reconcile AdMob, app-ads.txt, messages, caps, inactivity and Play declaration truth.
  - **Priority / evidence status:** P1 / FAIL.
  - **Failure / requirement:** Ready label coexists with zero traffic/inactivity/no caps and cannot prove readiness; FR-023–FR-025/FR-034.
  - **Surface / platforms:** AdMob app/unit/policy/messages/app-ads/account and Play ads/Data safety/audience; A primary, I separately gated, W/P/D OFF or N/A only with reason; all W/P/A/I/D recorded.
  - **Dependencies / owner:** selected option and exact candidate; product/privacy owner.
  - **Baseline → change → GREEN:** fresh read-only inventory → owner-authorized minimal external changes only if required → read-back/crawl/runtime evidence matches exact shipped behavior.
  - **Runtime & qualities:** no IDs/financial/private details in durable receipts; all-age/locale/accessibility impacts; core works OFF.
  - **Rollback / kill / external:** leave/return ads OFF through authorized action; kill on account/policy/declaration mismatch; every console mutation owner-gated.
  - **Evidence / workflow note:** current read-only facts in `recovery-audit.md`; closure `OWNER/EXTERNAL`.

## R4–R6 — Exact artifact, store truth, internal test and staged rollout

- [ ] T225 [R4] Bind release identity, signing and Firebase inputs.
  - **Priority / evidence status:** P0 / FAIL.
  - **Failure / requirement:** wrong version/certificate/config can ship an unverifiable app; FR-010/FR-034.
  - **Surface / platforms:** A Gradle/package/version/signing/Firebase; W/P/I/D metadata impact explicit.
  - **Dependencies / owner:** T162/T169, G-014/G-015 and fresh Play maximum; release owner.
  - **RED → change → GREEN:** fixed-code readiness detects missing/mismatch without printing values → supply approved inputs and versionCode max+1 → config/release checks GREEN.
  - **Runtime & qualities:** secret-safe; no user data; a11y/i18n N/A; other-platform versions not prematurely published.
  - **Rollback / kill / external:** remove only local secret inputs from lane; kill on certificate/project/version ambiguity; owner-controlled secret input required.
  - **Evidence / workflow note:** redacted release-input receipt; `OWNER/EXTERNAL`.

- [ ] T226 [R4] Build and hash one exact signed AAB sequentially.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** mutable/concurrent build output invalidates evidence; FR-010/FR-012.
  - **Surface / platforms:** web build → Capacitor sync → Android release bundle; A artifact, W/P/I/D parity noted.
  - **Dependencies / owner:** T225 and all selected source gates; release engineer.
  - **RED → change → GREEN:** clean build readiness and artifact inventory baseline → single sequential build → package/version/hash/size/cert/input commit manifest matches.
  - **Runtime & qualities:** production-data-integrity before and bundle after; secrets/PII/demo IDs absent; a11y/i18n tested later.
  - **Rollback / kill / external:** discard local artifact, never overwrite evidence; kill on mutation/hash/config mismatch; no upload yet.
  - **Evidence / workflow note:** exact AAB manifest; `BLOCKED`.

- [ ] T227 [R4] Inspect/install generated splits and run exact-artifact verification.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** source tests/build success do not prove packaged native/profile/runtime behavior; FR-010/FR-011.
  - **Surface / platforms:** bundletool splits, manifest, mapping/symbols/profiles/native libs, API 36 install/upgrade; A, W/P/I/D explicit follow-ups.
  - **Dependencies / owner:** T226; release/Android/QA owners.
  - **RED → change → GREEN:** inspect current artifact → any defect makes candidate FAIL/new version → exact splits launch/upgrade/retain data and pass R2/R3/security/performance matrices.
  - **Runtime & qualities:** eight locales/RTL/AT/reduced motion/privacy/security; test data only; physical-device limitations explicit.
  - **Rollback / kill / external:** uninstall test splits/discard candidate; kill on any artifact/runtime mismatch or missing symbol/profile/native proof; devices may be external.
  - **Evidence / workflow note:** exact-artifact evidence manifest; `BLOCKED`.

- [ ] T228 [R5] Reconcile legal, privacy, Play and store truth to the exact AAB.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** current app access/audience/assets/declarations can contradict shipped behavior; FR-034 and US8.
  - **Surface / platforms:** Privacy/Terms/deletion, Play app content/Data safety/ads/audience/health/access/store locales/assets; A candidate, W/P/I/D policy links.
  - **Dependencies / owner:** T227, G-008/G-009/G-016/G-017 and ADR/social scope; owner + qualified reviewers.
  - **Baseline → change → GREEN:** source/AAB/console/doc matrix finds contradictions → authorized minimal corrections → read-back and qualified review bind exact candidate.
  - **Runtime & qualities:** all eight locales/fallback truth, child/privacy/a11y reachability; no invented legal facts.
  - **Rollback / kill / external:** halt publication/authorized revert if candidate changes; kill on any mismatch/broken link/missing approval; console/public-doc writes owner-gated.
  - **Evidence / workflow note:** candidate truth matrix; `OWNER/EXTERNAL`.

- [ ] T229 [R5] Upload the exact hash to internal testing and validate it.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** unprocessed/untested or different artifact could reach production; FR-012/FR-034.
  - **Surface / platforms:** Play internal track/pre-launch/generated splits/testers; A only, W/P/I/D no publication.
  - **Dependencies / owner:** T227–T228 and G-019; release owner.
  - **Baseline → change → GREEN:** verify target/empty pending changes/hash/tester/access/rollback → upload once → processing, pre-launch and named tester matrix pass on same hash.
  - **Runtime & qualities:** safe test accounts/data; security/privacy/a11y/eight locales/physical-device gaps explicit.
  - **Rollback / kill / external:** halt internal/reject candidate; kill on hash mismatch/review-access/policy/crash/data issue; external write requires explicit approval.
  - **Evidence / workflow note:** redacted internal-track packet; `OWNER/EXTERNAL`.

- [ ] T230 [R6] Bind incident operator, alerts, thresholds and forward recovery drill.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** rollout cannot halt/recover without accountable operations; FR-013/FR-033.
  - **Surface / platforms:** Play vitals, sync/consent/policy telemetry, feature gates/runbook; A release with W/P/I/D incident impacts.
  - **Dependencies / owner:** T229 and G-021; named incident/release operators.
  - **Baseline → change → GREEN:** no verified operator/route/drill → owner binds names/windows/thresholds and approved simulation → alerts/halt/flags/v11-aware replacement meet targets.
  - **Runtime & qualities:** telemetry privacy/retention/access; no diary content; accessible incident user copy/eight locales if surfaced.
  - **Rollback / kill / external:** rollout remains stopped; kill on unreachable operator/unknown metric/stale gate; production drills separately authorized.
  - **Evidence / workflow note:** operations runbook/drill receipt; `OWNER/EXTERNAL`.

- [ ] T231 [R6] Promote the exact AAB to 10% only at an explicit checkpoint.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** first production exposure can expand without health/rollback proof; FR-012–FR-013/FR-034.
  - **Surface / platforms:** Play production 10% is A (Android-only publication); shared backend/service regressions are monitored for W/P/I/D and no release parity is inferred.
  - **Dependencies / owner:** T229–T230 and G-022; product/release owner.
  - **Baseline → change → GREEN:** exact hash/health/rollback/operator/policy review → explicit 10% action → retain defined-window vitals/sync/consent/policy evidence below thresholds.
  - **Runtime & qualities:** privacy-safe aggregate telemetry; accessibility/i18n/store truth; optional ads/social OFF unless separately passed.
  - **Rollback / kill / external:** halt/forward replacement; kill on threshold/policy/operator/hash gap; external production write.
  - **Evidence / workflow note:** 10% checkpoint/health packet; `OWNER/EXTERNAL`.

- [ ] T232 [R6] Promote the same AAB to 50% only at a new checkpoint.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** healthy-looking early data can be incomplete or artifact can change; FR-012–FR-013.
  - **Surface / platforms:** Play production 50% is A (Android-only publication); shared backend/service regressions are monitored for W/P/I/D and no release parity is inferred.
  - **Dependencies / owner:** T231 completed window and G-023; release owner.
  - **Baseline → change → GREEN:** verify same hash and complete 10% evidence → explicit 50% action → defined-window metrics/policy remain within thresholds.
  - **Runtime & qualities:** cohort/privacy/locale/device coverage documented; no human/platform overclaim.
  - **Rollback / kill / external:** halt/forward replacement; kill on rebuild/auto-increase/incomplete window/threshold breach; external production write.
  - **Evidence / workflow note:** 50% checkpoint/health packet; `OWNER/EXTERNAL`.

- [ ] T233 [R6] Promote the same AAB to 100% and close post-release monitoring only at explicit checkpoints.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** full exposure or early closure can hide late failures; FR-012–FR-013/FR-033.
  - **Surface / platforms:** Play production 100% and post-release window are A (Android-only publication); shared backend/service regressions are monitored for W/P/I/D and no release parity is inferred.
  - **Dependencies / owner:** T232 completed window and G-024; release/incident owner.
  - **Baseline → change → GREEN:** same-hash 50% health/rollback review → explicit 100% action → complete owner-defined post-release window with thresholds/policy healthy and incident ledger closed.
  - **Runtime & qualities:** privacy-safe metrics; all declarations/locales/accessibility support channels monitored; no absolute defect-free claim.
  - **Rollback / kill / external:** halt/forward replacement remains available; kill on any threshold/policy/operator gap; external production write.
  - **Evidence / workflow note:** 100% + post-release closure packet; `OWNER/EXTERNAL`.

- [ ] T234 [R6] Run final evidence review and protected handoff.
  - **Priority / evidence status:** P0 / UNVERIFIED.
  - **Failure / requirement:** stale/missing receipts or unrelated diff can be published as release proof; FR-035.
  - **Surface / platforms:** full selected diff, task/requirement/platform/evidence matrices; W/P/A/I/D plus store/ops.
  - **Dependencies / owner:** all selected release tasks; QA/release owner, independent Role 8/10 only if owner later permits.
  - **Baseline → change → GREEN:** rerun final focused/broad/artifact/security checks sequentially → correct only scoped issues → zero critical contradiction, exact counts/hashes and diff/status attribution.
  - **Runtime & qualities:** technical/runtime/human/legal/artistic/production proof separated; privacy/no-template/no-fake-data checks; all locales/platforms explicit.
  - **Rollback / kill / external:** handoff only; kill on any FAIL/material UNVERIFIED/unexplained file; commit/push/PR requires separate G-025.
  - **Evidence / workflow note:** future final analysis/handoff packet; `BLOCKED`.

## Current task summary

- Audit/recovery tasks complete: T161, T163, T164, T165.
- Owner decision required: T166, T197, T205, T211 and all applicable G-xxx gates.
- Monetization ON: `STOP`; legacy reward/rewarded: `LEGACY / UNVERIFIED`.
- Public social/child-or-unknown enablement: `STOP`.
- Exact AAB/internal/rollout: `BLOCKED / OWNER-EXTERNAL`.
- First safe implementation request after owner approval: T162 (clean lane), then T167–T174 (schema/types/data truth), not ads or public social.

Fresh one-worker RED ledger for future authorized slices: 23 failures across 8 files — single-line approval (1), v11 forward rollback (1), diary header/toolbar (2), Friends reflow (1), challenge completion/header reflow (2), Android diary touch targets (1), and Habits metrics test-provider integration (15). A focused rerun reproduced all 23. These map to T171/T175/T181/T186/T187/T190/T200/T202/T203/T230; no production or test fix is authorized by this planning audit.
