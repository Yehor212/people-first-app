# Feature Specification: Android 2.1 Release Recovery

**Feature:** `002-android-2-1-connected-release`  
**Updated:** 2026-08-11  
**Lifecycle:** RECOVERY AUDIT AND PLANNING  
**Implementation:** NOT AUTHORIZED  
**Release:** STOP

## Goal

Recover a truthful, executable path for ZenFlow Android 2.1 without treating inherited code, checked tasks, console metadata, test ads, or old receipts as release proof.

The release goal includes:

1. a stable Android 16 / API 36 candidate built from a reviewed lane;
2. preserved local-first data and cross-platform contracts;
3. complete Android navigation, reflow, accessibility, locale, lifecycle, performance and exact-artifact evidence;
4. a separately governed all-ages public-social program;
5. a separately governed non-orb motion program with owner artistic selection;
6. a verified policy-safe monetization model without fictitious rewards, selected by the product owner and confirmed by fresh runtime evidence;
7. protected same-AAB internal testing and staged 10% → 50% → 100% rollout only after every gate is green.

The full requested scope is not currently feasible as a verified production rollout by the operational Play deadline of 2026-08-30. The official policy date is 2026-08-31; the earlier current-console date governs operations. A narrower core-app release with ads OFF is not blocked by monetization alone, but remains `UNVERIFIED` until its non-ad blockers are cleared.

## Clarifications

### Session 2026-08-11

- Q: Is this recovery run authorized to implement product behavior, run converge, publish Git changes, build/upload an AAB, or mutate external consoles? → A: No. It is audit-and-planning only; all those actions remain outside authorization.
- Q: May existing reward constants, callbacks, prompt UI, ledger, treats, XP, badges, unlocks, or rewarded units be activated, deleted, or treated as production-ready? → A: No. They remain `LEGACY / UNVERIFIED`; do not change or activate them without reachability proof and separate owner approval.
- Q: May habit completion or journal save trigger an automatic fullscreen ad, show an ad before confirmed persistence, or place advertising inside private or emotionally sensitive content? → A: No. The primary action must complete without advertising; only a future unobtrusive opt-in concept outside private content may be planned.
- Q: Which ADR-MON-001 option—A genuine reward product, B voluntary policy-safe non-reward format, or C ads fail-closed/OFF—has the owner selected? → A: None. Record all three options, keep ads fail-closed/OFF, and wait for an explicit owner choice before implementation.
- Q: What replaces the previous “working rewarded ads” objective? → A: A verified policy-safe monetization model without fictitious rewards, selected by the product owner and confirmed by fresh runtime evidence.

These five answers were supplied directly by the owner; no new question was inferred or answered on the owner's behalf. Their normative integration is FR-001–FR-005, FR-020–FR-025, FR-031–FR-035, US1, US6, ADR-MON-001, and the explicit non-goals below. Remaining owner gates are intentional decisions, not unresolved wording placeholders.

## Authority and non-goals

This specification authorizes planning documents and read-only diagnostics only. It does not authorize production code, dependencies, migrations, Edge Functions, console mutations, secrets, AAB creation/upload, internal-track publication, deploy, push, PR, merge, rollout, or convergence.

Explicit non-goals for this audit:

- do not activate, delete, or refactor legacy reward/rewarded code;
- do not create treats, XP, badges, unlocks, or any substitute currency;
- do not choose ADR-MON-001 on the owner's behalf;
- do not implement public social, QR, motion redesigns, or new reward economics;
- do not change the frozen canonical orb family;
- do not manufacture runtime, human, legal, store, security, or production evidence;
- do not reuse an old AAB or rebuild between release stages;
- do not run `speckit-implement` or `speckit-converge`.

## Evidence vocabulary

- `PASS`: the named bounded check was freshly observed against the recovery snapshot.
- `FAIL`: a required named check ran and failed or a current truth contradicts the requirement.
- `UNVERIFIED`: material evidence is unavailable or not run.
- `OWNER/EXTERNAL`: an owner choice, qualified review, secret/input, authenticated external change, human/device evidence, or publication authority is required.
- `LEGACY / UNVERIFIED`: production reachability or product legitimacy is not established; preserve fail-closed and do not activate/delete.

## User failure modes

### US1 — A completed action must be durable and interruption-free

As a user, when I complete a habit or save a journal entry, the primary action finishes and is confirmed from authoritative local persistence without an ad interrupting, delaying, conditioning, or obscuring it.

Acceptance:

- the save/complete transaction commits before success UI or any unrelated optional surface;
- no automatic fullscreen ad runs before or immediately after the action;
- no ad appears in private journal text, editor, emotional reflection, recovery, or error states;
- network/ad failure, consent state, age, geography, restart, duplicate callback, and no-fill cannot roll back or duplicate the primary action;
- core functionality remains usable with ads OFF, unavailable, denied, or unsupported.

### US2 — Android navigation and layout remain trustworthy

As an Android user, I can enter, use, and leave Orb, Habits, Diary, Planning, Settings and every nested overlay with system Back, visible Back/Close, keyboard/Escape where applicable, without accidental actions or lost committed state.

Acceptance:

- LIFO ownership is explicit for every sheet/modal/overlay;
- root Back delegates to Android rather than invoking a product action;
- predictive Back cancel/commit, process death, activity recreation, WebView reload, OAuth/settings return and IME states are covered;
- phone, tablet, landscape, split-screen/freeform, safe-area/cutout, 200% text and RTL do not clip critical actions;
- all eight locales have parity, placeholder integrity and bidi-safe behavior;
- motion reduction and assistive technology states are separated from human acceptance claims.

### US3 — A release artifact is exactly what was verified

As the release owner, I can trace one reviewed commit and build-input set to one signed AAB, generated splits, installed candidate, evidence manifest, internal test, rollout stages, rollback replacement and monitoring record.

Acceptance:

- target/compile SDK and manifest behavior satisfy API 36 without prohibited opt-outs;
- versionCode is greater than the Play maximum and versionName is correct for Android only;
- signing certificate digest, SHA-256, size, mapping, symbols, profiles, native libraries and test/demo configuration are captured without exposing secrets;
- bundletool-generated splits are installed and upgrade/data-retention tested;
- the same AAB, not a rebuild, moves internal → 10% → 50% → 100%;
- rollout never auto-increases and halts on explicit health/policy thresholds;
- release and rollback remain forward-compatible with schema v11.

### US4 — Public social is safe before it is public

As a user of any supported age, I am not exposed to public discovery, ranking, invitations, links, QR exchange, abuse, stalking, impersonation, or objectionable content until age treatment, consent, safety controls, moderation operations, legal declarations and backend authorization are proven.

Desired future surfaces:

- Friends;
- Challenges;
- public profiles and profile search;
- global leaderboard and challenge-specific ranking;
- invitation codes, links, static QR display and explicit-confirmation scanning.

Acceptance before any child/unknown or public enablement:

- a neutral age screen and durable age-state contract are owner-approved and declaration-aligned;
- child/unknown accounts default to public-social OFF;
- authenticated server authorization, RLS, rate limits, anti-enumeration, block/report, moderation, appeals, evidence retention and child-safety escalation exist;
- decode/scan is inert: no write, join, follow, friend, share or navigation side effect before explicit confirmation;
- hostile origin, unknown version/type, oversized payload, replay, revoked/expired/self/duplicate invite and cross-account state fail closed;
- no hardcoded person, challenge, rank, activity or success record appears when the source is unavailable;
- UGC terms acceptance, reporting/blocking and published child-safety standards are live and verified;
- the exact Play target-audience, Data safety, app access, privacy and store surfaces match runtime behavior.

### US5 — Motion improves meaning without losing control

As a user, non-orb motion supports comprehension and emotional safety without hiding completion, trapping focus, leaking lifecycle work, harming performance, or overriding reduced-motion preferences.

Acceptance:

- inventory every production-reachable non-orb animation by owner, trigger, exit, timer/RAF/canvas resource, lifecycle, focus, reduced-motion and platform behavior;
- create baseline videos before any redesign;
- create a 4–6 direction concept board and three variants each for Gratitude Bloom and Let Go of a Thought;
- stop for the owner's explicit artistic choice before implementation;
- verify cleanup on rapid close/background/restart and semantic completion without relying on animation;
- report Technical, Visual Runtime, Artistic/Craft, Motion, Model and Plan separately;
- the canonical orb is regression-only and is not redesigned.

### US6 — Monetization is honest and optional

As a user, ads never invent value, exploit a private/emotional moment, or become a condition for core functionality.

Acceptance:

- ADR-MON-001 is explicitly selected by the owner before implementation;
- option A is a new product scope, not an ad plumbing task;
- option B uses a voluntary format whose policy and UX do not depend on a fictitious reward;
- option C keeps all ad initialization, requests, prompts and callbacks fail-closed/OFF;
- rewarded terminology and “watch and earn” copy are forbidden while no genuine reward exists;
- existing reward constants, callbacks, prompt, ledger and units remain `LEGACY / UNVERIFIED`;
- frequency, age, consent, geography, network failure, no-fill, dismiss, duplicate callback, process death and restart have separate tests/tasks;
- UMP updates at launch, `canRequestAds` is current, privacy options are reachable, test devices use test ads, and child/unknown requests cannot receive personalized/ineligible ads;
- console Ready state is never treated as runtime or product-model proof;
- the app remains fully functional when ads are OFF.

### US7 — Private/local-first data remains authoritative

As a user, my journal, habits, mood, planning and automation data remain owner-bound, offline-capable, deletion-safe and non-fabricated across restart, sync and version upgrade.

Acceptance:

- IndexedDB/Dexie remains local truth; Zustand publishes only committed state;
- offline queue operations are stable-ID, idempotent, owner/generation fenced and privacy-safe;
- sync ordering, tombstones, deletion barriers, backup/import and N-1/forward-only behavior remain compatible;
- generated Supabase types and remote migration parity match before release;
- no production fallback invents records when source/cloud is unavailable;
- diagnostics use fixed codes/bounded metadata and exclude diary prose, identifiers and secrets;
- exact-AAB process-death/update testing covers primary commit, outbox, remote ack and deletion.

### US8 — Store and legal truth match the candidate

As the owner, I can verify that Privacy, Terms, deletion, Data safety, ads, health, app access, target audience, content rating, store copy/screenshots and child-safety disclosures describe the exact candidate without unsupported legal facts.

Acceptance:

- app access describes authenticated paths and provides an authorized review route if required;
- all eight store locales are current or use an explicitly approved fallback;
- screenshots/tablet assets show the current product;
- no health, exact-alarm, ads, social, child, data, or account-deletion declaration contradicts source/runtime;
- operator identity, jurisdiction, retention, lawful basis, international transfer, moderation/SLA and translations come from the owner/qualified reviewer, never the agent;
- source reachability and broken links are locally checked; legal sufficiency remains qualified external approval.

## Functional requirements

### Core/data

- **FR-001:** Habit completion and journal save MUST commit without advertising dependencies.
- **FR-002:** Success UI MUST follow confirmed local persistence; background sync MAY follow without redefining success.
- **FR-003:** Ads MUST NOT run before persistence confirmation or automatically immediately after it.
- **FR-004:** Ads MUST NOT appear inside diary prose, editors, private detail views, emotional check-ins, recovery or error states.
- **FR-005:** Missing authoritative data MUST produce loading/empty/unavailable/error state, never synthetic records.
- **FR-006:** Sync changes MUST preserve local truth, tombstones, queue idempotency, owner/generation boundaries and N-1 safety.
- **FR-007:** Generated Supabase types MUST be fresh against the reviewed schema before any release claim.

### Android/release

- **FR-008:** The candidate MUST target API 36 and satisfy Android 16 edge-to-edge, predictive Back, adaptive window and locale/font behavior.
- **FR-009:** Every takeover MUST declare Back/Escape/visible-exit/focus/scroll/safe-area ownership.
- **FR-010:** The exact signed AAB MUST bind commit, build inputs, version, certificate digest, hashes, size, splits, profiles, mapping, symbols and native-library checks.
- **FR-011:** Upgrade/data-retention/process-death and all critical routes MUST be exercised on generated splits from that AAB.
- **FR-012:** Internal, 10%, 50% and 100% MUST use the same hash and explicit owner approvals.
- **FR-013:** Numeric crash/ANR/startup/render/sync/policy thresholds MUST halt promotion; no automatic stage increase is allowed.

### Public social/all ages

- **FR-014:** Public social MUST be a separate high-risk sub-spec and feature gate.
- **FR-015:** Child/unknown accounts MUST fail closed for public discovery, global ranking, contact/invites and ad personalization until approved evidence exists.
- **FR-016:** Profile search and leaderboards MUST resist enumeration, scraping, IDOR, stalking, spoofed rank and cross-age contact abuse.
- **FR-017:** Invite/link/QR decoding MUST validate canonical scheme, version, type, origin, size, expiry, revocation, audience and signature/nonce where specified, with zero writes before confirmation.
- **FR-018:** Report, block, moderation, appeals, child-safety escalation and abuse-rate operations MUST exist before public enablement.
- **FR-019:** No QR dependency, RPC, public index or policy declaration MAY be added without separate owner authorization and reviewed provenance.

### Monetization

- **FR-020:** ADR-MON-001 MUST remain undecided until the owner explicitly selects A, B or C.
- **FR-021:** No treats, XP, badges, premium unlocks, pseudo rewards or reward-oriented copy MAY be created to justify ads.
- **FR-022:** Legacy reward constants/callbacks/UI/ledger MAY NOT be activated, deleted or treated as production until reachability and value are separately approved.
- **FR-023:** Option B MUST use a voluntary non-fictitious-value format and pass Play, AdMob, Families/all-ages, consent, privacy, legal and UX review before runtime testing.
- **FR-024:** Frequency, age, consent, geography, network/no-fill, dismiss, duplicate callback, process death and restart MUST be independently verified.
- **FR-025:** Monetization failure or absence MUST NOT block the core application.

### Accessibility/localization/motion

- **FR-026:** All user-facing changes MUST cover `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, `he`; `ar`/`he` MUST be RTL/bidi safe.
- **FR-027:** Critical targets MUST be at least 44 CSS px / repository 48dp intent, remain visible at 200% text, and not be focus-obscured.
- **FR-028:** Reduced motion MUST preserve meaning and completion without animation.
- **FR-029:** Non-orb motion implementation MUST wait for owner selection from retained concept/baseline artifacts.
- **FR-030:** Technical checks MUST NOT be reported as artistic or human acceptance.

### Privacy/security/operations

- **FR-031:** Diary prose, habit content, mood notes, auth tokens, secrets and unnecessary PII MUST NOT enter ad payloads, QR payloads, analytics, logs or evidence.
- **FR-032:** Public-social and monetization gates MUST default OFF on missing, stale, malformed, offline or unknown state.
- **FR-033:** Release monitoring MUST have a named operator, alert route, stage windows, halt thresholds, rollback artifact/process and post-release window.
- **FR-034:** Console/store changes, AAB upload, deployment and rollout MUST require an explicit owner checkpoint and verified target.
- **FR-035:** Evidence MUST bind command/tool, timestamp, commit/artifact hash, platform/device/configuration, pass/fail counts and limitations.

## Platform impact matrix

| Area | Web/Vite | Installed PWA | Android/Capacitor | iOS/WKWebView | Desktop/Tauri |
|---|---|---|---|---|---|
| Core save/complete | preserve Dexie-first behavior | update/restart proof required | process-death/WebView proof required | lifecycle parity UNVERIFIED | lifecycle parity UNVERIFIED |
| Public social | gated OFF until sub-spec | same plus link/install routing | app links/Back/camera permission | universal links/camera parity | link/QR capability decision |
| Monetization | graceful OFF/N/A unless chosen format supports web | OFF by default | primary audited surface; currently OFF | plugin/parity UNVERIFIED | OFF/N/A unless separately designed |
| Navigation/reflow | browser matrix | standalone/update matrix | full API 36 matrix | safe-area/Back-equivalent UNVERIFIED | wide/keyboard/window matrix |
| Motion | shared effective-motion contract | lifecycle/update | Android lifecycle/perf/video | WKWebView lifecycle UNVERIFIED | desktop resource/perf UNVERIFIED |
| Release | source/build checks | service-worker version parity | exact signed AAB + Play | no release mutation in this feature | no release mutation in this feature |

No platform row may be inferred from another. Android 2.1 publication does not authorize or claim iOS/Desktop/PWA release parity.

## Monetization decision record ADR-MON-001

**Decision:** not made.  
**Default before decision:** all ads fail-closed/OFF.

### Option A — genuine reward product

New product scope requiring evidence of user value, reward meaning, economy/abuse controls, accessibility, privacy, synchronization, fairness, expiry/reversal, support and owner approval. Ad plumbing cannot bootstrap this decision.

### Option B — voluntary policy-safe non-reward format

Permitted for investigation only if the exact format is honest without a reward and policy/legal/consent/all-ages/UX analysis proves applicability. A rewarded unit cannot be relabeled as non-reward. Runtime remains OFF until fresh test-device and console evidence passes.

### Option C — ads remain OFF

Preserves core-app behavior and removes monetization from the release critical path except for proving fail-closed behavior and declaration truth. This is the safe operational default, but the durable product choice still belongs to the owner.

## Success and kill criteria

### Planning success

- every old task is classified;
- requirements, plan, one specification-quality plus eight domain checklists, canonical tasks, threat model, external gates and feasibility agree;
- no artifact claims rewarded readiness or invents value;
- all owner/external decisions and evidence gaps are explicit;
- Spec Kit analysis finds no unresolved internal contradiction;
- final diff contains planning/evidence changes only.

### Release success

Release success is not achievable inside this audit. A future release requires all release-blocking tasks green against one exact signed AAB, owner approvals, internal validation, monitoring ownership and same-hash staged promotion.

### Immediate kill/stop criteria

- any ad before save confirmation, automatic post-action interstitial, sensitive-flow ad, or fictitious reward;
- child/unknown public-social or personalized/ineligible ad exposure without proven controls;
- stale/missing service gate treated as ON;
- synthetic user/social/reward records in production;
- source/remote schema or generated-type mismatch;
- AAB/hash/signing/version/config mismatch;
- unresolved critical/high security finding or privacy leakage;
- missing app access/target audience/Data safety truth;
- crash/ANR/startup/render/sync/policy threshold breach;
- missing owner/operator/rollback authority;
- rebuild between rollout stages.

## Owner decisions and external gates

The canonical list is [owner-external-gates.md](owner-external-gates.md). The critical unresolved decisions are ADR-MON-001, the all-ages/public-social product boundary, moderation/child-safety operator and SLA, legal facts/review, exact signing/Firebase inputs, QR dependency/RPC authority, owner artistic selection, incident operator/alerts, internal upload, and every rollout promotion.
