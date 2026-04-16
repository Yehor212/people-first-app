# Diary Section — Animation & UX Revolution

**Date:** 2026-04-15
**Scope:** Full diary section redesign — sidebar, animations, transitions, micro-interactions
**Target:** Telegram-level polish and beyond (A++ on every platform)

---

## 1. Competitive Landscape Analysis

### 1.1 Industry Leaders — What They Do Right

| App | Strength | Weakness | Steal-worthy |
|-----|----------|----------|--------------|
| **Day One** | Dual-pane master-detail, rich media, timeline | Animations feel heavy, no shared-element transitions | Journal switcher drawer, timeline navigation |
| **Bear** | Sidebar collapse to icon-only 48px, typography-first | No mood tracking, no media cards | Sidebar collapse → icon-only with tooltip, keyboard shortcut ⌘\ |
| **Notion** | Hover-reveal sidebar, smooth width animation | Box-shadow lag (4 animated shadows!), heavy JS animations | Peek-on-hover sidebar, breadcrumb trail |
| **Telegram** | 120fps native scroll, custom list rendering, swipe gestures | Not a journal | Swipe-to-action, bounce physics, haptic micro-feedback |
| **Apple Notes** | Section collapse with disclosure chevron, cross-device sync of collapse state | Basic animations | Hierarchical collapse, keyboard shortcuts (⌥⌘←/→) |
| **Journey** | Templates, goals, cross-platform | Generic UI, no animation polish | Template carousel on empty state |
| **iA Writer** | Focus mode (dim non-active paragraph), typography perfection | Desktop-only feel | Active paragraph highlight, typewriter scroll |

### 1.2 What NOBODY Does (Our Opportunity)

1. **Shared-element card→editor morph** — no journal app morphs the card into the editor
2. **Mood-reactive ambient animations** — sidebar/editor atmosphere changes with entry mood
3. **Writing momentum visualization** — real-time visual feedback as you write (not just word count)
4. **Cinematic empty state** — not a static illustration, but a living breathing invitation
5. **Gesture vocabulary** — consistent swipe/pinch/long-press language across the entire diary

---

## 2. Current State Assessment

### 2.1 What We Have (from codebase analysis)

```
JournalModule.tsx — orchestrator
├── PanelLayout (react-resizable-panels)
│   ├── LayoutPanel (left: entry list, collapsible, 30% default)
│   │   ├── Header (title + streak + settings + close)
│   │   ├── JournalCalendar / JournalCalendarFull
│   │   └── JournalEntryList (compact mode, stagger animation)
│   ├── ResizeHandle
│   └── LayoutPanel (right: editor/viewer/stats/empty, 70% default)
│       ├── Sidebar toggle button (PanelLeftOpen/Close)
│       ├── JournalEntryEditor (desktop mode, sidebarCollapsed prop)
│       ├── JournalEntryViewer
│       ├── LazyJournalStats
│       └── Empty state (PenLine icon + text)
└── Mobile: full-screen modal flow
```

### 2.2 Current Sidebar Collapse

- **Mechanism:** `react-resizable-panels` with `collapsible` + `collapsedSize={0}`
- **State:** `sidebarCollapsed` in `useState`, persisted via `localStorage`
- **Toggle:** Button in right panel header (PanelLeftOpen/PanelLeftClose icons)
- **Also in:** Editor header (Bear/Notion pattern — `onToggleSidebar` prop)
- **Animation:** Panel library handles width transition (CSS-based)
- **A11y:** `aria-expanded`, `aria-controls`, focus management on expand

### 2.3 Gaps Identified

| Gap | Current | Target |
|-----|---------|--------|
| Sidebar collapse animation | Instant snap (0px) | Smooth spring with content fade |
| Card → editor transition | Hard cut (new component) | Shared-element morph (layoutId) |
| Empty state | Static icon + text | Cinematic living canvas |
| Scroll physics | Standard overflow-y | Rubber-band bounce, momentum |
| Entry card hover/press | Basic `whileTap: scale 0.97` | Depth shift + glow + parallax |
| Sidebar content during collapse | Disappears at 0px | Fade out at 80%, icons stay until 48px |
| Writing feedback | None (word count only) | Ambient particles, mood orb pulse |
| Desktop keyboard shortcuts | None for sidebar | ⌘\ toggle, ⌘N new, ⌘↑↓ navigate |

---

## 3. Sidebar Collapse/Expand — A++ Design

### 3.1 Three-State Sidebar Model

```
EXPANDED (30%, ~340px)        COMPACT (48px, icon-only)        HIDDEN (0px)
┌──────────────────┐          ┌────┐                           │
│ Diary        🔥 3│          │ 📓 │ ← tooltip "Diary"        │ (nothing)
│ ─────────────── │          │ 📊 │ ← tooltip "Stats"         │
│ [Calendar strip] │          │ ⚙️ │ ← tooltip "Settings"     │
│                  │          │────│                           │
│ ┌──────────────┐ │          │ 😄 │ ← mood dot, tooltip      │
│ │ Entry card 1 │ │          │ 😊 │   entry title             │
│ └──────────────┘ │          │ 😐 │                           │
│ ┌──────────────┐ │          │ 😔 │                           │
│ │ Entry card 2 │ │          │    │                           │
│ └──────────────┘ │          │ ── │                           │
│ ┌──────────────┐ │          │ ＋ │ ← "New entry"            │
│ │ Entry card 3 │ │          └────┘                           │
│ └──────────────┘ │
│     [+ New]      │
└──────────────────┘
```

### 3.2 Animation Choreography

**Collapse: Expanded → Compact (300ms total)**

| Time | Element | Animation | Easing |
|------|---------|-----------|--------|
| 0-100ms | Calendar strip | Fade out (opacity 1→0) + scale 0.95 | easeIn |
| 0-100ms | Entry card text | Fade out (opacity 1→0) | easeIn |
| 50-150ms | Entry card → mood dot | Morph: card shrinks to circle (layoutId per entry) | spring(300,25) |
| 100-200ms | Header text | Fade out, icon remains | easeIn |
| 100-300ms | Panel width | 340px → 48px | spring(400,30) |
| 200-300ms | Mood dots | Settle into vertical stack | spring(260,25) |
| 250-300ms | Icon tooltips | Become active (appear on hover) | - |

**Expand: Compact → Expanded (350ms total)**

| Time | Element | Animation | Easing |
|------|---------|-----------|--------|
| 0-50ms | Icon tooltips | Disable | - |
| 0-200ms | Panel width | 48px → 340px | spring(300,25) |
| 100-200ms | Mood dots → entry cards | Morph: circle expands to card | spring(300,25) |
| 150-250ms | Header text | Fade in + slide from left 8px | easeOut |
| 200-300ms | Entry card text | Fade in + stagger 40ms | spring(300,25) |
| 250-350ms | Calendar strip | Fade in + scale 1.0 from 0.95 | spring(260,25) |

### 3.3 Compact Mode Details

- **Width:** 48px (matches touch target minimum)
- **Icons:** Mood emoji from each entry (top 5-7 visible, rest scrollable)
- **Active entry:** Highlighted ring around mood dot (same as expanded card's accent color)
- **Hover:** Tooltip with entry title + relative time ("2h ago")
- **Click mood dot:** Opens that entry in editor (right panel)
- **New entry button:** "+" icon at bottom of icon strip
- **Header icons:** Diary icon (📓), Stats (📊), Settings (⚙️) stacked vertically

### 3.4 Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+\` / `⌘\` | Toggle sidebar (expanded ↔ compact) | Global when diary open |
| `Ctrl+Shift+\` | Toggle sidebar (compact ↔ hidden) | Global when diary open |
| `Ctrl+N` / `⌘N` | New entry | Global when diary open |
| `↑` / `↓` | Navigate entries in list | When sidebar focused |
| `Enter` | Open selected entry | When sidebar focused |
| `Escape` | Close editor → list / Close diary | Contextual |

### 3.5 Implementation Notes

```tsx
// Three-state sidebar model
type SidebarState = "expanded" | "compact" | "hidden";

// Compact mode: use framer-motion layoutId on mood dots
// Each entry card's mood circle gets layoutId={`mood-${entry.id}`}
// Compact mode renders same layoutId as standalone dot
// Framer Motion auto-morphs between them

// Panel width animation: override react-resizable-panels
// with framer-motion AnimatePresence for compact state
// PanelLayout handles expanded↔hidden
// Custom compact state lives OUTSIDE PanelLayout as fixed 48px div
```

---

## 4. Card → Editor Shared-Element Transition

### 4.1 The Morph Effect

When user taps an entry card in the sidebar, the card **morphs into the editor**:

```
SIDEBAR                          EDITOR PANEL
┌──────────────┐                 ┌─────────────────────────────┐
│ 😄 Morning    │ ──── morph ──→ │ 😄 Morning Thoughts         │
│ Text preview  │                │                             │
│ #tag  5w  2h  │                │ Full content here...        │
└──────────────┘                 │                             │
                                 │                             │
                                 └─────────────────────────────┘
```

### 4.2 Animation Sequence (400ms)

| Phase | Duration | What Happens |
|-------|----------|-------------|
| **Lift** | 0-100ms | Card lifts (z-index + shadow increase), siblings dim to 60% opacity |
| **Morph** | 100-300ms | Card expands across ResizeHandle into editor area (layoutId on wrapper) |
| **Settle** | 200-400ms | Mood circle settles into editor header position, title morphs to editable, content fades in with typewriter stagger |
| **Ambient** | 300-500ms | Editor background shifts to mood-colored ambient gradient |

### 4.3 Reverse Animation (Editor → List)

When pressing Back or clicking another entry:
1. Content fades out (100ms)
2. Editor shrinks back to card position (200ms spring)
3. Card settles into list with subtle bounce
4. Siblings restore full opacity with stagger

### 4.4 Technical Approach

```tsx
// Use framer-motion layoutId on a shared wrapper
// Card: <motion.div layoutId={`entry-${entry.id}`}>
// Editor: <motion.div layoutId={`entry-${activeEntryId}`}>

// AnimatePresence mode="popLayout" for cross-fade
// layout="position" on inner elements for independent animation

// Fallback for reduced-motion: instant cut (no morph)
```

---

## 5. Entry Card Micro-Interactions

### 5.1 Hover State (Desktop)

```
Default                    Hover (200ms)
┌──────────────────┐       ┌──────────────────┐
│ ┃ 😄 Title       │       │ ┃ 😄 Title       │  ← y: -2px
│ ┃   Preview...   │  →    │ ┃   Preview...   │  ← shadow increase
│ ┃   #tag  5w     │       │ ┃   #tag  5w     │  ← border glow (mood color)
└──────────────────┘       └──────────────────┘
                            ↑ mood-colored rim glow (box-shadow)
```

- **Transform:** `translateY(-2px)` — card lifts slightly
- **Shadow:** Mood-colored glow intensifies (from `MOOD_GLOW` map)
- **Border:** Border opacity increases from 0.08 to 0.15
- **Accent bar:** Becomes slightly wider (1.5px → 2px) with brighter gradient
- **Timing:** `spring(400, 25)` — snappy response

### 5.2 Press/Tap State (Mobile + Desktop)

```
Press (instant)             Release
┌──────────────────┐       (spring back with overshoot)
│ ┃ 😄 Title       │  ←    scale: 0.97
│ ┃   Preview...   │       shadow: compressed
│ ┃   #tag  5w     │       haptic: light tap
└──────────────────┘
```

### 5.3 Active/Selected State (Desktop master-detail)

```
┌──────────────────┐
│ ┃ 😄 Title       │  ← left accent bar PULSES gently (opacity 0.6↔1.0, 2s)
│ ┃   Preview...   │  ← background: mood gradient at 12% opacity (vs 8% default)
│ ┃   #tag  5w     │  ← ring: 1px mood-colored border
└──────────────────┘
    ↑ This entry is currently open in the editor
```

### 5.4 Swipe-to-Delete (Mobile)

Already implemented — enhance with:
- **Reveal:** Red background slides in from trailing edge
- **Icon:** Trash icon with scale spring as it's revealed
- **Threshold indicator:** Haptic medium at 80px threshold
- **Undo toast:** Slides up from bottom with 5s countdown ring

### 5.5 Long-Press to Edit (Mobile)

Already implemented — enhance with:
- **Visual feedback:** At 200ms, card gets subtle pulsing border
- **At 500ms trigger:** Card "lifts" (translateY -4px, shadow increase), haptic medium
- **Context menu:** Slides in from card position (not center of screen)

---

## 6. Stagger Animation System

### 6.1 Entry List Stagger (Already Implementing via EP6_US001)

```
Item 1: delay 0ms     ████████████ (y:20→0, opacity:0→1)
Item 2: delay 40ms    ████████████
Item 3: delay 80ms    ████████████
Item 4: delay 120ms   ████████████
Item 5: delay 160ms   ████████████
Item 6: delay 160ms   ████████████  ← capped, appears with item 5
Item 7: delay 160ms   ████████████  ← capped
```

- **Spring:** `springPresets.quick` (stiffness: 300, damping: 25)
- **Cap:** 5 items max (items 6+ appear instantly with item 5)
- **Total window:** ~360ms (160ms stagger + 200ms spring settle)
- **Reduced motion:** All items appear instantly

### 6.2 Date Group Headers

```
Group "Today": fade in → entries stagger below
Group "Yesterday": fade in 100ms later → entries stagger
Group "Last week": fade in 200ms later → entries stagger
```

- Each date group header fades in before its entries
- Entries within each group stagger independently (reset counter per group)

### 6.3 Search Results Stagger

When AI search returns results:
- Results fade in with stagger 60ms (slightly slower — results are "thinking")
- Similarity badge animates from 0% → actual % with counting effect
- No results: empty state bounces in with playful spring

---

## 7. Empty State — Living Canvas

### 7.1 Current State
Static `PenLine` icon + "Select an entry or start writing" text.

### 7.2 Target: Cinematic Living Empty State

```
┌─────────────────────────────────────────┐
│                                         │
│         ╭─────────────────────╮         │
│         │                     │         │
│         │    ✨ [Orb glow]    │         │  ← ValenceOrb at 30% scale
│         │                     │         │     neutral/calm state
│         ╰─────────────────────╯         │     breathing animation
│                                         │
│         "Що ти думаєш?"                 │  ← Typewriter effect
│         ───────────────                 │     (types out, pauses, changes)
│                                         │
│     ┌─────────┐  ┌──────────┐           │
│     │ ✏️ Write │  │ 🎯 Prompt│           │  ← Two CTA pills
│     └─────────┘  └──────────┘           │     hover: gentle lift + glow
│                                         │
│     "3 entries this week · 5 🔥 streak" │  ← Subtle context line
│                                         │
│              · · ·                      │  ← Ambient particles
│         ·          ·                    │     (from ParticleBackground)
│              ·                          │
└─────────────────────────────────────────┘
```

### 7.3 Rotating Prompts (Typewriter Effect)

Cycle through writing prompts every 8 seconds:
1. Type out prompt character by character (40ms per char)
2. Hold for 5 seconds
3. Erase backwards (20ms per char)
4. Pause 1 second
5. Type next prompt

Prompts from existing `DAILY_QUOTES` array + new writing prompts.

### 7.4 Mood-Time Ambient

Empty state changes based on time of day:
- **Morning (6-12):** Warm golden gradient, rising energy particles
- **Afternoon (12-17):** Clear blue tones, steady floating particles
- **Evening (17-21):** Warm amber/purple, settling particles
- **Night (21-6):** Deep indigo, slow drifting stars

---

## 8. Editor Polish

### 8.1 Writing Momentum Indicator

As user types, subtle visual feedback:
- **Word count ring:** Circular progress around mood emoji (target: 200 words)
- **Flow state:** After 30s continuous typing, editor background subtly pulses
- **Milestone celebrations:** At 100, 500, 1000 words — confetti micro-burst from mood emoji

### 8.2 Format Toolbar Animation

Toolbar items stagger in when toolbar opens:
- 6 items × 30ms stagger = 180ms total
- Each item: scale(0.8→1) + opacity(0→1)
- Active format: gentle pulse ring

### 8.3 Auto-Save Indicator

Current `SaveIndicator` — enhance:
- **Saving:** Subtle pulse animation on save icon
- **Saved:** Checkmark draws itself (SVG path animation, 300ms)
- **Error:** Shake animation (3 oscillations, 200ms)

---

## 9. Platform-Specific Considerations

### 9.1 iOS/Capacitor

- Rubber-band scroll on entry list (native iOS behavior via `-webkit-overflow-scrolling: touch`)
- Haptic feedback on: card tap (light), long-press trigger (medium), delete threshold (heavy)
- Safe area insets on sidebar header and bottom CTA
- Sidebar state survives app backgrounding

### 9.2 Android/Capacitor

- Material-style ripple on card tap (CSS `::after` pseudo-element)
- Back button: collapse sidebar → close diary (not both at once)
- Edge-to-edge with `env(safe-area-inset-*)` 
- Predictive back gesture support (sidebar peek)

### 9.3 Desktop/Web

- Keyboard shortcuts (Section 3.4)
- Hover states (Section 5.1)
- Resize handle with snap points (30%, 40%, 50%)
- Double-click resize handle → reset to 30%
- `prefers-reduced-motion`: all animations disabled, instant transitions

---

## 10. Performance Budget

| Metric | Budget | How |
|--------|--------|-----|
| Stagger FPS | 60fps constant | GPU-only: transform + opacity |
| Sidebar collapse | 60fps, < 300ms | CSS transform, no layout reflow |
| Card morph | 60fps, < 400ms | layoutId (FLIP technique) |
| Empty state | < 5% CPU idle | requestAnimationFrame, pause when hidden |
| Memory | < 10MB for animations | Cleanup on unmount, no leaked listeners |
| Bundle | < 3KB gzip for new code | Tree-shake framer-motion imports |

---

## 11. Implementation Epics (Suggested Breakdown)

### Epic A: Three-State Sidebar (P0, 2 Stories)

**Story A1:** Compact mode (48px icon-only sidebar)
- New `SidebarCompact.tsx` component
- Mood dot strip with tooltips
- Three-state toggle logic
- Keyboard shortcut `Ctrl+\`

**Story A2:** Sidebar collapse/expand animations
- Content fade choreography
- Mood dot ↔ card morph (layoutId)
- Spring physics tuning
- Persist compact preference

### Epic B: Shared-Element Card→Editor (P1, 2 Stories)

**Story B1:** Layout morph foundation
- layoutId on entry card wrapper
- layoutId on editor wrapper
- AnimatePresence mode="popLayout"
- Sibling dim on card lift

**Story B2:** Editor ambient + settling
- Mood gradient animation in editor
- Title morph to editable
- Content typewriter stagger
- Reverse animation on back

### Epic C: Living Empty State (P1, 1 Story)

**Story C1:** Cinematic empty state
- Time-of-day ambient gradient
- Typewriter rotating prompts
- Orb integration (30% scale)
- CTA pills with hover animation

### Epic D: Card Micro-Interactions (P2, 1 Story)

**Story D1:** Enhanced hover/press/active states
- Desktop hover lift + glow
- Active entry pulsing accent
- Enhanced swipe-to-delete reveal
- Long-press visual feedback

### Epic E: Writing Momentum (P2, 1 Story)

**Story E1:** Writing feedback system
- Word count ring around mood
- Flow state detection + ambient
- Milestone celebrations
- Enhanced save indicator

---

## 12. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| layoutId morph flickers on fast navigation | High | Debounce entry selection (100ms), preload target layout |
| Compact sidebar scroll with 50+ entries | Medium | Virtualize mood dot list (only render visible) |
| Three-state adds complexity to PanelLayout | Medium | Compact state lives OUTSIDE PanelLayout as separate div |
| Performance on low-end Android | High | GPU-only animations, `will-change` hints, reduce particle count |
| prefers-reduced-motion breaks layout | Medium | Separate no-animation layout branch, test independently |

---

## 13. Sources & Research

### Competitive Analysis
- [Reflection.app — Best Journaling Apps 2026](https://www.reflection.app/blog/best-journaling-apps)
- [Journey — Best Diary App 2026](https://blog.journey.cloud/best-diary-app-2026/)
- [Day One Features](https://dayoneapp.com/features/)
- [Dribbble — Diary App Designs](https://dribbble.com/tags/diary-app)

### Animation Patterns
- [Motion.dev — Layout Animations](https://motion.dev/docs/react-layout-animations)
- [Maxime Heckel — Advanced Framer Motion Patterns](https://blog.maximeheckel.com/posts/advanced-animation-patterns-with-framer-motion/)
- [FreeCodeCamp — Animated Sidebar with Framer Motion](https://www.freecodecamp.org/news/create-a-fully-animated-sidebar/)
- [Joshua Wootonn — Sidebar Animation Performance](https://www.joshuawootonn.com/sidebar-animation-performance)
- [react-resizable-panels — Animate collapse #310](https://github.com/bvaughn/react-resizable-panels/issues/310)

### Sidebar UX
- [UX Planet — Best Practices for Sidebar](https://uxplanet.org/best-ux-practices-for-designing-a-sidebar-9174ee0ecaa2)
- [Navbar Gallery — Best Sidebar Menu Designs 2026](https://www.navbar.gallery/blog/best-side-bar-navigation-menu-design-examples)
- [AlfDesignGroup — Sidebar Design for Web Apps 2026](https://www.alfdesigngroup.com/post/improve-your-sidebar-design-for-web-apps)
- [Pixso — Expand Collapse UI Design](https://pixso.net/tips/expand-collapse-ui-design/)

### Micro-Interactions
- [Nightborn — Animations & Micro-Interactions](https://www.nightborn.com/blog/animations-and-micro-interactions-to-improve-app-usability)
- [Wyzowl — 15 Microinteractions Examples](https://wyzowl.com/microinteractions-examples/)
- [BricxLabs — 12 Micro Animation Examples 2025](https://bricxlabs.com/blogs/micro-interactions-2025-examples)
- [Userpilot — 14 Micro-interaction Examples](https://userpilot.com/blog/micro-interaction-examples/)
