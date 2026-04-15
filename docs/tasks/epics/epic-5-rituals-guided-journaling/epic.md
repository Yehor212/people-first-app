# Epic 5: Rituals, Guided Journaling & Ritual Engine

**Status:** Backlog
**Created:** 2026-04-14
**Source:** [Diary Deep Redesign Research](../../reference/research/2026-04-14-diary-deep-redesign.md)

---

## Goal

Solve blank page anxiety and build daily rituals through time-aware guided prompts, expanded templates, and context-adaptive UI. Research-backed: Seligman's gratitude practice shows 25% happiness boost. Five Minute Journal's morning/evening structure is a proven habit format. Context awareness makes the app feel alive and personal.

## Scope In

- **Morning & Evening Structured Prompts** (Tier 1 — Critical): Time-of-day-aware guided entries (Five Minute Journal format). Morning (before 12:00): 3 gratitudes + what would make today great + daily affirmation. Evening (after 18:00): 3 amazing things + how to improve + what I learned. Auto-detection of time → suggest appropriate template. Customizable prompts after first use
- **10 New Templates**: Morning Ritual, Evening Reflection, CBT Thought Record, Dream Journal, Decision Journal, Habit Check-in, Shadow Work, Travel, Freewrite Sprint, Letter to Future Self (expanding from current 5 to 15 total)
- **Context-Aware UI**: Time-of-day greetings ("Good morning, [name]"), color accent shifts (amber → daylight → golden → indigo), suggested template based on time, behavioral adaptation (0-3 entries: onboarding, 4-10: suggestions, 11-30: insights, 30+: full features, 100+: power user)
- **Dream Journal Mode** (Tier 3): Quick capture from lock screen, voice recording (eyes-closed-friendly), pre-set tags (vivid/lucid/nightmare/recurring), optional sketch pad, AI dream insight
- **Empty State Polish**: First-time (zero entries): warm illustration + "Your story starts here" + primary CTA. Empty search: magnifying glass + suggestions. Empty day: time-of-day gradient + contextual CTA
- **Freewrite Sprint Mode**: Timer + word goal + optional no-delete constraint for stream-of-consciousness writing

## Scope Out

- AI-generated personalized prompts (Epic 4 — AI capability)
- Challenge-based daily prompts (Epic 2 — Challenges system)
- Widget-based prompt display (Epic 6 — Platform)
- Smart reminder timing for prompts (Epic 2 — Smart Reminders)

## Success Criteria

- Morning/evening template usage: 30%+ of new entries use structured prompts within first 30 days
- Template variety: users try 3+ different templates within first 60 days
- Context-aware greeting accuracy: correct time-of-day detection 100% of the time
- Behavioral adaptation: progressive disclosure matches user maturity level
- Dream journal entries: 5%+ of entries tagged as dream type within 90 days
- Empty state → first entry conversion: 80%+ of new users create entry within first session
- Freewrite sprint completion rate > 50% for started sprints

## Dependencies

- **Epic 1**: Entry type system (`entryType` field for morning-ritual, evening-reflection, dream, freewrite-sprint)
- Existing `journalTemplates.ts` (extend, not replace)
- User profile data for name in greetings
- Device clock for time-of-day detection

## Risks & Mitigations

| Risk                                   | Impact | Mitigation                                                         |
| -------------------------------------- | ------ | ------------------------------------------------------------------ |
| Too many templates overwhelm users     | Medium | Progressive disclosure: show 5 most relevant, "See all" expandable |
| Morning/evening time zones wrong       | Low    | Use device local time, not server time                             |
| Context-aware UI feels creepy          | Low    | Transparent ("Based on the time of day"), user can disable         |
| Dream journal needs lock-screen access | Medium | Deep link from notification, Capacitor background mode             |
| Empty states feel generic              | Low    | Theme-aware illustrations, animated with reduced-motion respect    |

## Architecture Impact

- **Modified**: `journalTemplates.ts` (add 10 templates), `JournalModule.tsx` (greetings, context-aware CTA), `JournalEntryList.tsx` (empty states), `JournalEntryEditor.tsx` (entry type selector, freewrite mode)
- **New Components**: `TimeAwarePrompts.tsx`, `ContextGreeting.tsx`, `DreamEntryEditor.tsx`, `FrewriteSprintTimer.tsx`, `EmptyStateIllustration.tsx`
- **New Hooks**: `useTimeOfDay.ts`, `useUserMaturity.ts` (entry count → feature level)
- **New Data**: `dreamTags`, `sleepQuality` fields on JournalEntry, `promptUsed` tracking

## Phases

1. Time-of-day detection hook + context greeting component
2. Morning/evening structured prompt templates
3. Entry type selector in editor (before writing)
4. 10 new templates in journalTemplates.ts
5. Context-aware template suggestion logic
6. Behavioral adaptation (progressive feature disclosure)
7. Empty state illustrations + CTAs
8. Dream journal mode (tags, sleep quality, voice-friendly)
9. Freewrite sprint mode (timer, word goal)
10. i18n for all 8 languages

---

## Revolution Enhancement — Ritual Engine (Source: diary-revolution.md)

### Additional Scope In

- **Three-Act Ceremony** (Revolution — Tier 1): Journaling as a three-act ceremony with designed pauses and sensory transitions. Act I — Opening (15-30s): screen dims, paper rises with spring, breath sync begins, time-of-day greeting, Ma moment (3s intentional emptiness), then writing space fades in. Act II — Writing (user-paced): living canvas active, all existing features available, no interruptions. Act III — Closing (10-20s): save triggers orb reading, glyph crystallizes, contextual response (positive → GratitudeBloom, heavy → BurnThought option, neutral → wax seal animation), reflection card. State machine: idle → opening → writing → closing → idle. Customizable — power users can skip any act
- **Ma Principle — Designed Emptiness** (Revolution — Tier 1): Specific moments of intentional silence. Before writing: 3s empty space after greeting. After saving: 2s pause before response card. Between entries: atmospheric gradient gaps between date groups (not white space — emotional breathing room). Monthly review: 5s constellation rotation before text. Based on Japanese concept of Ma — the beauty of intentional empty space
- **Enhanced Time-of-Day Greetings** (Revolution — Tier 1): 4 ambient moods with color accent shifts. Morning (6-12): warm amber, "Good morning. What matters today?" Afternoon (12-18): natural light, "Pause. How is the day unfolding?" Evening (18-22): golden hour, "The day is settling. What will you carry forward?" Night (22-6): deep indigo, "Quiet night. Let the thoughts come."
- **Closing Ceremony** (Revolution — Tier 2): Based on entry content, ONE contextual response. Positive entry → GratitudeBloom (existing). Heavy entry → gentle option: "Would you like to let something go?" → BurnThought (existing). Neutral entry → wax seal animation (new: wax drops onto paper). Brief reflection card: word count, writing duration, weather report, emotional glyph
- **Research basis**: Cowry Consulting's Ritual Design Toolkit (4 behavioral patterns: pausing, sensory experience, sequencing, scripting)

### Additional Success Criteria

- Ritual completion (all 3 acts) > 60% for users with ritual enabled in first 30 days
- Ma pause duration adjustable (0-10s range, default 3s)
- Opening ceremony completes within 30 seconds maximum
- Closing ceremony integrates seamlessly with existing BurnThought/GratitudeBloom
- Ritual skip option accessible within 1 tap (no forced participation)
- Time-of-day greeting accuracy: 100% correct period detection

### Additional Architecture Impact

- **New Components**: `RitualEngine.tsx` (state machine wrapper), `OpeningCeremony.tsx`, `ClosingCeremony.tsx`, `WaxSealAnimation.tsx`, `MaPause.tsx`, `ReflectionCard.tsx`
- **New Hook**: `useRitualEngine.ts` (state machine: idle → opening → writing → closing → idle)
- **Modified**: `JournalEntryEditor.tsx` (wrap in ritual engine), existing `ContextGreeting.tsx` (enhance with 4 ambient moods)
- **Dependencies**: Epic 7 (glyph crystallization in closing ceremony), Epic 8 (weather report in reflection card)

### Additional Phases

11. Ritual Engine state machine (`useRitualEngine` hook + `RitualEngine` component)
12. Opening ceremony (screen dim + paper rise spring + greeting + Ma pause)
13. Enhanced time-of-day greetings (4 ambient moods with color accent shifts)
14. Closing ceremony (contextual response: Bloom/Burn/Seal + reflection card)
15. Ma principle integration (designed pauses throughout diary UI)
16. Ritual settings (enable/disable, skip shortcuts, Ma duration slider)
