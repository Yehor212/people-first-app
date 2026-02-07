# ZenFlow — Project Context for Claude

> **Complete project reference for continuing work in new chat sessions.**
> **Updated:** 2026-02-07 | **Version:** 1.6.0

---

## About

**ZenFlow** — PWA + Android app for mental health and productivity, optimized for people with ADHD.

**Stack:**
- React 18.3.1 + TypeScript 5.8.3 + Vite 5.4.19 + Tailwind CSS 3.4.17
- Capacitor 8 (Android native) + PWA (Workbox injectManifest)
- Supabase 2.45.6 (auth, database, realtime) + Dexie 4.2.1 (IndexedDB)
- TanStack React Query 5.83 + React Router 6.30
- Radix UI (28 packages) + Lucide Icons + Framer Motion 12.26
- Recharts 2.15.4 + Lottie + html2canvas + jsPDF
- Sentry 10.38 (error tracking) + Vitest 2.1.9 (662 tests)
- i18n: Custom Context-based, 9 languages, ~14,728 translation keys

**Deployments:**
- GitHub Pages: `yehor212.github.io/people-first-app/`
- Vercel: configured via `vercel.json`
- Android: Capacitor 8

---

## Architecture

### Single Route App
All tabs render in `src/pages/Index.tsx`. Tab navigation: home, garden/inner world, stats, settings.

### Offline-First
IndexedDB (Dexie) is primary storage. Offline queue with retry moved to IndexedDB (v3 schema). Cloud sync via Supabase with 60-second debounce.

### Code Splitting (vite.config.ts)
Manual chunks: i18n, react-vendor, ui-vendor, supabase, dexie, framer-motion, date-fns, tanstack, lucide-icons, capacitor, lottie, sentry, forms, ui-extras, utils-vendor. **Recharts NOT chunked** (CJS interop → TDZ errors).

### PWA (src/sw.ts)
Custom Service Worker via injectManifest. Workbox strategies: NetworkFirst for navigation (3s timeout, 1h TTL), CacheFirst for fonts/storage. Auto-skipWaiting on install + clients.claim on activate. Auto-reload on controllerchange.

### Audio System
Web Audio API + HTML Audio elements. **Two playback APIs:**

- **`playDirect(soundId)`** — iOS-compatible synchronous play. Calls `audio.play()` with zero awaits directly in user gesture context. Used by all UI gesture handlers (HyperfocusMode). Sets `audioUnlocked = true` internally. Does NOT call `audio.load()` (which resets iOS blessing). Tracks status via `onplaying`/`onerror` events.

- **`play(soundId)`** — Async play with full status tracking, canplaythrough wait, fallback URLs, abort controllers. Used for non-gesture contexts (e.g., audioLifecycle resume). Has 11 async hops — NOT suitable for iOS gesture context.

- **`resumeDirect()`** — iOS-compatible synchronous resume from pause. Calls `audio.play()` on existing element.

**iOS unlock**: "Blessed" Audio element pattern — one persistent `HTMLAudioElement` created once, reused for all playback. iOS keeps user-gesture blessing on the element across `src` changes (as long as `audio.load()` is NOT called). Silent MP3 + oscillator trick for initial unlock. `needsResume()` helper handles both `'suspended'` and `'interrupted'` states. Audio lifecycle manager for app pause/resume via `forceUnlockAudio()`.

**Sound files**: 4 WAV (underwater, thunderstorm, ocean, river — 5-10MB each) + 2 MP3 (cafe, fireplace — smaller). WAV files are large; `playDirect()` streams them without waiting for full download.

---

## Key File Locations

### Core
| File | Purpose |
|------|---------|
| `src/pages/Index.tsx` | Main page, all tabs |
| `src/App.tsx` | App wrapper |
| `src/main.tsx` | Entry point, version check |
| `src/sw.ts` | Service Worker |
| `src/index.css` | CSS variables, 3 themes (light, dark, OLED) |
| `src/i18n/translations.ts` | All translations (~16K lines) |

### Storage & Sync
| File | Purpose |
|------|---------|
| `src/storage/db.ts` | Dexie DB schema (3 versions) |
| `src/storage/cloudSync.ts` | Cloud sync orchestrator |
| `src/storage/realtimeSync.ts` | Realtime subscriptions |
| `src/storage/reminderSync.ts` | Reminder settings sync |
| `src/lib/offlineQueue.ts` | IndexedDB-based offline queue |
| `src/lib/offlineQueueHandlers.ts` | Queue action handlers |

### Audio
| File | Purpose |
|------|---------|
| `src/lib/ambientSounds.ts` | Sound library, unlock, playback (~1210 lines). Blessed element, `playDirect()`, `resumeDirect()`, `play()`, status tracking |
| `src/lib/audioManager.ts` | Web Audio API wrapper, `ensureContextResumed()` |
| `src/lib/audioLifecycle.ts` | Pause/resume on app background, `forceUnlockAudio()` |
| `src/lib/notificationSounds.ts` | Notification audio |

### Hyperfocus Mode
| File | Purpose |
|------|---------|
| `src/components/HyperfocusMode.tsx` | Fullscreen focus timer + ambient sound selector + Spotify. All gesture handlers use `playDirect()`/`resumeDirect()` for iOS. Debug panel via 3-tap on "Ambient sound" label |

### Config & Deploy
| File | Purpose |
|------|---------|
| `vite.config.ts` | Build config, manual chunks, PWA |
| `vercel.json` | Vercel headers, CSP, rewrites |
| `capacitor.config.ts` | Android native config |
| `.github/workflows/deploy.yml` | CI/CD to GitHub Pages |
| `src/lib/versionCheck.ts` | App version checking |
| `vite-plugin-version.ts` | Generates version.json |

### UI Framework
| File | Purpose |
|------|---------|
| `src/lib/constants.ts` | App-wide constants |
| `src/lib/utils.ts` | General utilities |
| `src/lib/lazyWithRetry.ts` | Lazy load with chunk retry |
| `src/lib/androidBackHandler.ts` | Android back button |
| `src/components/ui/progress-ring.tsx` | ProgressRing (44px sm/md, 56px lg) + ProgressRingCompact (44px checkmark) |
| `src/components/CompactHabitCard.tsx` | Habit cards with 48px min-size +/- buttons |

---

## Stats Components (`src/components/stats/`)

| Component | Purpose |
|-----------|---------|
| `ZenScoreHub.tsx` | Zen Score ring + breakdown sparklines |
| `RadialDashboard.tsx` | 3 concentric progress rings (mood/habits/focus) |
| `RingDetailSheet.tsx` | Bottom sheet with chart for ring detail |
| `TrophyHall.tsx` | Hall of Fame with 3D flip achievement cards |
| `WeeklyReview.tsx` | Weekly summary with badges |
| `EnergyField.tsx` | Fire-based heatmap |
| `EmotionGalaxy.tsx` | Orbiting emoji galaxy |
| `DataMountains.tsx` | Mountain-style data visualization |
| `ParticleBackground.tsx` | Animated particle effects |

---

## React Contexts (5)

| Context | File |
|---------|------|
| Language/i18n | `src/contexts/LanguageContext.tsx` |
| Mood theme | `src/contexts/MoodThemeContext.tsx` |
| Emotion theme | `src/contexts/EmotionThemeContext.tsx` |
| Feature flags | `src/contexts/FeatureFlagsContext.tsx` |
| AI Coach | `src/contexts/AICoachContext.tsx` |

---

## Custom Hooks (23+)

Key hooks: `useIndexedDB`, `useGamification`, `useOfflineQueue`, `useChallenges`, `useStatsCalculations`, `useInsights`, `useSwipeNavigation`, `useBackHandler`, `useThrottledCallback`, `useInnerWorld`, `useADHDHooks`, `useDemoMode`, `usePwaInstall`, `useHealthConnect`.

---

## Database

### Dexie (IndexedDB) — 6 tables
`moods`, `habits`, `focusSessions`, `gratitudeEntries`, `settings`, `offlineQueue`

### Supabase — 25 tables
`profiles`, `user_data`, `user_settings`, `push_subscriptions`, `user_backups`, `moods`, `gratitude_entries`, `habits`, `habit_completions`, `habit_reminders`, `focus_sessions`, `user_tasks`, `user_quests`, `challenges`, `user_challenges`, `friend_challenges`, `friend_challenge_members`, `leaderboards`, `badges`, `user_badges`, `mystery_boxes`, `time_challenges`, `adhd_state`, `app_config`, `feedback`

### Pending Migration
`user_reminder_settings` needs 3 columns added manually:
```sql
ALTER TABLE public.user_reminder_settings
ADD COLUMN IF NOT EXISTS mood_time_morning text,
ADD COLUMN IF NOT EXISTS mood_time_afternoon text,
ADD COLUMN IF NOT EXISTS mood_time_evening text;
```

---

## Testing

- **Framework:** Vitest 2.1.9 + @testing-library/react
- **Tests:** 29 test files, 662 tests passing
- **E2E:** Playwright configured
- **Commands:** `npm test`, `npm run test:coverage`, `npm run test:e2e`

---

## Critical Gotchas

1. **CSP headers**: Both `index.html` meta tag AND `vercel.json` header exist. Server header overrides meta. Keep them in sync.
2. **GitHub Pages**: No custom HTTP headers. `version.json` fetched with `?_t=timestamp` cache-bust.
3. **Recharts**: NOT manually chunked — CJS interop helpers cause circular deps + TDZ errors.
4. **triggerSync()**: 60-second debounce. For immediate sync, use `queueXxxSync()` helpers.
5. **Swipe navigation**: Excludes 20px edge zones for Android system back gesture.
6. **ErrorBoundary**: Class components can't use hooks. Thread translations via functional wrapper props.
7. **Notification channels**: Android channels immutable after creation.
8. **Audio on iOS — gesture context**: `audio.play()` MUST be called synchronously in user gesture handler. Any `await` between tap and play breaks iOS gesture context. Use `playDirect()` for gesture-initiated playback, NOT `play()`.
9. **Audio on iOS — `audio.load()` resets blessing**: NEVER call `audio.load()` on the blessed element. Setting `audio.src = url` auto-triggers loading. Calling `load()` explicitly resets iOS's "user-initiated" flag.
10. **Audio on iOS — `needsResume()`**: Must handle `'interrupted'` state (not just `'suspended'`). Use `needsResume()` helper.
11. **Audio unlock listeners**: Removed after success; `forceUnlockAudio()` re-registers them on app resume.
12. **SW auto-skipWaiting**: New SW immediately activates. Auto-reload via controllerchange listener.
13. **WCAG touch targets**: All interactive elements must be minimum 44px (buttons, checkboxes). Habit +/- buttons are 48px.

---

## iOS Audio Architecture (Important)

The audio system has two parallel playback paths:

### `playDirect()` — For gesture handlers (iOS-safe)
```
User tap → handleSoundSelect/handleStart/handlePause/toggleSound
  → generator.playDirect(soundId)
    → stopImmediate() [sync]
    → audioElement = getOrCreateBlessedElement() [sync]
    → audioElement.src = url [sync, auto-loads]
    → audioUnlocked = true [sync]
    → audioElement.play() [sync call, returns promise]
    → track via onplaying/onerror events [async, non-blocking]
```
**Zero awaits. Gesture context preserved. iOS works.**

### `play()` — For non-gesture contexts (async)
```
generator.play(soundId)
  → await transition mutex
  → check audioUnlocked → 'blocked' if false
  → await unlockAudio()
  → await playAudioFile() → await loadAndPlayUrl()
    → audio.load() + await canplaythrough
    → await audio.play()
```
**11 awaits. Gesture context lost. NOT for iOS gesture handlers.**

### Blessed Audio Element
Module-level singleton `blessedAudioElement` — created once, never destroyed. All playback reuses this element. `stopImmediate()` pauses and clears handlers but does NOT null the element or call `load()`.

---

## Recent Fixes (Feb 2026)

| Commit | Fix |
|--------|-----|
| `8565017` | **iOS audio: synchronous `playDirect()` — zero awaits, no `load()`, gesture context preserved** |
| `9d7ec7d` | Blessed audio element pattern + habit button sizes (44-48px WCAG) |
| `48e8357` | Hyperfocus timer non-blocking + remove `muted:true` from unlock |
| `e4a9d1d` | SVG path errors, ring tap, iOS audio interrupted state |
| `2544386` | MP3 404, stale cache auto-reload, version check cache-bust |
| `bf26fc1` | TDZ blocker, responsive, caching, cross-browser |
| `32e19b4` | aria-label translation + floating promise |
| `4591046` | 7 user-reported bugs + similar issues scan |

---

## Commands

```bash
npm run dev          # Dev server (port 8080)
npm run build        # Production build
npm run preview      # Preview build
npm test             # Run 662 tests
npm run test:e2e     # Playwright E2E
npx cap sync         # Capacitor sync
npm run build:android # Android build
```

---

*Updated automatically during development sessions.*
