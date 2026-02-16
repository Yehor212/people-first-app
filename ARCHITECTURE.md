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
| i18n | Custom (8 languages) |

---

## Folder Structure

```
src/
  app/                          # App shell (providers, routing, error boundary)
    App.tsx                     # Root component, provider tree
    ErrorBoundary.tsx           # Global React error boundary
    routes.tsx                  # Route definitions
    providers.tsx               # All context/provider wrappers

  features/                     # Feature modules — self-contained domains
    mood/
      components/               # UI components for this feature
      hooks/                    # Feature-specific hooks
      store.ts                  # Zustand slice for this feature
      types.ts                  # Feature-local types
      utils.ts                  # Feature-local utilities
      index.ts                  # Barrel export (public API)
    habits/
    focus/
    journal/                    # (already migrated)
    breathing/
    garden/                     # Inner World
    challenges/
    friends/
    schedule/
    gamification/               # XP, treats, streaks, levels, rewards
    onboarding/
    settings/

  shared/                       # Cross-feature reusable code
    components/                 # Generic UI (Button, Modal, Card, etc.)
      ui/                       # shadcn/ui primitives
    hooks/                      # Cross-feature hooks (useDebounce, usePlatform, etc.)
    lib/                        # Utilities & platform services
      haptics.ts
      logger.ts
      platformUtils.ts
      validation.ts             # Zod schemas for shared types
    types/                      # Shared type definitions
      index.ts
      supabase.ts               # Auto-generated DB types
    constants/                  # App-wide constants

  stores/                       # Global Zustand stores
    appStore.ts                 # Auth, initialization, active tab
    userDataStore.ts            # Moods, habits, focus sessions, gratitude
    gamificationStore.ts        # XP, treats, streaks, badges
    syncStore.ts                # Cloud sync state, offline queue

  storage/                      # Persistence layer
    db.ts                       # Dexie database schema
    cloudSync.ts                # Supabase sync orchestration
    realtimeSync.ts             # Realtime subscriptions

  i18n/
    locales/                    # One JSON file per language
      en.json
      uk.json
      ru.json
      ...
    index.ts                    # i18n setup, useTranslation hook

  plugins/                      # Custom Capacitor plugins
```

---

## Feature Module Pattern

Every feature is a self-contained module:

```
src/features/mood/
  components/
    MoodTracker.tsx             # Main feature UI
    MoodSelector.tsx            # Sub-component
    MoodHistory.tsx             # Sub-component
  hooks/
    useMoodData.ts              # Data access hook
    useMoodAnalytics.ts         # Feature-specific logic
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

### Three-layer model

| Layer | Tool | Scope | Example |
|-------|------|-------|---------|
| **Global client state** | Zustand | App-wide, persisted | Auth state, user preferences, active tab |
| **Server state** | TanStack React Query | Remote data, cached | Supabase queries, friend profiles |
| **Local UI state** | useState | Single component | Modal open/close, form input value |

### Rules

1. **Zustand for shared state.** If 2+ components need the same data, it goes in a Zustand store.
2. **React Query for server data.** All Supabase reads go through `useQuery`. All writes through `useMutation`.
3. **useState for UI-only state.** If it dies with the component, it's local state.
4. **No prop drilling deeper than 1 level.** Parent → Child is fine. Parent → Child → Grandchild → use a store.
5. **No direct localStorage.** Use Zustand `persist` middleware or `useIndexedDB` hook. Zero raw `localStorage.getItem` calls.

### Store file pattern

```typescript
// stores/userDataStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserDataState {
  moods: MoodEntry[];
  addMood: (entry: MoodEntry) => void;
  // ...
}

export const useUserDataStore = create<UserDataState>()(
  persist(
    (set, get) => ({
      moods: [],
      addMood: (entry) => set((s) => ({ moods: [...s.moods, entry] })),
    }),
    { name: 'zenflow-user-data' }
  )
);
```

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

### Reward Pipeline (single function, never copy-paste)

```typescript
// shared/lib/rewardPipeline.ts
export function rewardUser(action: RewardAction, config: RewardConfig): void {
  awardXp(action);
  const result = earnTreats(action, config.treats, config.reason);
  triggerXpPopup(result.earned, action);
  triggerSync();
  haptics[config.hapticMethod]();
  plantSeed(action, config.seedType);
  waterPlants(action);
  updateChallengeProgress();
  if (config.questUpdate) updateQuestProgress(action);
}
```

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

### Rules

1. **One JSON file per language:** `src/i18n/locales/{lang}.json`
2. **Flat key structure:** `"mood.tracker.title"` not nested objects
3. **No hardcoded user-facing strings.** Everything goes through `t()`.
4. **Supported languages:** en, uk, ru, de, fr, es, pt, ja, zh
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

| ID | Severity | Description | File | Status |
|----|----------|-------------|------|--------|
| TD-01 | CRITICAL | Index.tsx is 2,800-line god component | src/pages/Index.tsx | Open |
| TD-02 | CRITICAL | No state management, all prop drilling | src/pages/Index.tsx | Open |
| TD-03 | CRITICAL | Non-atomic IndexedDB writes | src/hooks/useIndexedDB.ts:337 | Open |
| TD-04 | CRITICAL | CSP unsafe-inline | index.html:9 | Open |
| TD-05 | CRITICAL | Web Locks bypass in auth | src/lib/supabaseClient.ts:114 | Open |
| TD-06 | HIGH | 40+ exhaustive-deps suppressions | Various | Open |
| TD-07 | HIGH | 178 direct localStorage calls in 54 files | Various | Open |
| TD-08 | HIGH | translations.ts is 19,879 lines | src/i18n/translations.ts | Open |
| TD-09 | HIGH | Test coverage ~6% | src/__tests__/ | Open |
| TD-10 | HIGH | No runtime validation at data boundaries | Various | Open |
| TD-11 | MEDIUM | No CI/CD pipeline | — | Open |
| TD-12 | MEDIUM | React Router vestigial (1 route) | src/App.tsx | Open |
| TD-13 | MEDIUM | No React Error Boundary | src/App.tsx | Open |
| TD-14 | MEDIUM | Unused deps (next-themes, etc.) | package.json | Open |
