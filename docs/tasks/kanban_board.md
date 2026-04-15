# Diary Deep Redesign — Kanban Board

**Initiative:** Diary Deep Redesign + Revolution
**Created:** 2026-04-14
**Source:** [Deep Redesign](../reference/research/2026-04-14-diary-deep-redesign.md) | [Revolution](../reference/research/2026-04-14-diary-revolution.md)

---

## Linear Configuration

| Key              | Value               |
| ---------------- | ------------------- |
| Team ID          | — (file-based mode) |
| Next Epic Number | 10                  |

---

## Epic Story Counters

| Epic                                                 | Status  | Next Story | Stories Done | Story Prefix |
| ---------------------------------------------------- | ------- | ---------- | ------------ | ------------ |
| Epic 1: Quick Entry & Entry Types                    | Backlog | US001      | —            | EP1\_        |
| Epic 2: Engagement & Gamification                    | Backlog | US001      | —            | EP2\_        |
| Epic 3: Memories, Nostalgia & Living Timeline        | Backlog | US010      | 0/9          | EP3\_        |
| Epic 4: AI Intelligence, Insights & Emotional Mirror | Backlog | US011      | 0/10         | EP4\_        |
| Epic 5: Rituals, Guided Journaling & Ritual Engine   | Backlog | US001      | —            | EP5\_        |
| Epic 6: Telegram-Level Polish                        | Backlog | US011      | 0/10         | EP6\_        |
| Epic 7: Living Entries & Arousal Foundation          | Backlog | US009      | 0/8          | EP7\_        |
| Epic 8: Emotional Canvas                             | Backlog | US008      | 0/7          | EP8\_        |
| Epic 9: Multi-Sensory Input                          | Backlog | US008      | 0/7          | EP9\_        |

---

## Epics Overview

### Active

- [Epic 1: Quick Entry & Entry Types](epics/epic-1-quick-entry/epic.md) — Backlog
- [Epic 2: Engagement & Gamification](epics/epic-2-engagement-gamification/epic.md) — Backlog
- [Epic 3: Memories, Nostalgia & Living Timeline](epics/epic-3-memories-nostalgia/epic.md) — Backlog
- [Epic 4: AI Intelligence, Insights & Emotional Mirror](epics/epic-4-ai-intelligence/epic.md) — Backlog
- [Epic 5: Rituals, Guided Journaling & Ritual Engine](epics/epic-5-rituals-guided-journaling/epic.md) — Backlog
- [Epic 6: Telegram-Level Polish](epics/epic-6-telegram-polish/epic.md) — Backlog
- [Epic 7: Living Entries & Arousal Foundation](epics/epic-7-living-entries/epic.md) — Backlog
- [Epic 8: Emotional Canvas](epics/epic-8-emotional-canvas/epic.md) — Backlog
- [Epic 9: Multi-Sensory Input](epics/epic-9-multi-sensory-input/epic.md) — Backlog

### Archived

(none)

---

## Priority Order (Recommended)

Based on Impact × Effort from deep-redesign + revolution research:

1. **Epic 7** (foundation — arousal axis + glyphs, prerequisite for Epics 8, 9)
2. **Epic 1** → Epic 2 → Epic 5 (sequential — entry types → streaks → rituals + ritual engine)
3. **Epic 8** (after Epic 7 — emotional canvas uses arousal data)
4. **Epic 3** (independent — memories + living timeline can parallel)
5. **Epic 9** (after Epic 7 — multi-sensory input feeds visual params)
6. **Epic 6** (cross-cutting — apply polish as features land)
7. **Epic 4** (highest effort — AI infrastructure + emotional mirror)

**Critical path:** Epic 7 → Epic 8 (canvas needs arousal). Epic 1 → Epic 2 (streaks need entry types).
**Revolution foundation:** Epic 7 must land first — arousal + glyph pipeline enables Epics 3, 5, 8, 9.

---

## Epic 6 Stories (Telegram-Level Polish)

| Story     | Title                                                                                                                       | Priority | Complexity | Status  |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ------- |
| EP6_US001 | [Diary List — Stagger & Skeleton](epics/epic-6-telegram-polish/stories/EP6_US001-diary-list-polish/story.md)                | P0       | Medium     | Backlog |
| EP6_US002 | [Mood Selection Micro-Interaction](epics/epic-6-telegram-polish/stories/EP6_US002-mood-selection-microinteraction/story.md) | P1       | Low        | Backlog |
| EP6_US003 | [Journal Save Flow & Milestones](epics/epic-6-telegram-polish/stories/EP6_US003-journal-save-flow/story.md)                 | P1       | Medium     | Backlog |
| EP6_US004 | [Swipe-to-Delete](epics/epic-6-telegram-polish/stories/EP6_US004-swipe-to-delete/story.md)                                  | P1       | High       | Backlog |
| EP6_US005 | [Calendar Polish](epics/epic-6-telegram-polish/stories/EP6_US005-calendar-polish/story.md)                                  | P2       | Medium     | Backlog |
| EP6_US006 | [Stats Animated Charts](epics/epic-6-telegram-polish/stories/EP6_US006-stats-animated-charts/story.md)                      | P2       | Medium     | Backlog |
| EP6_US007 | [Editor Floating Toolbar](epics/epic-6-telegram-polish/stories/EP6_US007-editor-floating-toolbar/story.md)                  | P2       | High       | Backlog |
| EP6_US008 | [Ritual Widget Enhancement](epics/epic-6-telegram-polish/stories/EP6_US008-ritual-widget-enhancement/story.md)              | P2       | Low        | Backlog |
| EP6_US009 | [Page Transitions](epics/epic-6-telegram-polish/stories/EP6_US009-page-transitions/story.md)                                | P3       | High       | Backlog |
| EP6_US010 | [Home Screen Widget — Mood](epics/epic-6-telegram-polish/stories/EP6_US010-home-screen-widget/story.md)                     | P3       | High       | Backlog |

**Dependency chain:** US001 (foundation) → US004 (swipe needs stable list). All others independent.
**Parallelizable:** US002, US003, US005, US006, US007, US008 can run in parallel.
**Late-stage:** US009 (page transitions) and US010 (widget) recommended last.

---

## EP6_US001 Tasks (Diary List — Stagger & Skeleton)

| Task | Title                                                                                                                                                | Est. | Group | Status |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ------ |
| T1   | [Animation Config Foundation](epics/epic-6-telegram-polish/stories/EP6_US001-diary-list-polish/tasks/T1-animation-config-foundation.md)              | 3h   | 1     | Todo   |
| T2   | [Diary Skeleton Loader](epics/epic-6-telegram-polish/stories/EP6_US001-diary-list-polish/tasks/T2-diary-skeleton-loader.md)                          | 4h   | 1     | Todo   |
| T3   | [Stagger Animation Upgrade + Reduced Motion](epics/epic-6-telegram-polish/stories/EP6_US001-diary-list-polish/tasks/T3-stagger-animation-upgrade.md) | 4h   | 2     | Todo   |

**Total:** 11h | **Parallel Groups:** G1 (T1, T2 parallel) → G2 (T3 depends on T1)
**Execution order:** T1 + T2 in parallel → T3 after T1 completes

---

## EP6_US002 Tasks (Mood Selection Micro-Interaction)

| Task | Title                                                                                                                                                         | Est. | Group | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ------ |
| T1   | [Spring Bounce & Deselection Fade](epics/epic-6-telegram-polish/stories/EP6_US002-mood-selection-microinteraction/tasks/T1-spring-bounce-deselection-fade.md) | 3h   | 1     | Todo   |
| T2   | [Haptic Pulse on Pointer Down](epics/epic-6-telegram-polish/stories/EP6_US002-mood-selection-microinteraction/tasks/T2-haptic-pulse-pointer-down.md)          | 3h   | 1     | Todo   |

**Total:** 6h | **Parallel Groups:** G1 (T1, T2 parallel)
**Execution order:** T1 + T2 in parallel (no dependencies)

---

## EP6_US003 Tasks (Journal Save Flow & Word Count Milestones)

| Task | Title                                                                                                                                         | Est. | Group | Status |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ------ |
| T1   | [Save State Indicator Component](epics/epic-6-telegram-polish/stories/EP6_US003-journal-save-flow/tasks/T1-save-state-indicator-component.md) | 4h   | 1     | Todo   |
| T2   | [Word Count Milestones & Confetti](epics/epic-6-telegram-polish/stories/EP6_US003-journal-save-flow/tasks/T2-word-count-milestones.md)        | 4h   | 1     | Todo   |
| T3   | [Integrate Save Indicator into Editor](epics/epic-6-telegram-polish/stories/EP6_US003-journal-save-flow/tasks/T3-integrate-save-indicator.md) | 4h   | 2     | Todo   |

**Total:** 12h | **Parallel Groups:** G1 (T1, T2 parallel) → G2 (T3 depends on T1)
**Execution order:** T1 + T2 in parallel → T3 after T1 completes

---

## EP6_US004 Tasks (Swipe-to-Delete with Rubber-Band Physics)

| Task | Title                                                                                                                                       | Est. | Group | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ------ |
| T1   | [Swipe Gesture & Rubber-Band Physics](epics/epic-6-telegram-polish/stories/EP6_US004-swipe-to-delete/tasks/T1-swipe-gesture-rubber-band.md) | 4h   | 1     | Todo   |
| T2   | [Delete Action, Undo Toast & Haptic](epics/epic-6-telegram-polish/stories/EP6_US004-swipe-to-delete/tasks/T2-delete-action-undo-toast.md)   | 4h   | 1     | Todo   |
| T3   | [Visual Polish & Scroll Conflict](epics/epic-6-telegram-polish/stories/EP6_US004-swipe-to-delete/tasks/T3-visual-polish-scroll-conflict.md) | 4h   | 2     | Todo   |

**Total:** 12h | **Parallel Groups:** G1 (T1, T2 parallel) → G2 (T3 depends on T1, T2)
**Execution order:** T1 + T2 in parallel → T3 after both complete
**DRY Warning:** T2 reuses existing soft-delete flow from JournalModule.tsx + useJournal.ts

---

## EP6_US005 Tasks (Journal Calendar Polish)

| Task | Title                                                                                                                                           | Est. | Group | Status |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ------ |
| T1   | [Mood-Intensity Day Cell Coloring](epics/epic-6-telegram-polish/stories/EP6_US005-calendar-polish/tasks/T1-mood-intensity-day-coloring.md)      | 4h   | 1     | Todo   |
| T2   | [Streak Visualization](epics/epic-6-telegram-polish/stories/EP6_US005-calendar-polish/tasks/T2-streak-visualization.md)                         | 4h   | 1     | Todo   |
| T3   | [Calendar Transitions & Tap Filter](epics/epic-6-telegram-polish/stories/EP6_US005-calendar-polish/tasks/T3-calendar-transitions-tap-filter.md) | 4h   | 2     | Todo   |

**Total:** 12h | **Parallel Groups:** G1 (T1, T2 parallel) → G2 (T3 after mood/streak land)
**Execution order:** T1 + T2 in parallel → T3 after both complete

---

## EP6_US006 Tasks (Stats Animated Charts & Counters)

| Task | Title                                                                                                                                                 | Est. | Group | Status |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ------ |
| T1   | [Chart Path Drawing Animation](epics/epic-6-telegram-polish/stories/EP6_US006-stats-animated-charts/tasks/T1-chart-path-drawing-animation.md)         | 4h   | 1     | Todo   |
| T2   | [Animated Counter & Streak Display](epics/epic-6-telegram-polish/stories/EP6_US006-stats-animated-charts/tasks/T2-animated-counter-streak-display.md) | 4h   | 1     | Todo   |

**Total:** 8h | **Parallel Groups:** G1 (T1, T2 parallel)
**Execution order:** T1 + T2 in parallel (no dependencies)

---

## EP6_US007 Tasks (Editor Floating Formatting Toolbar)

| Task | Title                                                                                                                                                       | Est. | Group | Status |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ------ |
| T1   | [FloatingToolbar Upgrade & Portal](epics/epic-6-telegram-polish/stories/EP6_US007-editor-floating-toolbar/tasks/T1-floating-toolbar-upgrade.md)             | 5h   | 1     | Todo   |
| T2   | [Selection Detection & Toolbar Lifecycle](epics/epic-6-telegram-polish/stories/EP6_US007-editor-floating-toolbar/tasks/T2-selection-detection-lifecycle.md) | 4h   | 2     | Todo   |
| T3   | [Format Actions & Markdown Shortcuts](epics/epic-6-telegram-polish/stories/EP6_US007-editor-floating-toolbar/tasks/T3-format-actions-markdown-shortcuts.md) | 4h   | 2     | Todo   |

**Total:** 13h | **Parallel Groups:** G1 (T1) → G2 (T2, T3 parallel after T1)
**Execution order:** T1 first → T2 + T3 in parallel
**DRY Warning:** T1 extends existing DiaryFormatToolbar.tsx (90% similar — upgrade, not replace)

---

## EP6_US008 Tasks (Ritual Widget Enhancement)

| Task | Title                                                                                                                                                         | Est. | Group | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ------ |
| T1   | [BurnThought Phase Haptics](epics/epic-6-telegram-polish/stories/EP6_US008-ritual-widget-enhancement/tasks/T1-burnthought-phase-haptics.md)                   | 3h   | 1     | Todo   |
| T2   | [GratitudeBloom Petal Variety & Haptics](epics/epic-6-telegram-polish/stories/EP6_US008-ritual-widget-enhancement/tasks/T2-gratitude-bloom-petals-haptics.md) | 3h   | 1     | Todo   |

**Total:** 6h | **Parallel Groups:** G1 (T1, T2 parallel)
**Execution order:** T1 + T2 in parallel (no dependencies)

---

## EP6_US009 Tasks (Page Transitions & Shared Element Animation)

| Task | Title                                                                                                                                                      | Est. | Group | Status |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ------ |
| T1   | [Shared Element Card→Detail Expand](epics/epic-6-telegram-polish/stories/EP6_US009-page-transitions/tasks/T1-shared-element-card-expand.md)                | 5h   | 1     | Todo   |
| T2   | [FAB Scale Transition](epics/epic-6-telegram-polish/stories/EP6_US009-page-transitions/tasks/T2-fab-scale-transition.md)                                   | 3h   | 1     | Todo   |
| T3   | [Sub-Section Crossfade & View Transitions API](epics/epic-6-telegram-polish/stories/EP6_US009-page-transitions/tasks/T3-crossfade-view-transitions-api.md) | 5h   | 2     | Todo   |

**Total:** 13h | **Parallel Groups:** G1 (T1, T2 parallel) → G2 (T3 after transitions infrastructure)
**Execution order:** T1 + T2 in parallel → T3 after both complete

---

## EP6_US010 Tasks (Home Screen Widget — Mood Diary Integration)

| Task | Title                                                                                                                                                    | Est. | Group | Status |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- | ------ |
| T1   | [WidgetData Extension & Mood Sync](epics/epic-6-telegram-polish/stories/EP6_US010-home-screen-widget/tasks/T1-widget-data-extension-mood-sync.md)        | 3h   | 1     | Todo   |
| T2   | [Mini Widget Provider (Android 2x1)](epics/epic-6-telegram-polish/stories/EP6_US010-home-screen-widget/tasks/T2-mini-widget-provider.md)                 | 5h   | 2     | Todo   |
| T3   | [Deep Link Intents & Mood in Small Widget](epics/epic-6-telegram-polish/stories/EP6_US010-home-screen-widget/tasks/T3-deep-link-intents-mood-display.md) | 4h   | 2     | Todo   |
| T4   | [Widget i18n Strings](epics/epic-6-telegram-polish/stories/EP6_US010-home-screen-widget/tasks/T4-widget-i18n-strings.md)                                 | 3h   | 3     | Todo   |

**Total:** 15h | **Parallel Groups:** G1 (T1) → G2 (T2, T3 parallel) → G3 (T4 after layouts exist)
**Execution order:** T1 → T2 + T3 in parallel → T4 last

---

## Epic 3 Stories (Memories, Nostalgia & Living Timeline)

| Story     | Title                                                                                                                                     | Priority | Complexity | Status  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ------- |
| EP3_US001 | [On This Day — Daily Memory Card](epics/epic-3-memories-nostalgia/stories/EP3_US001-on-this-day-memory-card/story.md)                     | P0       | Medium     | Backlog |
| EP3_US002 | [On This Day — Push Notifications](epics/epic-3-memories-nostalgia/stories/EP3_US002-on-this-day-push-notifications/story.md)             | P1       | Medium     | Backlog |
| EP3_US003 | [Time Capsule — Write to Future Self](epics/epic-3-memories-nostalgia/stories/EP3_US003-time-capsule-write-to-future-self/story.md)       | P1       | High       | Backlog |
| EP3_US004 | [Year in Review — Journal Wrapped](epics/epic-3-memories-nostalgia/stories/EP3_US004-year-in-review-journal-wrapped/story.md)             | P1       | High       | Backlog |
| EP3_US005 | [Entry Sharing as Image Cards](epics/epic-3-memories-nostalgia/stories/EP3_US005-entry-sharing-image-cards/story.md)                      | P2       | Medium     | Backlog |
| EP3_US006 | [Constellation Journal — My Sky](epics/epic-3-memories-nostalgia/stories/EP3_US006-constellation-journal-my-sky/story.md)                 | P1       | High       | Backlog |
| EP3_US007 | [Emotion Sediment — Emotional Core](epics/epic-3-memories-nostalgia/stories/EP3_US007-emotion-sediment-emotional-core/story.md)           | P2       | Medium     | Backlog |
| EP3_US008 | [Growth Rings — Annual Dendrochronology](epics/epic-3-memories-nostalgia/stories/EP3_US008-growth-rings-annual-dendrochronology/story.md) | P2       | Medium     | Backlog |
| EP3_US009 | [Emotional River — Flowing Timeline](epics/epic-3-memories-nostalgia/stories/EP3_US009-emotional-river-flowing-timeline/story.md)         | P3       | High       | Backlog |

**Dependency chain:** US001 (foundation) → US002 (notifications need memory card). All others independent.
**Parallelizable:** US003, US004, US005, US006, US007, US008 can run in parallel.
**Late-stage:** US009 (Emotional River) recommended last — highest complexity, lowest priority.
**Revolution features:** US006 (Constellation), US007 (Sediment), US008 (Growth Rings), US009 (River) — depend on Epic 7 for arousal data (optional, fallback available).

---

## Epic 4 Stories (AI Intelligence, Insights & Emotional Mirror)

| Story     | Title                                                                                                                        | Priority | Complexity | Status  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ------- |
| EP4_US001 | [Weekly AI Emotional Report](epics/epic-4-ai-intelligence/stories/EP4_US001-weekly-ai-report/story.md)                       | P0       | High       | Backlog |
| EP4_US002 | [Compassionate Stranger](epics/epic-4-ai-intelligence/stories/EP4_US002-compassionate-stranger/story.md)                     | P0       | Medium     | Backlog |
| EP4_US003 | [Emotional Echo Detection](epics/epic-4-ai-intelligence/stories/EP4_US003-emotional-echo-detection/story.md)                 | P0       | High       | Backlog |
| EP4_US004 | [Voice-to-Text Enhancement](epics/epic-4-ai-intelligence/stories/EP4_US004-voice-to-text/story.md)                           | P1       | Medium     | Backlog |
| EP4_US005 | [CBT Thought Record](epics/epic-4-ai-intelligence/stories/EP4_US005-cbt-thought-record/story.md)                             | P1       | Medium     | Backlog |
| EP4_US006 | [Habit-Mood Correlation](epics/epic-4-ai-intelligence/stories/EP4_US006-habit-mood-correlation/story.md)                     | P1       | Medium     | Backlog |
| EP4_US007 | [Post-Entry Cognitive Reflection](epics/epic-4-ai-intelligence/stories/EP4_US007-cognitive-reflection/story.md)              | P2       | High       | Backlog |
| EP4_US008 | [Hidden Pattern Intelligence](epics/epic-4-ai-intelligence/stories/EP4_US008-hidden-pattern-intelligence/story.md)           | P2       | High       | Backlog |
| EP4_US009 | [Ask Your Journal Q&A](epics/epic-4-ai-intelligence/stories/EP4_US009-ask-journal-qa/story.md)                               | P2       | Medium     | Backlog |
| EP4_US010 | [Conversational AI with Mentor Personas](epics/epic-4-ai-intelligence/stories/EP4_US010-conversational-ai-personas/story.md) | P3       | High       | Backlog |

**Dependency chain:** US001 (foundation: LLM API pattern) → US002, US007, US008, US009, US010 (all need LLM). US003, US004, US005, US006 independent.
**Parallelizable:** US003 + US004 + US005 + US006 can run in parallel (no LLM dependency). US002 + US007 + US008 can parallel after US001.
**Deferred:** Emotion Granularity Training, Temporal Perspective Shift (add via ln-220 ADD mode later).

---

## Epic 7 Stories (Living Entries & Arousal Foundation)

| Story     | Title                                                                                                              | Priority | Complexity | Status  |
| --------- | ------------------------------------------------------------------------------------------------------------------ | -------- | ---------- | ------- |
| EP7_US001 | [Arousal Lookup Table](epics/epic-7-living-entries/stories/EP7_US001-arousal-lookup/story.md)                      | P0       | Low        | Backlog |
| EP7_US002 | [Visual Params Pipeline](epics/epic-7-living-entries/stories/EP7_US002-visual-params-pipeline/story.md)            | P0       | Medium     | Backlog |
| EP7_US003 | [Shader Arousal Integration](epics/epic-7-living-entries/stories/EP7_US003-shader-arousal-integration/story.md)    | P0       | Medium     | Backlog |
| EP7_US004 | [Emotional Glyph Generation](epics/epic-7-living-entries/stories/EP7_US004-emotional-glyph-generation/story.md)    | P0       | High       | Backlog |
| EP7_US005 | [Glyph Crystallization Animation](epics/epic-7-living-entries/stories/EP7_US005-glyph-crystallization/story.md)    | P1       | High       | Backlog |
| EP7_US006 | [Entry Aging Patina](epics/epic-7-living-entries/stories/EP7_US006-entry-aging-patina/story.md)                    | P1       | Low        | Backlog |
| EP7_US007 | [Breath-Synced Paper](epics/epic-7-living-entries/stories/EP7_US007-breath-synced-paper/story.md)                  | P1       | Low        | Backlog |
| EP7_US008 | [Glyph in Journal List & Fullscreen](epics/epic-7-living-entries/stories/EP7_US008-glyph-list-fullscreen/story.md) | P2       | Medium     | Backlog |

**Dependency chain:** US001 (foundation) → US002 (needs arousal) → US004 (needs visual params). US003 needs US001. US005 needs US003 + US004. US006 independent. US007 needs US001. US008 needs US004.
**Parallelizable:** US001 first → US002 + US003 + US006 in parallel → US004 + US007 → US005 + US008 last.
**Critical path:** US001 → US002 → US004 → US005 (glyph pipeline end-to-end).
**Total Story Points:** 35 SP (2+3+5+8+8+2+2+5)

---

## Epic 8 Stories (Emotional Canvas)

| Story     | Title                                                                                                                     | Priority | Complexity | Status  |
| --------- | ------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ------- |
| EP8_US001 | [Living Ink Diffusion](epics/epic-8-emotional-canvas/stories/EP8_US001-living-ink-diffusion/story.md)                     | P0       | High       | Backlog |
| EP8_US002 | [Typing Dynamics Mirror](epics/epic-8-emotional-canvas/stories/EP8_US002-typing-dynamics-mirror/story.md)                 | P1       | Medium     | Backlog |
| EP8_US003 | [Emotional Weather System](epics/epic-8-emotional-canvas/stories/EP8_US003-emotional-weather-system/story.md)             | P0       | High       | Backlog |
| EP8_US004 | [Weather Particles](epics/epic-8-emotional-canvas/stories/EP8_US004-weather-particles/story.md)                           | P1       | Medium     | Backlog |
| EP8_US005 | [Ink Pattern Preservation & Replay](epics/epic-8-emotional-canvas/stories/EP8_US005-ink-pattern-preservation/story.md)    | P1       | Medium     | Backlog |
| EP8_US006 | [Weather Report Badge](epics/epic-8-emotional-canvas/stories/EP8_US006-weather-report-badge/story.md)                     | P2       | Low        | Backlog |
| EP8_US007 | [Emotion Ink Settings & Graceful Fallback](epics/epic-8-emotional-canvas/stories/EP8_US007-emotion-ink-settings/story.md) | P2       | Medium     | Backlog |

**Dependency chain:** US001 (foundation: lexicon + ink) → US003 (weather needs lexicon) → US004 (particles need weather states), US006 (badge needs weather data). US002 independent. US005 needs US001. US007 last (cross-cutting).
**Parallelizable:** US001 + US002 can run in parallel. US005 + US003 can run in parallel after US001.
**Recommended order:** US001 + US002 → US003 + US005 → US004 + US006 → US007

---

## Epic 9 Stories (Multi-Sensory Input)

| Story     | Title                                                                                                                           | Priority | Complexity | Status  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- | ------- |
| EP9_US001 | [Input Mode Selector & Progressive Disclosure](epics/epic-9-multi-sensory-input/stories/EP9_US001-input-mode-selector/story.md) | P0       | Medium     | Backlog |
| EP9_US002 | [Body Map Touch](epics/epic-9-multi-sensory-input/stories/EP9_US002-body-map-touch/story.md)                                    | P0       | High       | Backlog |
| EP9_US003 | [Emotion Palette Painting](epics/epic-9-multi-sensory-input/stories/EP9_US003-emotion-palette/story.md)                         | P0       | High       | Backlog |
| EP9_US004 | [Scribble Express](epics/epic-9-multi-sensory-input/stories/EP9_US004-scribble-express/story.md)                                | P1       | Medium     | Backlog |
| EP9_US005 | [Rhythm Tapping](epics/epic-9-multi-sensory-input/stories/EP9_US005-rhythm-tapping/story.md)                                    | P1       | Medium     | Backlog |
| EP9_US006 | [Voice Tone Analysis](epics/epic-9-multi-sensory-input/stories/EP9_US006-voice-tone-analysis/story.md)                          | P1       | High       | Backlog |
| EP9_US007 | [Mode Combination & Sensory Attachments](epics/epic-9-multi-sensory-input/stories/EP9_US007-mode-combination/story.md)          | P2       | Medium     | Backlog |

**Dependency chain:** US001 (foundation) → US002-US006 (individual modes, parallelizable) → US007 (combination needs all modes).
**Parallelizable:** US002, US003, US004, US005, US006 can run in parallel after US001.
**Blocked by:** Epic 7 (entryToVisualParams integration).
**Recommended order:** US001 → US002 + US003 + US004 + US005 + US006 (parallel) → US007
