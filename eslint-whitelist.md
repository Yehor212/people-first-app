# ESLint Inline Suppression Whitelist

> Generated: 2026-02-13 | ESLint target: `--max-warnings 0` PASS
> Total inline `eslint-disable-next-line` comments: 55

## Summary by Rule

| Rule | Count | Justification |
|------|-------|---------------|
| `react-hooks/exhaustive-deps` | 35 | Intentional dependency omissions to prevent re-render loops or stale closure bugs. Adding these deps would cause infinite effect cycles or behavior regressions. Each reviewed individually. |
| `@typescript-eslint/no-misused-promises` | 15 | Promise variables used in truthiness checks (`if (this.processingPromise)`) to gate concurrent execution. The check tests whether a Promise *object* exists (not its resolved value), which is correct. |
| `@typescript-eslint/no-floating-promises` | 1 | Fire-and-forget async call in event handler where the result is intentionally ignored. |
| `no-control-regex` | 2 | Intentional regex to strip control characters from export filenames. |

---

## react-hooks/exhaustive-deps (35 suppressions)

| File | Line | Context |
|------|------|---------|
| `src/components/ChallengeModal.tsx` | 197 | `useEffect` loads leaderboard once on mount. Adding `loadLeaderboard` would cause infinite loop. |
| `src/components/FocusTimer.tsx` | 293 | `useEffect` timer interval — `saveTimerState` is stable ref-based. |
| `src/components/FocusTimer.tsx` | 413 | `useEffect` completion handler — deps intentionally limited to timer state. |
| `src/components/HabitTracker.tsx` | 261 | `useMemo` with `today` — date string recalculated but value stable within day. |
| `src/components/HabitTracker.tsx` | 461 | `useCallback` — `isCompletedToday` is derived, adding would cause cascading rerenders. |
| `src/components/HyperfocusMode.tsx` | 149 | Ref cleanup — `soundGeneratorRef.current` captured before cleanup runs. |
| `src/components/MoodTracker.tsx` | 96 | `moods` array created inline — wrapping in useMemo would be premature. |
| `src/components/NotificationPermission.tsx` | 20 | `useEffect` checks permission once on mount. |
| `src/components/QuestsPanel.tsx` | 66 | `useEffect` — `t.syncFailedLocal` is translation string, stable per render. |
| `src/components/QuestsPanel.tsx` | 87 | `useEffect` — quest objects recreated each render, deps would cause infinite loop. |
| `src/components/SettingsPanel.tsx` | 66 | `useEffect` — `openSections` used for scroll-to behavior, runs once. |
| `src/components/ShareModal.tsx` | 119 | `useEffect` — canvas render on mount, deps intentionally empty. |
| `src/components/stats/DataMountains.tsx` | 143 | `safeData` conditional — wrapping in useMemo unnecessary for this visualization. |
| `src/components/stats/HabitCalendar.tsx` | 65 | `today` object — date constructed inline, stable within day. |
| `src/components/stats/WeeklyReview.tsx` | 173 | `today` object — same as HabitCalendar. |
| `src/components/stats/WeeklyReview.tsx` | 250 | `useMemo` — `calculateWeekStats` is module-level function, always stable. |
| `src/components/stats/WeeklyReview.tsx` | 252 | `useMemo` — same as above. |
| `src/components/TasksPanel.tsx` | 90 | `useEffect` — `t.syncFailedLocal` translation string, stable. |
| `src/components/TimeHelper.tsx` | 67 | `useEffect` — sound functions are stable refs, adding would cause resubscription. |
| `src/components/UserProgressBar.tsx` | 64 | `useEffect` — `animatedXp` is animation target, intentionally excluded. |
| `src/components/WeeklyCalendar.tsx` | 22 | `dayNames` array — created from translations, stable per language. |
| `src/features/journal/JournalEntryEditor.tsx` | 228 | Auto-save effect — deps limited to entry content changes only. |
| `src/features/journal/JournalEntryEditor.tsx` | 241 | Auto-save timer — same as above. |
| `src/features/journal/JournalEntryEditor.tsx` | 402 | Focus trap — runs once on mount. |
| `src/features/journal/JournalHabitSection.tsx` | 50 | `useEffect` — habit loading on mount. |
| `src/features/journal/JournalModule.tsx` | 154 | `useEffect` — `journal` object ref changes on every render. |
| `src/features/journal/JournalModule.tsx` | 160 | `useEffect` — `security` object ref changes on every render. |
| `src/features/journal/JournalStats.tsx` | 65 | `useMemo` — `moodLabels` is translations object, stable per language. |
| `src/features/journal/JournalStats.tsx` | 88 | `useMemo` — `language` is context value, adding would be redundant. |
| `src/features/journal/JournalStats.tsx` | 105 | `useMemo` — same as above. |
| `src/hooks/useGamification.ts` | 174 | `useEffect` — gamification state init, adding all deps would cause infinite loop. |
| `src/hooks/useGamification.ts` | 210 | `useEffect` — level-up notification, `userLevel.title` excluded to prevent re-fire. |
| `src/hooks/useInnerWorld.ts` | 845 | `useCallback` — `world.restDays` excluded, stable between renders. |
| `src/pages/Index.tsx` | 1273 | `useCallback` — IndexedDB setters are stable, adding is redundant. |
| `src/pages/Index.tsx` | 1487, 1617, 1660 | Various `useEffect` hooks — intentional one-time setup or stable outer-scope deps. |

## @typescript-eslint/no-misused-promises (15 suppressions)

| File | Lines | Context |
|------|-------|---------|
| `src/lib/offlineQueue.ts` | 164, 173, 349, 355, 359, 479, 583 | Promise-as-lock pattern: `if (this.initPromise)`, `if (this.enqueueLock)`, `if (this.processingPromise)` — checks whether a Promise object exists, not its resolved value. |
| `src/lib/ambientSounds.ts` | 169, 719, 749 | Same pattern: `if (this.fadePromise)` — guards concurrent audio operations. |
| `src/lib/apiClient.ts` | 170 | `if (this.refreshPromise)` — deduplicates token refresh calls. |
| `src/lib/authStateManager.ts` | 48 | `if (this.completionPromise)` — prevents duplicate auth completion. |
| `src/lib/syncOrchestrator.ts` | 148 | `if (this.processingPromise)` — prevents concurrent sync operations. |
| `src/storage/cloudSync.ts` | 47 | `if (currentSyncPromise)` — deduplicates sync calls. |
| `src/storage/innerWorldCloudSync.ts` | 127 | `if (syncInnerWorldPromise)` — same pattern. |

## @typescript-eslint/no-floating-promises (1 suppression)

| File | Line | Context |
|------|------|---------|
| `src/features/journal/JournalModule.tsx` | 420 | Fire-and-forget `handleQuickMood()` call in click handler. Error is caught inside the function. |

## no-control-regex (2 suppressions)

| File | Line | Context |
|------|------|---------|
| `src/features/journal/journalExport.ts` | 15 | Intentional: strips control characters from exported filenames for filesystem safety. |
| `src/lib/exportService.ts` | 60 | Same pattern: sanitizes filenames in PDF/Markdown export. |
