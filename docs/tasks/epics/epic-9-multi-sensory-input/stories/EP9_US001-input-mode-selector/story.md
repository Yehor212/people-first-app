# EP9_US001: Input Mode Selector & Progressive Disclosure

**Epic:** Epic 9 — Multi-Sensory Input
**Priority:** P0 (Foundation)
**Complexity:** Medium
**Status:** Backlog
**Created:** 2026-04-14

---

## User Story

As a journal user, I want to choose from multiple input modes on the diary home screen so that I can express my emotions in the way that feels most natural right now.

---

## Acceptance Criteria

1. **Given** I open the diary entry screen, **When** the screen loads, **Then** I see 6 input mode icons: Write, Paint, Body, Scribble, Tap, Voice — with Write selected by default
2. **Given** I have fewer than 5 journal entries, **When** I view the mode selector, **Then** non-text modes appear locked with a subtle lock indicator, and tapping a locked mode shows a tooltip explaining how to unlock ("Write 5 entries to unlock")
3. **Given** I have 5+ journal entries, **When** I open the diary screen for the first time after reaching the threshold, **Then** I see an unlock animation revealing the new modes, and all modes become tappable
4. **Given** I select a non-default mode, **When** I navigate away and return within the same session, **Then** the previously selected mode is still active

---

## Test Strategy

(Planned separately by test planner)

---

## Technical Notes

- Component: `src/components/diary/InputModeSelector.tsx`
- Progressive disclosure threshold stored in app config (default: 5 entries)
- Entry count read from Zustand `userDataStore` or Dexie query
- Mode selector renders as horizontal icon strip below diary header
- Touch targets >= 44px per mode icon
- i18n: mode names + unlock tooltip in all 8 languages
- Unlock animation: respect `prefers-reduced-motion`
- Android back handler: mode selector is not a modal, no back handler needed

---

## Dependencies

- **Blocks:** EP9_US002, EP9_US003, EP9_US004, EP9_US005, EP9_US006, EP9_US007

---

## orchestratorBrief

```
tech: "React 18, TypeScript, Zustand, Tailwind, Capacitor"
keyFiles: "src/components/diary/InputModeSelector.tsx, JournalModule.tsx, userDataStore"
approach: "New component with 6 icon buttons, threshold check via entry count, session state for selection"
complexity: "Medium (progressive disclosure logic + unlock animation + i18n)"
```
