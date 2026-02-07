# Changelog

All notable changes to ZenFlow will be documented in this file.

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
