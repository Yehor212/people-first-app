# ZenFlow Architecture & Coding Standards

> This document is the "constitution" of the ZenFlow codebase.
> Every PR, every feature, every refactor MUST follow these rules.
> Last updated: 2026-02-16 (TD-20 Phase 6 — 33 components + 3 hooks + 3 hook-only resolved, DayClock deleted)

---

## Codebase Metrics (as of 2026-02-16)

| Metric | Value | Command |
|--------|-------|---------|
| Source files | 420 (.ts/.tsx, excl. tests) | `find src -name "*.ts" -o -name "*.tsx" \| grep -v test \| wc -l` |
| Test files | 25 | `find src test -name "*.test.*" -o -name "*.spec.*" \| wc -l` |
| Total LOC | ~59,000 | `find src -name "*.tsx" -exec wc -l {} + \| tail -1` |
| Tests passing | 543/543 | `npx vitest --run` |
| ESLint errors | 0 | `npx eslint src/ --quiet` |
| ESLint warnings | 21 | `npx eslint src/` |
| TypeScript errors | 0 | `npx tsc --noEmit` |
| God components (>400L) | 0 remaining (33 components + 3 hooks resolved, 1 dead code deleted, 3 out-of-scope) | See [Known Technical Debt](#known-technical-debt) |
| Direct localStorage calls | 0 (was 199) | Enforced by ESLint `no-restricted-globals` rule. All access via `SK` + `safeJson`. |
| Silent .catch(() => {}) | 0 | `grep -rn '\.catch.*=> {}' src/ \| wc -l` |
| React.memo components | 12 / 80+ | `grep -rl 'memo(' src/ --include="*.tsx" \| wc -l` |
| lazy() imports | 6 | `grep -rn 'lazy(' src/ \| wc -l` |

> Update these metrics after each major refactor phase. Compare deltas to track progress.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Folder Structure](#folder-structure)
3. [Feature Module Pattern](#feature-module-pattern)
4. [State Management](#state-management)
5. [Data Flow](#data-flow)
6. [Storage Rules](#storage-rules)
7. [Error Handling](#error-handling)
8. [Validation](#validation)
9. [Component Rules](#component-rules)
10. [Naming Conventions](#naming-conventions)
11. [Testing](#testing)
12. [Performance](#performance)
13. [Security](#security)
14. [i18n](#i18n)
15. [Git & CI/CD](#git--cicd)
16. [Known Technical Debt](#known-technical-debt)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite (SWC plugin) |
| Styling | Tailwind CSS + shadcn/ui |
| State (client) | Zustand |
| State (server) | TanStack React Query |
| Local DB | Dexie (IndexedDB) |
| Backend | Supabase (Auth, Database, Realtime) |
| Native | Capacitor 8 |
| Analytics | Firebase (Crashlytics + Analytics) |
| Ads | AdMob via @capacitor-community/admob |
| Error Monitoring | Sentry |
| i18n | Custom (8 languages: en, uk, es, de, fr, ja, ar, he) |

---

## Folder Structure

### Current State (as of Phase 2 completion)

```
src/
  pages/
    Index.tsx                   # 374-line orchestrator: hooks → tabs (was 2,800 → 652 → 374)

  stores/                       # Zustand stores + bridge hooks
    appStore.ts                 # Auth, initialization, active tab
    userDataStore.ts            # Moods, habits, focus sessions, gratitude (with array validation)
    uiStore.ts                  # Modals, confetti, focus minutes, getModalToggle utility
    gamificationStore.ts        # XP/treats bridge to useGamification hook
    useHydrateUserData.ts       # Bridge: IndexedDB → Zustand (14 useIndexedDB calls)
    useHydrateGamification.ts   # Bridge: registers gamification hooks into store
    index.ts                    # Barrel export

  hooks/                        # Custom hooks (40 files)
    # Lifecycle hooks (extracted from Index.tsx)
    useAppLifecycle.ts          # App init, splash, loading
    useDateTracking.ts          # Midnight detection, date sync
    useAuthSession.ts           # Supabase session, OAuth, sync
    useNotificationSetup.ts     # FCM, local reminders, channels
    useOnboardingEffects.ts     # Progressive onboarding, re-engagement
    useCloudSyncEffects.ts      # Cloud sync, realtime subscriptions
    useAppUpdateCheck.ts        # Version check (reads onboardingComplete from store)
    useWeeklyReportTrigger.ts   # Auto-show weekly report on Monday (reads from store)
    useSettingsHandlers.ts      # Reset, name change, pull-to-refresh, schedule CRUD
    useReminderMigration.ts     # One-time moodTime → 3-time format migration
    useEmotionSync.ts           # Sync emotion theme with current mood
    # Feature handlers (extracted from Index.tsx)
    useMoodHandlers.ts          # handleAddMood, handleQuickMood
    useHabitHandlers.ts         # handleToggleHabit, CRUD (~180 lines, most complex)
    useFocusHandlers.ts         # handleCompleteFocusSession
    useGratitudeHandlers.ts     # handleAddGratitude
    useChallengeHandlers.ts     # updateChallengeProgress, feature unlock
    # Derived data
    useDerivedData.ts           # 14 useMemos: schedule events, CTA system, widget data
    useDeepLinkHandler.ts       # Auth + challenge deep links
    useHabitForm.ts             # Habit creation/edit form state + handlers (extracted from HabitTracker)
    useFocusTimer.ts            # Timer state machine + persistence + handlers (extracted from FocusTimer)
    # Domain hooks
    useGamification.ts          # XP, levels, treats, achievements
    useInnerWorld.ts            # Garden, creatures, rest mode (542 lines, dead code removed)
    useIndexedDB.ts             # Generic IndexedDB persistence hook
    useSwipeNavigation.ts       # Mobile tab swipe
    useSessionTimeout.ts        # Auto-logout after inactivity
    useScrollLock.ts            # Lock scroll when modal open
    # ... 20+ more domain/utility hooks

  components/
    tabs/                       # Tab content components (extracted from Index.tsx JSX)
      HomeTab.tsx               # ~200 lines — mood, habits, gratitude, streak
      GardenTab.tsx             # ~115 lines — schedule, journal, breathing, focus
      StatsTab.tsx              # ~45 lines — stats page wrapper
      AchievementsTab.tsx       # ~34 lines — achievements + leaderboard
      SettingsTab.tsx           # ~58 lines — settings panel wrapper
    ModalLayer.tsx              # 10 modal renders (weekly report, challenges, etc.)
    OverlayLayer.tsx            # Confetti, consent, update, onboarding overlays
    AuthGate.tsx                # 7 initialization gates (splash, language, auth, tutorial, onboarding, notifications)
    SplashScreen.tsx            # Premium loading animation
    ErrorBoundary.tsx           # LazyErrorBoundary + ModalErrorBoundary
    HabitCreationForm.tsx       # Form JSX for habit creation/editing (extracted from HabitTracker)
    FocusReflectionModal.tsx    # Post-focus reflection modal (extracted from FocusTimer)
    challenges/                 # Challenge sub-components (extracted from ChallengeModal)
      ChallengeCard.tsx         # Single challenge card (presentational)
      ParticipantsLeaderboard.tsx # Cloud leaderboard with real-time updates
      CreateChallengeView.tsx   # Challenge creation form
      ChallengeDetailsView.tsx  # Challenge details + share/delete
      ChallengesListView.tsx    # Active/completed/expired lists
      JoinChallengeView.tsx     # Join by code/invite
    # ... 50+ feature components

  features/                     # Feature modules (only journal migrated)
    journal/                    # Self-contained: JournalModule, Calendar, Editor, Sticker

  contexts/                     # React contexts
    LanguageContext.tsx          # i18n with 8 languages
    EmotionThemeContext.tsx      # Dynamic background based on mood
    FeatureFlagsContext.tsx      # Module visibility flags
    AdContext.tsx                # AdMob integration

  lib/                          # Utilities & platform services
  storage/                      # Dexie DB, cloud sync, realtime
  i18n/
    translations.ts             # 19,879-line monolith (all 8 languages)
  plugins/                      # Custom Capacitor plugins
```

### Target State (future phases)

```
src/
  features/                     # Each domain self-contained
    mood/
      components/
      hooks/
      store.ts                  # Zustand slice
      types.ts
      index.ts                  # Barrel export (public API)
    habits/
    focus/
    journal/                    # (already migrated)
    breathing/
    garden/
    challenges/
    schedule/
    gamification/
    onboarding/
    settings/
  shared/
    components/ui/              # shadcn/ui primitives
    hooks/                      # Cross-feature hooks
    lib/                        # Platform utilities
    types/                      # Shared type definitions
  stores/                       # Only global orchestration stores
  i18n/locales/                 # One JSON per language (split from monolith)
```

---

## Feature Module Pattern

**Current state:** Only `journal/` is migrated to feature module pattern. Other features still live in `components/` and `hooks/`.

Target structure for each feature module:

```
src/features/mood/
  components/
    MoodTracker.tsx             # Main feature UI
    MoodSelector.tsx            # Sub-component
  hooks/
    useMoodData.ts              # Data access hook
  store.ts                      # Zustand slice
  types.ts                      # Feature-local types
  utils.ts                      # Pure helper functions
  index.ts                      # Barrel: export { MoodTracker } from './components/MoodTracker'
```

### Rules

1. **Features import from `shared/` and `stores/`, NEVER from each other.**
   - `features/mood/` can import from `shared/components/` and `stores/userDataStore`
   - `features/mood/` CANNOT import from `features/habits/`
   - If two features need shared logic, move it to `shared/` or `stores/`

2. **Barrel exports only.** External code imports from `@/features/mood`, never from `@/features/mood/components/MoodTracker`.

3. **One feature = one domain.** Don't mix mood and habit logic in the same feature module.

---

## State Management

### Current Architecture: Bridge Pattern

User data lives in **IndexedDB** (via Dexie + `useIndexedDB` hook) and is bridged into **Zustand** stores for fast, synchronous reads by any component.

| Layer | Tool | Scope | Example |
|-------|------|-------|---------|
| **Persistence** | Dexie (IndexedDB) | Source of truth | Moods, habits, focus sessions |
| **Global client state** | Zustand | In-memory mirror + app state | Auth, active tab, modals, user data |
| **Local UI state** | useState | Single component | Form input, local toggle |

### Bridge Pattern (how it works)

```
IndexedDB (Dexie)
  ↕ useIndexedDB hooks (14 calls in useHydrateUserData)
Zustand userDataStore
  ← _hydrateFromDB() syncs values + validates arrays
  ← _registerSetters() registers IndexedDB write functions
  → setMoods()/setHabits()/etc. write to BOTH store AND IndexedDB
  ↕ Components read via useUserDataStore(selector)
```

The bridge hook `useHydrateUserData` (in `stores/`) calls `useIndexedDB` for each data field, then:
1. Syncs loaded values into Zustand via `_hydrateFromDB()` (with `Array.isArray` validation)
2. Registers setter functions via `_registerSetters()` so store actions persist to IndexedDB

### Stores

| Store | Responsibility | Key Pattern |
|-------|---------------|-------------|
| `appStore` | Auth, initialization, active tab, navigation | Plain Zustand |
| `userDataStore` | All user data (moods, habits, settings) | Bridge to IndexedDB |
| `uiStore` | Modals, confetti, focus minutes | `getModalToggle(name)` utility |
| `gamificationStore` | XP/treats bridge | Registers hooks from `useGamification` |

### `getModalToggle` Pattern

Module-level cached toggle functions for modal open/close, replacing 11 `useCallback` wrappers:

```typescript
// In uiStore.ts — called at module scope, not inside components
const setShowWeeklyReport = getModalToggle('showWeeklyReport');
// Returns: (value: boolean) => void — stable reference, no re-renders
```

### Rules

1. **Zustand for shared state.** If 2+ components need the same data, it goes in a Zustand store.
2. **useState for UI-only state.** If it dies with the component, it's local state.
3. **No prop drilling deeper than 1 level.** Parent → Child is fine. Parent → Child → Grandchild → use a store.
4. **No direct localStorage.** Use `SK` keys from `src/lib/storageKeys.ts` + `safeJson` accessors (`storageGetRaw`, `safeLocalStorageGet`, etc.). ESLint enforces this.
5. **Array validation at hydration boundary.** `_hydrateFromDB` validates arrays survive corrupted cloud sync data.

---

## Data Flow

```
User Action
  → Feature Component (UI event)
    → Zustand Store (update local state)
      → IndexedDB (persist via Dexie)
      → Cloud Sync (push to Supabase via queue)
        → Realtime Subscription (pull updates from other devices)
          → Zustand Store (merge remote state)
            → Feature Component (re-render)
```

### Reward Pipeline

**Current implementation:** `rewardUser()` in `gamificationStore.ts` — a Zustand action that calls registered hooks via bridge pattern:

```typescript
// gamificationStore.ts
rewardUser: (action, config) => {
  const hooks = get()._hooks;
  if (!hooks) return { treatsEarned: 0 };  // Guard: hooks not yet registered
  hooks.awardXp(action);
  const result = hooks.earnTreats(action, config.treats, config.reason);
  triggerXpPopup(result.earned, action);
  triggerSync();
  haptics[config.hapticMethod]();
  hooks.plantSeed(action, config.seedType);
  hooks.waterPlants(action);
}
```

Hooks are registered via `useHydrateGamification({ awardXp, earnTreats, plantSeed, waterPlants })` in Index.tsx.

---

## Storage Rules

1. **Dexie (IndexedDB) is the source of truth** for user data (moods, habits, focus sessions, etc.)
2. **Zustand persist** is for app state (preferences, UI state, auth tokens)
3. **NEVER use `localStorage` directly.** Use `SK.*` keys + `safeJson` accessors (`storageGetRaw`, `safeLocalStorageSet`, etc.). ESLint `no-restricted-globals` enforces this.
4. **Atomic writes**: When updating IndexedDB, persist FIRST, then update React state on success.
5. **Cloud sync is async and non-blocking.** Local-first: the app must work fully offline.

---

## Error Handling

### Rules

1. **Never empty catch blocks.** Every catch must log with context:
   ```typescript
   // BAD
   catch (e) {}
   catch (_) { /* ignore */ }

   // GOOD
   catch (error) {
     logger.error('[MoodTracker] Failed to save mood:', error);
   }
   ```

2. **React Error Boundary** wraps the entire app tree. Catches render errors, shows recovery UI.

3. **Circuit breaker for non-critical sync.** If a sync endpoint fails with schema error, disable for the session (see `reminderSync.ts` pattern).

4. **Sentry for production.** All unhandled errors + key breadcrumbs. No PII in error payloads.

5. **Graceful degradation.** If a feature fails to load/sync, the rest of the app continues. Never crash the whole app for a non-critical feature.

---

## Validation

### Rules

1. **Validate at every boundary** with Zod:
   - Supabase API responses
   - IndexedDB reads (data can be corrupted)
   - URL parameters and deep links
   - User form input before submit
   - Data coming from Capacitor plugins

2. **Zod schemas live next to their types:**
   ```typescript
   // shared/types/mood.ts
   export const MoodEntrySchema = z.object({
     id: z.string().uuid(),
     mood: z.enum(['terrible', 'bad', 'okay', 'good', 'great']),
     timestamp: z.string().datetime(),
     // ...
   });
   export type MoodEntry = z.infer<typeof MoodEntrySchema>;
   ```

3. **Fail gracefully:** If validation fails, log the error and use a safe default, don't crash.

---

## Component Rules

### Size limits

| Metric | Limit | Action if exceeded |
|--------|-------|--------------------|
| File lines | 400 max | Extract hooks, split into sub-components |
| useState hooks | 5 max per component | Extract into custom hook or Zustand store |
| useEffect hooks | 3 max per component | Extract into custom hook |
| Props | 7 max | Use composition, context, or store |
| Imports | 15 max | Component is doing too much — split |

### Patterns

1. **Container/Presenter split** for complex features:
   - Container: data fetching, state, side effects
   - Presenter: pure UI, receives props

2. **Custom hooks for logic extraction:**
   ```typescript
   // Instead of 5 useEffects in a component:
   function useMoodSync(moods: MoodEntry[]) {
     // All sync-related effects encapsulated here
   }
   ```

3. **No business logic in JSX.** Extract to functions or hooks.
   ```typescript
   // BAD
   {moods.filter(m => m.date === today && m.mood !== 'terrible').length > 0 && <Component />}

   // GOOD
   const hasTodayMoods = useMemo(() => filterTodayMoods(moods).length > 0, [moods]);
   {hasTodayMoods && <Component />}
   ```

---

## Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase | `MoodTracker.tsx` |
| Hooks | camelCase + `use` prefix | `useMoodData.ts` |
| Stores | camelCase + `Store` suffix | `userDataStore.ts` |
| Types/Interfaces | PascalCase, no `I` prefix | `MoodEntry` (not `IMoodEntry`) |
| Zod schemas | PascalCase + `Schema` suffix | `MoodEntrySchema` |
| Constants | UPPER_SNAKE_CASE | `MAX_STREAK_DAYS` |
| Config objects | camelCase | `adConfig`, `rewardConfig` |
| Event handlers | `handle` + noun + verb | `handleMoodSave`, `handleHabitToggle` |
| Boolean props/state | `is`/`has`/`should` prefix | `isLoading`, `hasStreak`, `shouldSync` |
| Files (non-component) | camelCase | `challengeService.ts` |

---

## Testing

### Strategy

| Layer | Tool | What to test |
|-------|------|-------------|
| Unit | Vitest | Pure functions, utilities, store logic |
| Integration | Vitest + Testing Library | Hooks, store interactions |
| E2E | (future) Playwright | Critical user flows |

### Rules

1. **Every new business logic function MUST have tests.** No exceptions.
2. **Test the behavior, not the implementation.** Don't test internal state shape.
3. **Test file location:** `src/__tests__/{module}.test.ts` or co-located `*.test.ts`
4. **Coverage target:** 40% minimum, 70% for `shared/lib/` and `stores/`
5. **Test naming:** `describe('functionName', () => { it('should do X when Y', ...) })`

---

## Performance

### Rules

1. **React.memo** only when measured. Don't prematurely optimize.
2. **useMemo/useCallback** for expensive computations and stable references passed to children.
3. **Lazy load** feature modules:
   ```typescript
   const MoodTracker = lazy(() => import('@/features/mood'));
   ```
4. **Image optimization:** Use WebP, lazy loading, proper sizing.
5. **Bundle splitting:** Each feature module = separate chunk.
6. **No eslint-disable for exhaustive-deps.** Fix the dependency array or restructure the effect.

---

## Security

### Rules

1. **CSP policy:** No `unsafe-inline`, no `unsafe-eval`. Use nonces for inline scripts.
2. **No `dangerouslySetInnerHTML`** without DOMPurify sanitization.
3. **Supabase RLS:** Every table MUST have RLS enabled with proper policies.
4. **RLS performance:** Use `(select auth.uid())` not `auth.uid()` in policies.
5. **No secrets in client code.** Supabase anon key is public by design — all other keys go server-side.
6. **Input sanitization:** Validate and sanitize all user input before rendering or storing.
7. **Trigger/function safety (Supabase):**
   - ALWAYS read current function body before `CREATE OR REPLACE`
   - Cross-check every column against `CREATE TABLE` definition
   - Test signup flow after any auth trigger change

---

## i18n

### Current State

All translations live in a single 19,879-line file: `src/i18n/translations.ts`. Not yet split into per-language JSON files.

### Rules

1. **Target:** One JSON file per language: `src/i18n/locales/{lang}.json`
2. **No hardcoded user-facing strings.** Everything goes through `t()`.
3. **Supported languages (8):** en, uk, es, de, fr, ja, ar, he
4. **RTL support:** ar, he (Arabic, Hebrew)
5. **Fallback:** English for missing keys.

---

## Git & CI/CD

### Branch strategy
- `main` — production, always deployable
- `feature/*` — feature branches, PR to main
- `fix/*` — bug fix branches

### Commit messages
```
type: brief description

type = feat | fix | refactor | chore | docs | test | perf
```

### CI pipeline (GitHub Actions)
```
On PR to main:
  1. npm ci
  2. npm run lint
  3. npm run typecheck
  4. npm test
  5. npm run build
```

### Pre-commit hooks
- Lint staged files (ESLint)
- Type check
- Format (Prettier)

---

## Known Technical Debt

> Track items here until resolved. Remove when done.
> Last audit: 2026-02-16 (TD-20 Phase 6 — 33 components + 3 hooks + 3 hook-only resolved, 1 SKIP, DayClock deleted)

### Resolved

| ID | Was | Resolution | Date |
|----|-----|-----------|------|
| TD-12 | React Router vestigial (only 1 route `/`) | Removed entirely. SPA renders `<Index />` directly. `NavLink.tsx` (dead code) + `NotFound.tsx` deleted. Cleaned vite.config.ts manualChunks/optimizeDeps. | Phase 5 |
| TD-13 | No React Error Boundary | `ErrorBoundary.tsx` with `LazyErrorBoundary` + `ModalErrorBoundary` wrapping all lazy components | Pre-Phase 2 |
| TD-14 | Unused dependencies in package.json | `react-router-dom`, `@hookform/resolvers`, `embla-carousel-react`, `react-resizable-panels` removed. 3 dead shadcn/ui wrappers deleted (`carousel.tsx`, `resizable.tsx`, `chart.tsx`). 8 packages removed total. | Phase 5 |

### Partially Resolved

| ID | Severity | Description | Before | After | Status |
|----|----------|-------------|--------|-------|--------|
| TD-01 | ~~CRITICAL~~ → LOW | Index.tsx god component | 2,800 lines, 46 useState, 29 useEffect | **374 lines**, 4 useState, 4 useEffect, 43 imports | Under 400-line limit. AuthGate, useSettingsHandlers, useReminderMigration, useEmotionSync extracted. |
| TD-02 | ~~CRITICAL~~ → LOW | No state management | All prop drilling | **4 Zustand stores** + bridge hooks. Tab components still receive handler props. | Feature handlers not yet in stores. |
| TD-06 | ~~HIGH~~ → **DONE** | exhaustive-deps eslint suppressions | **41** across 28 files | **17 remaining** across 14 files (all legitimate mount-only/cleanup/ref patterns). 1 bug fixed: `JournalEntryEditor` prompts now update on language change (`ts` added to useMemo deps). | Audited all suppressions; only intentional patterns remain. |
| TD-10 | ~~HIGH~~ → DONE | ~~No runtime validation~~ | **Fixed 2026-02-16**: Created `src/lib/schemas.ts` with 9 Zod runtime schemas + `validateArray`/`validateObject` helpers. Added `itemSchema`/`objectSchema` params to `useIndexedDB` — eliminated 7 unvalidated `as T` casts. Wired schemas into `useHydrateUserData` (7 calls), `useInnerWorld`, `useGamification`. Replaced 6 ad-hoc validators in `realtimeSync.ts` with Zod `safeParse()`. Fixed 2 bugs: `'abandoned'→'aborted'` focus status, `emotion` string→object. All schemas use `.passthrough()` + `.default()` for forward/backward compat. 25 new tests (568 total). | src/lib/schemas.ts |

### Open

| ID | Severity | Description | Current Measurement | File |
|----|----------|-------------|-------------------|------|
| TD-03 | ~~CRITICAL~~ → DONE | ~~Non-atomic IndexedDB writes (read-modify-write race)~~ | **Fixed 2026-02-16**: Wrapped `clear()` + `bulkPut()` in `table.db.transaction('rw', table, ...)` for atomic array writes. Single `put()` calls (settings) were already atomic. Follows existing pattern from `clearLocalUserData()` in db.ts. | src/hooks/useIndexedDB.ts |
| TD-04 | ~~CRITICAL~~ → DONE | ~~CSP `unsafe-inline` for scripts and styles~~ | **Fixed 2026-02-16**: Removed `'unsafe-inline'` from both `script-src` and `style-src`. Moved 3 runtime `@keyframes` to index.css, externalized version check to `version-check.js` (Vite plugin). CSSOM property assignments (`style.cssText`, `setProperty`) are CSP-safe. | index.html, vite-plugin-version.ts, src/index.css |
| TD-05 | ~~CRITICAL~~ → DONE | ~~Web Locks API bypass in auth (causes AbortError on reload)~~ | **Fixed 2026-02-16**: Replaced no-op lock bypass with `resilientNavigatorLock` — tries `navigator.locks` first (cross-tab coordination), catches `AbortError` during OAuth redirect, falls back to in-memory serialization. Uses existing `isAbortError()` from validation.ts. | src/lib/supabaseClient.ts |
| TD-07 | ~~HIGH~~ → DONE | ~~Direct `localStorage` calls~~ | **Fixed 2026-02-16**: Central `SK` registry (src/lib/storageKeys.ts) + safeJson accessors + ESLint `no-restricted-globals` rule. 199 raw calls → 0 across 50+ files. | src/lib/storageKeys.ts |
| TD-08 | ~~HIGH~~ → DONE | ~~translations.ts monolith (all languages in one file)~~ | **Fixed 2026-02-16**: Split 19,879-line monolith into per-language files. `types.ts` (2,280L), 8 language files in `languages/` (~2,200L each), `index.ts` (37L assembler), `translations.ts` (3L re-export). Zero import changes needed. | src/i18n/ |
| TD-09 | ~~HIGH~~ → MEDIUM | Low test coverage | **Phase 3 done 2026-02-17**: 1273 → **1551 tests** (+278). Added 9 new files: taskMomentum (52), habits (18), seasonHelper (22), challenges (17), onboardingFlow (45), comebackChallenge (23), habitScheduleSync (40), authStateManager (17), innerWorldHelpers (44). 56 test files total. Phase 4 TODO: remaining hooks, complex service modules. | src/**/__tests__/ |
| TD-11 | ~~HIGH~~ → DONE | ~~CI pipeline missing lint + typecheck~~ | **Fixed 2026-02-16**: Added `eslint --quiet` + `tsc --noEmit` steps to deploy.yml. Still missing: `playwright`, `npm audit`. | .github/workflows/deploy.yml |
| TD-15 | ~~MEDIUM~~ → DONE | useInnerWorld.ts monolith | ~~780+ lines~~ → **336 lines** (extracted innerWorldHelpers.ts + useRestMode.ts) | src/hooks/useInnerWorld.ts |
| TD-16 | LOW | Prop drilling in HomeTab (~30 props) | Handlers + inner world values passed as props | src/components/tabs/HomeTab.tsx |
| TD-17 | ~~HIGH~~ → DONE | ~~Silent `.catch(() => {})` swallowing errors~~ | **Fixed 2026-02-16**: All 34 instances replaced with `logger.warn`/`logger.error` across 20 files. Categorized by risk: fire-and-forget (warn), data ops (error), with-fallback (warn + fallback). | Various |
| TD-18 | ~~HIGH~~ → DONE | ~~Memory leaks: uncleaned setTimeout in contexts~~ | **Fixed 2026-02-16**: MoodThemeContext — added useRef + clearTimeout cleanup (EmotionThemeContext already correct). | src/contexts/MoodThemeContext.tsx |
| TD-19 | ~~HIGH~~ → DONE | ~~Raw console.* calls bypassing logger.ts~~ | **Fixed 2026-02-16**: 16 calls replaced with logger.* in 4 files (main.tsx, sw.ts, sentry.ts, gamificationStore.ts). Remaining: logger.ts (6, implementation) + crashReporting.ts (7, implementation). | Various |
| TD-20 | ~~HIGH~~ → DONE | God components violating 400-line / 5-useState / 3-useEffect rules | **33 components + 3 hooks + 3 hook-only resolved**, DayClock deleted, 1 SKIP (sidebar), Celebrations.tsx false positive (4 components × 1 useEffect each). | See God Components table below |
| TD-21 | ~~MEDIUM~~ → DONE | ~~Scattered Capacitor platform checks~~ | **Fixed 2026-02-16**: Created `src/lib/platform.ts` — single source of truth for isNative, platform, isAndroid, isIos, isWeb. ~58 scattered calls → 0 outside platform.ts. 44 files updated, 3 test files migrated to mock `@/lib/platform`. | src/lib/platform.ts |
| TD-22 | ~~MEDIUM~~ → DONE | ~~Scattered import.meta.env access~~ | **Fixed 2026-02-16**: Created `src/lib/env.ts` — single source of truth for 11 env vars. 26 scattered calls → 0 outside env.ts. 15 files updated. | src/lib/env.ts |
| TD-23 | ~~MEDIUM~~ → DONE | ~~Direct Supabase calls in UI components~~ | **Fixed 2026-02-17**: Created `feedbackService.ts` + `accountService.ts`. Extracted 10 data/function operations from 5 UI files. 14 auth-only calls remain in place (by design). Original "71 calls" was inflated by grep matching imports/comments; actual was 21. | src/lib/feedbackService.ts, src/lib/accountService.ts |
| TD-24 | LOW | Low memoization + lazy loading coverage | Only **12/80+** components use React.memo. Only **6** lazy() imports. Heavy components not lazy-loaded. | Various |

### God Components (TD-20 Detail)

> Last audit: 2026-02-16 (Phase 6) via `wc -l` + `grep -c 'useState(' + 'useEffect('`. Limit: 400 lines, 5 useState, 3 useEffect.
> Every PASS must include evidence: command output, file path, or test checklist. No evidence = FAIL.
> **TD-20 COMPLETE**: All component and hook violations resolved. Only sidebar.tsx (vendored) remains as SKIP.

#### Resolved (33 components)

| File | Was | Now | Resolution |
|------|-----|-----|------------|
| ScheduleTimeline.tsx | 1,653L / 17st / 6eff | max 343L / 2st | `schedule/` — 9 files |
| StatsPage.tsx | 1,281L / 11st / 0eff | max 356L / 3st | `stats-page/` — 7 files |
| HyperfocusMode.tsx | 1,012L / 16st / 10eff | max 271L / 2st | `hyperfocus-mode/` — 7 files |
| MoodTracker.tsx | 712L / 15st / 3eff | max 240L / 3st | `mood-tracker/` — 7 files |
| FriendsPanel.tsx | 694L / 15st / 4eff | max 280L / 2st | `friends-panel/` — 8 files |
| BreathingExercise.tsx | 833L / 9st / 4eff | max 249L / 2st | `breathing-exercise/` — 8 files |
| GoalsPanel.tsx | 815L / 6st / 0eff | max 224L / 1st | `goals-panel/` — 7 files |
| AuthScreen.tsx | 749L / 7st / 8eff | max 271L / 0st | `auth-screen/` — 5 files |
| TasksPanel.tsx | 501L / 9st / 0eff | max 186L / 0st | `tasks-panel/` — 7 files |
| Leaderboard.tsx | 526L / 10st / 2eff | max 230L / 2st | `leaderboard/` — 5 files |
| AccountSection.tsx | 548L / 14st / 5eff | max 232L / 0st | `account-section/` — 6 files |
| DataSection.tsx | 419L / 9st / 1eff | max 260L / 2st | `data-section/` — 4 files |
| AnimatedStatsComponents.tsx | 694L / 4st / 3eff | max 349L / 2st | `animated-stats/` — 3 files |
| AnimatedEmotionEmoji.tsx | 650L / 0st / 0eff | max 305L / 0st | `animated-emotion-emoji/` — 3 files |
| CompactHabitCard.tsx | 605L / 2st / 1eff | max 400L / 2st | `compact-habit-card/` — 4 files |
| RingDetailSheet.tsx | 567L / 0st / 0eff | max 332L / 0st | `ring-detail-sheet/` — 5 files |
| EmotionGalaxy.tsx | 559L / 2st / 1eff | max 280L / 0st | `emotion-galaxy/` — 6 files |
| WeeklyReview.tsx | 548L / 1st / 0eff | max 294L / 1st | `weekly-review/` — 5 files (hook extracted) |
| HabitCreationForm.tsx | 536L / 0st / 1eff | max 394L / 0st | `habit-creation-form/` — 4 files |
| DailySurprise.tsx | 513L / 2st / 1eff | max 313L / 2st | `daily-surprise/` — 4 files (data pool extracted) |
| ComebackChallenge.tsx | 513L / 2st / 1eff | max 384L / 2st | `comeback-challenge/` — 3 files |
| WelcomeTutorial.tsx | 471L / 2st / 1eff | max 279L / 2st | `welcome-tutorial/` — 3 files (slides config extracted) |
| HabitCompletionCelebration.tsx | 462L / 1st / 1eff | max 245L / 1st | `habit-completion-celebration/` — 5 files (3 exports split) |
| FocusTimer.tsx | 448L / 0st / 0eff | max 204L / 0st | `focus-timer/` — 5 files |
| ChallengesPanel.tsx | 431L / 3st / 0eff | max 365L / 3st | `challenges-panel/` — 3 files |
| GratitudeJournal.tsx | 429L / 2st / 2eff | max 316L / 2st | `gratitude-journal/` — 4 files |
| UnifiedShareModal.tsx | 427L / 0st / 0eff | max 292L / 0st | `share/` — split to 3 files |
| WeeklyInsightsCard.tsx | 424L / 1st / 0eff | max 278L / 1st | `weekly-insights-card/` — 3 files |
| MoodWeather.tsx | 416L / 0st / 0eff | max 249L / 0st | `mood-weather/` — 4 files |
| HabitTracker.tsx | 416L / 2st / 1eff | max 370L / 2st | `habit-tracker/` — 4 files |
| AICoachOnboarding.tsx | 406L / 4st / 0eff | max 234L / 4st | `ai-coach-onboarding/` — 3 files (i18n extracted) |
| WhatsNewModal.tsx | 402L / 2st / 1eff | max 231L / 2st | `whats-new-modal/` — 3 files (changelog extracted) |
| QuestsPanel.tsx | 401L / 4st / 4eff | max 271L / 4st | `quests-panel/` — 3 files |

#### Resolved — Hook LOC violations (3 hooks, Phase 6)

| File | Was | Now | Resolution |
|------|-----|-----|------------|
| hooks/useInnerWorld.ts | 542L / 0st / 4eff | 336L | `innerWorldHelpers.ts` (161L) + `useRestMode.ts` (89L) |
| hooks/useFocusTimer.ts | 513L / 18st / 8eff | 399L | `focusTimerTypes.ts` (68L) + `useFocusTimerConfig.ts` (85L) |
| hooks/useStatsCalculations.ts | 413L / 0st / 0eff | 373L | `statsTypes.ts` (44L) — types extracted |

#### Resolved — Hook-only violations (3 files, Phase 6)

| File | Was | Now | Resolution |
|------|-----|-----|------------|
| schedule/AddEventModal.tsx | 269L / **8**st / 0eff | 5st | Merged 4 time useState into 1 object |
| auth-screen/useAuthSession.ts | 218L / 2st / **7**eff | 3eff | Removed ref-sync effect + merged 4 mount effects |
| schedule/useScheduleData.ts | 283L / 3st / **4**eff | 3eff | Merged task-loading + time-interval mount effects |

#### False positive (not a violation)

| File | Lines | useState | useEffect | Notes |
|------|-------|----------|-----------|-------|
| Celebrations.tsx | 311 | 4 | 4 | 4 components × 1 useEffect each — no single component exceeds limit |

#### Remaining — Component LOC violations (1 file >400L — SKIP)

| File | Lines | useState | useEffect | Notes |
|------|-------|----------|-----------|-------|
| ui/sidebar.tsx | **641** | 2 | 1 | shadcn vendored — SKIP |

#### Dead code (deleted)

| File | Lines | Notes |
|------|-------|-------|
| ~~DayClock.tsx~~ | ~~527~~ | Deleted — 0 component imports found in codebase |

#### Out of scope

| File | Lines | Notes |
|------|-------|-------|
| features/journal/JournalEntryEditor.tsx | **1,170** | Separate feature module |
| features/journal/JournalModule.tsx | **1,060** | Separate feature module |
| features/journal/JournalEntryList.tsx | **513** | Separate feature module |

---

### CI/CD: Actual vs Required

> `deploy.yml` exists but is incomplete vs ARCHITECTURE.md §15 requirements.

| Step | Required (§15) | Actual (deploy.yml) | Status |
|------|---------------|---------------------|--------|
| npm ci | Yes | Yes | PASS |
| npx eslint src/ --quiet | Yes | Yes (added 2026-02-16) | PASS |
| npx tsc --noEmit | Yes | Yes (added 2026-02-16) | PASS |
| npm test | Yes | Yes | PASS |
| npm run build | Yes | Yes | PASS |
| npm audit | Recommended | **No** | MISSING |
| Playwright E2E | Recommended | **No** | MISSING |

---

### Audit Cadence

> Run this checklist monthly (or after each major refactor). Compare metrics against [Codebase Metrics](#codebase-metrics-as-of-2026-02-16) table.

1. `npx tsc --noEmit` — must be 0 errors
2. `npx eslint src/ --quiet` — track error count
3. `npx vitest --run` — all tests pass
4. `npm run build` — succeeds
5. `grep -rn 'localStorage\.' src/ | wc -l` — **0** (enforced by ESLint, was 199)
6. `grep -rn '\.catch.*=> {}' src/ | wc -l` — track decrease from 34
7. `find src -name "*.tsx" -exec wc -l {} + | sort -rn | head -20` — god component progress
8. `grep -rl 'memo(' src/ --include="*.tsx" | wc -l` — memo adoption
