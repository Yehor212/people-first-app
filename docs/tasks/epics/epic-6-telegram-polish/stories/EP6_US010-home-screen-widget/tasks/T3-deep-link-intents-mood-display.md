# T3: Deep Link Intents & Mood in Small Widget

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US010 Home Screen Widget](../story.md)
**Related:** T1 (mood data), T2 (Mini provider)
**Parallel Group:** 2

---

## Context

### Current State

- Existing widgets open the app on tap but without deep linking to specific sections.
- `WidgetProviderSmall.java` (2x2) shows habit data but no mood information.
- Deep link URI schemes (`zenflow://`) may or may not be configured.

### Desired State

- Widget tap opens app to diary tab (deep link: `zenflow://diary/mood`).
- Write button opens journal editor directly (deep link: `zenflow://diary/editor`).
- Small widget (2x2) updated to include mood emoji display alongside existing content.

### Inherited Assumptions

- **A1 (PLATFORM):** Android `PendingIntent` with URI scheme handles deep linking to app sections.

---

## Implementation Plan

### Phase 1: Deep Link URI Setup

- [ ] Verify/add intent filter in AndroidManifest for `zenflow://` scheme
- [ ] Map `zenflow://diary/mood` → open app to diary tab
- [ ] Map `zenflow://diary/editor` → open app to journal editor

### Phase 2: Widget PendingIntents

- [ ] In `WidgetProviderMini.java` (T2): set `PendingIntent` on root → `zenflow://diary/mood`
- [ ] Add "Write" button area in Mini widget → `PendingIntent` to `zenflow://diary/editor`
- [ ] Update existing Small/Medium/Large providers: add diary deep link option

### Phase 3: Mood in Small Widget

- [ ] Update `WidgetProviderSmall.java` layout to include mood emoji display
- [ ] Read `currentMood` from SharedPreferences (same pattern as T2)
- [ ] Position mood emoji alongside existing habit data without breaking layout

---

## Technical Approach

### Recommended Solution

**Language:** Java (Android) + Capacitor deep link handling
**Existing:** `WidgetProviderSmall.java`, Capacitor app URL handling

### Key APIs

- `PendingIntent.getActivity(context, 0, intent, FLAG_IMMUTABLE)` — widget click action
- `Intent(Intent.ACTION_VIEW, Uri.parse("zenflow://diary/mood"))` — deep link intent
- AndroidManifest `<intent-filter>` with `<data android:scheme="zenflow" />`

### Implementation Pattern

```pseudocode
// Deep link intent
intent = Intent(ACTION_VIEW, Uri.parse("zenflow://diary/mood"))
pendingIntent = PendingIntent.getActivity(ctx, requestCode, intent, FLAG_IMMUTABLE)
views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

// Write button
writeIntent = Intent(ACTION_VIEW, Uri.parse("zenflow://diary/editor"))
writePending = PendingIntent.getActivity(ctx, requestCode+1, writeIntent, FLAG_IMMUTABLE)
views.setOnClickPendingIntent(R.id.write_button, writePending)
```

### Why This Approach

- URI-based deep linking is standard Android pattern
- Capacitor handles URI routing to correct app state

### Known Limitations

- Deep link handling on app side may need route mapping in Capacitor config or JS listener
- Each PendingIntent needs unique requestCode

### Patterns Used

- PendingIntent deep linking (standard Android widget pattern)
- URI scheme routing (Capacitor convention)

---

## Acceptance Criteria

- [ ] **Given** I tap any diary widget, **When** the app opens, **Then** it navigates directly to the diary tab.
- [ ] **Given** I tap the Write button on a widget, **When** the app opens, **Then** it navigates to the journal editor.
- [ ] **Given** the Small widget (2x2), **When** it renders, **Then** mood emoji is visible alongside existing content.
- [ ] **Given** the app is already open, **When** I tap the widget, **Then** it switches to diary tab without full restart.

---

## Affected Components

### Implementation

- `android/app/src/main/java/com/zenflow/app/WidgetProviderMini.java` — add deep link PendingIntents
- `android/app/src/main/java/com/zenflow/app/WidgetProviderSmall.java` — add mood display + deep link
- `android/app/src/main/res/layout/widget_small.xml` — add mood emoji element
- `android/app/src/main/AndroidManifest.xml` — verify/add intent filter for zenflow:// scheme
- `capacitor.config.ts` or JS route handler — handle deep link routing

---

## Existing Code Impact

### Refactoring Required

- `WidgetProviderSmall.java` — add mood data reading + emoji display to existing layout

### Tests to Update

- None expected (native Android changes)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Deep links work when app is cold-started and warm-started
- [ ] Small widget layout not broken by mood emoji addition
- [ ] NO new tests created
