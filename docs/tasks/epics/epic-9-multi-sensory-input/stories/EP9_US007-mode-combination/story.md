# EP9_US007: Mode Combination & Sensory Attachments

**Epic:** Epic 9 — Multi-Sensory Input
**Priority:** P2
**Complexity:** Medium
**Status:** Backlog
**Created:** 2026-04-14

---

## User Story

As a journal user, I want to attach sensory captures (body map, painting, scribble, tapping pattern, voice tone) to my text entries so that I can combine written reflection with non-verbal emotional expression in a single entry.

---

## Acceptance Criteria

1. **Given** I am writing a text entry, **When** I tap a sensory mode icon, **Then** I can create a sensory capture that attaches to my current text entry without replacing the text
2. **Given** my entry has one or more sensory attachments, **When** I view the entry card in the journal list, **Then** I see small indicator icons showing which sensory modes are attached
3. **Given** I see sensory indicator icons on an entry card, **When** I tap an indicator, **Then** I see the full sensory artifact (body map, painting, scribble, ripple pattern, or voice analysis)

---

## Test Strategy

(Planned separately by test planner)

---

## Technical Notes

- Modifies: `JournalEntryEditor.tsx` — add sensory attachment flow
- Modifies: `JournalEntryCard.tsx` — render sensory mode indicator icons
- Modifies: `types.ts` — `JournalEntry` type gains optional fields: `bodyMap`, `palette`, `scribble`, `rhythm`, `voiceTone`
- Modifies: `db.ts` — Dexie schema migration to add sensory data columns
- Each sensory attachment is independent — user can add multiple different modes to one entry
- Attachment flow: tap mode icon → mode component opens as overlay → capture → save → return to text editor
- Indicator icons: small, consistent set of 5 icons matching mode selector
- Storage: each addon < 10KB, total entry size remains manageable
- i18n: attachment prompts, indicator labels in all 8 languages
- Standards research: `docs/research/rsh-003-multi-sensory-input-standards.md` §6

---

## Dependencies

- **Blocked by:** EP9_US001 (mode selector), EP9_US002-US006 (individual mode components must exist)

---

## orchestratorBrief

```
tech: "React 18, TypeScript, Zustand, Dexie, Tailwind"
keyFiles: "JournalEntryEditor.tsx, JournalEntryCard.tsx, types.ts, db.ts"
approach: "Add optional sensory fields to entry type, overlay flow for capture, indicator icons on cards"
complexity: "Medium (schema migration + editor integration + card rendering + multi-mode attachment flow)"
```
