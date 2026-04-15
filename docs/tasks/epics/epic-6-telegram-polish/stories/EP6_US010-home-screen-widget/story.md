# EP6_US010: Home Screen Widget — Mood Diary Integration

**Status:** Backlog
**Epic:** 6 — Telegram-Level Polish
**Priority:** P3
**INVEST Score:** 5/6 (Estimable: iOS scope depends on platform setup)

---

## User Story

As a **diary user**, I want home screen widgets on my phone to quickly see my mood and streak, so that I can engage with my diary without opening the full app.

## Description

**Existing state (Android — READY):** 3 custom widget providers (Small 2x2, Medium 4x2, Large 4x4) already exist with streak/habits data, SharedPreferences sync, and `useWidgetSync.ts` hook (11 tests). Custom `WidgetPlugin.ts` Capacitor bridge is production-quality.

**What this story adds:**

1. **Mood data** to existing Android widgets — show current mood emoji alongside streak.
2. **Mini widget (2x1)** — new compact widget with mood emoji + streak count.
3. **Deep link intents** — tapping mood emoji opens diary to mood selection, tapping Write opens editor.
4. **iOS WidgetKit** — implement equivalent widgets for iOS (requires iOS platform to be set up).
5. **i18n** — widget strings in all 8 languages.

**Zero visual regression constraint:** Existing Android widgets continue to work. New mood data and mini widget are additive.

## Acceptance Criteria

1. **Given** I add the mini widget (2x1) to my Android home screen, **Then** I see my current mood emoji and streak count, and tapping it opens the app to the diary tab.
2. **Given** I have the small widget (2x2), **When** I log a mood in the app, **Then** the widget updates to reflect the new mood within the next update cycle (30 min or on app background).
3. **Given** I tap the Write button on any diary widget, **Then** the app opens directly to the journal editor (deep link).
4. **Given** I use the app in a non-English language, **Then** widget strings (streak label, prompt text) display in the correct language.

## Technical Notes

**Standards Research:** [RSH-001](../../../research/rsh-001-telegram-polish-standards.md) — section 10 (Home Screen Widget)

**Existing infrastructure (DO NOT rebuild):**

- `src/plugins/WidgetPlugin.ts` — Capacitor bridge
- `src/plugins/widgetTypes.ts` — `WidgetData` interface
- `src/plugins/WidgetWeb.ts` — web fallback (no-op)
- `src/hooks/useWidgetSync.ts` — sync hook (11 tests)
- `android/app/src/main/java/com/zenflow/app/WidgetPlugin.java` — native plugin
- `android/app/src/main/java/com/zenflow/app/WidgetProvider{Small,Medium,Large}.java` — existing providers
- SharedPreferences key: `zenflow_widget_prefs`

**New work:**

- Extend `WidgetData` interface: add `currentMood: string` (emoji), `moodLabel: string`.
- Extend `useWidgetSync.ts`: sync mood data from mood store.
- Android: create `WidgetProviderMini.java` (2x1) + layout XML + `appwidget_info_mini.xml`. Register in AndroidManifest.
- Android: add mood emoji display to existing Small widget layout.
- Android: deep link intents — `PendingIntent` with `zenflow://diary/mood` and `zenflow://diary/editor` URI schemes.
- i18n: widget strings via Android `strings.xml` per locale. 8 language resource directories.
- iOS: separate story/spike if `ios/` directory doesn't exist yet. WidgetKit requires iOS app target + App Groups.

**Risk:** iOS WidgetKit requires `cap add ios` and native Swift development. If iOS platform is not yet set up, iOS widget scope moves to a follow-up story. Android scope is self-contained.

**Files:** `widgetTypes.ts`, `useWidgetSync.ts`, `WidgetPlugin.java`, NEW: `WidgetProviderMini.java`, Android layouts, strings.xml per locale

## Dependencies

- All other EP6 stories recommended first (widget shows mood data from completed features)
- iOS platform setup (if iOS widget is in scope)

## Test Strategy

_(Planned by test planner)_

## Orchestrator Brief

```
tech: "Capacitor, Java (Android), Swift (iOS), TypeScript"
keyFiles: ["src/plugins/widgetTypes.ts", "src/hooks/useWidgetSync.ts", "android/.../WidgetPlugin.java", "new: WidgetProviderMini.java"]
approach: "Extend existing widget infra with mood data, add Mini provider, deep link intents, i18n strings"
complexity: "High (native Android code + deep links + i18n + potential iOS WidgetKit)"
```

## Definition of Done

- [ ] Mini widget (2x1) shows mood + streak on Android
- [ ] Existing widgets display current mood emoji
- [ ] Deep links open diary tab / editor correctly
- [ ] Widget strings in all 8 languages
- [ ] useWidgetSync syncs mood data
- [ ] Existing widget tests still pass
- [ ] No TypeScript errors
