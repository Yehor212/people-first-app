# Epic 1: Quick Entry & Entry Types

**Status:** Backlog
**Created:** 2026-04-14
**Source:** [Diary Deep Redesign Research](../../reference/research/2026-04-14-diary-deep-redesign.md)

---

## Goal

Eliminate friction for daily journaling by introducing a Daylio-style 2-tap quick check-in mode and an entry type system that supports multiple journaling formats. Currently every entry requires opening the full editor — too much friction for daily use. 8M+ Daylio users prove demand for low-friction capture.

## Scope In

- **Quick Check-in Mode** (Tier 1 — Critical): 2-tap mood + activity icons, optional one-line note, 10-15 second total time
- **Entry Type System**: `entryType` field on JournalEntry supporting: standard, quick-checkin, morning-ritual, evening-reflection, thought-record, dream, time-capsule, freewrite-sprint, gratitude
- **Activity Tracker**: Default set of 16 customizable activity icons (exercise, meditation, reading, work, etc.), stored in new `journalActivities` Dexie table
- **Save Indicator**: Auto-save checkmark after 1.5s typing pause (Saving → Saved → Synced states)
- **Optimistic Saves**: Immediate Zustand update + green checkmark, background IndexedDB/Supabase write
- **Quick Check-in Entry Point**: Floating "+" FAB on diary home + swipe up gesture
- **Expand to Full Entry**: Pre-fill editor with mood + activities from quick check-in
- **Data Model Extensions**: `activities`, `entryType`, `wordCount` fields on JournalEntry

## Scope Out

- Home screen widget (Epic 6)
- Morning/evening prompt integration (Epic 5)
- Habit-mood correlation analytics (Epic 4)
- Activity-mood correlation charts (Epic 4 — depends on data from this Epic)
- Streak counting from quick check-ins (Epic 2 — consumes entries from this Epic)

## Success Criteria

- Quick check-in completion time < 15 seconds (from tap to saved)
- Quick check-in → full entry conversion rate tracked (target: 20%+ expand)
- Entry type filter working in search/list (filter by standard/check-in/dream/etc.)
- Auto-save indicator visible within 200ms of typing pause detection
- Zero data loss: optimistic save with IndexedDB fallback on Supabase failure
- All 8 languages supported for activity names and UI strings

## Dependencies

- Dexie schema migration (new `journalActivities` table, new fields on `journalEntries`)
- JournalModule.tsx orchestrator changes (new FAB button, routing to quick check-in)
- types.ts extension (JournalEntry interface, new types)

## Risks & Mitigations

| Risk                                           | Impact | Mitigation                                                          |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------- |
| Dexie schema migration breaks existing entries | High   | Version increment with upgrade handler preserving all existing data |
| Quick check-in feels too simple / not valuable | Medium | "Expand to full" CTA + streak integration (Epic 2) adds meaning     |
| Activity icon set too generic                  | Low    | User customization (add/remove/reorder) from day 1                  |
| FAB overlaps with existing UI elements         | Low    | Z-index layering per modal-standard.md, responsive positioning      |

## Architecture Impact

- **New Components**: `QuickCheckinSheet.tsx`, `ActivityGrid.tsx`, `SaveIndicator.tsx`
- **Modified**: `JournalModule.tsx` (FAB + routing), `JournalEntryCard.tsx` (entry type badge), `JournalEntryList.tsx` (type filter), `types.ts`, `db.ts`
- **New Storage**: `journalActivities` table in Dexie, `activities`/`entryType`/`wordCount` fields
- **New Hook**: `useQuickCheckin.ts`

## Phases

1. Data model extension (types.ts + db.ts migration)
2. Activity definitions + management UI
3. QuickCheckinSheet component
4. FAB entry point on diary home
5. Save indicator on editor
6. Entry type badges on cards + list filter
7. i18n for all 8 languages
