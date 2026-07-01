# Definition of Done (DoD)

> **Solo Developer Disclaimer**: This is a quality guideline for major releases - not a strict blocker for every commit. A critical production hotfix can skip non-essential manual checks, but you should track what was skipped and circle back. Automated gates (CI) always run regardless.

---

## Automated Gates (CI enforces these)

These run on every push to `main` and every PR via `.github/workflows/deploy.yml`:

| # | Gate | Command | Blocking? |
|---|------|---------|-----------|
| 1 | TypeScript | `npx tsc --noEmit` | Yes |
| 2 | ESLint | `npx eslint . --max-warnings=0` | Yes |
| 3 | Unit tests | `npx vitest run` (2650+ tests) | Yes |
| 4 | i18n completeness | `npm run i18n:check` (8 languages) | Yes |
| 5 | Production build | `npm run build` | Yes |
| 6 | E2E smoke | `npx playwright test --project=chromium` | Yes |
| 7 | Coverage report | `npx vitest run --coverage` | **No** (informational) |
| 8 | Security audit | `npm audit --audit-level=high` | **No** (informational) |
| 9 | Best-practices implied requirements gate | `npm run check:best-practices` verifies `docs/ai/BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md`, AGENTS, CI, drift, release, and completion wiring | Yes for agent/process/release-gate changes |

## Runtime Reliability Gates

These apply to performance, startup, sync, navigation, service worker, WebGL,
canonical orb, IndexedDB/Dexie, Supabase, offline queue, app lifecycle, or
cross-platform user-flow changes.

| # | Gate | How to verify | Blocking? |
|---|------|---------------|-----------|
| 1 | Runtime contract read | `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md` cited in the plan or report | Yes |
| 2 | Canonical orb invariant | `npm run check:canonical-orbs` | Yes for orb or visual primitive work |
| 3 | Chrome route smoke | `npm run smoke:chrome-performance` or route-specific Playwright perf proof with cold-boot, steady-state, LoAF blocking, and diagnostic long-frame metrics | Yes for performance claims |
| 4 | V1/V2 sync round trip | Perform source shell -> adjacent shell -> source shell check for changed data | Yes for shared data changes |
| 5 | Sync contract invariant | `npm run check:sync-contract`, including `runWithSyncLeaderLock()` for multi-tab delta ownership, `WRITE_SYNC_EVENT` outbox protection, and no fire-and-forget core event writes | Yes for sync, storage, Supabase, backup, offline queue, or hydration work |
| 6 | Delete anti-resurrection | Prove stale local state, backup, or delayed pull cannot restore deleted data | Yes for delete changes |
| 7 | Live account sync proof | `npm run check:github-sync-secrets` and `npm run smoke:sync-account` with a dedicated test account; missing credentials means UNVERIFIED, not PASS | Yes for account-level sync claims |
| 8 | Public deploy proof | `npm run ci:remote:wait` plus cache-busted public URL when the issue is public | Yes for public-user claims |
| 9 | Sync 100 percent closure matrix | `docs/ai/TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md` rows for the touched entity/platform are proved or marked `UNVERIFIED` | Yes for sync/account/cross-shell claims |
| 10 | Privacy-safe sync diagnostics | `npm run smoke:sync-health` or `window.__zenflowSyncHealth.snapshot()` with `?syncHealth=1` when diagnosing deployed sync; no payloads, entity ids, journal text, or habit names | Yes for public sync debugging claims |
| 11 | Telegram sync drill | `npm run smoke:telegram-sync-drill`; `PASS` requires every row to pass, `PARTIAL` or `UNVERIFIED` must be named in the Done Packet. Release CI must attach the `telegram-sync-drill` artifact from a freshly built preview. | Yes for sync/account/cross-shell claims |
| 12 | Task completion protocol | `docs/ai/TASK_COMPLETION_PROTOCOL.md` Done Packet lists scope, evidence, known gaps, rollback, and deploy state | Yes for claims that a task is complete |
| 13 | Telegram 20-idea ledger | `docs/ai/TELEGRAM_GRADE_20_IDEA_LEDGER.md` rows touched by the change are marked `PASS`, `PARTIAL`, `UNVERIFIED`, `FAIL`, or `WAIVED` with evidence | Yes for sync/runtime/account/release claims |
| 14 | iOS native gate | `npm run cap:sync:ios` plus the GitHub Actions `ios-gate` macOS simulator build for `ios/App/App.xcodeproj`; missing macOS/Xcode proof means iOS remains `UNVERIFIED` | Yes for iOS/WKWebView claims |
| 15 | Desktop EXE contract | `npm run check:desktop-exe-contract`; local artifacts require `npm run desktop:check` and `npm run desktop:release:check:dev`; public `.exe` claims require `npm run desktop:release:check`, `/desktop` Desktop Dock screenshot, WebView2 trace evidence, signed updater/code-signing status, and no visual/canonical orb regression | Yes for desktop runtime, download page, or `.exe` claims |
| 16 | Microsoft Store/MSIX contract | `npm run assets:logos:check`, `npm run desktop:store:assets:check`, `npm run desktop:store:package`, and `npm run desktop:store:check`; Store logo assets must be generated from the filter-free source with no hard-square thumbnail artifacts, web/PWA/Tauri/Android/iOS logo surfaces must stay in the same family, Store package identity must come from Partner Center Product Identity, and Store package/certification state stays `UNVERIFIED` until the generated package is accepted in Partner Center and Windows App Certification Kit or Store certification evidence exists | Yes for Partner Center, Store, MSIX, or Store-ready claims |
| 17 | Google Play AdMob/app-ads production contract | `npm run google-play:assets:check`; before production monetization, `public/app-ads.txt` must be generated and verified with `ZENFLOW_ADMOB_PUBLISHER_ID=pub-0000000000000000 npm run google-play:app-ads` and `npm run google-play:app-ads:check`, real AdMob app/ad unit IDs must pass `npm run google-play:admob:check`, live root-domain app-ads proof must pass `ZENFLOW_APP_ADS_PUBLIC_URL=https://your-developer-domain.example/app-ads.txt npm run google-play:app-ads:public-check`, public Play listing proof must pass `npm run google-play:public-listing:check`, and Play Console Ads/Advertising ID/Data safety proof must be current. Missing owner IDs, public crawler proof, or Play Console proof means Google Play production monetization remains `UNVERIFIED`, not PASS | Yes for Google Play, Android ads, AdMob, Advertising ID, or production monetization claims |

## Manual Checks (before major releases)

| # | Check | How to verify |
|---|-------|---------------|
| 1 | No new untyped `any` | Review diff for `any` escape hatches |
| 2 | Strings in i18n | No hardcoded user-visible strings in components |
| 3 | ARCHITECTURE.md read | Confirmed patterns before writing code |
| 4 | CHANGELOG.md updated | Entry under `[Unreleased]` for user-facing changes |
| 5 | Runtime matrix reviewed | Web/PWA/Android/iOS/desktop/phone impact noted or marked `UNVERIFIED` |
| 6 | Visual proof captured | Screenshot or trace for UI/motion changes, including phone and desktop when applicable |
| 7 | Sync closure reviewed | `docs/ai/TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md` checked for account, offline, delete, multi-tab, and V1/V2 impact |
| 8 | Sync diagnostics privacy checked | Run `npm run smoke:sync-health` or confirm public/debug sync evidence exposes only route/auth/online/queue/cursor/receipt metadata |
| 9 | Completion packet reviewed | `docs/ai/TASK_COMPLETION_PROTOCOL.md` status vocabulary used: `PASS`, `PARTIAL`, `UNVERIFIED`, `FAIL`, or `WAIVED` |
| 10 | 20-idea ledger reviewed | `docs/ai/TELEGRAM_GRADE_20_IDEA_LEDGER.md` touched rows are named in the Done Packet |
| 11 | Desktop EXE contract reviewed | `docs/ai/DESKTOP_EXE_RUNTIME_CONTRACT.md` read when desktop/WebView2/runtime packaging is touched |
| 12 | Microsoft Store/MSIX contract reviewed | `docs/ai/MICROSOFT_STORE_MSIX_CONTRACT.md` read when Partner Center, Store, MSIX, or Product Identity is touched |
| 13 | Best Practices Packet reviewed | `docs/ai/BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md` used when the user asks for best practices, full implementation, deep research, hidden gaps, or cross-platform quality |

## Release-Only (before store/web publish)

| # | Check | Reference |
|---|-------|-----------|
| 1 | Version bumped | `package.json` + `android/app/build.gradle` (versionCode + versionName) |
| 2 | Smoke checklist | `docs/SMOKE_CHECKLIST.md` - core flows verified |
| 3 | Git tag created | `git tag v<version> && git push --tags` |
| 4 | Release checklist | `docs/RELEASE_CHECKLIST.md` - full QA pass |
| 5 | Runtime contract | `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md` gates reviewed |

## Hotfix Exception

For urgent production fixes:
1. Automated gates (CI) still run - no bypassing
2. Manual checks can be deferred - create a follow-up task
3. Document what was skipped in the commit message: `fix(scope): description [hotfix, skipped: changelog]`

## Snapshot Tracking

Current quality state is captured in `tests.json` at project root. Update it after major releases.

---

*Consolidates: `tests.json`, `docs/RELEASE_CHECKLIST.md`, `docs/SMOKE_CHECKLIST.md`, `.github/workflows/deploy.yml`*
