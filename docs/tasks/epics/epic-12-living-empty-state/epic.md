# Epic 12: Living Empty State & Ambient Canvas

**Status:** Backlog
**Priority:** P1
**Created:** 2026-04-15
**Source:** [Diary Section Revolution](../../reference/research/2026-04-15-diary-section-revolution.md)

---

## Goal

Replace the static empty state (PenLine icon + "Select an entry or start writing") with a cinematic, time-of-day reactive living canvas featuring the ValenceOrb, typewriter rotating prompts, ambient particles, and contextual CTAs — transforming dead space into an invitation to write.

## Scope

### In Scope

- Time-of-day ambient gradient background:
  - Morning (6-12): warm golden gradient, rising energy particles
  - Afternoon (12-17): clear blue tones, steady floating particles
  - Evening (17-21): warm amber/purple, settling particles
  - Night (21-6): deep indigo, slow drifting stars
- ValenceOrb integration at 30% scale with breathing animation (neutral/calm state)
- Typewriter effect with rotating writing prompts:
  - Type out character by character (40ms/char)
  - Hold for 5 seconds
  - Erase backwards (20ms/char)
  - Pause 1 second, type next prompt
  - Source: existing `DAILY_QUOTES` array + new writing prompts (i18n)
- Two CTA pills: "Write" (✏️) + "Prompt" (🎯) with hover lift + glow animation
- Context line: "{N} entries this week · {streak} 🔥 streak"
- Ambient particles from existing `ParticleBackground` component
- `prefers-reduced-motion`: static gradient, no typewriter, no particles, no orb breathing
- Works in both LTR and RTL
- Responsive: adapts to editor panel width (narrow when sidebar expanded, wide when hidden)

### Out of Scope

- Entry card animations (Epic 6)
- Sidebar animations (Epic 10)
- Editor writing momentum (Epic 8)
- New writing prompt content creation (separate content task)

## Success Criteria

- Empty state renders in < 100ms (no blocking resources)
- CPU idle < 5% when empty state visible (efficient particles + orb)
- Typewriter cycles every ~8 seconds, correctly handles all 8 locales
- Time-of-day detection correct across timezones (uses `new Date().getHours()`)
- Orb uses existing shader pipeline (no new WebGL context or GPU resources)
- CTA "Write" button creates new entry (same as existing FAB)
- Ambient gradient transitions smoothly between time periods (not hard cut)
- Bundle size increase < 2KB gzip for new empty state code

## Dependencies

- `ValenceOrb` component (`src/components/ValenceOrb.tsx`) — existing
- `ParticleBackground` component (`src/components/stats/ParticleBackground.tsx`) — existing
- `DAILY_QUOTES` array in `JournalEntryList.tsx` — existing, reuse
- i18n: new keys for writing prompts in all 8 languages

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Orb + particles + typewriter strain low-end devices | High | Device capability detection: reduce particle count on weak GPU, skip orb on < 4GB RAM |
| Typewriter effect with RTL languages (Arabic, Hebrew) | Medium | Use `direction: rtl` CSS, erase from start not end, test with Arabic prompts |
| Time-of-day gradient hard transitions | Low | Use 30-minute blend zones between periods (e.g., 11:30-12:30 = morning→afternoon blend) |
| ValenceOrb WebGL context conflicts with editor | Low | Orb unmounts when editor opens (AnimatePresence exit), no context leak |

## Architecture Impact

### New Components

- `DiaryEmptyCanvas.tsx` — living empty state orchestrator
- `TypewriterText.tsx` — reusable typewriter effect with i18n support
- `TimeOfDayGradient.tsx` — ambient gradient based on current hour with blend zones

### Modified Components

- `JournalModule.tsx` — replace static empty state div with `<DiaryEmptyCanvas />`
- `src/i18n/translations.ts` — add writing prompt keys for all 8 languages

### Technical Approach

```
// DiaryEmptyCanvas renders when journal.view === "list" && no activeEntry
// Uses existing components:
//   <TimeOfDayGradient /> — CSS gradient background, updates every 15 min
//   <ParticleBackground /> — existing, pass time-of-day config
//   <ValenceOrb scale={0.3} /> — existing, breathing mode
//   <TypewriterText prompts={localizedPrompts} /> — new component

// Typewriter: useEffect with setInterval, tracks charIndex + promptIndex
// Cleanup on unmount, pause when document.hidden (Page Visibility API)
```

## Phases

1. **Time-of-day gradient:** `TimeOfDayGradient` component with blend zones
2. **Typewriter:** `TypewriterText` component with i18n prompts
3. **Orb + particles:** Integrate ValenceOrb at 30% + ParticleBackground
4. **CTA + context:** Action pills + streak/count line + reduced-motion fallback
