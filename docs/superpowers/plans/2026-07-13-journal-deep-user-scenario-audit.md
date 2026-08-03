# Journal Deep User-Scenario Audit Plan

**Goal:** Produce fresh, reproducible evidence for ZenFlow journal behavior across supported platforms, correct any reproduced defects test-first, and distinguish proven behavior from device- or owner-dependent checks.

**Scope:** V2 journal shell, current-day feed, entries, favorites, editor tools, photos and gestures, wallpaper and motion, password protection, email recovery, offline behavior, sync, backup/export, accessibility, localization, performance, privacy, and platform shells.

**Proof rule:** Web research, agent conclusions, old CI, and source inspection are supporting evidence only. A scenario is `PASS` only after a fresh local test, browser/runtime observation, native build/test, or exact-commit CI result. Missing physical devices, assistive technology, owner accounts, SMTP delivery, or multi-device credentials remain `UNVERIFIED`.

## Official Research Baseline

- Playwright user-visible, isolated, web-first testing: <https://playwright.dev/docs/best-practices>
- WCAG 2.2 focus, pointer, dragging, target size, status, and accessible authentication: <https://www.w3.org/TR/WCAG22/>
- Apple gesture and accessibility alternatives: <https://developer.apple.com/design/human-interface-guidelines/gestures/> and <https://developer.apple.com/design/human-interface-guidelines/accessibility>
- Android accessibility manual, analysis, and automated testing: <https://developer.android.com/guide/topics/ui/accessibility/testing>
- Pointer cancellation and pinch semantics: <https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event> and <https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures>
- Responsive image quality and performance: <https://web.dev/learn/design/responsive-images> and <https://web.dev/learn/images/performance-issues>
- Supabase password recovery, PKCE, SMTP, sessions, and native deep links: <https://supabase.com/docs/reference/javascript/v1/auth-resetpasswordforemail>, <https://supabase.com/docs/guides/auth/sessions/pkce-flow>, <https://supabase.com/docs/guides/auth/auth-smtp>, <https://supabase.com/docs/guides/auth/sessions>, and <https://supabase.com/docs/guides/auth/native-mobile-deep-linking?platform=swift>
- Tauri least-privilege capabilities and CSP headers: <https://v2.tauri.app/security/capabilities/> and <https://v2.tauri.app/security/http-headers/>

## Scenario Matrix

### Entry lifecycle and navigation

- Empty first use, current-day quote/prompt, create, autosave, explicit save, cancel, reload, reopen, edit, favorite/unfavorite, delete, and locked entry.
- Current day versus historical day, calendar navigation, month/year boundary, timezone change, DST boundary, and locale week/date formatting.
- Exactly four top rail controls plus the bottom disclosure control; favorites contain only explicitly favorited records; historical entries never leak into the current-day surface.

### Editor tools and media

- Prompt insertion, formatting, font family/size, text and page colors, theme, wallpaper, texture, voice, audio record/play/delete, and reduced-motion behavior.
- Photo permission denial, unsupported/corrupt/oversized/oriented files, one to the product limit of five photos, thumbnail/full-resolution races, add/delete/reopen, and backup/sync persistence.
- Tap, drag, pinch, keyboard alternative, pointer cancellation, orientation/app switching, bounds clamping, no accidental page pan, persisted transforms across mobile/desktop, and no visible pixelation at supported display sizes.

### Authentication, privacy, and recovery

- Set, unlock, wrong password, lockout/retry, biometrics availability/denial, remove protection, and preservation of encrypted records.
- Password reset and magic link on same device, different device, expired/replayed link, email scanner or in-app browser, deep-link handoff, new-password screen, session establishment, and cancellation/recovery.
- Account switching, owner isolation, no journal content or unnecessary PII in logs/Sentry, custom SMTP readiness, and least-privilege native/desktop permissions.

### Data integrity and resilience

- Offline create/edit/delete, reconnect, duplicate events, tombstones, conflicts, interrupted save/import/sync/reset, quota exhaustion, and stale service-worker cache.
- Full/partial/legacy/malformed/over-capacity backup, export/import round trip, migrations, rollback behavior, and same-account multi-device convergence.
- Crash/reload, background/foreground, app switch, network switching, slow/failed requests, actionable errors, and retry without data loss.

### Platform, accessibility, and experience

- Web/PWA install, offline launch, update/reload, safe areas, virtual keyboard, responsive desktop/mobile layouts, and zoom at 200%/400%.
- Android back, lifecycle, permissions, deep links, SystemBars; iOS/WKWebView safe areas, keyboard, orientation, lifecycle, VoiceOver; Desktop/Tauri resize, keyboard/mouse, offline, and capabilities.
- Keyboard-only flow, focus order/return/trap, visible and unobscured focus, screen-reader labels/status messages, 44px targets, high contrast, reduced motion, long translations, and `ar`/`he` RTL.
- Privacy-respecting, nonjudgmental copy; predictable recovery from mistakes; no coercive prompts; comprehensible loading/uncertainty/error states.

### Performance and operations

- Empty journal and large-history profiles, five large photos, long rich text, slow network, CPU throttling, memory pressure, layout shift, image decode quality, startup, save latency, and animation stability.
- Fresh exact-commit CI, production-equivalent local build, cache-busted public route, console/network evidence, security scan, dependency audit, and release rollback evidence.

## Execution Sequence

1. Run the full Vitest suite and all journal Playwright specifications with bounded concurrency; record fresh counts instead of preserving a planned count.
2. Run `check:all`, sync/auth/data-integrity/accessibility/i18n/orb gates, Chrome performance smoke, security suite, and dependency audit.
3. Execute desktop and mobile browser scenarios against a production build; capture screenshots, console, network, gesture, persistence, offline, RTL, and reduced-motion evidence.
4. Run Android and iOS build/unit/lint/simulator gates and Tauri checks available on this host; label missing physical-device checks `UNVERIFIED`.
5. Have the nine non-coordinator orchestra roles independently inspect disjoint risks and return evidence-backed `GO`, `STOP`, or `ASK` findings.
6. For every reproduced defect, add the smallest red regression test before production edits, implement the scoped fix, rerun the red test green, then rerun blast-radius and visual checks.
7. Repeat independent review after fixes. Completion requires zero unresolved `P0/P1`, no unexplained `P2` in changed scope, clean worktree or explicit change ledger, and a final `PASS/FAIL/UNVERIFIED` packet.

## Acceptance And Kill Criteria

- `PASS`: fresh deterministic evidence proves the claimed behavior on the named platform/configuration.
- `FAIL`: the behavior is reproducibly wrong, data-risking, inaccessible, insecure, or materially confusing.
- `UNVERIFIED`: the required device, credential, SMTP delivery, assistive technology, external service, or reproducible harness is unavailable.
- `STOP`: any data loss, cross-account leak, auth bypass, broken recovery, inaccessible critical action, runtime crash, or exact-commit CI failure.
- No claim of “all users,” universal preference, physical-device parity, or 100% defect absence is allowed without matching evidence.

## Fresh Evidence Ledger — 2026-07-13

- Full Vitest: `557` files passed; `6,645` tests passed; `14` explicit todos; exit `0`.
- `npm run check:all`: typecheck, ESLint, 8-language parity/deep checks, translation quality, hardcoded-color, canonical-orb, logo-asset, visual, and V2 paper-theme gates passed.
- Journal browser matrix: `28/28` passed across desktop Chromium and Mobile Chrome projects with bounded concurrency.
- Wallpaper matrix: Web/PWA `6/6`; desktop/Tauri browser runtime `6/6`; Android Chromium/WebView simulation `8/8`; iOS WebKit simulation `9/9`.
- PWA production-service-worker runtime: `2/2` applicable scenarios passed; two browser/project mismatches were explicitly skipped by the matrix.
- Data and security: `409` sync invariants passed; production-data-integrity scanned `2,095` paths with `0` errors and `0` warnings; `npm audit --audit-level=high` reported `0` vulnerabilities; Snyk Code reported `0` issues.
- Recovery: tracked journal Magic Link proof packet passed all eight status checks. Local SMTP apply remains `UNVERIFIED` because the current process does not contain the owner-only production SMTP environment.
- Visual artifacts: `output/playwright/journal-final-desktop-20260713.png` and `output/playwright/journal-final-mobile-20260713.png`.
- `UNVERIFIED`: physical Android/iOS devices, VoiceOver/TalkBack/Switch Control, real HEIC decode and photo quality under measured DPR/memory/quota pressure, signed Tauri installer/update rollback, live multi-device convergence, current production SMTP apply, and cache-busted public deployment of this uncommitted snapshot.
