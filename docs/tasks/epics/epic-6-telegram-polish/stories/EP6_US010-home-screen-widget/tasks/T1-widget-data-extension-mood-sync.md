# T1: WidgetData Extension & Mood Sync

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US010 Home Screen Widget](../story.md)
**Related:** T2 (Mini provider uses extended data), T3 (deep links use widget bridge), T4 (i18n strings)
**Parallel Group:** 1

---

## Context

### Current State

- `WidgetData` interface in `src/plugins/widgetTypes.ts` contains habit/streak data but NO mood data.
- `useWidgetSync.ts` syncs habit data to native widgets via `WidgetPlugin.ts` bridge (11 tests).
- Mood data (current emoji, label) available from mood/journal store.
- Widget bridge writes to SharedPreferences (`zenflow_widget_prefs`) on Android.

### Desired State

- `WidgetData` extended with `currentMood: string` (emoji) and `moodLabel: string`.
- `useWidgetSync` syncs mood data alongside existing habit data.
- Native widgets can read mood data from SharedPreferences.

### Inherited Assumptions

- **A1 (ARCHITECTURE):** `useWidgetSync.ts` is the single entry point for all widget data sync — extend, don't create parallel sync.

---

## Implementation Plan

### Phase 1: Extend WidgetData Interface

- [ ] Add `currentMood?: string` (emoji character) to `WidgetData` in `widgetTypes.ts`
- [ ] Add `moodLabel?: string` (translated mood name) to `WidgetData`
- [ ] Keep fields optional for backward compatibility with existing widgets

### Phase 2: Sync Mood Data

- [ ] In `useWidgetSync.ts`, read current mood from journal/mood store
- [ ] Include `currentMood` and `moodLabel` in the `widgetData` object passed to native bridge
- [ ] Mood updates when user logs mood (existing sync trigger on app background)

### Phase 3: Verify Bridge

- [ ] Ensure `WidgetPlugin.java` reads new fields from SharedPreferences JSON
- [ ] No Java changes needed IF plugin stores arbitrary JSON (verify)
- [ ] If Java parses specific fields → add `currentMood` and `moodLabel` parsing

---

## Technical Approach

### Recommended Solution

**Library:** Existing Capacitor widget bridge (`WidgetPlugin.ts` → `WidgetPlugin.java`)
**Existing:** `useWidgetSync.ts` (11 tests), `widgetTypes.ts`

### Key APIs

- `WidgetData` interface extension (TypeScript)
- `Widget.updateWidget(data: WidgetData)` — existing bridge call
- SharedPreferences JSON serialization (Android)

### Implementation Pattern

```pseudocode
// widgetTypes.ts
interface WidgetData {
  ...existing fields
  currentMood?: string    // "😊"
  moodLabel?: string      // "Happy" (translated)
}

// useWidgetSync.ts
const widgetData: WidgetData = {
  ...existingData,
  currentMood: moodStore.currentMood?.emoji,
  moodLabel: moodStore.currentMood?.label,
}
```

### Why This Approach

- Minimal change: 2 fields added to existing interface + sync
- Backward compatible: new fields are optional

### Patterns Used

- Interface extension (TypeScript optional fields for backward compat)
- Single sync hook pattern (project convention)

---

## Acceptance Criteria

- [ ] **Given** `WidgetData` interface, **When** I check the type, **Then** it includes `currentMood` and `moodLabel` as optional strings.
- [ ] **Given** I log a mood in the app, **When** widget sync runs, **Then** mood data is written to SharedPreferences.
- [ ] **Given** no mood is logged today, **When** widget sync runs, **Then** `currentMood` is undefined (no crash).
- [ ] **Given** existing widget tests, **When** I run them, **Then** all 11 existing tests still pass.

---

## Affected Components

### Implementation

- `src/plugins/widgetTypes.ts` — extend WidgetData interface
- `src/hooks/useWidgetSync.ts` — include mood data in sync
- `android/.../WidgetPlugin.java` — verify JSON parsing (may need field additions)

---

## Existing Code Impact

### Tests to Update

- `src/hooks/__tests__/useWidgetSync.test.ts` — existing mock may need `currentMood` field in expected data

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] All 11 existing widget tests pass
- [ ] WidgetData backward compatible (optional fields)
- [ ] NO new tests created
