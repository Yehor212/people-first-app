# T2: Mini Widget Provider (Android 2x1)

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US010 Home Screen Widget](../story.md)
**Related:** T1 (provides mood data), T3 (deep links), T4 (i18n)
**Parallel Group:** 2

---

## Context

### Current State

- 3 existing Android widget providers: `WidgetProviderSmall.java` (2x2), `WidgetProviderMedium.java` (4x2), `WidgetProviderLarge.java` (4x4).
- All read from SharedPreferences key `zenflow_widget_prefs`.
- Widget XML configs in `res/xml/`, layouts in `res/layout/`.
- Registered in `AndroidManifest.xml` as `<receiver>`.

### Desired State

- New `WidgetProviderMini.java` (2x1) showing mood emoji + streak count.
- Layout XML + `appwidget_info_mini.xml` config.
- Registered in AndroidManifest.
- Follows existing provider pattern (copy + adapt).

### Inherited Assumptions

- **A1 (ARCHITECTURE):** Follow existing WidgetProvider pattern exactly — SharedPreferences read, RemoteViews, AppWidgetProvider base class.

---

## Implementation Plan

### Phase 1: Widget Config & Layout

- [ ] Create `res/xml/appwidget_info_mini.xml`: minWidth=110dp, minHeight=40dp, updatePeriodMillis=1800000 (30min)
- [ ] Create `res/layout/widget_mini.xml`: horizontal layout with mood emoji (ImageView/TextView) + streak count (TextView)
- [ ] Use existing widget background drawable/style

### Phase 2: Provider Implementation

- [ ] Create `WidgetProviderMini.java` extending `AppWidgetProvider`
- [ ] `onUpdate`: read SharedPreferences, extract `currentMood` + streak, populate RemoteViews
- [ ] Handle null/missing mood data gracefully (show default emoji or placeholder)

### Phase 3: Manifest Registration

- [ ] Add `<receiver>` for `WidgetProviderMini` in `AndroidManifest.xml`
- [ ] Reference `appwidget_info_mini.xml` in `<meta-data>`
- [ ] Add preview image (can reuse/modify existing widget preview)

---

## Technical Approach

### Recommended Solution

**Language:** Java (matching existing providers)
**Existing pattern:** `WidgetProviderSmall.java`

### Key APIs

- `AppWidgetProvider.onUpdate()` — widget refresh callback
- `RemoteViews(packageName, R.layout.widget_mini)` — layout binding
- `SharedPreferences.getString("zenflow_widget_prefs", "{}")` — data read
- `JSONObject` parsing for mood/streak fields

### Implementation Pattern

```pseudocode
class WidgetProviderMini extends AppWidgetProvider:
  onUpdate(context, appWidgetManager, appWidgetIds):
    FOR each widgetId:
      prefs = context.getSharedPreferences("zenflow_widget_prefs", MODE_PRIVATE)
      json = JSONObject(prefs.getString("data", "{}"))
      mood = json.optString("currentMood", "😊")
      streak = json.optInt("streak", 0)

      views = RemoteViews(packageName, R.layout.widget_mini)
      views.setTextViewText(R.id.mood_emoji, mood)
      views.setTextViewText(R.id.streak_count, streak + " 🔥")
      views.setOnClickPendingIntent(R.id.widget_root, openAppIntent)

      appWidgetManager.updateAppWidget(widgetId, views)
```

### Why This Approach

- Follows established pattern from existing 3 providers
- SharedPreferences is the proven data bridge

### Patterns Used

- AppWidgetProvider pattern (standard Android widget)
- SharedPreferences JSON bridge (existing widget infrastructure)

---

## Acceptance Criteria

- [ ] **Given** I add the mini widget (2x1) to home screen, **Then** it displays current mood emoji and streak count.
- [ ] **Given** no mood is logged, **When** widget renders, **Then** default emoji shown (no crash).
- [ ] **Given** I tap the widget, **Then** the app opens to the diary tab.
- [ ] **Given** the widget exists on home screen, **When** 30 min passes or app backgrounds, **Then** widget data refreshes.

---

## Affected Components

### Implementation

- NEW: `android/app/src/main/java/com/zenflow/app/WidgetProviderMini.java`
- NEW: `android/app/src/main/res/layout/widget_mini.xml`
- NEW: `android/app/src/main/res/xml/appwidget_info_mini.xml`
- `android/app/src/main/AndroidManifest.xml` — register new receiver

---

## Existing Code Impact

### Tests to Update

- None expected (new native code, existing providers unchanged)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Widget appears in Android widget picker
- [ ] Follows existing provider code pattern
- [ ] NO new tests created
