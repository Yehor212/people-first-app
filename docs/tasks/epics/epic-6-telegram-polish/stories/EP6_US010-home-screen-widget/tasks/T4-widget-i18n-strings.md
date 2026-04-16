# T4: Widget i18n Strings

**Epic:** [Epic 6 — Telegram-Level Polish](../../../../epics/epic-6-telegram-polish/epic.md)
**User Story:** [EP6_US010 Home Screen Widget](../story.md)
**Related:** T2 (Mini widget uses strings), T3 (Small widget uses strings)
**Parallel Group:** 3

---

## Context

### Current State

- Android `strings.xml` exists for default locale but widget-specific strings may not cover all 8 languages.
- App supports 8 languages: en, uk, es, de, fr, ja, ar, he.
- Android uses `res/values-{locale}/strings.xml` for localization.
- Some locale directories may already exist for other app strings.

### Desired State

- Widget strings (streak label, prompt text, write button label) translated in all 8 languages.
- Each locale has its own `strings.xml` entry for widget content.
- RTL support for ar and he (Android handles this via layout mirroring).

### Inherited Assumptions

- **A1 (i18n):** All 8 languages must be covered per Law 17 (Babel Law). Missing translations = build/review failure.

---

## Implementation Plan

### Phase 1: Define Widget Strings

- [ ] Identify all user-visible strings in widget layouts:
  - Streak label (e.g., "day streak", "days streak")
  - Write/compose prompt (e.g., "Write", "New entry")
  - Mood label fallback (e.g., "No mood logged")
- [ ] Add to `res/values/strings.xml` (default = en)

### Phase 2: Create Locale Resources

- [ ] Create/update `res/values-uk/strings.xml` — Ukrainian translations
- [ ] Create/update `res/values-es/strings.xml` — Spanish translations
- [ ] Create/update `res/values-de/strings.xml` — German translations
- [ ] Create/update `res/values-fr/strings.xml` — French translations
- [ ] Create/update `res/values-ja/strings.xml` — Japanese translations
- [ ] Create/update `res/values-ar/strings.xml` — Arabic translations
- [ ] Create/update `res/values-iw/strings.xml` — Hebrew translations (Android uses `iw` not `he`)

### Phase 3: RTL Verification

- [ ] Ensure widget layouts use `android:layoutDirection="locale"` or default mirroring
- [ ] Arabic and Hebrew: verify text alignment and emoji position are correct
- [ ] No `android:gravity="left"` hardcoded — use `start`/`end` instead

---

## Technical Approach

### Recommended Solution

**Platform:** Android resource system (`res/values-{locale}/strings.xml`)

### Key APIs

- `@string/widget_streak_label` — Android resource reference in layouts
- `res/values-{locale}/` — locale-specific resource directories
- `android:supportsRtl="true"` — RTL support flag in manifest

### Implementation Pattern

```xml
<!-- res/values/strings.xml (en - default) -->
<string name="widget_streak_label">day streak</string>
<string name="widget_write_button">Write</string>
<string name="widget_no_mood">No mood logged</string>

<!-- res/values-uk/strings.xml -->
<string name="widget_streak_label">днів поспіль</string>
<string name="widget_write_button">Написати</string>
<string name="widget_no_mood">Настрій не записано</string>
```

### Why This Approach

- Android's built-in resource system is the standard i18n mechanism for widgets
- No runtime overhead — system loads correct locale at widget render time

### Patterns Used

- Android locale resource directories (standard)
- RTL-compatible layout attributes (`start`/`end` instead of `left`/`right`)

---

## Acceptance Criteria

- [ ] **Given** I use the app in Ukrainian, **When** widget renders, **Then** streak label and prompt text display in Ukrainian.
- [ ] **Given** all 8 languages, **When** I check `res/values-{locale}/strings.xml`, **Then** all widget strings are translated.
- [ ] **Given** Arabic or Hebrew locale, **When** widget renders, **Then** layout is mirrored (RTL) with correct text alignment.
- [ ] **Given** an unsupported locale, **When** widget renders, **Then** English strings display as fallback.

---

## Affected Components

### Implementation

- `android/app/src/main/res/values/strings.xml` — add widget string keys (en)
- `android/app/src/main/res/values-uk/strings.xml` — Ukrainian
- `android/app/src/main/res/values-es/strings.xml` — Spanish
- `android/app/src/main/res/values-de/strings.xml` — German
- `android/app/src/main/res/values-fr/strings.xml` — French
- `android/app/src/main/res/values-ja/strings.xml` — Japanese
- `android/app/src/main/res/values-ar/strings.xml` — Arabic
- `android/app/src/main/res/values-iw/strings.xml` — Hebrew

---

## Existing Code Impact

### Tests to Update

- None expected (resource files only)

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] All 8 languages have widget string translations
- [ ] RTL layout verified for Arabic and Hebrew
- [ ] NO new tests created
