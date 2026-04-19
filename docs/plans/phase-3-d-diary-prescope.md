# Phase 3-D Diary Super-Page — Pre-Scope Notes (2026-04-18)

**Status:** Pre-research before formal team-lead plan. NOT yet approved.
**Trigger:** Phase 3-C HabitsPage in progress (Agent `af8b400b`); 3-D is next.
**Original plan estimate:** 4 days (`ia-restructure-4page-proposal-2026-04-16.md` §8 Phase 3-D)
**Revised estimate:** **8-12 days** (see "Why estimate doubled").

---

## Scope per IA Plan

> Build segmented control: Today / Journal / Focus / Plan / Review.
> Absorb JournalModule + FocusTimer + HyperfocusMode + DayPlans.
> Consolidate 5 «особые часы» components via `useClockTimer` unified hook.
> Delete duplicates (FocusTimer + BreathingExercise second copies).

## Why Estimate Doubled

### `src/features/journal/` — 21,360 LOC across 30+ files

| File | LOC | Status |
|---|---|---|
| `JournalModule.tsx` | **1884** | God component — needs decomposition before V2 wire-up |
| `JournalEntryEditor.tsx` | **1758** | God component |
| `useJournalEditorState.ts` | 1208 | Hook bloat |
| `JournalEntryList.tsx` | 973 | Approaching ceiling |
| `BurnThoughtWidget.tsx` | 869 | |
| `JournalStats.tsx` | 830 | NEW `.toFixed` violations (Law 17 i18n) |
| Other 24 files | ~13837 | Mostly CRUD + canvas + media |

**Pre-condition for Phase 3-D:** Decompose JournalModule + JournalEntryEditor into ≤350 LOC chunks first. Estimated 2-3 days alone.

### Scope drift discoveries

- `GardenTab.tsx` (181 LOC) per IA plan §3 was supposed to MERGE → Habits, but its actual content is **Today dashboard** (ScheduleTimeline + JournalModule + FocusTimer + BreathingExercise + MoodInsights). This belongs to Phase 3-D, not 3-C.
- HyperfocusMode + DayPlans + FocusTimer second copies need recon before merge plan.

## Recommended Phase 3-D Sub-Phases

| Sub-phase | Scope | Days | Blocker |
|---|---|---|---|
| 3-D.1 | Decompose `JournalModule.tsx` (1884→4-6 files ≤350) | 2 | None |
| 3-D.2 | Decompose `JournalEntryEditor.tsx` (1758→similar) | 2 | None |
| 3-D.3 | Build segmented control shell + 5 sub-views | 1 | After 3-D.1+2 |
| 3-D.4 | Migrate Today (from GardenTab content) | 1 | After 3-D.3 |
| 3-D.5 | Migrate Journal sub-tab (using decomposed pieces) | 1 | After 3-D.4 |
| 3-D.6 | Migrate Focus + Plan + Review sub-tabs | 2 | After 3-D.5 |
| 3-D.7 | `useClockTimer` consolidation | 1 | Last |
| 3-D.8 | Delete duplicates (FocusTimer/BreathingExercise) | 0.5 | Phase 3-F cutover safer |
| **Total** | | **9.5 days** | |

## Pre-Phase Decisions Needed (from User)

1. **Decomposition timing:** decompose journal first as separate Phase 3-D.0 PRs (low-risk, keeps V1 working) OR mix into 3-D.1?
2. **Segmented vs scroll-linked** for Diary super-page (HabitsPage chose scroll — same approach for Diary?)
3. **Today sub-tab** — populate from GardenTab dashboard, or build fresh?
4. **AI Insider integration** — per IA plan §13 Q7 «Only AI Insider kept». Where in Diary?
5. **Year-in-Pixels widget** — per IA plan §13 Q8 «Diary (exact sub-tab TBD)». Stats tab? Review tab?

## Files Confirmed Required

### Source (modify or migrate):
- `src/pages/nav-v2/DiaryPage.tsx` — placeholder → real
- New: `src/pages/nav-v2/diary/` — sub-components (DiaryTodayZone, DiaryJournalZone, DiaryFocusZone, DiaryPlanZone, DiaryReviewZone)
- `src/features/journal/JournalModule.tsx` — decompose (separate sub-phase)
- `src/features/journal/JournalEntryEditor.tsx` — decompose
- `src/i18n/languages/*.ts` × 8 — new keys

### Reuse (read-only):
- `src/components/FocusTimer.tsx`
- `src/components/BreathingExercise.tsx`
- `src/components/HyperfocusMode.tsx`
- `src/components/ScheduleTimeline.tsx`
- `src/components/MoodInsights.tsx`
- `src/stores/userDataStore.ts`

### New tests:
- `src/pages/nav-v2/diary/__tests__/DiaryPage.test.tsx`
- One per zone

## Risks

1. **God-component decomposition could break existing 3786 vitest tests** — must preserve all entry CRUD + lock screen + canvas + sticker behaviors. Mitigation: strangler-fig pattern, extract one sub-component at a time with passing tests after each.
2. **Bundle bloat** — Diary already lazy-loads JournalModule (3.4 MB chunk per `lazy-import-policy`). After zone split, watch chunk graph for duplication.
3. **Journal canvas (`DiaryCanvas`, `FloatingMediaLayer`) is 517+ LOC of Konva-style canvas code** — touching it risks visual regression on stickers/photos.
4. **Auth-dependent journal (lock screen)** — must respect `JournalLockScreen` PIN flow on V2.

## Sources / Plans Referenced

- `C:\Users\egors\.claude\plans\ia-restructure-4page-proposal-2026-04-16.md` §8 Phase 3-D + §14 «Карминная вселенная»
- `C:\Users\egors\.claude\plans\frontend-design-plan-2026-04-16.md` §6 Signature layers
- `docs/audit/backlog-2026-04-18.md` — god-component canary entries

## When to Start

After Phase 3-C HabitsPage:
1. Cherry-picked + Police N=2 PASS
2. CI green on all checks
3. User explicit go for Phase 3-D
4. Decision on questions 1-5 above
