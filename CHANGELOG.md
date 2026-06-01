# Changelog

All notable changes to ZenFlow will be documented in this file.

## [2.0.0] - 2026-06-01

### Changed - V2 Release
- Bumped the public ZenFlow version to 2.0.0 across web, Android, iOS, and desktop metadata.
- Updated the in-app "What's New" source so the 2.0.0 release has visible user-facing notes.

---

## [1.7.1] — 2026-02-13

### Changed — Google-Only Authentication
- Removed email magic link and "Skip for now" from AuthScreen
- Removed email sign-in from Settings account section
- Google OAuth is now the only authentication method

### Fixed — ESLint Zero Warnings (Closure-Grade Audit)
- Fixed all 271 ESLint warnings across 96+ source files
- Added eslint-whitelist.md documenting 55 inline suppressions
- TypeScript strict mode: 0 errors, 0 warnings

---

## [1.7.0] — 2026-02-10

### Added — Premium Animated Tree
- **SVG animated tree**: Replaced canvas with Framer Motion + native SVG animations
- **5 growth stages × 4 seasons**: 20 unique tree visuals with smooth transitions
- **Falling particles**: Petals (spring), leaves (summer/autumn), snowflakes (winter) via zero-JS SVG animate
- **Stage 5 crown glow**: Sparkle shimmer effect for max-level trees
- **Seasonal decorations**: Cherry blossoms, sun dapple, fruits, snow caps

### Added — Treats Economy
- **Earn treats**: Habits (10), journal (8), mood tracking (5), breathing (5), focus (0.5/min)
- **Streak multiplier**: +10% per day, max 2x at 10-day streak
- **Spend treats**: Water tree (10 treats, +30% water, +50 XP), touch tree (free, +10 XP)
- **Tree XP system**: Stage progression from seed to sprout to sapling to tree to majestic tree

### Added — Non-Intrusive Ad System
- **Rewarded-only ads**: Fully opt-in, mood-aware, never during focus sessions
- **Watch ads to earn bonus treats**: Extra rewards for choosing to watch

### Added — Personal Journal
- **Voice journaling**: Record audio entries with transcription
- **Export & statistics**: Export journal data, view writing analytics
- **Biometric lock**: Secure private entries with fingerprint/face
- **Premium templates**: Guided prompts for gratitude, reflection, goals
- **Habit integration**: Link journal entries to tracked habits
- **Journal tutorial**: Interactive onboarding for new users

### Fixed — Comprehensive Audit (200+ Issues)
- **Home page**: 4 data bugs + UrgencyAlert rewrite + RTL/i18n fixes
- **Garden tab**: 39 fixes across 14 files (data, i18n, RTL, a11y)
- **Stats tab**: 28 fixes across 6 files (data, i18n, RTL, a11y)
- **Settings tab**: 27 fixes across 8 files (back handlers, touch, RTL, i18n)
- **Garden sub-panels**: 23 fixes across 8 files (RTL, i18n, touch, scroll lock)
- **Stale closure fix**: Rest mode data loss prevention (functional state updates)
- **ErrorBoundary**: Crash isolation for InnerWorldCard
- **Friends streak sync**: Fixed sync timing and audio permissions
- **Sentry errors**: Resolved all 10 production errors (TDZ, haptics, stale cache)

---

## [Unreleased]

### Added — Google Calendar Integration
- **ScheduleTimeline**: Google Calendar events shown with blue "G" badge in My World tab
- **SettingsPanel**: Calendar toggle for Google-signed users (enable/disable)
- **AuthScreen**: Added `calendar.readonly` OAuth scope for Google sign-in
- **Per-date caching**: In-memory Map cache with 15-min TTL prevents API abuse on date switching
- **Loading indicator**: Pulsing blue dot while Google Calendar events are syncing
- **Deletion guard**: Google events are read-only, cannot be deleted by user
- **CSP**: `https://www.googleapis.com` added to `connect-src` in both `index.html` and `vercel.json`
- **i18n**: `googleCalendar`, `googleCalendarDescription`, `googleCalendarEnabled` keys for all 9 languages
- **CSS**: `--event-google` color variable for all 3 themes (light, dark, OLED)

### Added — Health Connect (Full Kotlin Implementation)
- **HealthConnectPlugin.kt**: Rewrote from Java placeholder to full Kotlin with coroutines
- **isAvailable()**: Uses `HealthConnectClient.getSdkStatus()` (proper SDK check)
- **checkPermissions()**: Real permission check via `getGrantedPermissions()` coroutine
- **requestPermissions()**: Launches Health Connect permission dialog via `@ActivityCallback`, re-queries SDK on return
- **writeMindfulnessSession()**: Writes `MindfulnessSessionRecord` (meditation type), returns inserted ID
- **readSleepSessions()**: Reads real sleep data from Health Connect with time range filter
- **readSteps()**: Reads real step data, sums totals across records
- **openHealthConnect()**: Settings → App → Play Store fallback chain
- **AndroidManifest**: Added `ViewPermissionUsageActivity` alias for permission usage view
- **build.gradle**: Added `kotlinx-coroutines-android:1.8.1` dependency
- All methods resolve with safe defaults on error (never crash)

### Added — Scroll Lock
- **useScrollLock hook**: Locks body scroll when modals are open (fixes iOS/Android scroll bleed)
- Applied to 10+ modal/panel components: BreathingExercise, FocusTimer, GoalsPanel, HyperfocusMode, Leaderboard, NotificationPermission, StatsPage, StreakBanner, AboutSection

### Fixed — UI/UX
- **RadialDashboard**: Switched from touch events to pointer events for cross-platform swipe
- **Garden tab**: Reordered content (FocusTimer before ScheduleTimeline)
- **HyperfocusMode**: Portal rendering to escape PullToRefresh stacking context

---

## [Unreleased] — Pre-Release Audit (8 Sections)

### Fixed — [1/8] Android UX (Back Handler)
- **ChallengeModal**: Android back button now navigates between sub-views (details/join/create → list) instead of closing the entire modal
- **ShareModal**: Android back button now properly closes the bottom sheet
- **DatabaseRecoveryDialog**: Android back button dismisses the dialog (disabled during restore)
- **UpdateRequiredDialog**: Android back button dismisses the update prompt

### Fixed — [1/8] Android UX (Button Press Feedback)
- **SettingsPanel**: Added `btn-press` class to Sync Now, Sign Out, Delete Account, and Install App buttons for consistent tap feedback

### Fixed — [2/8] Double-tap Protection
- **ChallengeModal**: Create Challenge, Copy Code, and Share buttons now have 1000ms throttle to prevent duplicate actions on rapid taps
- **ShareModal**: Download, Copy, and Share buttons now have 1000ms throttle
- **WelcomeBackModal**: Continue and Accept Challenge buttons now have 1000ms throttle

### Fixed — [3/8] Accessibility
- **ChallengeModal**: Added `aria-label` to back button and copy code button
- **ShareModal**: Added `aria-label` to download, copy, and share buttons for screen reader support (TalkBack/VoiceOver)

### Fixed — [5/8] Design — i18n Exit Toast
- **androidBackHandler**: Added missing translations for exit toast in Japanese (ja), Arabic (ar), and Hebrew (he) — all 9 languages now covered

### Verified — No Changes Needed
- **[2/8] UI scenarios**: Loading/empty/error/offline states confirmed in all major components (Skeleton components, OfflineBanner, StorageErrorBanner, ErrorBoundary)
- **[3/8] Edge cases**: First launch onboarding, theme persistence, cache invalidation, cross-device sync — all properly handled
- **[4/8] Functional**: Audio system (playDirect/resumeDirect, concurrent sound protection), timers (Date.now offset-based, background-safe), notifications — all working
- **[5/8] Design**: 3 themes (light/dark/OLED) consistent, typography scale, animation system (btn-press, card-hover, shimmer, modal-enter)
- **[6/8] Automation**: Feature flags (AI Coach hidden), console logs gated behind logger, no stale debug code
- **[7/8] Stubs**: AI Coach properly hidden via feature flag, Spotify commented out with clear TODO markers, no dead buttons
- **[8/8] Connectivity**: Session → stats → garden → quests data flow confirmed, settings sync bidirectional, offline queue → cloud sync pipeline intact

### Files Changed
- `src/components/ChallengeModal.tsx` — useBackHandler + useThrottledCallback + aria-labels
- `src/components/ShareModal.tsx` — useBackHandler + useThrottledCallback + aria-labels
- `src/components/WelcomeBackModal.tsx` — useThrottledCallback
- `src/components/DatabaseRecoveryDialog.tsx` — useBackHandler
- `src/components/UpdateRequiredDialog.tsx` — useBackHandler
- `src/components/SettingsPanel.tsx` — btn-press on 4 buttons
- `src/lib/androidBackHandler.ts` — exit toast translations (ja, ar, he)

---

## [1.6.0] — 2026-02-07

### Fixed
- MP3 404 errors, stale cache auto-reload, version check cache-bust
- Full web audit: TDZ blocker, responsive layout, caching, cross-browser
- aria-label translation + floating promise in ChallengeModal
- 7 user-reported bugs + similar issues scan

## [1.5.x] — iOS Audio Fixes

### Fixed
- iOS audio: synchronous playDirect() — zero awaits, gesture context preserved
- Blessed audio element pattern + habit button sizes 44-48px WCAG
- Hyperfocus timer non-blocking + remove muted:true from unlock
- SVG path errors, ring tap, iOS audio interrupted state
