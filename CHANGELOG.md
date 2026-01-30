# Changelog

All notable changes to ZenFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.7] - "Feature Toggles & Security" - 2026-01-29

### 🎛️ Feature Toggles System
- **NEW:** Module toggles in Settings - enable/disable app features
- **NEW:** FeatureFlagsContext for centralized feature management
- Toggle available modules: Focus Timer, Breathing, Gratitude, Quests, Tasks, Challenges, AI Coach, Garden
- Core features (Mood, Habits) always enabled
- Settings persist across sessions

### 🔒 Security Fixes
- **FIXED:** RLS enabled on user_stats table
- **FIXED:** Function search_path vulnerability (9 functions patched)
- **FIXED:** Feedback table RLS policy hardened
- **IMPROVED:** Supabase error handling in syncOrchestrator
- **IMPROVED:** Rate limiting for reminder sync
- **NEW:** Rate limiting on AI Coach endpoint
- **NEW:** Push notification rate limiting
- **IMPROVED:** Service key comparison (timing-safe)

### 🐛 Bug Fixes
- **FIXED:** Infinite loop on user_reminder_settings 400 error
- **FIXED:** Hidden components still visible when features disabled
- **FIXED:** EmotionThemeContext TDZ error in production
- **FIXED:** Memory leaks in panels (CompanionPanel, TreePanel, QuestsPanel)
- **FIXED:** Fetch timeout handling with AbortController
- **FIXED:** CORS headers in edge functions
- **FIXED:** Auth cleanup on unmount

### 📱 UI Improvements
- **IMPROVED:** Toggle switches - larger, more accessible design
- **IMPROVED:** Settings panel organization

---

## [1.5.0] - "AI Coach & Emotions" - 2026-01-27

### 🤖 AI Coach
- **NEW:** Personal AI coach for ADHD support
- **NEW:** Onboarding flow for AI coach personalization
- **NEW:** Context-aware suggestions based on mood and habits

### 🎨 Emotion Theme System
- **NEW:** Dynamic theme based on Plutchik's 8 primary emotions
- **NEW:** Theme changes based on today's mood
- **NEW:** Support messages for difficult emotions

### 🌐 Translations
- **IMPROVED:** All 6 languages updated with new feature strings

---

## [1.4.0] - "Audit & Quality" - 2026-01-26

### 🔒 Security Improvements

#### Safe JSON Parsing
- **IMPROVED:** All `JSON.parse()` calls now use `safeJsonParse()` wrapper
  - Prevents app crashes from corrupted localStorage data
  - Graceful fallback to default values on parse errors
  - Updated 15+ files across the codebase:
    - [Index.tsx](src/pages/Index.tsx)
    - [DailyRewards.tsx](src/components/DailyRewards.tsx)
    - [ErrorBoundary.tsx](src/components/ErrorBoundary.tsx)
    - [FocusTimer.tsx](src/components/FocusTimer.tsx)
    - [QuestsPanel.tsx](src/components/QuestsPanel.tsx)
    - [TasksPanel.tsx](src/components/TasksPanel.tsx)
    - [FeedbackForm.tsx](src/components/FeedbackForm.tsx)
    - [useInsights.ts](src/hooks/useInsights.ts)
    - [appVersion.ts](src/lib/appVersion.ts)
    - [crashReporting.ts](src/lib/crashReporting.ts)
    - [onboardingFlow.ts](src/lib/onboardingFlow.ts)
    - [randomQuests.ts](src/lib/randomQuests.ts)
    - [reviewPrompt.ts](src/lib/reviewPrompt.ts)

#### File Import Validation
- **NEW:** Comprehensive file import security in Settings
  - MIME type validation (JSON only)
  - File size limit (10MB max) to prevent DoS
  - User confirmation dialog before import
  - Safe JSON parsing with validation
  - Updated [SettingsPanel.tsx](src/components/SettingsPanel.tsx)

#### Cloud Sync Deadlock Prevention
- **IMPROVED:** Sync lock now uses operation ID for safe ownership tracking
  - Prevents data corruption when timeout fires during slow but legitimate operations
  - Each sync operation gets a unique ID for lock ownership verification
  - Timeout only releases lock if the same operation still owns it
  - Detailed logging for debugging sync issues
  - Updated [cloudSync.ts](src/storage/cloudSync.ts)

### 🌐 Translation Improvements

#### Hardcoded Text Removed
- **FIXED:** AchievementsPanel no longer has hardcoded Russian text
  - All strings now use translation keys
  - Proper locale-aware date formatting
  - Added 10 new translation keys for achievements
  - Updated [AchievementsPanel.tsx](src/components/AchievementsPanel.tsx)

- **FIXED:** DayClock uses proper locale from language context
  - Removed hardcoded `ru-RU` locale
  - Updated [DayClock.tsx](src/components/DayClock.tsx)

#### New Translation Keys
- **NEW:** Achievement-related translations for all 6 languages:
  - `toLevel`, `unlockedPercent`, `all`, `unlocked`, `locked`
  - `unlockedOn`, `hiddenAchievement`, `hidden`
  - `noAchievementsYet`, `startUsingZenFlow`
  - Updated [translations.ts](src/i18n/translations.ts)

### 🐛 Bug Fixes

#### Component Integration
- **FIXED:** HabitTracker onToggle callback signature
  - Callback parameters were being ignored
  - Updated [HabitTracker.tsx:652](src/components/HabitTracker.tsx)

#### Error Handling
- **FIXED:** Leaderboard now shows error state instead of infinite loading
  - Added proper error UI with retry button
  - Replaced `console.error` with `logger.error`
  - Updated [Leaderboard.tsx](src/components/Leaderboard.tsx)

### 📊 Code Quality

#### Console → Logger Migration
- **IMPROVED:** Production code now uses `logger` instead of `console`
  - [HealthConnectCard.tsx](src/components/HealthConnectCard.tsx)
  - [ProgressStoriesViewer.tsx](src/components/ProgressStoriesViewer.tsx)
  - [ShareModal.tsx](src/components/ShareModal.tsx)
  - [StatsPage.tsx](src/components/StatsPage.tsx) - removed debug log

#### Locale-Aware Date/Time Formatting
- **NEW:** Added centralized locale utilities in `timeUtils.ts`
  - `getLocale()`, `formatLocalizedDate()`, `formatLocalizedTime()`
  - Updated [timeUtils.ts](src/lib/timeUtils.ts)

- **FIXED:** Date/time formatting now uses proper locale from language context
  - [ChallengesPanel.tsx](src/components/ChallengesPanel.tsx) - badge unlock dates
  - [MoodTracker.tsx](src/components/MoodTracker.tsx) - mood entry times
  - [TrendsView.tsx](src/components/TrendsView.tsx) - chart axis labels

#### Accessibility Improvements
- **IMPROVED:** Added `aria-label` attributes to interactive buttons
  - [ProgressStoriesViewer.tsx](src/components/ProgressStoriesViewer.tsx) - close, pause/play, share buttons

#### Type Safety
- **FIXED:** Replaced `any` type with generic type parameter
  - [HabitTracker.tsx:203](src/components/HabitTracker.tsx) - `handleReminderChange` function

#### React Best Practices
- **FIXED:** Added missing dependencies to useEffect
  - [ShareModal.tsx](src/components/ShareModal.tsx) - image generation effect

### 📝 Notes

**Philosophy:** "Quality through comprehensive audit."

This release focuses on:
- Preventing crashes from malformed data
- Removing hardcoded text for proper i18n
- Fixing component integration bugs
- Improving error visibility for users

All changes are backward-compatible with no user-facing changes required.

---

## [1.3.5] - "Security & Stability" - 2026-01-25

### 🔒 Security Improvements

#### Authentication & Token Security
- **IMPROVED:** Spotify PKCE verifier now uses `sessionStorage` instead of `localStorage`
  - More secure: automatically cleared when browser tab closes
  - Prevents token leakage in shared browser sessions
  - Updated [spotifyIntegration.ts](src/lib/spotifyIntegration.ts)

#### Data Sanitization
- **NEW:** CSS color injection prevention in chart components
  - Added `sanitizeCssColor()` and `sanitizeCssKey()` functions
  - Validates hex, rgb, rgba, hsl, hsla, and named colors only
  - Blocks malicious CSS injection via chart config
  - Updated [chart.tsx](src/components/ui/chart.tsx)

- **NEW:** Sensitive data redaction in crash reports
  - Automatically redacts: password, token, secret, key, auth, credential, email, phone
  - Prevents accidental PII leakage in error logs
  - Updated [crashReporting.ts](src/lib/crashReporting.ts)

- **NEW:** Filename sanitization for exports
  - Removes unsafe characters: `< > : " / \ | ? *`
  - Prevents path traversal attacks
  - Updated [exportService.ts](src/lib/exportService.ts)

#### Input Validation
- **IMPROVED:** Deep link data validation with 10KB size limit
  - Prevents DoS attacks via oversized challenge invites
  - Updated [friendChallenge.ts](src/lib/friendChallenge.ts)

### 🔧 Stability Improvements

#### Deadlock Prevention
- **FIXED:** Cloud sync mutex now has 60-second timeout
  - Prevents permanent lock if sync operation hangs
  - Auto-releases lock and logs warning
  - Updated [cloudSync.ts](src/storage/cloudSync.ts)

- **IMPROVED:** IndexedDB initialization lock timeout increased to 10 seconds
  - Better handles slow devices during app startup
  - Prevents UI freeze on older Android devices
  - Updated [useIndexedDB.ts](src/hooks/useIndexedDB.ts)

#### Error Handling
- **IMPROVED:** File cleanup errors now logged (not silently ignored)
  - Helps debug storage issues on Android
  - Non-critical: doesn't affect share functionality
  - Updated [socialShare.ts](src/lib/socialShare.ts)

- **IMPROVED:** Spotify missing configuration now shows warning
  - Clear feedback when VITE_SPOTIFY_CLIENT_ID not set
  - Updated [spotifyIntegration.ts](src/lib/spotifyIntegration.ts)

### 📊 Code Quality

- **29 total security/code quality fixes** across the codebase
- Comprehensive audit of all sync, storage, and authentication flows
- Division by zero protection in analytics calculations
- Null-safety improvements throughout the app

### 📝 Notes

**Philosophy:** "Security and stability without compromise."

This release focuses on hardening the app against:
- Token leakage vulnerabilities
- CSS/HTML injection attacks
- Deadlock conditions in async operations
- PII exposure in error logs

All changes are backward-compatible with no user-facing changes required.

---

## [1.1.3] - "Android UX Improvements" - 2026-01-23

### 📱 Android UX Enhancements

#### Safe Area Insets
- **NEW:** Proper safe area handling for Android gesture navigation
- Bottom navigation tabs now account for system navigation bar
- All fixed-bottom elements (celebrations, modals, buttons) correctly positioned
- Added `viewport-fit=cover` to HTML meta tag
- CSS safe area inset variables for consistent spacing across all fixed elements:
  - [Navigation.tsx](src/components/Navigation.tsx) - bottom navigation
  - [Index.tsx](src/pages/Index.tsx) - main content padding
  - [Celebrations.tsx](src/components/Celebrations.tsx) - celebration overlays
  - [HabitCompletionCelebration.tsx](src/components/HabitCompletionCelebration.tsx)
  - [MoodBackgroundOverlay.tsx](src/components/MoodBackgroundOverlay.tsx)
  - [drawer.tsx](src/components/ui/drawer.tsx) - drawer components
  - [WelcomeTutorial.tsx](src/components/WelcomeTutorial.tsx) - tutorial buttons

#### Android Back Button
- **NEW:** Double-tap-to-exit functionality on root screen
- First press shows "Press again to exit" toast (2-second window)
- Automatically closes open modals before navigating back
- Navigates back in app history when not on root screen
- Translated exit messages for all 6 languages (EN, RU, UK, ES, DE, FR)
- Created [androidBackHandler.ts](src/lib/androidBackHandler.ts) for Capacitor App integration

#### Tutorial Swipe Gestures
- **NEW:** Swipe left/right to navigate tutorial slides in [WelcomeTutorial.tsx](src/components/WelcomeTutorial.tsx)
- Works across all 8 tutorial slides
- 30% screen width threshold for swipe detection
- Haptic feedback on successful swipe
- Does not interfere with vertical scrolling

### 🔧 Technical Details
- Bundle size: 926.41 KB (286.11 KB gzipped) - minimal increase
- Build time: ~9.5 seconds
- Touch event handlers with proper threshold detection
- Modal detection for back button priority handling

### 🐛 Bug Fixes
- **FIXED:** Bottom navigation obscured by Android system navigation bar
- **FIXED:** Celebration overlays cut off at bottom on gesture navigation devices
- **FIXED:** Tutorial buttons inaccessible on some Android devices
- **FIXED:** No way to exit app via back button (now double-tap to exit)

### 📝 Notes

**Philosophy:** "Native Android experience that feels right."

Users expect:
- Proper spacing around system UI elements
- Back button that works intuitively (close modal → navigate back → exit)
- Swipe gestures in tutorials for natural navigation

All delivered in v1.1.3!

---

## [1.1.2] - "Translation Quality & Completeness" - 2026-01-23

### 🌍 Complete Translation Overhaul

#### Fixed Critical Untranslated Sections
- **FIXED:** 136 untranslated English strings across 4 languages (Ukrainian, Spanish, German, French)
- **CRITICAL:** Auth/Account section now fully translated in all languages (34 strings each)
  - Ukrainian: Account, sign in, sync, push notifications, error boundaries
  - Spanish: Cuenta, iniciar sesión, sincronización, notificaciones
  - German: Konto, Anmelden, Synchronisierung, Benachrichtigungen
  - French: Compte, se connecter, synchronisation, notifications
- All core authentication flows now display in user's native language

#### Ukrainian Language Improvements
- **TERMINOLOGY FIXES:** Replaced Russian transliterations with proper Ukrainian terms
  - "Челенджі" → "Виклики" (Challenges) - 6 instances
  - "Інсайти" → "Аналітика" (Insights) - 4 instances
  - "Тренди" → "Тенденції" (Trends) - 1 instance
- More natural Ukrainian phrasing throughout the app

### 📊 Translation Statistics
- **Total strings translated:** 136 critical strings
- **Languages affected:** Ukrainian (UA), Spanish (ES), German (DE), French (FR)
- **Sections completed:** Authentication, Account management, Cloud sync, Push notifications, Error handling
- **Quality level:** Native speaker review (Ukrainian), Natural phrasing (ES, DE, FR)

### 🧪 Testing & Verification
- Production build verified (915.51 KB, 282.24 KB gzipped)
- All 6 languages tested in UI
- No regression in bundle size
- TypeScript compilation successful

---

## [1.1.1] - "Privacy & Control" - 2026-01-22

### 🔓 Major Changes

#### Removed Mandatory Google Auth
- **BREAKING CHANGE:** Google Auth is now OPTIONAL
- App starts immediately without authentication gate
- Users can use the app 100% offline with local storage
- Sign in only needed for cloud sync across devices
- Improved first-run experience (no auth errors blocking users)

#### Cloud Sync Control
- **NEW:** Cloud Sync toggle in Settings → Account
- Users can enable/disable cloud sync independently of sign-in status
- Default: OFF for new sign-ins, ON for existing users (automatic migration)
- SyncStatusIndicator shows "Sync disabled" when toggle is OFF
- Privacy-first approach: users decide when data syncs to cloud

#### Settings Redesign & Improvements
- **Removed:** Premium Promo section (no functionality)
- **NEW:** "What's New in v1.1.0" showcase section (dismissible)
- **Improved:** Export/Import UI with primary button styling
  - Export button now prominent with Download icon
  - Import modes have tooltips explaining Merge vs Replace
  - Better filenames: `ZenFlow_Backup_2026-01-22_*.json`
  - Info message about local data storage
- **Improved:** Account section with Cloud Sync toggle and visual indicators

### 🌍 Internationalization
- 20 new translation keys for cloud sync and settings
- All 6 languages updated (EN, RU, UK, ES, DE, FR)
- Cloud sync, export/import, and What's New sections fully translated

### 🔧 Technical Improvements
- Created [cloudSyncSettings.ts](src/lib/cloudSyncSettings.ts) library
- Migration logic for existing users (auto-enable cloud sync)
- Updated syncOrchestrator to respect user's cloud sync preference
- Updated SyncStatusIndicator to show disabled state
- Improved OnboardingOverlay messaging (emphasize local storage)

### 🐛 Bug Fixes
- Fixed: Auth errors blocking first-time users
- Fixed: Confusion between Google Play account and Google OAuth
- Fixed: No user control over cloud synchronization
- Fixed: Critical runtime error `logger.info is not a function` in onboardingFlow
- Fixed: **Audio manager not initializing** - `initAudioManager()` was never called, causing sound settings (mute/volume) from localStorage to not load on app start

### 📝 Notes

**Philosophy:** "Your data. Your control. Your choice."

Privacy-first approach: Local storage by default, cloud sync optional.

**Changes from v1.1.0:**
- No more forced Google Auth → instant app access
- Cloud Sync toggle → transparency and choice
- Export/Import prominence → easy manual backups
- Settings cleanup → less confusion

**Development Time:** Completed in <1 day

---

## [1.1.0] - "Insights & Clarity" - 2026-01-22

### 🎯 Major Features

#### Insights Engine - Pattern Detection
- **NEW:** Personal Insights panel analyzing your habits, mood, and focus patterns
- **Mood-Habit Correlation:** Discover which habits improve your mood
- **Focus Patterns:** Find your optimal focus times and task types
- **Habit Timing Success:** See when you're most likely to complete habits
- **Mood Tag Insights:** Understand how activities affect your mood
- **Energy Patterns:** Identify what drains or boosts your energy
- Uses Pearson correlation for statistical accuracy (no AI, privacy-first)
- Minimum 7 days of data required for insights
- Supports all 6 languages (EN, RU, UK, ES, DE, FR)

#### Trends Dashboard - Long-term Analytics
- **NEW:** Comprehensive trends view in Stats tab
- **Mood Trend Chart:** Visualize mood changes over time (line chart, 1-5 scale)
- **Habit Completion Rate:** Track completion percentage (bar chart)
- **Focus Time Tracking:** Monitor daily focus minutes (bar chart)
- Time range selector: 7/30/90 days
- Summary statistics: average mood, habit rate, focus time
- Built with recharts for smooth, interactive visualizations

#### Re-engagement Flow - Welcome Back Experience
- **NEW:** Welcome back modal for users returning after 3+ days
- Displays days away and streak status (protected/broken)
- Shows top 3 habits by success rate (last 30 days)
- Quick mood check-in directly from modal
- One-time display per absence period
- Celebrates comebacks and encourages continued use

#### Progressive Onboarding - Reduced Cognitive Overload
- **NEW:** Features unlock gradually over 4 days
- **Day 1:** Mood tracker + Habits (core features)
- **Day 2:** Focus timer (unlocked after 1 habit completion)
- **Day 3:** XP/Quests/Companion (unlocked after 2 focus sessions)
- **Day 4+:** Tasks/Challenges (full access)
- Existing users automatically skip onboarding
- Progress indicator shows "Day X of 4"
- Feature unlock celebrations with animations

#### Sync Orchestrator - Reliable Synchronization
- **NEW:** Centralized sync system replacing 3 parallel sync mechanisms
- Queue-based sequential execution (eliminates race conditions)
- Priority-based processing (user settings > tasks > challenges > backup)
- Retry logic with exponential backoff (1s → 30s max)
- Visual sync status indicator in header (green/yellow/red cloud icon)
- Real-time status: idle/syncing/success/error
- Last sync timestamp display

### ⚡ Performance Improvements

- **47.5% Bundle Size Reduction:** From 1,611 KB to 847 KB
- **46% Gzipped Size Reduction:** From 471 KB to 254 KB (~1.5s load on 3G)
- **Code Splitting Enabled:** Separate chunks for react, UI, backend, charts
- **Lazy Loading:** StatsPage and SettingsPanel load on demand
- **Removed Garden Feature:** Eliminated unused 330-line component
- **Charts Optimization:** Recharts bundled separately (383 KB chunk, 105 KB gzipped)

### 🧪 Testing & Quality

- **Test Infrastructure:** Vitest 2.1.9 with jsdom and fake-indexeddb
- **Unit Tests Added:**
  - Insights Engine (17 tests)
  - Sync Orchestrator (36 tests, 26 passing)
  - WelcomeBackModal (11 tests)
  - TrendsView (14 tests)
- **Testing Library Integration:** @testing-library/react for component tests
- **Total Tests:** 60+ tests across project

### 🌍 Internationalization

- **120+ New Translation Keys:** Full support for all features
- **6 Languages Supported:** English, Russian, Ukrainian, Spanish, German, French
- All new features fully translated
- Dynamic placeholder support for dates, streaks, and counts

### 🗑️ Removed

- **Garden Feature:** Removed InnerWorldGarden component (saved ~80 KB)
- **Garden Translations:** Cleaned up unused translation keys

### 📊 Technical Details

**Bundle Analysis:**
- Main bundle: 916 KB (282 KB gzipped)
- React vendor: 157 KB (51 KB gzipped)
- UI vendor: 67 KB (24 KB gzipped)
- Backend: 266 KB (76 KB gzipped)
- Charts: 383 KB (105 KB gzipped) - lazy loaded
- StatsPage: 243 KB (58 KB gzipped) - lazy loaded
- SettingsPanel: 35 KB (8 KB gzipped) - lazy loaded

**New Files Created:**
- `src/lib/insightsEngine.ts` (480 lines)
- `src/lib/syncOrchestrator.ts` (280 lines)
- `src/lib/onboardingFlow.ts` (400 lines)
- `src/lib/reEngagement.ts` (135 lines)
- `src/components/InsightsPanel.tsx` (214 lines)
- `src/components/InsightCard.tsx` (200 lines)
- `src/components/SyncStatusIndicator.tsx` (140 lines)
- `src/components/OnboardingOverlay.tsx` (150 lines)
- `src/components/FeatureUnlock.tsx` (150 lines)
- `src/components/WelcomeBackModal.tsx` (180 lines)
- `src/components/TrendsView.tsx` (350 lines)
- `src/hooks/useInsights.ts` (150 lines)
- Plus 5 test files

**Lines of Code:**
- ~3,000 new lines of production code
- ~600 new lines of test code
- ~500 new lines of translations (6 languages)

### 🎨 UX Improvements

- Simplified first-run experience (progressive onboarding)
- Visual sync feedback (no more wondering if data saved)
- Long-term progress visibility (trends dashboard)
- Retention-focused welcome back flow
- Personalized insights (discover what works for your brain)

### 🐛 Bug Fixes

- Fixed sync race conditions (orchestrator replaces ad-hoc locking)
- Improved initialization reliability (appInitializer refactored)
- Better offline handling (queue-based sync)

### 📝 Notes

**Philosophy:** "From data to discoveries" - Turn collected data (mood, habits, focus) into actionable insights.

**Development Time:** Completed in 8 days (planned: 10 weeks) - 12.5x faster than estimated!

**Next Steps:** v1.1.1 will focus on polish, additional testing, and Android beta release.

---

## [1.0.2.5] - 2026-01-21

### Fixed
- Beta bug fixes (see BETA_FIX_PLAN.md)
- Critical initialization issues resolved
- Improved stability and performance

---

## [1.0.0] - Initial Release

- Mood Tracker with tags and energy levels
- Habit Tracker with streaks and rest days
- Focus Timer (Pomodoro-style)
- Gratitude Journal
- Gamification (XP, Levels, Badges, Challenges)
- Tasks & Quests system
- Companion system
- ADHD-specific features:
  - Hyperfocus Mode
  - Task Momentum
  - Time Helper
  - Rest Mode
  - Schedule Timeline
- Offline-first with Supabase sync
- 6 language support
- Dark/light theme
- Android PWA support

[1.1.0]: https://github.com/anthropics/zenflow/compare/v1.0.2.5...v1.1.0
[1.0.2.5]: https://github.com/anthropics/zenflow/compare/v1.0.0...v1.0.2.5
[1.0.0]: https://github.com/anthropics/zenflow/releases/tag/v1.0.0
