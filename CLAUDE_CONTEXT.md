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
Web Audio API + HTML Audio elements. iOS unlock via silent MP3 + oscillator trick. `needsResume()` helper handles both `'suspended'` and `'interrupted'` states. Audio lifecycle manager for app pause/resume.

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
| `src/lib/ambientSounds.ts` | Sound library, unlock, playback (~1050 lines) |
| `src/lib/audioManager.ts` | Web Audio API wrapper |
| `src/lib/audioLifecycle.ts` | Pause/resume on app background |
| `src/lib/notificationSounds.ts` | Notification audio |

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
8. **Audio on iOS**: Must handle `'interrupted'` state (not just `'suspended'`). Use `needsResume()` helper.
9. **Audio unlock listeners**: Removed after success; `forceUnlockAudio()` re-registers them on app resume.
10. **SW auto-skipWaiting**: New SW immediately activates. Auto-reload via controllerchange listener.

---

## Recent Fixes (Feb 2026)

| Commit | Fix |
|--------|-----|
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
