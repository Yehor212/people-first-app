# Android Play API36, Auth, and AdMob No-Mock Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reach a fresh Google Play and AdMob `PASS` for ZenFlow Android 2.1.2 (versionCode 39): target SDK 36, no active API35 policy violation, real Google and Telegram authentication, one production Habits banner, and no mock/sample/demo production data or ad identifiers.

**Architecture:** Treat repository integrity, signed-artifact identity, Play policy state, release publication, Play-installed runtime, and AdMob serving as separate gates. Remediate the policy warning by reversibly pausing only the thirteen obsolete API35 closed-test tracks; do not delete historical bundles, tester lists, or production data. Upload and publish the already verified versionCode 39 AAB only after Google's new upload-certificate activation time, then verify real OAuth and advertising behavior from the Play-installed artifact.

**Tech Stack:** Google Play Console, Google AdMob/UMP, Capacitor 8 Android, React/TypeScript/Vite, Supabase Auth, Telegram OIDC, Google Identity, repository release/PDI checkers, Android package and signing tools.

**Spec:** `docs/RELEASE_CHECKLIST.md`, `docs/release/google-play/ADMOB_OWNER_FINALIZATION_RUNBOOK.md`, `docs/auth-facebook-telegram-setup.md`, `docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md`, and the live Play/AdMob console evidence captured on 2026-08-25.

## Global Constraints

- Production runtime and release evidence must contain no mock, fake, demo, sample, placeholder, canned, synthetic, or fallback business records.
- Production AAB must contain the real AdMob app ID and exactly one intended production banner ID; Google sample IDs and extra reachable ad units are release blockers.
- Test doubles remain allowed only inside isolated tests and must not enter production source reachability, `dist`, APK, AAB, Play declarations, or readiness evidence.
- Never print, commit, log, or paste upload-key passwords, OAuth secrets, Telegram tokens, Supabase service credentials, or user data.
- Keep Web/Vite, installed PWA, iOS/WKWebView, and Desktop/Tauri ad-free; this monetization release is Android banner-only.
- Do not delete App Bundles, mailing lists, testers, tracks, or production data. Pausing an obsolete closed-test track is the reversible policy remediation; track resumption is the rollback.
- Two empty historical closed-test tracks (`1.1.1`, `1.4.1`) are not flagged and are outside the remediation set.
- A local build, console draft, upload, review submission, or publication notification is not final proof. Final release status requires `Available in Google Play` for versionCode 39 plus Play-installed runtime evidence.
- No ad click is permitted during verification. Serving proof uses banner rendering and AdMob request/impression counters only.

## Explicit Requirements

- Make Google Play API36 compliance show `PASS` before the 31 August 2026 deadline.
- Publish Android 2.1.2 versionCode 39 when a new upload is necessary and allowed.
- Ensure Google and Telegram authentication work for real users.
- Ensure the new release can show the intended AdMob banner under the product policy.
- Prohibit mock/sample/demo data and fake readiness evidence.
- Execute the plan and keep the goal active until all required evidence is obtained.

## Implied Requirements

- Preserve historical artifacts and tester configuration while removing their active policy effect.
- Bind every positive claim to the exact package, versionCode, target SDK, signer, artifact hash, and current console state.
- Confirm Ads, Advertising ID, Data safety, privacy policy, `Contains ads`, UMP/CMP, and AdMob Policy Center declarations match the exact versionCode 39 artifact.
- Verify OAuth callback ownership, session creation, logout/account switching, and absence of credential leakage from a Play-installed build.
- Verify banner eligibility, consent, protected-surface exclusion, lifecycle cleanup, rotation/reflow, offline/no-fill behavior, and withdrawal without synthetic ad success.
- Keep a rollback path for closed tracks and the production rollout.

## Current Evidence Baseline

- Production `2.1.1 (38)` is available in Google Play at 100% in 177 countries/regions and its App Bundle reports target SDK 36.
- Play Policy Center still reports an unresolved API36 requirement because thirteen separate active closed-test tracks contain target SDK 35 releases.
- The thirteen flagged tracks were last updated from 21 January through 11 February 2026 and are older than production 2.1.1.
- Track `Закрите тестування - 1.7.0` uses mailing list `Test zen` with 19 users; pausing the track preserves the list and moves eligible users to the newer production path.
- New upload-certificate activation is server-blocked until `2026-08-27 14:56:24 UTC`.
- Signed candidate: `/Users/yehor/Library/Application Support/ZenFlow/Releases/zenflow-2.1.2-39-api36-play-upload-newkey-signed.aab`.
- Candidate SHA-256: `c705ca015b95abccbe827bc6c561af981e9c3f6f0617d321fe75183b9c864a89`.

## Platform Matrix

| Surface | Planned status | Reason and evidence path |
| --- | --- | --- |
| Web/Vite | N/A | No web code or ad runtime change; public auth visibility remains a blast-radius smoke only. |
| Installed PWA | N/A | No PWA release change; production ads remain disabled. |
| Android/Capacitor | IN SCOPE | Exact AAB, Play policy, Play-installed auth, consent, banner, lifecycle, and rollback proof required. |
| iOS/WKWebView | N/A | Ads remain disabled and no iOS release is authorized by this Android task. |
| Desktop/Tauri | N/A | Ads remain disabled and no desktop release changes. |
| Store/Release | IN SCOPE | Closed tracks, API36 issue, upload signing, production rollout, declarations, and published state. |
| Accessibility | PARTIAL | No UI code changes; Play-installed banner must not cover content, navigation, safe areas, or touch targets. |
| Performance | PARTIAL | No visual downgrade is allowed; verify banner recreation and no duplicate/stale native banner across lifecycle/rotation. |
| Security and Privacy | IN SCOPE | Keychain-only password, OAuth secret isolation, UMP consent/withdrawal, Data safety, and no PII in evidence. |
| Testing | IN SCOPE | Fresh repository gates, artifact scan, console proof, OAuth sessions, and real serving proof. |
| Release and Operations | IN SCOPE | Publication monitoring, policy propagation, staged recovery, stop-rollout path, and final evidence packet. |

## Decision: Pause Obsolete API35 Closed Tracks

**Source-backed applicability:** Play Policy Center identifies the thirteen bundles as the remaining API35 problem, and each corresponding track exposes a reversible `Призупинити тестування версії` action.

**Local evidence:** Production 2.1.1 is newer and already target SDK 36; the flagged releases are historical 1.0.2.1 through 1.7.0 closed tests.

**Affected surface:** Google Play closed testing only. Production availability, App Bundles, mailing lists, and user data are preserved.

**Tradeoff:** Testers lose access to obsolete test binaries and receive the newer production version. Reject this action for any track that shows a current product experiment or a newer legitimate release; update that track to API36 instead.

**Verification path:** After each pause, the track must move from `Активні типи версій` to `Призупинені версії`; Policy Center must stop listing its AAB as blocking.

### Flagged Track Inventory

| Track | Track ID | Current release |
| --- | --- | --- |
| Закрите тестування - 1.0.2.1 | `4697656726205826494` | 5 (1.0.2.1) |
| Закрите тестування - 1.0.2.2 | `4699764792591234038` | 7 (1.0.2.3) |
| Закрите тестування - 1.0.2.4 | `4700446192244130204` | 8 (1.0.2.4) |
| Закрите тестування - 1.0.2.5 | `4700978866984789669` | 9 (1.0.2.5) |
| Закрите тестування - 1.1.0 | `4701585921813040551` | 12 (1.1.0) |
| Закрите тестування - 1.1.1.0 | `4699715735716761660` | 16 (1.1.1) |
| Закрите тестування - 1.2.1 | `4701741242955262376` | 18 (1.2.1) |
| Закрите тестування - 1.3.5 | `4700145962122775746` | 19 (1.3.5) |
| Закрите тестування - 1.4.0 | `4699018701657349200` | 20 (1.4.0) |
| Закрите тестування - 1.5.7 | `4701398083386335092` | 23 (1.5.7) |
| Закрите тестування - 1.5.9 | `4699408543026949097` | 24 (1.5.9) |
| Закрите тестування - 1.6.0 | `4701045800781207579` | 25 (1.6.0) |
| Закрите тестування - 1.7.0 | `4697449055783875318` | 26 (1.7.0) |

## Task 1: Freeze Baseline and Verify Reversible Targets

**Files:**
- Read: `docs/RELEASE_CHECKLIST.md`
- Read: `docs/release/google-play/ADMOB_OWNER_FINALIZATION_RUNBOOK.md`
- Read: `docs/auth-facebook-telegram-setup.md`
- Verify: live Google Play Console closed-testing inventory and Policy Center issue `4988635802004940314`

- [ ] Confirm package `com.zenflow.app`, production 2.1.1 (38), target SDK 36, 100% rollout, and `Available in Google Play`.
- [ ] Confirm exactly thirteen flagged target SDK 35 closed-test releases and match every track ID against the inventory above.
- [ ] Confirm each target is active, older than production, and exposes the reversible pause action.
- [ ] Record tester/country configuration without copying names, emails, or other PII into release evidence.
- [ ] Stop if a track contains a current experiment, a release newer than production, or a distinct form-factor program that requires continued testing.

**Acceptance criteria:** Thirteen exact reversible targets, zero production tracks, zero bundles selected for deletion.

**Verification:** Fresh Play Console snapshots and exact track URL/status checks.

## Task 2: Pause the Thirteen Obsolete API35 Closed Tests

**External state:** Google Play closed-testing tracks only.

- [ ] For each inventory row, open the exact track URL and re-confirm its heading and active release.
- [ ] Select `Призупинити тестування версії` and read the confirmation dialog before accepting.
- [ ] Confirm the dialog affects only that closed-test track, not production or its mailing list.
- [ ] Pause the track and verify its status is no longer active.
- [ ] Repeat until all thirteen flagged tracks are paused.
- [ ] Leave empty unflagged tracks 1.1.1 and 1.4.1 unchanged.
- [ ] Re-open the closed-testing inventory and confirm zero flagged API35 releases remain under active track types.

**Acceptance criteria:** Thirteen paused historical tracks; production 2.1.1 remains 100% available; no deleted bundles, tester lists, or user data.

**Rollback:** Resume an exact paused track only if its cohort must be restored; do not restore its API35 release after the enforcement deadline without an owner decision.

**Verification:** Closed-testing inventory shows the thirteen tracks under paused versions, and production release details remain unchanged.

## Task 3: Obtain Google Play API36 Policy PASS

- [ ] Re-open Policy Center issue `4988635802004940314` after the track changes.
- [ ] Open `Перевірені набори App Bundle` and confirm no active closed-test AAB remains blocking.
- [ ] Refresh after Google processing intervals without creating duplicate console changes.
- [ ] Confirm the API36 warning disappears or changes to an explicit resolved/compliant state.
- [ ] Confirm the app dashboard no longer says action is required by 31 August 2026.

**Acceptance criteria:** Policy Center no longer reports the API36 violation; production 2.1.1 (38) still reports target SDK 36 and 100% availability.

**Verification:** Fresh Policy Center, app dashboard, and production release-detail evidence. A propagation delay remains `UNVERIFIED`, never `PASS`.

## Task 4: Re-run the No-Mock and Signed-Artifact Gates

**Files:**
- Verify: `config/production-data-integrity-baseline.json`
- Verify: `config/production-data-integrity-waivers.json`
- Verify: `dist/**`
- Verify: `/Users/yehor/Library/Application Support/ZenFlow/Releases/zenflow-2.1.2-39-api36-play-upload-newkey-signed.aab`

- [ ] Confirm the release worktree and exact source tree remain clean and match the approved main tree.
- [ ] Run `npm run check:production-data-integrity` and require exit 0 with zero findings/warnings.
- [ ] Run `npm run check:production-data-integrity:diff` and `npm run check:production-data-integrity:staged`.
- [ ] Run a fresh production build only if current `dist` bytes are not bound to the approved source tree.
- [ ] Run `npm run check:production-data-integrity:bundle` against the exact production bundle.
- [ ] Run `npm run google-play:app-ads:check` with the real publisher family.
- [ ] Run `npm run google-play:admob:check` with the real Android app/banner IDs.
- [ ] Run `npm run google-play:admob:aab-check -- --aab <exact-signed-aab>` and require exactly one configured production banner, no sample IDs, and no extra IDs.
- [ ] Verify AAB SHA-256, package, versionCode 39, versionName 2.1.2, min SDK 26, target SDK 36, and signer fingerprint.
- [ ] Run the scoped secrets scan without printing secret values.

**Acceptance criteria:** All source/bundle/AAB integrity checks exit 0; baseline and waiver ledgers do not grow; no production mock/sample/demo reachability exists.

**Verification:** Fresh command outputs bound to source HEAD and AAB SHA-256.

## Task 5: Activate the New Upload Key and Publish VersionCode 39

**Dependency:** Google server time is later than `2026-08-27 14:56:24 UTC`.

- [ ] Confirm Play App Signing shows the new upload-certificate SHA-1 and SHA-256 fingerprints.
- [ ] Confirm no reset review or upload-certificate error remains.
- [ ] Open production release draft `2.1.2 (39)` and upload the exact signed AAB.
- [ ] Verify Play parses package `com.zenflow.app`, versionCode 39, versionName 2.1.2, min SDK 26, target SDK 36, and the intended signer.
- [ ] Verify Play produces no blocking errors about signing, API level, permissions, ads, or versioning.
- [ ] Preserve the eight localized release notes already saved in the draft.
- [ ] Review the final change summary, then start the production rollout and submit it for review.
- [ ] Confirm managed publishing state and record whether approval will auto-publish.

**Acceptance criteria:** Google Play accepts the exact AAB and the production release reaches submitted/review state without blocking errors.

**Rollback:** Before publication, discard only the new draft changes. After rollout starts, use Play's stop-rollout control if a release-critical regression appears.

**Verification:** AAB row inside the release, review summary, submission receipt, and exact release status.

## Task 6: Verify Play and AdMob Declarations

- [ ] Confirm Play declares Ads = Yes and `Contains ads` is visible where applicable.
- [ ] Confirm Advertising ID declaration matches the exact release manifest.
- [ ] Confirm Data safety covers current Google Mobile Ads SDK categories and does not claim collection the app does not perform.
- [ ] Confirm the public privacy policy describes Google Mobile Ads, UMP/privacy choices, Advertising ID behavior, SDK data categories, and withdrawal.
- [ ] Confirm AdMob app status is Ready, Google Play is linked, and `com.zenflow.app` is verified.
- [ ] Confirm banner unit `zenflow_android_habits_banner_v1` is the intended production unit.
- [ ] Confirm AdMob Policy Center has no violations or serving restrictions.
- [ ] Confirm EEA/UK/Switzerland and US-state privacy messages are active.
- [ ] Confirm app-ads.txt and the public listing resolve from current public endpoints.

**Acceptance criteria:** Store and AdMob declarations match the exact artifact and current product behavior; no owner action is required on policy or consent surfaces.

**Verification:** Fresh Play/AdMob console evidence and public endpoint checks. Payment/tax identity details stay private and are summarized only as action-required or no-action-required.

## Task 7: Reach Published and Verify the Play-Installed Runtime

**Dependency:** Play review and propagation complete.

- [ ] Wait for production status `Available in Google Play` for versionCode 39 and confirm intended rollout percentage/countries.
- [ ] Install or update ZenFlow from Google Play; verify installer provenance, package, versionCode 39, and versionName 2.1.2 on the device.
- [ ] Complete a real Google sign-in and verify a Supabase session is created and survives app return/relaunch.
- [ ] Log out, complete a real Telegram OIDC sign-in, and verify provider `custom:telegram`, display identity, callback return, and session persistence.
- [ ] Verify account switching cannot reuse the previous account's local or queued state.
- [ ] Use an eligible adult account, complete real consent, pass the product grace conditions, and open Habits.
- [ ] Confirm exactly one anchored adaptive banner renders below the Habits list without overlap.
- [ ] Confirm AdMob records a real request and impression; do not click the ad.
- [ ] Verify rotation/split-screen recreates the banner without duplicates.
- [ ] Verify background/foreground removes stale native banner state.
- [ ] Verify no banner/request on auth, onboarding, Settings, Privacy, mood check-in, bad/terrible mood, focus, focus reflection, journal, drawer, sheet, or modal surfaces.
- [ ] Revoke consent and confirm the banner is removed and no new request occurs.
- [ ] Verify offline, no-fill, and error behavior leaves content usable and never fabricates an ad or success state.

**Acceptance criteria:** VersionCode 39 is Play-installed; both real OAuth flows complete; one legitimate banner request and impression occur; all protected-surface and consent invariants hold.

**Verification:** Device package evidence, semantic UI/accessibility-node interaction, OAuth session/provider evidence without tokens, and fresh AdMob counters.

## Task 8: Final Closure and Operations Packet

- [ ] Recheck Play Policy Center API36 compliance after versionCode 39 publication.
- [ ] Recheck AdMob Policy Center, app readiness, CMP, app-ads.txt, and public listing after live serving.
- [ ] Review Android Vitals for versionCode 39 when data becomes available; do not infer health from missing metrics.
- [ ] Record exact source HEAD, AAB SHA-256, signer fingerprint, Play release status, policy status, auth results, and banner evidence.
- [ ] Review `git diff` and `git status`; ensure no secret, user data, generated credential, mock data, or unrelated change entered the worktree.
- [ ] Run `npm run check:no-ai-templates` because this plan is durable release documentation.
- [ ] Report every remaining runtime, human, payment, propagation, or metrics gap as `UNVERIFIED`.
- [ ] Mark the active goal complete only after every required acceptance criterion is satisfied.

**Done criteria:**

- [ ] Google Play API36 issue resolved.
- [ ] Production 2.1.2 (39) available in Google Play with target SDK 36.
- [ ] No mock/sample/demo production data, ad IDs, or fake evidence.
- [ ] Google and Telegram real sign-in pass on the Play-installed build.
- [ ] AdMob Ready/Policy/CMP pass and one legitimate banner request/impression verified.
- [ ] No required release item remains `FAIL` or unexplained `UNVERIFIED`.

## UNVERIFIED Ledger at Plan Creation

| Item | Reason | Impact | Closure path |
| --- | --- | --- | --- |
| Closed-track pause results | No external mutation has occurred yet. | API36 Policy Center remains FAIL. | Execute Tasks 1-3. |
| Upload key active | Google enforces activation until 2026-08-27 14:56:24 UTC. | VersionCode 39 upload blocked before that time. | Recheck App Signing after the timestamp. |
| VersionCode 39 publication | AAB is prepared but not uploaded/published. | Auth/ad fixes are not released. | Execute Task 5 and wait for review. |
| Play-installed auth | VersionCode 39 is not in Play. | Real Google/Telegram user outcome not yet proved. | Execute Task 7 after publication. |
| Live banner serving | No versionCode 39 Play request/impression exists. | Monetization remains UNVERIFIED. | Execute Task 7 without test ads or ad clicks. |
| Policy propagation time | Google processing duration is external. | Console may remain pending after correct changes. | Poll boundedly and preserve `UNVERIFIED` until explicit resolution. |

## Completeness Self-Review

- Spec coverage: API36 policy, closed tracks, signing, publication, auth, banner, consent, declarations, no-mock integrity, rollback, and final operations all have explicit tasks.
- Placeholder scan: no TODO/TBD, omitted-code marker, fake log, or generic completion claim is present.
- Boundary check: production, test tracks, artifact readiness, submission, publication, Play-installed behavior, and live AdMob serving remain separate evidence gates.
- Non-goals: no deletion of historical bundles/testers, no iOS/Desktop monetization, no paid dependency, no ad click, no fabricated test account or production data.
