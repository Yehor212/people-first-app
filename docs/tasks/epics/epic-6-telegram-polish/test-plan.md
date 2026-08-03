# Epic 6: Telegram-Level Polish — Automated Test Plan

**Date:** 2026-04-15
**Approach:** Risk-Based Testing — high-risk business logic first, visual animations excluded.
**Framework:** Vitest + React Testing Library (project standard).

---

## Priority 1 — HIGH RISK (data loss, broken navigation, incorrect state)

### T01: Save state machine transitions (useJournalEditorState)
- **Type:** Unit
- **File to test:** `src/features/journal/useJournalEditorState.ts`
- **Risk:** HIGH — incorrect state = user thinks entry saved when it wasn't
- **Scenarios:**
  1. idle → saving → saved → idle (happy path, 2s timeout back to idle)
  2. idle → saving → error (save rejection)
  3. Ctrl+Enter blocked while saveState === "saving" (double-save prevention)
  4. MIN_SAVE_DISPLAY_MS (400ms) ensures "saving" is visible long enough
- **Mock:** `onSave` (resolve/reject), timer fakes via `vi.useFakeTimers()`

### T02: Word count milestone detection (useJournalEditorState)
- **Type:** Unit
- **File to test:** `src/features/journal/useJournalEditorState.ts`
- **Risk:** HIGH — false milestone on load = broken UX, missed milestone = silent failure
- **Scenarios:**
  1. No milestone fires on initial load (prevWordCountRef initialized to current count)
  2. Crossing 100-word threshold fires milestone 100
  3. Crossing 250 fires 250 (only lowest newly-crossed fires, not all)
  4. Going from 99 → 101 fires, but 101 → 105 does not re-fire
  5. Milestone auto-clears after 300ms
- **Mock:** Content state changes simulating typing

### T03: countWordsHtml utility (types.ts)
- **Type:** Unit (pure function)
- **File to test:** `src/features/journal/types.ts` → `countWordsHtml`
- **Risk:** HIGH — wrong count breaks milestone detection
- **Scenarios:**
  1. Empty string / null → 0
  2. Plain text word count
  3. HTML tags stripped (`<p>hello</p> <b>world</b>` → 2)
  4. `&nbsp;` treated as space
  5. Multiple whitespace collapsed
  6. Only tags / only whitespace → 0

### T04: parseDeepLink URL routing (deepLinks.ts)
- **Type:** Unit (pure function)
- **File to test:** `src/lib/deepLinks.ts` → `parseDeepLink`
- **Risk:** HIGH — wrong parsing = user lands on wrong screen or nowhere
- **Scenarios:**
  1. Unsupported short-ID forms such as `zenflow://challenge/ABC123` and web `/challenge/ABC123` → `{ type: "unknown" }`
  2. `zenflow://diary/mood` → `{ type: "diary", route: "mood" }`
  3. `zenflow://diary/editor` → `{ type: "diary", route: "editor" }`
  4. `zenflow://challenge?id=XYZ` → `{ type: "unknown" }`; no short-ID lookup contract exists
  5. Encoded challenge invites (`zenflow://challenge?data=...`) are verified through `useDeepLinkHandler`, not this generic parser
  6. OAuth callback URL (`login-callback`) → null (skipped by handleDeepLink)
  7. Malformed URL → null (try/catch)
  8. Unknown scheme → `{ type: "unknown" }`

### T05: computeStreaks calendar logic (JournalCalendar.tsx)
- **Type:** Unit (pure function — extract or test via module)
- **File to test:** `src/features/journal/JournalCalendar.tsx` → `computeStreaks`
- **Risk:** HIGH — wrong streaks = misleading visual data
- **Scenarios:**
  1. Empty dates → empty map
  2. Single date → no streak (minimum 2)
  3. Two consecutive dates → streak with isStart/isEnd flags
  4. Gap breaks streak: [Jan 1, Jan 2, Jan 5, Jan 6] → two separate streaks
  5. Long streak: 7 consecutive days, all flagged correctly
  6. Unsorted input dates → still works (internal sort)

---

## Priority 2 — MEDIUM RISK (degraded experience, wrong display)

### T06: Draft persistence lifecycle (useJournalEditorState)
- **Type:** Integration
- **File to test:** `src/features/journal/useJournalEditorState.ts`
- **Risk:** MEDIUM — lost draft = lost user work
- **Scenarios:**
  1. Draft saves to IndexedDB via debounced timer
  2. Draft loads on mount when entry is null (new entry)
  3. Draft older than 7 days is expired and deleted
  4. Draft cleared after successful save
  5. Fallback to localStorage when IndexedDB fails
- **Mock:** `settingsRepo` (put/get/delete), `vi.useFakeTimers()`

### T07: viewTransitions fallback (viewTransitions.ts)
- **Type:** Unit (pure function)
- **File to test:** `src/lib/viewTransitions.ts` → `startViewTransition`
- **Risk:** MEDIUM — crash on unsupported browsers
- **Scenarios:**
  1. Browser supports `startViewTransition` → calls it with callback
  2. Browser lacks API → callback called directly (no crash)

### T08: Widget mood data sync (useWidgetSync)
- **Type:** Unit (hook)
- **File to test:** `src/hooks/useWidgetSync.ts`
- **Risk:** MEDIUM — existing tests cover habits; need mood data coverage
- **Scenarios:**
  1. Mood data included in widget update payload
  2. Widget updates when mood changes (dependency tracking)
  3. Mood label localized per i18n language
- **Note:** Extend existing `useWidgetSync.test.ts`

### T09: Deep link subscription lifecycle (deepLinks.ts)
- **Type:** Unit
- **File to test:** `src/lib/deepLinks.ts` → `subscribeToDeepLinks`
- **Risk:** MEDIUM — leaked listener = memory leak, missed events
- **Scenarios:**
  1. Listener registered on subscribe
  2. CustomEvent detail passed to callback
  3. Cleanup function removes listener (no events after unsubscribe)

---

## Priority 3 — LOW RISK (cosmetic, enhancement)

### T10: SaveIndicator renders correct state (SaveIndicator.tsx)
- **Type:** Unit (component render)
- **File to test:** `src/features/journal/SaveIndicator.tsx`
- **Risk:** LOW — visual only, but verifies i18n keys and retry button
- **Scenarios:**
  1. `idle` → renders null
  2. `saving` → shows spinner + "Saving..." text
  3. `saved` → shows checkmark + "Saved" text
  4. `error` → shows alert icon + retry button (when onRetry provided)
  5. `error` without onRetry → no retry button
  6. `synced` → shows cloud icon
  7. `aria-live="polite"` present for screen readers

### T11: AnimatedCounter reduced-motion fallback (AnimatedCounter.tsx)
- **Type:** Unit (component)
- **File to test:** `src/components/ui/AnimatedCounter.tsx`
- **Risk:** LOW — a11y compliance
- **Scenarios:**
  1. When `shouldAnimate()` returns false → display equals target immediately
  2. Custom format function applied to display value
  3. Suffix appended correctly
  4. Target update after initial animation triggers re-animation

### T12: Calendar mood intensity coloring (JournalCalendar.tsx)
- **Type:** Integration (component render)
- **File to test:** `src/features/journal/JournalCalendar.tsx`
- **Risk:** LOW — visual, but verifies data-to-color mapping
- **Scenarios:**
  1. Day with "great" mood → green indicator
  2. Day with "terrible" mood → red indicator
  3. Day without mood → no color indicator
  4. Day with entry but no mood → neutral styling

---

## Implementation Notes

### Test file locations (per project convention)
| # | Test file path |
|---|----------------|
| T01-T02 | `src/features/journal/__tests__/useJournalEditorState.test.ts` |
| T03 | `src/features/journal/__tests__/types.test.ts` |
| T04, T09 | `src/lib/__tests__/deepLinks.test.ts` |
| T05, T12 | `src/features/journal/__tests__/JournalCalendar.test.ts` |
| T06 | `src/features/journal/__tests__/useJournalEditorState.test.ts` (same file as T01-T02) |
| T07 | `src/lib/__tests__/viewTransitions.test.ts` |
| T08 | `src/hooks/__tests__/useWidgetSync.test.ts` (extend existing) |
| T10 | `src/features/journal/__tests__/SaveIndicator.test.tsx` |
| T11 | `src/components/ui/__tests__/AnimatedCounter.test.tsx` |

### Extraction needed
- `computeStreaks` in `JournalCalendar.tsx` is currently a module-private function. To unit-test it, either:
  - (a) Export it (preferred — pure function, no side effects), or
  - (b) Test indirectly via component render with known dates

### Mocking patterns (follow existing `useWidgetSync.test.ts` style)
- `vi.mock('@/lib/platform')` for native/web branching
- `vi.mock('@/lib/logger')` to suppress log noise
- `vi.useFakeTimers()` for debounce/timeout tests
- `renderHook` from `@testing-library/react` for hook tests
- `vi.resetModules()` + `vi.doMock()` for per-test platform overrides

### Estimated effort
| Priority | Scenarios | Est. hours |
|----------|-----------|------------|
| P1 (T01-T05) | ~28 | 6-8h |
| P2 (T06-T09) | ~12 | 3-4h |
| P3 (T10-T12) | ~14 | 3-4h |
| **Total** | **~54** | **12-16h** |
