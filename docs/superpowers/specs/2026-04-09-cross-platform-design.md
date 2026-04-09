# ZenFlow Cross-Platform Experience — Design Spec

## Overview

Transform ZenFlow from a mobile-first app with a stretched desktop view into a Telegram-level cross-platform experience where each device tier gets an optimized interaction paradigm while sharing the same design DNA.

**Approach:** Adaptive Layout Engine (Approach A) — one codebase, structural transformation per device class.
**Interaction model:** Platform-optimized (Model B) — mobile is a touch app, desktop is a keyboard+mouse app. Same design language, different interaction paradigms.

## Device Tiers

| Tier         | Width       | Layout                            | Input                       | Navigation                            |
| ------------ | ----------- | --------------------------------- | --------------------------- | ------------------------------------- |
| **Phone**    | < 768px     | Single panel                      | Touch, gestures             | Bottom tab bar (5 tabs)               |
| **Tablet**   | 768-1024px  | Optional split                    | Touch + optional keyboard   | Bottom tabs or side rail              |
| **Laptop**   | 1024-1440px | 2-column (sidebar + content)      | Mouse + keyboard            | Persistent left sidebar (collapsible) |
| **Desktop+** | 1440px+     | 3-column (nav + content + detail) | Mouse + keyboard, shortcuts | Expanded sidebar + context panel      |

## Technical Foundation

### Layout Engine

**Container Queries** (Tailwind v4 native `@container`):
Every layout component is a container — children adapt to their container's size, not the viewport. This enables truly modular components that work in any panel width.

```html
<div class="@container">
  <div class="grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-4">
    <!-- Cards adapt to container, not viewport -->
  </div>
</div>
```

**`useDeviceTier()` hook:**
Returns `phone | tablet | laptop | desktop` based on viewport width + input method detection. Uses `useMediaQuery` internally with these breakpoints:

- phone: `(max-width: 767px)`
- tablet: `(min-width: 768px) and (max-width: 1023px)`
- laptop: `(min-width: 1024px) and (max-width: 1439px)`
- desktop: `(min-width: 1440px)`

**`useInputMethod()` hook:**
Detects primary input: `touch | mouse | keyboard`. Updates reactively when user switches (e.g., detaches tablet keyboard). Uses `pointer: coarse/fine` and `hover: hover/none` media queries.

**Layout Primitives:**

- `<AdaptiveShell>` — root layout that switches between bottom-tabs and sidebar modes
- `<PanelLayout columns={2|3}>` — resizable multi-panel container
- `<MasterDetail>` — list + detail split with responsive collapse
- `<BentoGrid>` — asymmetric card grid for dashboard views

### Platform Detection (existing + new)

Existing `src/lib/platform.ts` provides `isNative`, `isAndroid`, `isIos`, `isWeb`.

New additions:

- `isDesktopViewport` — viewport >= 1024px (not platform, viewport)
- `useInputMethod()` — touch vs mouse vs keyboard-primary
- CSS custom properties: `--device-tier: phone|tablet|laptop|desktop`

## Per-Tab Layouts

### Home Tab — Bento Grid Dashboard

**Phone:** Vertical scroll — mood card, habit progress, streak banner, daily insights.

**Tablet:** 2-column bento grid — mood+habits (left), streaks+insights (right).

**Laptop:** Sidebar nav + 3-column bento grid. Cards: mood (2x1 large), habits (2x1 wide), streak (1x2 tall), insights (1x1 compact), focus timer (1x1), garden preview (1x1).

**Desktop+:** Sidebar + 4-column bento grid + right panel showing today's timeline summary. Bento cards use `@container` queries internally — content density adapts to card size.

Bento grid uses asymmetric proportions with exaggerated `rounded-2xl` corners, subtle elevation shadows, and micro-interactions within each tile (hover lift, data animation on mount).

### Journal Tab — Master-Detail

**Phone:** Entry list is full screen. Tapping entry navigates (push animation) to full-screen editor. Swipe-back to return. Entry creation opens as bottom sheet then expands.

**Tablet:** Split view — list (40%) + editor/viewer (60%). List collapses to icon strip in landscape when editor is active.

**Laptop:** 3-panel — list (30%) + editor (50%) + metadata sidebar (20%). Metadata shows: date, mood, tags, word count, photos grid, audio attachments.

**Desktop+:** 3-panel with wider metadata — list (25%) + editor (50%) + metadata+photos (25%). Photo gallery renders as grid (3 columns), not stacked thumbnails. Editor has `max-width: 65ch` for optimal readability with `line-height: 1.7`.

**Shared element transition:** Entry card in list morphs into editor header via View Transitions API. On phone this is a push navigation, on desktop it's an in-place panel update with shared element morph.

### Habits Tab — Adaptive Grid

**Phone:** 2-column compact cards. Tap to complete with spring animation + haptic feedback.

**Tablet:** 3-column grid with category grouping headers.

**Laptop:** 4-column grid + streak sidebar (collapsible). Drag-to-reorder enabled.

**Desktop+:** 4-5 column grid + streak chart panel + category filter sidebar. Hover previews show 7-day completion sparkline. Right-click context menu: Edit, Complete, Skip, Archive, Delete.

### Stats Tab — Wide Charts

**Phone:** Stacked full-width charts with horizontal scroll for time periods.

**Tablet:** 2-column chart grid. Charts expand on tap.

**Laptop:** Charts + filter sidebar (date range, category, comparison). Charts have more data points visible.

**Desktop+:** Wide charts + comparison panels + date picker sidebar. Hover on data points shows detailed tooltips. Right-click chart to export as PNG.

### Garden/Canvas Tab — Full Viewport

**Phone:** Full viewport, pinch-zoom, touch pan. Floating action button for planting.

**Tablet:** Full viewport + floating toolbar (bottom). Stylus support for precise interaction.

**Laptop:** Full viewport + docked sidebar toolbar (left). Keyboard shortcuts for zoom, rotate, plant.

**Desktop+:** Full viewport + docked tools + info panel (right, shows selected plant details). Mouse wheel zoom, right-click context menu.

## Navigation Transformation

### Phone (< 768px)

- Bottom tab bar: 5 visible tabs, haptic feedback on tap
- Sheets slide up for modals/overlays (existing pattern)
- Swipe left/right between tabs
- Android back button and iOS swipe-back handle navigation stack
- No changes to existing mobile navigation

### Tablet (768-1024px)

- Default: bottom tab bar (same as phone but wider)
- Landscape option: collapsible side rail (icon-only, 64px)
- Sheets become side panels in landscape orientation
- Split keyboard awareness (adjust layout when keyboard is docked)

### Laptop (1024-1440px)

- Persistent left sidebar replaces bottom tabs
- Sidebar: collapsible (64px icon rail ↔ 220px expanded)
- `Ctrl+B` toggles sidebar collapse
- Keyboard shortcuts `Ctrl+1-5` switch tabs
- Hover tooltips on sidebar icons when collapsed
- Active tab indicated by left accent bar (slides in with spring)
- No bottom navigation — completely hidden

### Desktop+ (1440px+)

- Sidebar always expanded (220px)
- Optional right context panel (280px) for metadata, quick actions
- Full keyboard navigation: `Tab`/`Shift+Tab` cycles focus areas
- `Ctrl+K` command palette accessible from anywhere
- Window controls respect native OS (traffic lights on macOS, title bar on Windows)

## 7 Desktop Power Features

### 1. Keyboard Shortcuts

Global shortcuts registered at app level via `useKeyboardShortcuts()` hook. Disabled when any text input has focus (to avoid conflicts).

| Category   | Shortcut   | Action                           |
| ---------- | ---------- | -------------------------------- |
| Navigation | `Ctrl+1-5` | Switch tabs                      |
| Navigation | `Ctrl+B`   | Toggle sidebar                   |
| Navigation | `Ctrl+K`   | Command palette                  |
| Navigation | `Ctrl+,`   | Settings                         |
| Actions    | `Ctrl+N`   | New journal entry                |
| Actions    | `Ctrl+H`   | Quick habit check-off dialog     |
| Actions    | `Ctrl+M`   | Log mood quick dialog            |
| Actions    | `Ctrl+F`   | Search within current view       |
| Panels     | `Escape`   | Close active panel/modal/palette |
| Panels     | `Ctrl+\`   | Toggle right context panel       |

On macOS: `Ctrl` maps to `Cmd` automatically.

### 2. Multi-Panel Views

Resizable panels with drag handles:

- Minimum panel width: 200px
- Maximum: 70% of viewport
- Double-click divider resets to default proportions
- Panel widths persisted per-tab in localStorage
- Resize handles invisible until hover (then glow with accent color)
- Smooth spring animation when panel snaps to min/max

### 3. Drag & Drop

- Journal: drop photos from filesystem directly into editor (HTML5 File API)
- Habits: drag cards to reorder in grid (visual placeholder shows drop target)
- Calendar: drag journal entries between dates
- Implementation: native HTML5 `draggable` API with spring-animated feedback via motion.dev

### 4. Right-Click Context Menus

Built with Radix UI `ContextMenu` (already in project dependencies).

| Element       | Menu Items                                 |
| ------------- | ------------------------------------------ |
| Habit card    | Complete, Skip, Edit, Archive, Delete      |
| Journal entry | Open, Export (JSON/PDF/MD), Share, Delete  |
| Stat chart    | Export as PNG, Change date range, Compare  |
| Calendar date | View day, New entry for date, Jump to week |
| Sidebar tab   | Pin to top, Hide tab                       |

### 5. Hover Previews

Using Radix `HoverCard` with 200ms open delay:

- Habit card hover: tooltip with streak sparkline (last 7 days mini chart)
- Mood dot hover: note text + tags
- Calendar date hover: mini day summary (mood, habits completed, journal flag)
- Sidebar tab hover (when collapsed): tab name tooltip

Hover previews disabled on touch devices (detected via `useInputMethod()`).

### 6. Wide Media Gallery

Journal photos on desktop:

- Grid layout: 3-4 columns based on container width (`@container`)
- Click opens lightbox with arrow key navigation (Left/Right)
- Lightbox shows photo metadata (date, dimensions, file size)
- Drag photos to reorder within entry

### 7. Command Palette (`Ctrl+K`)

Built with `cmdk` library (already in project, was unused).

**Sections:**

- Recent: last 5 accessed items (entries, habits, pages)
- Actions: New entry, Log mood, Check habit, Toggle theme, Open settings
- Search: fuzzy search across journal entries, habit names, settings
- Navigation: jump to any tab or sub-page

**Visual:** frosted glass background (`backdrop-filter: blur(20px)`), palette drops from top with spring physics (`stiffness: 400, damping: 30`), results highlight matched characters.

**Performance:** search is debounced (150ms), results memoized, max 20 results displayed.

## Animation System — 3-Layer Stack

### Layer 1: View Transitions API (browser-native)

Used for structural navigation transitions — zero JavaScript animation overhead.

- Tab switching on desktop: `document.startViewTransition()` with cross-fade (150ms)
- Journal list → editor: shared element transition (entry card morphs into editor header via `view-transition-name`)
- Panel show/hide: browser-native slide animation
- Fallback: if View Transitions API not supported, falls back to motion.dev spring animations

### Layer 2: Spring Physics via motion.dev

All interactive and component-level animations use spring physics — NOT duration+easing curves.

| Animation               | Spring Config                 | Feel                           |
| ----------------------- | ----------------------------- | ------------------------------ |
| Sidebar collapse/expand | `stiffness: 300, damping: 30` | Heavy, decisive                |
| Command palette drop-in | `stiffness: 400, damping: 28` | Quick with slight overshoot    |
| Panel resize            | `stiffness: 500, damping: 35` | Snappy, no wobble              |
| Drag-and-drop items     | `stiffness: 200, damping: 20` | Loose, follows cursor with lag |
| Habit completion burst  | `stiffness: 600, damping: 15` | Explosive, bouncy              |
| Modal/sheet open        | `stiffness: 350, damping: 30` | Smooth, confident              |

### Layer 3: CSS-only micro-interactions

Zero JavaScript overhead for hover, focus, press states.

```css
/* Hover lift on cards */
.card-hover {
  transition:
    transform 120ms ease-out,
    box-shadow 120ms ease-out;
}
.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Button press */
button:active {
  transform: scale(0.97);
}

/* Focus ring (keyboard only) */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  transition: outline-offset 100ms;
}

/* Theme transitions */
* {
  transition:
    color 200ms,
    background-color 200ms,
    border-color 200ms;
}
```

### Duration Standards

| Type                              | Duration       | Method                  |
| --------------------------------- | -------------- | ----------------------- |
| Micro (hover, press, focus)       | 100-150ms      | CSS `ease-out`          |
| Component (panel, card, menu)     | 200-300ms      | Spring physics          |
| Layout (sidebar, split)           | 300-400ms      | Spring `damping: 25-30` |
| View transition (page, tab)       | Browser-native | View Transitions API    |
| Emphasis (celebration, milestone) | 500-800ms      | Spring `damping: 12-15` |

### Reduced Motion

All animations gated by `prefers-reduced-motion`:

- Spring animations → instant (0ms duration)
- View Transitions → instant cross-fade (50ms)
- Micro-interactions → disabled
- Layout changes → instant snap (no spring)

## Visual Design — 2026 Standards

### Bento Grid System

Dashboard cards use asymmetric modular layout:

- Cards: `rounded-2xl` with `border border-border/10`
- Shadows: subtle multi-layer (`shadow-sm` base + `shadow-lg` on hover)
- Each card is `@container` — internal content adapts to card dimensions
- Gap: `gap-3` phone, `gap-4` desktop

### Evolved Glassmorphism

Used functionally (not decoratively) for depth hierarchy:

- Command palette backdrop: `backdrop-filter: blur(20px)` + `bg-background/80`
- Sidebar on tablet overlay mode: `backdrop-filter: blur(12px)` + `bg-card/90`
- Modal overlays: glass layer instead of opaque black (`bg-black/30` + `backdrop-blur-sm`)
- Always include `-webkit-backdrop-filter` for Safari/iOS

### Information Density

| Tier     | Base Font | Line Height | Padding Scale | Touch Target |
| -------- | --------- | ----------- | ------------- | ------------ |
| Phone    | 16px      | 1.5         | 1x (4px grid) | 44px min     |
| Tablet   | 16px      | 1.5         | 1.1x          | 44px min     |
| Laptop   | 15px      | 1.55        | 1.15x         | 32px min     |
| Desktop+ | 15px      | 1.6         | 1.2x          | 32px min     |

Journal editor on desktop: `max-width: 65ch`, `line-height: 1.7` for optimal reading.

### Design DNA (constant across ALL tiers)

These NEVER change between platforms:

- Color palette: identical theme tokens
- Border radius language: `rounded-xl` / `rounded-2xl`
- Shadow elevation scale: consistent depth system
- Icon set: Lucide icons everywhere
- Brand personality: same emoji, copy, voice
- Dark/light mode: synced across devices via cloud

### Platform-Adaptive Visuals

| Platform    | Adaptation                                                    |
| ----------- | ------------------------------------------------------------- |
| iOS         | System font (SF Pro influence), slightly rounder feel         |
| Android     | Material-style ripple on tap, Roboto influence                |
| Desktop web | Sharper interactive corners, defined borders, tighter shadows |
| Dark mode   | All platforms, preference synced to cloud                     |

### Micro-Delights

Small non-essential animations that bring joy (2026 trend):

- Habit completion: checkmark draws itself with spring physics
- Streak milestone: counter number animates up (spring with overshoot)
- Mood logged: selected emoji does tiny bounce
- Journal saved: subtle flash of success color on editor border
- These exist on ALL platforms — joy is universal

## Performance

### Code-Splitting by Device Tier

Desktop-only features are lazy-loaded — phone bundle never includes them:

```typescript
const CommandPalette = lazy(() => import("./desktop/CommandPalette"));
const ContextMenu = lazy(() => import("./desktop/ContextMenu"));
const ResizablePanels = lazy(() => import("./desktop/ResizablePanels"));
const HoverPreviews = lazy(() => import("./desktop/HoverPreviews"));
const DragDropManager = lazy(() => import("./desktop/DragDropManager"));
```

### Performance Budget

| Metric                   | Phone Target | Desktop Target |
| ------------------------ | ------------ | -------------- |
| First Contentful Paint   | < 1.5s       | < 1.0s         |
| Time to Interactive      | < 3.0s       | < 2.0s         |
| Animation frame budget   | 16ms (60fps) | 8ms (120fps)   |
| Initial bundle (gzip)    | < 200KB      | < 250KB        |
| Largest Contentful Paint | < 2.5s       | < 1.5s         |

### Rendering Optimization

- GPU-accelerated animations only (`transform`, `opacity`) — no layout thrashing
- Desktop: preload adjacent tab content for instant switching via `startTransition`
- Habit check-off uses `useOptimistic` for instant UI feedback before server confirms
- Journal auto-save uses `startTransition` to keep editor responsive during sync
- Virtual scrolling for long lists (journal entries, habit history) via `@tanstack/react-virtual` (already in deps)

## React 19 Integration

| Feature           | ZenFlow Use Case                                                 |
| ----------------- | ---------------------------------------------------------------- |
| `useOptimistic`   | Habit completion — UI updates instantly, reverts on server error |
| `useTransition`   | Tab switching — new tab renders in background, no jank           |
| `startTransition` | Journal save, cloud sync — non-blocking async operations         |
| `use()`           | Simplified data loading in panel components                      |

## Accessibility Across Tiers

### Keyboard Navigation (Desktop)

- `Tab` / `Shift+Tab`: cycle between focus areas (sidebar → main → detail panel)
- Arrow keys: navigate within lists (journal entries, habit grid)
- `Enter`: activate focused element
- `Escape`: close active overlay, unfocus panel
- `Space`: toggle habit completion on focused habit

### ARIA Landmarks (change per layout)

- Phone: `<main>` wraps everything, `<nav>` is bottom tabs
- Desktop: `<nav>` is sidebar, `<main>` is center panel, `<aside>` is detail panel
- Landmarks adapt dynamically when layout tier changes

### Focus Management

- Focus rings: visible on keyboard navigation (`focus-visible`), hidden on mouse click
- Panel transitions: focus moves to new panel content (not trapped in old panel)
- Command palette: focus trapped while open, returns to trigger on close
- Skip links: functional on desktop — "Skip to main content" jumps past sidebar

### Screen Reader

- Live regions for dynamic updates (habit completion, mood logged, sync status)
- Panel layout changes announced via `aria-live="polite"`
- All icons have `aria-label` or are `aria-hidden` with adjacent text

## Offline & Sync

- All layouts work fully offline — same Dexie/IndexedDB stack regardless of tier
- Panel state (sidebar width, column sizes, collapsed state) stored in localStorage per device
- User preferences (sidebar expanded, default tab, theme) synced to cloud Supabase profile
- Desktop window position NOT synced (per-device physical reality)

## Error Handling Per Layout

| Tier            | Error Display                                                 |
| --------------- | ------------------------------------------------------------- |
| Phone           | Full-screen error boundary with retry button                  |
| Tablet          | Full-screen or split-panel error (based on context)           |
| Laptop/Desktop  | Inline error in affected panel only — other panels unaffected |
| Network offline | Adaptive-width banner at top of current layout                |

## Migration Strategy

This is NOT a rewrite. It's an incremental enhancement of the existing codebase:

1. **Phase 1: Foundation** — `useDeviceTier`, `useInputMethod`, `AdaptiveShell`, CSS container setup, breakpoint expansion
2. **Phase 2: Navigation** — sidebar component, navigation transformation logic, keyboard shortcut system
3. **Phase 3: Home Tab** — bento grid dashboard, container-query cards
4. **Phase 4: Journal Tab** — master-detail layout, shared element transitions, wide media
5. **Phase 5: Desktop Features** — command palette, context menus, hover previews, drag-and-drop
6. **Phase 6: Remaining Tabs** — habits grid, stats charts, garden canvas adaptations
7. **Phase 7: Polish** — animation tuning, performance optimization, accessibility audit

Each phase produces a working build. No big-bang deployment.

## Files to Create

| File                                        | Purpose                                |
| ------------------------------------------- | -------------------------------------- |
| `src/hooks/useDeviceTier.ts`                | Device tier detection hook             |
| `src/hooks/useInputMethod.ts`               | Touch/mouse/keyboard detection         |
| `src/hooks/useKeyboardShortcuts.ts`         | Global keyboard shortcut system        |
| `src/components/layout/AdaptiveShell.tsx`   | Root layout switching (tabs ↔ sidebar) |
| `src/components/layout/PanelLayout.tsx`     | Resizable multi-panel container        |
| `src/components/layout/MasterDetail.tsx`    | List + detail split component          |
| `src/components/layout/BentoGrid.tsx`       | Asymmetric dashboard card grid         |
| `src/components/desktop/CommandPalette.tsx` | Ctrl+K command palette                 |
| `src/components/desktop/ContextMenu.tsx`    | Right-click menu wrapper               |
| `src/components/desktop/HoverPreview.tsx`   | Hover card wrapper                     |
| `src/components/desktop/ResizeHandle.tsx`   | Panel resize drag handle               |
| `src/components/desktop/DragDropZone.tsx`   | Drag-and-drop wrapper                  |

## Files to Modify

| File                                            | Changes                                                     |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `src/pages/Index.tsx`                           | Wrap in `<AdaptiveShell>`, adapt tab rendering per tier     |
| `src/components/Navigation.tsx`                 | Refactor: extract sidebar and bottom-tabs as separate modes |
| `src/components/tabs/HomeTab.tsx`               | Add bento grid layout for desktop                           |
| `src/features/journal/JournalModule.tsx`        | Add master-detail layout for desktop                        |
| `src/components/habit-tracker/HabitTracker.tsx` | Adaptive grid columns, drag-and-drop                        |
| `src/components/stats/StatsPage.tsx`            | Wide chart layout, filter sidebar                           |
| `src/components/canvas/GardenCanvas.tsx`        | Docked toolbar, keyboard shortcuts                          |
| `src/index.css`                                 | Expand container max-width, add desktop breakpoints         |
| `tailwind.config.ts`                            | Ensure container query support, add desktop utilities       |
| `vite.config.ts`                                | Code-split desktop features into separate chunks            |

## Non-Goals (Explicitly Out of Scope)

- Native desktop app (Electron/Tauri) — web app in browser is the desktop experience
- Platform-specific UI frameworks (no SwiftUI, no Jetpack Compose)
- Separate desktop codebase
- Server-side rendering
- Multi-window support
