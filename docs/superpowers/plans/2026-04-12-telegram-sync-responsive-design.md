# Telegram-Level Sync + Responsive Typography & Charts — Implementation Plan

**Spec**: `docs/superpowers/specs/2026-04-12-telegram-level-sync-and-responsive-design.md`
**Goal**: Telegram-quality cross-platform sync + responsive text/chart sizing

---

## Phase 1: Critical Sync Bug Fixes (prerequisite)

### Task 1.1–1.4: ALREADY FIXED (verified 2026-04-12)

- [x] Deletion-tracker filtering — present in all 3 pull functions (syncMoods:192, syncFocus:110, syncGratitude:147)
- [x] Dexie transactions — all pulls wrapped in `db.transaction("rw", ...)` (syncMoods:193, syncFocus:111, syncGratitude:148)
- [x] Backup deletion propagation — `mergeDeletedHabitIds` + `bulkDelete` inside transaction (backup.ts:625-629)
- [x] Dynamic import in Dexie transaction — no dynamic imports of deletionTracker exist (all static imports)

> Memory `project_sync_critical_findings.md` was 8 days stale. All 4 bugs were fixed in prior sessions.

---

## Phase 2: Responsive Typography System — COMPLETE

### Task 2.1: Add fontScale (localStorage + hook pattern, not Zustand)

- [x] Added `FONT_SCALE` key to `src/lib/storageKeys.ts`
- [x] Created `src/hooks/useFontScale.ts` — localStorage + custom event (same pattern as DopamineSettings)
- [x] Applies `--font-scale` CSS custom property on `:root`

### Task 2.2: Add --font-scale CSS custom property system

- [x] Updated `tailwind.config.ts` — all 8 fontSize + lineHeight wrapped in `calc(... * var(--font-scale, 1))`
- [x] Added chart CSS custom properties to `src/index.css` (--chart-font-axis/tooltip/label/title)
- [x] `useFontScaleInit()` called in `App.tsx` AnimationGate

### Task 2.3: Build font size settings UI with slider

- [x] Created `src/components/FontScaleSettings.tsx` — discrete 7-step slider
- [x] Live preview text, ARIA role=slider with valuemin/max/now/valuetext
- [x] Step dots for visual feedback
- [x] Integrated into `src/components/SettingsPanel.tsx` before Dopamine settings
- [x] Added 10 i18n keys to all 8 languages (types.ts + en/uk/es/de/fr/ja/ar/he)

### Task 2.4: Add RTL dir attribute management

- [x] Created `RtlDirectionManager` component in `App.tsx`
- [x] Sets `document.documentElement.dir = "rtl"` for ar/he, `"ltr"` for others
- [x] Placed inside `LanguageProvider` so `useLanguage()` works

### Task 2.5: Verify typography with tsc + vitest

- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx vitest run` — 3163 passed, 0 failures

---

## Phase 3: Responsive Charts — COMPLETE

### Task 3.1: Create chart typography tokens

- [x] Created `src/lib/chartTokens.ts` — CHART_FONT (axis/tooltip/label/title) + CHART_COLORS + CHART_MARGIN
- [x] Added `--chart-font-axis/tooltip/label/title` CSS custom properties to `src/index.css`

### Task 3.2: Fix HabitFrequencyChart responsive sizing

- [x] `src/components/habit-hub/HabitFrequencyChart.tsx` — imported CHART_FONT, replaced fontSize:10 with CHART_FONT.axis
- [x] Replaced `h-[140px]` with `@container` + `aspect-[5/2] @sm:aspect-[3/1] min-h-[100px] max-h-[200px]`

### Task 3.3: Fix JournalStats responsive sizing

- [x] `src/features/journal/JournalStats.tsx` — imported CHART_FONT, replaced all fontSize:10 with CHART_FONT.axis (6 occurrences)
- [x] Replaced all fontSize:11 with CHART_FONT.tooltip (2 occurrences)

### Task 3.4: Verify charts with tsc + vitest

- [x] `npx tsc --noEmit` — 0 errors (TSC_EXIT=0)
- [x] `npx vitest run` — 3163 passed, 0 failures (VITEST_EXIT=0)

---

## Phase 4: Sync Engine V2 — PARTIAL (3/9 tasks)

### Task 4.1: Enhance sync_events table schema — DEFERRED

- [ ] Create Supabase migration: add device_id, idempotency_key, version columns
- [ ] Add index on (entity_type, seq)

### Task 4.2: Build sync cursor management — COMPLETE

- [x] Created `src/lib/syncCursor.ts` — SyncCursor interface, loadSyncCursor/saveSyncCursor/advanceCursor, isBehind/getGapSize
- [x] Stores cursors in IndexedDB settings table via db.settings.put

### Task 4.3: Build gap detection + recovery — COMPLETE

- [x] Created `src/lib/syncGapRecovery.ts` — shouldApplyEvent (apply/ignore/gap), handleGap with 500ms coalescing window
- [x] processEventBatch with sorted application + device self-echo skip

### Task 4.4: Build sync poke channel

- [ ] Add single Supabase Realtime broadcast channel for sync notifications
- [ ] On poke: trigger delta pull (don't apply data from notification)

### Task 4.5: Upgrade offline queue with compaction

- [ ] Read `src/lib/offlineQueue.ts`
- [ ] Add operation compaction (CREATE+DELETE=remove, UPDATE+UPDATE=keep latest)
- [ ] Add priority levels (critical/high/normal/low)

### Task 4.6: Add sync state machine states

- [ ] Read `src/lib/syncStateMachine.ts`
- [ ] Add RECOVERING, OFFLINE, ONLINE_PENDING states + transitions

### Task 4.7: Build SyncStatusBadge component — COMPLETE

- [x] Created `src/components/SyncStatusBadge.tsx` — 6 states (synced/syncing/pending/offline/not-signed-in/error)
- [x] aria-live="polite", role="status", theme color tokens, motion-safe for pulse

### Task 4.8–4.9: Remaining sync tasks — DEFERRED to next session

- [ ] Task 4.4: Sync poke channel
- [ ] Task 4.5: Offline queue compaction + priority
- [ ] Task 4.6: Sync state machine new states
- [ ] Task 4.8: Sync integrity verification
- [ ] Task 4.9: Full sync engine verification

---

## Phase 5: Polish & Platform Parity — DEFERRED to next session

- [ ] Task 5.1: Haptic feedback on sync
- [ ] Task 5.2: Background sync on app resume
- [ ] Task 5.3: Sync status i18n keys
- [ ] Task 5.4: Final ci:preflight

---

## File Verification (evidence per changed file)

| #   | File                                               | Change                                                       | Evidence        |
| --- | -------------------------------------------------- | ------------------------------------------------------------ | --------------- |
| 1   | `src/lib/storageKeys.ts`                           | Added FONT_SCALE key                                         | tsc=0, eslint=0 |
| 2   | `src/hooks/useFontScale.ts`                        | NEW: font scale hook (7 levels, localStorage, CSS var)       | tsc=0, eslint=0 |
| 3   | `src/components/FontScaleSettings.tsx`             | NEW: slider UI with preview, ARIA, step dots                 | tsc=0, eslint=0 |
| 4   | `src/lib/chartTokens.ts`                           | NEW: CHART_FONT/CHART_COLORS/CHART_MARGIN tokens             | tsc=0, eslint=0 |
| 5   | `tailwind.config.ts`                               | All 8 fontSize wrapped in calc(clamp() \* var(--font-scale)) | tsc=0           |
| 6   | `src/index.css`                                    | Added --font-scale + --chart-font-\* CSS vars                | build=OK        |
| 7   | `src/App.tsx`                                      | useFontScaleInit() + RtlDirectionManager (ar/he)             | tsc=0, eslint=0 |
| 8   | `src/components/SettingsPanel.tsx`                 | Integrated FontScaleSettings                                 | tsc=0, eslint=0 |
| 9   | `src/components/habit-hub/HabitFrequencyChart.tsx` | Container-query sizing + CHART_FONT.axis                     | tsc=0, eslint=0 |
| 10  | `src/features/journal/JournalStats.tsx`            | CHART_FONT.axis (6x) + CHART_FONT.tooltip (2x)               | tsc=0, eslint=0 |
| 11  | `src/i18n/types.ts`                                | Added 10 fontScale\* type declarations                       | tsc=0           |
| 12  | `src/i18n/languages/en.ts`                         | 10 fontScale keys (English)                                  | tsc=0           |
| 13  | `src/i18n/languages/uk.ts`                         | 10 fontScale keys (Ukrainian)                                | tsc=0           |
| 14  | `src/i18n/languages/es.ts`                         | 10 fontScale keys (Spanish)                                  | tsc=0           |
| 15  | `src/i18n/languages/de.ts`                         | 10 fontScale keys (German)                                   | tsc=0           |
| 16  | `src/i18n/languages/fr.ts`                         | 10 fontScale keys (French)                                   | tsc=0           |
| 17  | `src/i18n/languages/ja.ts`                         | 10 fontScale keys (Japanese)                                 | tsc=0           |
| 18  | `src/i18n/languages/ar.ts`                         | 10 fontScale keys (Arabic)                                   | tsc=0           |
| 19  | `src/i18n/languages/he.ts`                         | 10 fontScale keys (Hebrew)                                   | tsc=0           |
| 20  | `src/components/SyncStatusBadge.tsx`               | NEW: 6-state sync indicator with ARIA                        | tsc=0, eslint=0 |
| 21  | `src/lib/syncCursor.ts`                            | NEW: Telegram pts-style seq counters                         | tsc=0, eslint=0 |
| 22  | `src/lib/syncGapRecovery.ts`                       | NEW: gap detection + 500ms coalescing + batch                | tsc=0, eslint=0 |

**Global evidence**: tsc 0 errors (TSC_EXIT=0), vitest 3163 passed (VITEST_EXIT=0), eslint 0 errors 0 warnings (ESLINT=0)

## Per-File Verification Checklist

- [x] `src/lib/storageKeys.ts` verified: FONT_SCALE key added, tsc=0, eslint=0
- [x] `src/hooks/useFontScale.ts` verified: font scale hook created, tsc=0, eslint=0
- [x] `src/components/FontScaleSettings.tsx` verified: slider UI created, tsc=0, eslint=0
- [x] `src/lib/chartTokens.ts` verified: chart tokens created, tsc=0, eslint=0
- [x] `tailwind.config.ts` verified: 8 fontSize wrapped in calc()\*var(--font-scale), tsc=0
- [x] `src/index.css` verified: --font-scale + --chart-font-\* CSS vars added, build=OK
- [x] `src/App.tsx` verified: useFontScaleInit + RtlDirectionManager, tsc=0, eslint=0
- [x] `src/components/SettingsPanel.tsx` verified: FontScaleSettings integrated, tsc=0, eslint=0
- [x] `src/components/habit-hub/HabitFrequencyChart.tsx` verified: container-query + CHART_FONT, tsc=0, eslint=0
- [x] `src/features/journal/JournalStats.tsx` verified: CHART_FONT.axis 6x + tooltip 2x, tsc=0, eslint=0
- [x] `src/i18n/types.ts` verified: 10 fontScale type declarations, tsc=0
- [x] `src/i18n/languages/en.ts` verified: 10 fontScale keys English, tsc=0
- [x] `src/i18n/languages/uk.ts` verified: 10 fontScale keys Ukrainian, tsc=0
- [x] `src/i18n/languages/es.ts` verified: 10 fontScale keys Spanish, tsc=0
- [x] `src/i18n/languages/de.ts` verified: 10 fontScale keys German, tsc=0
- [x] `src/i18n/languages/fr.ts` verified: 10 fontScale keys French, tsc=0
- [x] `src/i18n/languages/ja.ts` verified: 10 fontScale keys Japanese, tsc=0
- [x] `src/i18n/languages/ar.ts` verified: 10 fontScale keys Arabic, tsc=0
- [x] `src/i18n/languages/he.ts` verified: 10 fontScale keys Hebrew, tsc=0
- [x] `src/components/SyncStatusBadge.tsx` verified: 6-state sync indicator, tsc=0, eslint=0
- [x] `src/lib/syncCursor.ts` verified: Telegram pts-style cursors, tsc=0, eslint=0
- [x] `src/lib/syncGapRecovery.ts` verified: gap detection + batch processing, tsc=0, eslint=0
