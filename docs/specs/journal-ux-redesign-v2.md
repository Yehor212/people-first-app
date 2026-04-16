# Journal UX Redesign — A++ Spec

> Synthesized from 6 research agents: codebase architecture, sidebar/animation patterns,
> design standards, competitive analysis (8 apps), animation web research, FTUE/empty states.
> Target: Telegram-level polish, A++ quality rating.

---

## Part 1: Current State Audit

### CRITICAL (Broken / Non-Functional)

| # | Issue | File | Impact |
|---|---|---|---|
| C1 | `useEntryTransition` state machine stuck in `morphing-forward` — `finishReverse` never called | `useEntryTransition.ts` + `JournalModule.tsx` | Layout morph breaks after first entry open |
| C2 | EP10_US004 AC1-AC3 unchecked — choreographed collapse/expand not implemented | `JournalModule.tsx:842-858` | Sidebar snaps instead of choreographed transition |
| C3 | Panel width uses CSS transitions (react-resizable-panels internal), not spring physics | `PanelLayout.tsx` | Expanded↔hidden feels mechanical, not alive |
| C4 | `sidebarPanelRef.current?.collapse()` — abrupt, no easing | `JournalModule.tsx` | Jarring UX on sidebar hide |

### MAJOR (Incomplete / Poor UX)

| # | Issue | File | Impact |
|---|---|---|---|
| M1 | EP10 stories US001-US003 stuck at "To Review" — not "Done" | `epic-10/stories/` | Unfinished acceptance criteria |
| M2 | No gesture-driven sidebar toggle (edge swipe) | `JournalModule.tsx` | Desktop-only via button, no touch affordance |
| M3 | MoodDotStrip tooltip — 300ms delay + no spring animation | `MoodDotStrip.tsx` | Tooltip appears flat, not premium |
| M4 | Desktop empty state (DiaryEmptyCanvas) — no CTA button, only ambient animation | `DiaryEmptyCanvas.tsx` | User sees pretty background but no clear action |
| M5 | No skeleton loading states — journal opens to blank screen during IndexedDB load | `JournalModule.tsx` | Perceived performance is poor |
| M6 | Photo layout drag — no snap guides, no alignment hints | `FloatingMediaLayer.tsx` | Free-form drag feels chaotic |
| M7 | No "On This Day" / memories feature | — | Missed re-engagement opportunity |
| M8 | Streak display — number only, no visualization | `JournalModule.tsx` | Streak feels like data, not achievement |
| M9 | Editor toolbar — static position, not floating | `DiaryFormatToolbar.tsx` | Toolbar hidden when scrolled past it |

### MINOR (Polish / Enhancement)

| # | Issue | File | Impact |
|---|---|---|---|
| m1 | Card view mood emoji — no micro-animation on tap | `JournalModule.tsx:508` | Card feels static |
| m2 | Calendar strip — no swipe gesture for week navigation | `JournalCalendar.tsx` | Tap-only navigation |
| m3 | Entry cards — no stagger animation on list mount | `JournalEntryList.tsx` | List appears all at once |
| m4 | Settings — flat list, no grouped sections | `JournalModule.tsx` settings area | Hard to scan |
| m5 | No haptic on sidebar toggle | `useSidebarState.ts` | Missing tactile feedback |
| m6 | Audio player — basic, no waveform visualization | `JournalAudioPlayer.tsx` | Feels like placeholder |
| m7 | Search — no recent searches, no suggestions | `JournalEntryList.tsx` | Search feels bare |
| m8 | No keyboard shortcut hints in UI | — | Power users can't discover shortcuts |

---

## Part 2: Competitive Intelligence — What to Steal

### From Telegram (Animation Bible)
- **Every gesture = spring physics** (stiffness 300-600, damping 25-35)
- **Haptic on every interaction** (light tap for selection, medium for state change, success for completion)
- **Lottie for celebrations** (streak milestones, first entry, weekly summary)
- **Performance class detection** — reduce animation complexity on weak devices

### From Bear (Sidebar)
- **3-column progressive collapse** = our 3-state sidebar
- **Focus mode** — everything disappears except words (we have ZenFocusMode but underused)
- **Typography-first** design — content is the star, chrome disappears

### From Daylio (Mood)
- **2-tap mood logging** — mood in <10 seconds (we have 5-point scale, make it faster)
- **Year in Pixels** — color grid of entire year (we compute streaks but don't visualize)
- **Mood correlations** — "walking improves your mood by 23%"

### From Day One (Premium Journal)
- **"On This Day"** — show entries from 1yr/2yr/3yr ago (nostalgia = re-engagement)
- **Auto-metadata** — capture weather, location, currently playing music
- **Media bottom sheet** — paper clip icon reveals photo/audio/drawing options
- **Start Sheet** — guided entry creation (template + prompt + mood in one flow)

### From Reflectly (Delight)
- **Theme transitions** — choosing theme transforms entire app with choreographed animation
- **Continuous mood slider** with haptic detents (not just 5 discrete buttons)
- **Micro-celebrations** — confetti/bloom on achievements

### From Notion (Power Users)
- **Slash commands** — `/heading`, `/quote`, `/checklist`, `/breathe`, `/gratitude`
- **Contextual menus** — settings appear where relevant, not in separate panel

### From Stoic (Onboarding)
- **Personalization quiz → first reflection** (zero dead time)
- **Morning/evening framework** — different prompts by time of day (we have TypewriterText but it's random)
- **Streak freeze** — miss a day without breaking streak (reduces anxiety)

---

## Part 3: UX Redesign Spec

### 3.1 Three-State Sidebar (Fix + Polish)

**Current**: expanded (30%) / compact (48px) / hidden (0%)
**Target**: Telegram-smooth transitions with spring physics + gesture control

#### State Machine (Enhanced)

```
         edge-swipe-right          drag-handle-right
HIDDEN ──────────────────> COMPACT ─────────────────> EXPANDED
       <──────────────────         <─────────────────
         edge-swipe-left           drag-handle-left
                                   (or auto-collapse on edit)
```

#### Animation Choreography (EP10_US004 Fix)

**Expanded → Compact** (200ms total):
1. Calendar: `opacity 1→0, scale 1→0.95` (0-100ms, ease-in)
2. Entry titles: `opacity 1→0` stagger 30ms per item (0-150ms)
3. Panel width: `280px → 48px` spring `{stiffness:400, damping:30}` (50-200ms)
4. Mood dots: `opacity 0→1, x: -8→0` stagger 20ms (150-250ms)
5. Haptic: `light` at start

**Compact → Expanded** (250ms total):
1. Width: `48px → 280px` spring `{stiffness:300, damping:28}` (0-200ms)
2. Mood dots: `opacity 1→0, x: 0→-8` (0-50ms, fast exit)
3. Calendar: `opacity 0→1, scale 0.95→1` spring (100-200ms)
4. Entry titles: `opacity 0→1, y: 8→0` stagger 40ms, max 5 items (150-350ms)
5. Haptic: `light` at end

**Any → Hidden** (150ms):
1. Width: `current → 0` with ease-in (fast exit always)
2. Content opacity: `1→0` parallel (0-100ms)
3. Haptic: none

**Gesture Control**:
- Edge swipe (within 20px of left edge) → reveal compact
- Drag handle on compact → expand (velocity-aware snap)
- `prefers-reduced-motion`: skip all, instant state change

#### Desktop Content Coordination
- Content area uses `margin-left` transition synced to sidebar width
- No content shift flash — use `will-change: margin-left` on content panel
- Sidebar overlays content on mobile (no margin shift)

### 3.2 Empty States (Living Canvas Enhancement)

**Current**: DiaryEmptyCanvas with TimeOfDayGradient + ParticleBackground + ValenceOrb + TypewriterText
**Problem**: Beautiful but no clear CTA, feels like screensaver

**Redesign**:

```
┌─────────────────────────────────┐
│                                 │
│     [TimeOfDayGradient bg]      │
│                                 │
│        ┌──────────────┐         │
│        │  ValenceOrb   │         │
│        │  (breathing)  │         │
│        └──────────────┘         │
│                                 │
│     "Good evening, Yehor"       │  ← personalized greeting
│     [TypewriterText prompt]     │  ← time-aware prompt
│                                 │
│     ┌──────────────────────┐    │
│     │  ✏️  Start writing    │    │  ← primary CTA, spring bounce
│     └──────────────────────┘    │
│                                 │
│   📊 3 entries this week        │  ← subtle stats
│   🔥 5-day streak              │  ← streak with flame animation
│                                 │
│     [ParticleBackground]        │
└─────────────────────────────────┘
```

**Time-aware prompts** (not random):
- Morning (5-12): "How do you want today to feel?" / reflection prompts
- Afternoon (12-17): "What's on your mind right now?" / check-in prompts
- Evening (17-22): "How was your day?" / gratitude prompts
- Night (22-5): "What are you grateful for today?" / wind-down prompts

**CTA Animation**:
- Button: `whileHover: {scale: 1.02}`, `whileTap: {scale: 0.97}`
- Subtle pulse glow every 5s (attention without annoyance)
- On tap: spring scale `{stiffness:500, damping:25}` → editor opens from button origin

**First-ever empty state** (no entries at all):
- Warmer greeting: "Welcome to your journal"
- Brief 3-step inline hint (not modal tour):
  1. "Write freely — your thoughts are encrypted"
  2. "Track your mood with emoji"
  3. "Attach photos, audio, or stickers"
- Single CTA: "Write your first entry"
- Trust signal: "🔒 Private and encrypted on your device"

### 3.3 Editor UX (Telegram-Level)

#### Floating Format Toolbar
**Current**: Static toolbar at top
**Target**: Floating toolbar that follows text selection

```
┌─────────────────────────────────┐
│ [mood] [title]           [more] │  ← sticky header
├─────────────────────────────────┤
│                                 │
│  Lorem ipsum dolor sit amet,    │
│  ███████████████████            │  ← selected text
│  ┌─────────────────────┐        │
│  │ B  I  U  ~  " 🔗 H │        │  ← floating toolbar (appears on selection)
│  └─────────────────────┘        │
│  consectetur adipiscing elit.   │
│                                 │
│                                 │
│                                 │
├─────────────────────────────────┤
│ 📎  😊  🎙  📷  💡  ⚙️       │  ← bottom action bar (always visible)
└─────────────────────────────────┘
```

**Floating toolbar behavior**:
- Appears on text selection, positioned above selection
- Spring entrance: `opacity 0→1, y: 4→0, scale: 0.95→1` spring `{stiffness:500, damping:30}`
- Follows selection on scroll (repositioned via `getSelectionRange()`)
- Dismisses on deselection with fast exit (100ms)

#### Bottom Action Bar
**Current**: Mixed placement of media/widget controls
**Target**: Persistent bottom bar with icons

| Icon | Action | Spring |
|---|---|---|
| 📎 | Media picker (photo/audio/file bottom sheet) | Sheet slides up, stiffness:300, damping:26 |
| 😊 | Sticker picker | Sheet slides up with stagger grid |
| 🎙 | Voice recording | Red pulse animation, waveform visualizer |
| 📷 | Camera/gallery | Native picker opens |
| 💡 | Widgets menu (burn/gratitude/breathe/focus) | Sheet with animated icons |
| ⚙️ | Entry settings (theme/font/paper) | Sheet with live preview |

#### Slash Commands (Power Users)
Typing `/` in editor shows contextual menu:

```
/mood      — set entry mood
/heading   — insert heading
/quote     — insert blockquote
/checklist — insert checkbox list
/breathe   — insert breathing exercise
/gratitude — insert gratitude prompt
/burn      — insert burn-thought widget
/focus     — toggle zen focus mode
/template  — pick entry template
/photo     — attach photo
/audio     — record audio
```

Appears as overlay list, filtered by typing. Spring stagger 30ms per item.
Keyboard: arrow keys to navigate, Enter to select, Esc to dismiss.

#### Keyboard-Aware Layout
- Use `h-dvh` instead of `h-screen` (fixes iOS keyboard height)
- Add `<meta name="viewport" content="..., interactive-widget=resizes-content">`
- Editor scrolls to cursor on keyboard open (MutationObserver pattern)
- Bottom action bar: stays above keyboard (use `visualViewport.height`)

### 3.4 Mood Input (Daylio-Fast)

**Current**: 5 discrete buttons (great/good/okay/bad/terrible)
**Target**: Continuous slider + quick tap (2 modes)

#### Quick Mode (default, <10s)
```
  😫    😔    😐    🙂    😊
  ●─────●─────●─────●─────●
              ▲
         [drag thumb]
```
- Continuous slider with 5 detents (haptic snap at each)
- Drag for nuance, tap for quick
- Color gradient follows thumb position (red → yellow → green)
- Selected mood emoji: spring scale `1 → 1.3 → 1.0`

#### Year in Pixels (Stats View)
```
Jan  ● ● ● ● ● ● ● ● ● ● ... (31 dots)
Feb  ● ● ● ● ● ● ● ● ● ● ...
Mar  ● ● ● ● ● ● ● ● ● ● ...
...
Dec  ● ● ● ● ● ● ● ● ● ● ...
```
- Each dot = one day, colored by mood (teal→green→amber→orange→red)
- Empty days = faint outline
- Tap dot → show entry preview tooltip
- Entrance animation: dots fill row by row, stagger 10ms, spring opacity

### 3.5 Micro-Interactions Catalog

| Action | Animation | Spring | Haptic |
|---|---|---|---|
| Open journal card | Scale from card origin, spring 300/25 | `{stiffness:300, damping:25}` | medium |
| Close journal | Scale down to card, spring 400/30 | `{stiffness:400, damping:30}` | light |
| Tap entry card | `whileTap: {scale: 0.97}`, ripple | snappy | light |
| Swipe delete | x-drag with red zone reveal, threshold 80px | useMotionValue | medium at threshold |
| Undo delete | Snackbar slides up, entry re-inserts with spring | `{stiffness:400, damping:28}` | success |
| Save entry | Brief green checkmark flash (Lottie), scale pulse | 200ms | success |
| New entry (FAB) | FAB morphs to editor (layoutId or scale from origin) | `{stiffness:500, damping:25}` | medium |
| Toggle sidebar | Width spring + content choreography (see 3.1) | per-state | light |
| Mood select | Emoji: scale 1→1.3→1, color wash background | spring overshoot | snap detent |
| Calendar date tap | Date circle: fill color spring, entries list update | `{stiffness:400, damping:30}` | light |
| Search open | Search bar expands from icon with spring | `{stiffness:500, damping:30}` | none |
| Photo attach | Photo thumbnail: scale 0→1, spring overshoot | bouncy | light |
| Audio record start | Red pulse ring animation, waveform appears | continuous | medium |
| Audio record stop | Pulse stops, waveform freezes, save animation | 200ms ease | success |
| Streak milestone (7/14/30/60/100) | Confetti burst + number scale up + celebration sound | explosive | success + notify |
| Theme change | Entire canvas: crossfade 400ms with blur intermediate | `duration:0.4` | medium |
| Font change | Text: scale 0.98→1 with new font | `{stiffness:300, damping:25}` | light |
| Private mode toggle | Content blur in/out 300ms | `duration:0.3` | medium |
| Sidebar compact dot hover | Scale 1→1.15, tooltip spring from left | `{stiffness:500, damping:30}` | none |
| Sidebar dot → card morph | layoutId cross-subtree morph via LayoutGroup | auto (layout) | medium |
| Pull to refresh | Custom spring overscroll → sync indicator | `{stiffness:200, damping:20}` | light |
| Entry list mount | Stagger children: opacity+y, 40ms/item, max 5 | stagger | none |

### 3.6 "On This Day" Feature (New)

**Trigger**: On journal open, check if entries exist from same date in previous years.

**UI**: Subtle card above entry list (dismissible):
```
┌─────────────────────────────────┐
│ 📅 On This Day, 1 Year Ago      │
│                                 │
│ "Today I finally finished the   │
│  project and felt so relieved"  │
│                                 │
│ 😊 Great mood  •  Apr 16, 2025 │
│                          [View] │
└─────────────────────────────────┘
```

- Entrance: slide down + fade, spring `{stiffness:300, damping:28}`
- Dismiss: swipe up or X button, don't show again today
- Tap "View": morph to full entry viewer (layoutId)

### 3.7 Onboarding (First-Time Journal User)

**Philosophy**: Learn by doing, not by watching (NN/g research). Time to first write < 60 seconds.

**Flow**:
1. User taps journal card for first time
2. Empty canvas shows with warm greeting + "Write your first entry" CTA
3. User taps CTA → editor opens with:
   - Pre-filled date (today)
   - Mood picker highlighted with subtle pulse
   - Prompt text in placeholder (time-aware)
   - Inline hint: "Tap 😊 to set your mood" (disappears after first mood set)
4. After first save:
   - Celebration animation (confetti + "First entry!" badge)
   - Reward: 20 XP + 10 treats (gamification)
   - Brief toast: "Your thoughts are encrypted and private"
5. On second open:
   - Inline hint on sidebar: "Swipe from edge to toggle sidebar"
   - Hint on search: "Search your entries by keyword"
6. Hints never show again after interaction (persisted flag per hint)

### 3.8 Accessibility Enhancements

| Area | Current | Target |
|---|---|---|
| Mood picker | Buttons with emoji only | Radio group with `aria-label="Mood: Great"`, text labels below |
| Sidebar dots | `role="listbox"` (correct) | Add `aria-roledescription="mood timeline"` |
| Floating toolbar | — (new) | `role="toolbar"`, `aria-label="Text formatting"` |
| Entry cards | Swipe to delete | Also: long-press context menu with "Delete" option for non-gesture users |
| Animations | `shouldAnimate()` dual-check | Also: reduce stagger count, simplify springs to opacity-only |
| Touch targets | 44px (correct) | Verify bottom action bar icons >= 44px with spacing |
| Focus management | WCAG 2.4.3 on sidebar expand | Also: focus first entry on list load, focus title on editor open |
| Screen reader | Basic | Announce entry save, delete undo timer, streak milestone |

### 3.9 Desktop vs Mobile Differences

| Feature | Mobile | Desktop (lg:) |
|---|---|---|
| Sidebar | Hidden (no sidebar) | 3-state (hidden/compact/expanded) |
| Editor | Full-screen overlay | Right panel in master-detail |
| Toolbar | Bottom bar + floating | Floating only (more space) |
| Entry list | Full-screen view | Left panel, scrollable |
| Gestures | Swipe delete, swipe nav | Mouse hover states, keyboard shortcuts |
| Empty state | Full-screen canvas | Right panel canvas |
| "On This Day" | Top of entry list | Right panel (when no entry selected) |
| Mood input | Bottom sheet slider | Inline in editor header |
| Settings | Bottom sheet | Centered modal (existing) |

---

## Part 4: Implementation Priority

### Phase 1: Fix Broken (Week 1)
1. Fix `useEntryTransition` — wire `completeTransition`/`finishReverse` in JournalModule
2. Implement EP10_US004 choreography (collapse/expand animation sequence)
3. Fix panel width spring (override react-resizable-panels CSS with framer-motion)
4. Add skeleton loading states during IndexedDB hydration

### Phase 2: Core Polish (Week 2)
5. Floating format toolbar (text selection aware)
6. Bottom action bar (persistent, keyboard-aware)
7. Empty state CTA button + time-aware prompts
8. Entry list stagger animation
9. Micro-interactions catalog (haptic + springs on all touch points)

### Phase 3: New Features (Week 3)
10. Mood slider (continuous with detents)
11. "On This Day" memories card
12. Slash commands (editor power features)
13. Year in Pixels visualization (stats view)

### Phase 4: Onboarding & Delight (Week 4)
14. First-time user flow (inline hints, first-entry celebration)
15. Streak visualization (flame animation, milestones with confetti)
16. Edge-swipe gesture for sidebar toggle
17. Audio waveform visualizer
18. Theme change choreography (crossfade with blur)

### Phase 5: Advanced (Week 5+)
19. Streak freeze feature
20. Mood correlations analytics
21. Auto-metadata (weather, location)
22. Photo grid layouts (1/2/3/4/5+ smart arrangements)
23. Keyboard shortcut hints overlay

---

## Part 5: Quality Gates (A++ Criteria)

### Performance
- [ ] 60fps on all animations (GPU-only: transform + opacity)
- [ ] First paint < 200ms after journal open
- [ ] Skeleton → content transition < 500ms
- [ ] Sidebar toggle < 300ms total choreography
- [ ] No layout thrashing (batch DOM reads)

### Visual
- [ ] Every state change has spring animation
- [ ] Every touch has haptic feedback
- [ ] `prefers-reduced-motion` fully respected
- [ ] Theme tokens only (zero hardcoded colors)
- [ ] Glass surfaces follow 5-pillar aesthetic

### Accessibility
- [ ] WCAG 2.1 AA minimum (AAA for contrast)
- [ ] All interactive elements >= 44px touch target
- [ ] Full keyboard navigation (Tab, Enter, Escape, Arrow keys)
- [ ] Screen reader announces all state changes
- [ ] RTL layout correct (Arabic, Hebrew)

### Cross-Platform
- [ ] iOS / Android / Desktop render equivalently
- [ ] Android back handler on all overlays
- [ ] Safe area insets respected
- [ ] Keyboard-aware layout (h-dvh + visualViewport)

### i18n
- [ ] All new strings in all 8 languages
- [ ] Time-aware prompts translated
- [ ] "On This Day" date formatting localized
- [ ] Slash command labels translated

---

## Appendix: Research Sources

- `docs/research/rsh-005-premium-animation-patterns.md` — Framer Motion, Telegram springs, performance
- `docs/research/journal-app-competitive-analysis-2026.md` — 8-app competitive analysis
- `docs/research/ftue-empty-states-research.md` — Empty states, onboarding, accessibility
- `docs/visual-aesthetic.md` — 5-pillar design system
- `docs/orb-design-philosophy.md` — Orb interaction model
- Codebase analysis: JournalModule.tsx (1778 lines), 30+ components, 20+ hooks
- User personas: Mindful Professional, Stressed Student, Caring Parent
