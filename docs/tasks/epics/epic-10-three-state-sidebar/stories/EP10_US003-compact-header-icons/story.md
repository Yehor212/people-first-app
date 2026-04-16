# EP10_US003: Compact Sidebar — Header Icons & New Entry

**Epic:** [Epic 10: Three-State Sidebar](../../epic.md)
**Status:** Backlog
**Priority:** P1
**Complexity:** Medium
**Created:** 2026-04-15

---

## Goal

Add header action icons (Diary, Stats, Settings) and a "+" new entry button to the compact sidebar so all sidebar actions remain accessible in the 48px icon-only mode.

## Acceptance Criteria

### AC1: Header Icons

- [ ] Top of compact sidebar shows 3 icons stacked vertically: Diary (📓 or PenLine), Stats (BarChart3), Settings (Settings)
- [ ] Each icon has tooltip on hover with action name (localized via i18n)
- [ ] Click Diary icon: expands sidebar to full mode
- [ ] Click Stats icon: opens JournalStats in the editor panel
- [ ] Click Settings icon: opens password/settings panel

### AC2: New Entry Button

- [ ] "+" icon at the bottom of the compact sidebar (fixed position, always visible)
- [ ] Click creates new entry and opens editor (same behavior as expanded sidebar FAB)
- [ ] Tooltip: localized "New entry" text
- [ ] Touch target >= 44px

### AC3: Visual Separator

- [ ] A subtle divider line separates header icons from mood dot strip
- [ ] Another divider separates mood dots from the "+" button
- [ ] Dividers use `border-border/20` (consistent with expanded sidebar)

### AC4: RTL & A11y

- [ ] Icons and layout work correctly in RTL mode (Arabic, Hebrew)
- [ ] All icons have `aria-label` attributes
- [ ] Keyboard Tab order: header icons → mood dots → new entry button

## Technical Notes

### Affected Components

- `src/features/journal/SidebarCompact.tsx` — add header/footer sections
- `src/features/journal/JournalModule.tsx` — wire Stats/Settings/NewEntry handlers to compact sidebar

### Dependencies

- EP10_US001 (sidebar state hook)
- EP10_US002 (SidebarCompact component exists)
