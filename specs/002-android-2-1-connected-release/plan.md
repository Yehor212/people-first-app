# Implementation Plan: Android 2.1 Release Recovery

**Status:** planning complete only after `analysis.md` passes  
**Implementation authorization:** absent  
**Current release verdict:** STOP  
**Feature:** `002-android-2-1-connected-release`

## 1. Plan contract

This plan describes future, separately authorized work. It does not permit production edits, dependency changes, migrations, external writes, AAB generation/upload, publication or rollout in the current audit.

The recovery follows four independent tracks:

1. **Core Android release:** isolation → schema/types → save/data safety → API 36 navigation/layout → exact AAB → store truth → internal → staged rollout.
2. **Public social/all ages:** product/age/safety decision → backend authorization/moderation → public profiles/search/rankings/invites/QR → policy/runtime proof.
3. **Non-orb motion:** inventory/baseline → concepts/variants → owner selection → implementation/runtime/craft proof.
4. **Monetization:** ADR-MON-001 → exactly one of A/B/C → policy/UX/data/runtime proof; OFF until selected and proven.

The tracks share security, privacy, accessibility, i18n, evidence and operations gates, but no track can borrow another track's PASS.

## 2. Technical context

- Stack: Capacitor 8, React 18, TypeScript, Vite, Tailwind/shadcn, Zustand, Dexie/IndexedDB, Supabase, Firebase, Sentry, AdMob, custom i18n.
- Local truth: IndexedDB/Dexie; Zustand publication follows hydration/commit.
- Platforms: Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, Desktop/Tauri.
- Locales: `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, `he`; `ar`/`he` are RTL/bidi risk.
- Android release: current Play production is 34/1.7.2 targeting SDK 35; Android 2.1 local identity evidence is inherited/stale until exact-candidate reproof.
- Recovery lane: 349 collapsed dirty entries at branch/HEAD snapshot; implementation doctor fails.
- Schema: local automation migration exists; generated Supabase types currently fail freshness.
- Monetization: production shell/settings can reach parts of the SDK gate, but prompt/reward legitimacy/runtime are not proved; all reward/rewarded paths are `LEGACY / UNVERIFIED` and OFF.
- Public social: requested scope materially exceeds inherited challenge-only contract and is a new high-risk sub-spec.
- Motion: canonical orb frozen; non-orb inventory/concepts/human selection still required.

## 3. Primary-source constraints

The detailed source register is in `research.md`. Planning depends on these current rules:

- Google Play requires API 36 for applicable new apps/updates from 2026-08-31; current console shows 2026-08-30 for this account/locale.
- Android 16 makes edge-to-edge/predictive Back/adaptive-window and locale/font behavior candidate-wide concerns.
- Play staged rollout is explicit and controlled; it does not automatically increase and must use the same release artifact.
- Families/all-ages participation changes age-screen, identifier, ads, SDK and declaration requirements; unknown/child state must not be optimistically treated as adult.
- UGC/social applications need terms acceptance, report/block and continuing moderation; social apps also need published child-safety standards and a point of contact.
- Google rewarded ads grant an in-app reward. Without a genuine reward, existing rewarded units cannot be relabeled as an honest non-reward format.
- UMP state must refresh and ad requests depend on current `canRequestAds`; test ads/Ad Inspector precede any authorized live validation.
- WCAG 2.2 reflow, focus-not-obscured, target size and motion criteria apply to the affected UI, while human acceptance remains separate.

## 4. Architecture boundaries

### Preserve

- `src/pages/Index.tsx` remains the shell orchestrator; do not add a second hydration/lifecycle owner.
- Modal/sheet ownership remains in `ModalLayer`/`OverlayLayer` patterns with explicit Android Back.
- Dexie is local truth; production behavior never falls back to fabricated records.
- Sync uses stable identities, owner/generation fencing, tombstones, offline queues and forward-only release constraints.
- Theme tokens, 44px minimum/repository 48dp intent, safe areas, reduced-motion and RTL contracts remain mandatory.
- `ValenceOrb`/`MiniValenceOrb` remain canonical and frozen.

### Add only after authorization

- Public-social server authority and abuse controls live behind reviewed Supabase/RLS/RPC contracts, not client-computed truth.
- Invite/link/QR resolution has one canonical parser/resolver with inert decode and explicit confirmation before writes.
- Age state, consent and feature flags fail closed and are shared only through existing trusted state boundaries.
- Monetization implementation is selected from ADR-MON-001; legacy rewarded plumbing is not the default architecture.
- Non-orb motion follows a selected concept and existing effective-motion/lifecycle tokens rather than a new global animation framework.

## 5. Planned file/surface ownership

Exact files must be confirmed in a clean implementation lane before editing. Likely surfaces are listed for blast-radius planning, not as authorization.

| Track | Existing/future surfaces | Ownership boundary |
|---|---|---|
| Recovery | workspace protocol, release docs, evidence manifests | no production change until clean lane |
| Schema/sync | automation migration, generated types, sync contracts, backup/deletion/outbox | remote/local schema and rollback bound together |
| Core actions | habit persistence, journal transaction, publication handlers | commit first; ads independent |
| Android shell | MainActivity/themes, native Back bridge, V2 nav/sheets/safe areas | system/root and overlay ownership explicit |
| Reflow/a11y | five destinations, overlays/tables, locale files | eight locales, RTL, 200%, AT, reduced motion |
| Social | new feature module, RLS/RPC/migration, route/hub/profile/search/rank/invite/QR | separate high-risk sub-spec and gate |
| Monetization | current AdProvider/settings/controller/config/ledger/prompt plus selected new surface | preserve legacy until owner choice; OFF default |
| Motion | current non-orb owners and selected Gratitude/Let Go implementation | orb excluded; owner selection first |
| Exact release | Gradle/config/signing shape, bundletool receipts, Play/AdMob/store records | one candidate hash, no secrets in evidence |
| Operations | runbook, health ledger, rollback replacement and approvals | named human operator and external checkpoints |

## 6. Execution phases after authorization

### Phase P0 — Isolate and bind the candidate

1. Re-run edit doctor in a new locked `codex/` worktree from the owner-approved base.
2. Compare the 349-entry recovery manifest to the clean base; attribute every intended file and exclude unrelated/user work.
3. Reproduce current failures before any edits: constitution drift, type freshness and task-specific regressions.
4. Create a fresh implementation preflight token with test-first, skill routing, write set, rollback and platform matrix.
5. Stop on conflicts, unexplained generated artifacts, secrets/PII, policy bypasses or baseline ambiguity.

### Phase P1 — Establish schema/data truth

1. Owner chooses the approved migration target/replay path.
2. Verify migration/RLS/RPC contracts and rollback/forward-only behavior without exposing production data.
3. Regenerate Supabase types from the authoritative schema; do not hand-edit them.
4. Re-run type freshness, TypeScript, sync, deletion/tombstone, backup/import, process-death and PDI checks.
5. Bind any remote smoke to the dedicated authorized account flag; otherwise mark live parity `UNVERIFIED`.

### Phase P2 — Core action and ad independence

1. RED/characterize habit completion and journal save for commit ordering, publication, offline/restart/process death and failure.
2. Add negative controls proving no ad initialization/request/prompt/callback is required before or after either action.
3. Prove private/emotional/error/recovery routes cannot host ads or ad-oriented copy.
4. Prove ads OFF, denied consent, unknown age, offline, network error and plugin absence preserve core success.
5. Do not change legacy reward code in this phase unless separately authorized by ADR-MON-001.

### Phase P3 — Android 16 navigation, layout and accessibility

1. Generate source-owned inventory for every overlay/takeover/table and the five-destination journey.
2. RED each reproduced Back, focus, reflow, safe-area, IME, split-screen, RTL, localization or reduced-motion defect.
3. Make minimal fixes following existing shell/overlay architecture.
4. Re-run phone/tablet/landscape/split/freeform, gesture/three-button/predictive Back, process death/recreation/WebView reload/OAuth return/IME matrices.
5. Cover all eight locales, direct `en`/`ar`/`he` captures, automated a11y, TalkBack and named human AT review.
6. Record human/craft evidence separately from automation.

### Phase P4 — Non-orb motion concept gate

1. Inventory production reachability, trigger/exit, timers/RAF/canvas, lifecycle, focus, reduced motion and performance.
2. Capture hash-bound current baselines for normal/reduced motion on production-equivalent builds.
3. Produce 4–6 coherent ZenFlow-specific directions with constraints, not template names.
4. Produce three variants each for Gratitude Bloom and Let Go of a Thought.
5. Run the visual integrity critique; report technical/runtime/craft/motion independently.
6. Stop for G-012. No selected direction means no motion implementation.

### Phase P5 — Public social/all-ages discovery and safety

1. Resolve G-005–G-011: product scope, under-13 intent, neutral age state, moderation/appeals/SLA, child-safety owner, legal facts, QR dependency and backend authority.
2. Threat-model profile discovery, global/challenge ranking, invites/manual/link/QR, UGC, block/report, moderation and child/unknown cohorts.
3. Define data schemas, RLS/RPC, anti-enumeration/rate limits, authoritative ranking, deletion/retention, audit/privacy boundaries and feature flags.
4. RED hostile payload, IDOR, rank forgery, scraping, replay, self/duplicate/expired/revoked invite, cross-account, blocked-user and offline/restart paths.
5. Implement in slices only after safety controls and operator capacity exist; keep child/unknown/public gates OFF otherwise.
6. Reconcile runtime with Play audience, Families, UGC/child safety, Data safety, app access, privacy, Terms and store copy before enablement.

### Phase P6 — Monetization decision and selected branch

1. Owner selects exactly one ADR-MON-001 option.
2. **A:** create a new product spec for genuine user value/economy; do not start with AdMob integration.
3. **B:** name the exact voluntary non-reward format and placement outside sensitive/private/core-action flows; prove policy/UX/all-ages/legal feasibility before code.
4. **C:** harden OFF behavior and declaration truth; prove no initialization/request/prompt in denied/unknown/stale states.
5. For any future ad-enabled branch, separately test frequency, age, consent, geography, offline/network/no-fill, dismiss, duplicate callback, process death and restart.
6. Use test ads and Ad Inspector on authorized test devices before any live-serving evidence; preserve zero-secret redacted receipts.
7. Never call console Ready or an earned callback product readiness.

### Phase P7 — Exact AAB

1. Obtain G-014/G-015 through approved secret/config routes and validate shape without printing values.
2. Set versionCode from the fresh Play maximum plus one; keep platform metadata truthful.
3. Run web build → Capacitor sync → release bundle sequentially once for the candidate.
4. Capture commit, toolchain, inputs, version, SHA-256, size and signing-certificate digest.
5. Inspect bundle/splits, manifest, R8/mapping, native symbols, Baseline/Startup Profile, native page-size compatibility and absence of debug/test/demo configuration.
6. Install generated splits on API 36 and test cold/warm start, upgrade/data retention, all critical routes, process death, Back, locales, accessibility and performance.
7. Any fix produces a new candidate/version/evidence packet; old exact-artifact evidence becomes stale.

### Phase P8 — Store/legal/internal truth

1. Build a candidate-bound source ↔ AAB ↔ Play ↔ AdMob ↔ Privacy/Terms/deletion ↔ store asset matrix.
2. Resolve app-access mismatch and every applicable audience/ads/Data safety/health/permission/content/store declaration under owner authorization.
3. Obtain qualified child-safety/legal/localization approvals without inventing facts.
4. Upload the exact hash to internal testing only at G-019.
5. Retain Play processing, generated splits, pre-launch, tester/account/locale/device and policy evidence.
6. Stop on any artifact mismatch, crash/ANR, declaration contradiction, privacy leak, reviewer-access failure or missing required cohort.

### Phase P9 — Operations and staged rollout

1. Bind G-021 operator, alert route, backup/escalation, stage windows, post-release window, halt thresholds and recovery owner.
2. Drill fail-closed flags and forward-compatible replacement without using production data destructively.
3. At G-022, promote exact AAB to 10%; retain vitals/sync/consent/policy evidence for the defined window.
4. Repeat explicit G-023 and G-024 checkpoints for 50% and 100%; never auto-increase.
5. Halt on threshold or policy failure and follow the v11-aware replacement path; do not roll back to an incompatible binary.

## 7. Test-first/evidence model

Every executable task in `tasks.md` includes:

- stable ID and slice;
- user failure mode and requirement ID;
- exact surface and all five platform impacts;
- dependencies/owner;
- RED or characterization baseline;
- minimal change set;
- same-evidence GREEN plus blast radius;
- runtime/security/privacy/accessibility/i18n evidence;
- rollback/kill criteria;
- external side effect/approval and evidence path;
- current status.

If RED is impossible, the reason is recorded before editing and equivalent regression proof remains `UNVERIFIED`. Tests, assertions, scanners, thresholds and declarations are never weakened to obtain green output.

## 8. Verification layers

1. **Static/local:** typecheck, lint, i18n, accessibility, sync, production-data-integrity, security/Snyk, release config, diff/status.
2. **Runtime local:** browser/PWA, API 36 emulator and generated-split install with retained matrices.
3. **Exact artifact:** hash/signing/bundle/split/profile/native/config identity.
4. **Authenticated external:** Play/AdMob/Supabase truth, performed read-only first and written only at explicit gates.
5. **Human/qualified:** AT, visual craft, child safety, moderation operations, legal/localization review.
6. **Production:** internal/pre-launch/vitals/staged health, exact same AAB and explicit owner approvals.

No layer substitutes for the next.

## 9. Rollback strategy

- Planning: review/delete only this recovery packet if rejected; original artifact hashes are retained. No Git reset/clean is prescribed.
- Code: smallest slice-specific revert in the clean implementation lane, preserving unrelated user work.
- Data: forward-only correction with reviewed migration/tombstones/generation barriers; never ship a v10 binary after v11 state.
- Flags: public social, age-sensitive behavior and monetization fail closed on missing/stale/unknown state.
- Release: halt the staged rollout and deploy a reviewed forward-compatible replacement; do not reuse an unsafe older binary.
- External declarations: keep a before/after receipt and restore only through an owner-authorized console action if candidate truth changes.

## 10. Plan exit criteria

This plan is ready for owner review when:

- one specification-quality checklist and eight canonical domain checklists agree with the specification;
- the new task ledger covers every requirement/track/gate;
- `analysis.md` finds no critical internal contradiction;
- legacy rewards remain `LEGACY / UNVERIFIED` and OFF;
- public social, monetization, motion and core release dependencies remain explicitly separated;
- all failures/gaps are retained as `FAIL`, `UNVERIFIED`, `ASK` or `OWNER/EXTERNAL`;
- no production or external change appears in the audit diff.

Owner authorization must name the first bounded implementation slice. It does not automatically authorize later phases, Git publication, external writes or rollout.
