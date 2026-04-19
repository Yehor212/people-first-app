# Phase 3-D Diary Decomposition Strategy (2026-04-19)

**Status:** Research-backed plan. Pre-condition for Phase 3-D wire-up.
**Method:** Strangler-Fig pattern applied to React god-components.
**Scope:** Decompose `JournalModule.tsx` (1884 LOC) + `JournalEntryEditor.tsx` (1758 LOC) into ≤350 LOC chunks BEFORE building DiaryPage.

---

## 1. Why decompose first (vs wire-up first)

**Risk if we wire 1884-LOC monster directly into DiaryPage:**
- Single change ripples to 3786 vitest tests
- Bundle bloat (currently 4995/5050 ceiling — no headroom)
- Cannot reason about state — 19 useState hooks + 5 sub-hooks intertwine
- Phase 3-F V1 cutover becomes impossible without rewrite
- Future maintainers cannot safely touch any region

**Strangler-Fig trade-off:** decomposition adds 2-3 days but prevents 5-10 days of regression hunts later.

---

## 2. JournalModule.tsx — identified seams (1884 LOC)

| Lines | Region | Extract to | LOC |
|---|---|---|---|
| 1-90 | imports + types + constants | keep | 90 |
| 91-247 | state declarations (19 useState + 5 hooks) | `useJournalModuleState.ts` | 156 |
| 249-446 | callbacks (open, save, delete, navigate, password) | `useJournalModuleCallbacks.ts` | 197 |
| 447-590 | derived state + effects | `useJournalModuleEffects.ts` | 143 |
| 592-684 | top header bar (title + 5 action buttons) | `JournalModuleHeader.tsx` | 92 |
| 685-880 | onboarding flow (4 steps) | `JournalModuleOnboarding.tsx` | 195 |
| 881-1043 | editor view container (header + body) | `JournalModuleEditor.tsx` | 162 |
| 1044-1400 | floating panels (settings/password/shortcuts) | `JournalModuleModals.tsx` | 356 → split |
| 1400-1884 | celebrations + remaining UI | `JournalModuleCelebrations.tsx` | 484 → split |

**Result:** 1884 → 9 files, each ≤350 LOC.

---

## 3. JournalEntryEditor.tsx — identified seams (1758 LOC)

| Lines | Region | Extract to | LOC |
|---|---|---|---|
| 1-238 | imports + constants (fonts/themes/moods/inks) | `editorConstants.ts` | 238 |
| 239-end | main component | further split by sections | 1520 |

**Sub-extractions (estimated from grep):**
- `EditorToolbar.tsx` (formatting controls)
- `EditorMoodPicker.tsx` (MOOD_OPTIONS)
- `EditorInkPicker.tsx` (INK_COLORS)
- `EditorAtmospherePicker.tsx` (ATMOSPHERE_THEMES)
- `EditorPhotoArea.tsx`
- `EditorContentArea.tsx` (text input + ink rendering)

---

## 4. Strangler-Fig methodology (per-extraction)

For EACH extraction step:
1. **Identify boundary** — find props that the extracted region needs
2. **Extract pure** — copy region to new file with no logic change
3. **Add tests** — write tests for new file BEFORE wiring back
4. **Wire back** — replace in original with `<NewComponent {...props} />`
5. **Run vitest full** — must be 0 regression
6. **Commit** — single PR per extraction (`refactor(journal): extract <Name>`)

**Rule:** extractions land in `main` BEFORE Phase 3-D DiaryPage wiring starts. Each extraction is shippable independently.

---

## 5. 2026 Journaling UX research → DiaryPage architecture

**Patterns from leading apps (Day One, Journey, Stoic, Reflectly):**

1. **Blank Canvas + Structured guidance HYBRID** — Stoic's daily check-in (gratitude/worries/wins/improvements) for users who freeze at blank page; Day One's simplicity for power users. ZenFlow already has both: `JournalPrompt`, `JournalTemplatePicker`.

2. **Timeline + Calendar dual nav** — Day One uses timeline as primary, calendar as picker. ZenFlow has `JournalCalendar` + `JournalCalendarFull` + `JournalEntryList`. DiaryPage should expose all 3 via segmented control.

3. **Multimedia metadata** — automatic timestamp/location/weather. Existing: `MoodCorrelations`, `JournalStats`, `useDiaryCanvas`. Wire into Diary "Insights" sub-tab.

4. **Habit formation: gentle nudges** — Stoic's reminders are non-naggy. Existing: `JournalOnboardingHints`. Surface in Diary empty state, NOT modal.

5. **AI-guided reflection** — 2026 trend (Reflectly, mylifenote.ai). ZenFlow has `JournalEntryList:224` AI semantic search. Defer Diary AI integration to Phase 3-D.5+ (after segmented control works).

---

## 6. DiaryPage architecture (post-decomposition)

```
src/pages/nav-v2/diary/
├── DiaryPage.tsx                 (orchestrator, segmented control)
├── DiaryTodayZone.tsx            (today's entry quick-add)
├── DiaryJournalZone.tsx          (timeline of entries, reuses JournalEntryList)
├── DiaryFocusZone.tsx            (FocusTimer integration)
├── DiaryPlanZone.tsx             (DayPlans integration)
├── DiaryReviewZone.tsx           (JournalStats + MoodCorrelations)
├── DiaryCreateSheet.tsx          (vaul drawer wrapping decomposed editor)
├── useDiaryPageState.ts          (selectors only)
└── __tests__/
```

**Open question for user:** segmented vs scroll-linked. My recommendation: **segmented** for Diary because zones have distinct workflows (write vs review vs focus) — context-switching is intentional, not narrative.

---

## 7. Estimated effort (revised from 4 → 12 days)

| Phase | Scope | Days |
|---|---|---|
| 3-D.0a | Decompose `JournalEntryEditor` (1758→6 files) | 2 |
| 3-D.0b | Decompose `JournalModule` (1884→9 files) | 2 |
| 3-D.0c | Decompose `useJournalEditorState` (1208→3-4 hooks) | 1 |
| 3-D.1 | Build segmented control shell + 5 zone shells | 1 |
| 3-D.2 | Wire Today + Journal zones | 2 |
| 3-D.3 | Wire Focus + Plan zones | 2 |
| 3-D.4 | Wire Review zone | 1 |
| 3-D.5 | `useClockTimer` consolidation | 1 |
| **Total** | | **12 days** |

---

## 8. Acceptance criteria for decomposition (3-D.0)

Per extraction PR:
- ✅ tsc clean, eslint zero warnings
- ✅ vitest 3700+ green (no regression)
- ✅ Bundle delta ≤ +5KB per extraction
- ✅ Visual regression baselines unchanged
- ✅ All journal e2e tests still pass
- ✅ V1 (`?nav=v2` OFF) renders identically

---

## 9. References

- [Strangler Fig Pattern — AWS](https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-decomposing-monoliths/strangler-fig.html)
- [Strangler-Fig in React — gocodeo.com](https://www.gocodeo.com/post/how-the-strangler-fig-pattern-enables-safe-and-gradual-refactoring)
- [Best Journaling Apps 2026 — Mindful Suite](https://www.mindfulsuite.com/reviews/best-journaling-apps)
- [Day One Alternatives — mylifenote.ai](https://blog.mylifenote.ai/day-one-journal-alternative/)
- ADR-0002 Zustand-Dexie bridge pattern (this repo)
- IA Restructure Plan §8 Phase 3-D (this repo, 2026-04-16)

---

## 10. Decision needed from user before starting

1. **Approve strangler-fig (5 extraction PRs over 5 days BEFORE wire-up)?**
2. **Segmented vs scroll-linked** for DiaryPage?
3. **AI-guided reflection** — include in 3-D.x or defer?
4. **Year-in-Pixels widget** — Review zone or separate?
5. **Stats redirect** — what stays from V1 Stats?
