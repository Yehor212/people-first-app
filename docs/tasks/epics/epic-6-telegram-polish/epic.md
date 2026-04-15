# Epic 6: Telegram-Level Polish & Micro-Interactions

**Status:** Backlog
**Created:** 2026-04-14
**Source:** [Diary Deep Redesign Research](../../reference/research/2026-04-14-diary-deep-redesign.md)

---

## Goal

Achieve Telegram-level interaction quality across the entire diary feature through systematic spring physics, haptic feedback, staggered animations, skeleton loading, and polishing all existing components. Every action must respond in < 100ms. The goal is not new features but making existing features feel alive, responsive, and delightful.

## Scope In

### Animation Infrastructure

- **Global Animation Config** (`src/config/animations.ts`): 5 spring presets (snappy/quick/smooth/playful/explosive), 5 duration presets (micro 100ms → celebration 800ms), 4 easing presets (enter/exit/overshoot/smooth), stagger config (40ms per item, cap at 5)
- **Page Transitions**: Shared element expand (list → detail), slide up (new entry), crossfade (detail → editor), scale from FAB (quick check-in)
- **Reduced Motion**: Full `prefers-reduced-motion` support, `body.reduce-motion` class

### Micro-Interactions

- **Mood Selection**: Selected emoji scales 1→1.3→1.1 (spring 600/15), color radiates, unselected fade
- **Word Count Milestone**: Counter pulses at 100/250/500/1000 words, confetti at 1000
- **Streak Increment**: Number rolls up with spring bounce, flame icon grows briefly
- **Entry Card Stagger**: +40ms delay per card (cap 5), translateY 20→0 + opacity fade
- **Swipe to Delete**: Rubber-band physics, red reveal at 80px threshold, haptic warning, undo toast
- **Save Indicator**: Checkmark fade-in (200ms), Saving → Saved → Synced states

### Haptic Feedback Map (Capacitor)

- Light impact: mood emoji, formatting toggle, photo attach, pull to refresh
- Medium impact: entry save, long press context menu
- Success notification: streak milestone, achievement unlock
- Warning notification: delete confirmation
- Selection tick: date picker scroll

### Existing Feature Polish

- **JournalEntryCard**: Activity icons row, streak fire icon, hero image mode (photo as card background), entry type badge pill, shared element transition
- **JournalEntryList**: Skeleton loading (shimmer), pull-to-refresh custom animation, infinite scroll (IntersectionObserver), search filter by entry type
- **JournalCalendar**: Tap day → filter list, mood intensity coloring, entry count dots, streak visualization (connected line), smooth month transition
- **JournalStats**: Animated path drawing for mood chart (stroke-dasharray, 1.2s), animated counters (count up, 800ms), streak stats section
- **JournalEntryEditor**: Floating formatting toolbar on text selection (Telegram-style), link auto-detection, markdown shortcuts (**bold** auto-convert)
- **BurnThought**: Add haptic feedback at phase transitions, optional subtle fire sound
- **GratitudeBloom**: 5 petal shapes (vs 1), color-code by category, haptic on bloom

### Skeleton & Performance Perception

- Entry list skeleton matching exact card layout (mood dot + title + content shimmer)
- Staggered content loading priority: text → tags → photos → audio → stats
- Optimistic saves pattern across all write operations

### Platform

- **Home Screen Widget** (Tier 1): Mini (2×1) mood picker, Small (2×2) mood + streak + write, Medium (4×2) prompt + mood + streak + write, Lock screen prompt (iOS 16+)

## Scope Out

- New feature logic (all other Epics)
- Map view (deferred — Tier 3, high effort, low impact)
- Sound design beyond BurnThought/GratitudeBloom enhancements
- Custom animation library (use CSS transitions + spring-physics helpers)

## Success Criteria

- Every tap/swipe responds in < 100ms (perceived, via optimistic updates)
- 60 FPS maintained during all animations (profile with Chrome DevTools / Safari instruments)
- Skeleton loading visible for < 300ms on typical devices (IndexedDB is fast)
- Staggered list animation completes within 400ms total (5 items × 40ms + 200ms per)
- Haptic feedback works on iOS + Android (graceful no-op on web/desktop)
- `prefers-reduced-motion` disables ALL animations without breaking functionality
- Home screen widget renders correctly on iOS 16+ and Android 12+
- Lighthouse performance score maintained at 90+ after all animation additions
- Zero layout shift from skeleton → real content transitions

## Dependencies

- All Epics 1-5 (polish is applied on top of their components)
- Capacitor Haptics plugin
- Capacitor App Widgets plugin (for home screen widget)
- CSS View Transitions API (progressive enhancement, fallback to crossfade)
- IntersectionObserver API (for scroll-triggered animations)

## Risks & Mitigations

| Risk                                             | Impact | Mitigation                                                                              |
| ------------------------------------------------ | ------ | --------------------------------------------------------------------------------------- |
| Animations cause jank on low-end Android         | High   | Performance budget per animation, GPU-accelerated transforms only, test on real devices |
| Haptics not supported on all devices             | Low    | Wrap in try/catch, graceful no-op fallback                                              |
| Home screen widget Capacitor plugin immature     | Medium | Evaluate plugin maturity, fallback to PWA install prompt                                |
| Too many animations feel overwhelming            | Medium | Animation config allows easy tuning, user "reduced animations" toggle in settings       |
| CSS View Transitions API limited browser support | Low    | Progressive enhancement, fallback to opacity crossfade                                  |

## Architecture Impact

- **New Files**: `src/config/animations.ts` (global config), `src/hooks/useHaptics.ts`, `src/components/diary/SkeletonCard.tsx`, `src/components/diary/FloatingToolbar.tsx`
- **Modified (all existing diary components)**: JournalEntryCard, JournalEntryList, JournalCalendar, JournalCalendarFull, JournalStats, JournalEntryEditor, BurnThoughtWidget, GratitudeBloomWidget, DiaryFormatToolbar
- **New Capacitor Integration**: Haptics plugin, App Widget plugin
- **CSS**: New animation utility classes, spring-physics keyframes, skeleton shimmer

## Phases

1. Animation config file (`src/config/animations.ts`) — foundation for all other phases
2. Haptic feedback hook + integration across mood select / save / delete / streak
3. Entry card stagger animation + skeleton loading
4. Mood selection micro-interaction (spring scale + glow)
5. Save indicator + optimistic save pattern
6. Swipe-to-delete rubber-band physics + undo toast
7. Calendar polish (tap-to-filter, streak line, mood intensity)
8. Stats animated charts (path drawing, counter roll-up)
9. Editor floating toolbar + markdown shortcuts
10. BurnThought haptics + GratitudeBloom petal variety
11. Page transitions (shared element, slide, crossfade)
12. Home screen widget (Capacitor plugin evaluation → implementation)
13. Reduced motion audit (verify all animations respect preference)
14. Performance profiling + optimization pass
15. i18n for widget strings
