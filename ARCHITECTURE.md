# ZenFlow Architecture & Coding Standards

> This document is the "constitution" of the ZenFlow codebase.
> Every PR, every feature, every refactor MUST follow these rules.
> Last updated: 2026-02-15

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
4. **No direct localStorage.** Use `useIndexedDB` hook or Zustand store. Zero raw `localStorage.getItem` calls.
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
3. **NEVER use `localStorage.getItem/setItem` directly.** Always go through a hook or store.
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
> Last audit: 2026-02-16 (after Phase 7: FocusTimer decomposition)

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
| TD-06 | ~~HIGH~~ → LOW | exhaustive-deps eslint suppressions | **41** across 28 files | **16 remaining** (all annotated with reasons). 25 fixed: dead suppressions removed, missing deps added, useCallback refactors. | Only intentional mount-only effects remain. |
| TD-10 | HIGH | No runtime validation | Zero validation | **Array.isArray** validation in `_hydrateFromDB`. No Zod schemas yet. | Partial — store boundary only. |

### Open

| ID | Severity | Description | Current Measurement | File |
|----|----------|-------------|-------------------|------|
| TD-03 | CRITICAL | Non-atomic IndexedDB writes (read-modify-write race) | 375 lines, core `put()` not transactional | src/hooks/useIndexedDB.ts |
| TD-04 | CRITICAL | CSP `unsafe-inline` for scripts and styles | `script-src 'self' 'unsafe-inline'` | index.html:9 |
| TD-05 | CRITICAL | Web Locks API bypass in auth (causes AbortError on reload) | Active bypass comment in code | src/lib/supabaseClient.ts |
| TD-07 | HIGH | Direct `localStorage` calls instead of hooks/stores | **188 calls in 58 files** | Various |
| TD-08 | HIGH | translations.ts monolith (all languages in one file) | **19,879 lines** | src/i18n/translations.ts |
| TD-09 | HIGH | Low test coverage | 543 tests pass, but ~6% line coverage | src/__tests__/ |
| TD-11 | MEDIUM | No CI/CD pipeline (GitHub Actions) | Manual builds only | — |
| TD-15 | ~~MEDIUM~~ → LOW | useInnerWorld.ts monolith | ~~780+ lines~~ → **542 lines** (12 dead functions removed, garden/ dir deleted) | src/hooks/useInnerWorld.ts |
| TD-16 | LOW | Prop drilling in HomeTab (~30 props) | Handlers + inner world values passed as props | src/components/tabs/HomeTab.tsx |
