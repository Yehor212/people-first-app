# Telegram Web K Layout Research — Applied to ZenFlow

**Date:** 2026-04-11
**Source:** github.com/morethanwords/tweb (Telegram Web K source code)

---

## How Telegram Does It

### Main Layout: 3-Column Flexbox

Telegram uses `display: flex` with 3 columns:

```
#app → display: flex
  #column-left (sidebar)  → flex: var(--width) 1 auto; max-width: calc($large-screen / 4)
  #column-center (chat)   → flex: 1 (fills remaining)
  #column-right (details)  → optional, fixed width
```

**Key:** Each column is its own scroll container. Body never scrolls.

### Sidebar (Left Column)

```scss
#column-left {
  --sidebar-collapsed-width: 80px;
  --sidebar-max-width: calc($large-screen / 4); // ~420px
  flex: var(--current-width) 1 auto;
  max-width: var(--sidebar-max-width);
  width: var(--current-width);
}
```

- Collapsible: 80px (icons only) or full width (~420px)
- Uses CSS variable `--current-width` for smooth transitions
- On mobile: slides in/out as overlay

### Content (Center Column)

- `flex: 1` — fills ALL remaining space automatically
- NO `max-width` on the column itself
- Internal content (messages) has own max-width for readability

### Responsive Breakpoints (from \_shared.scss)

```scss
$handhelds: 720px; // phone
$medium-screens: 1275px; // tablet
$large-screen: 1680px; // desktop
```

### Modals (Popups)

```scss
.popup {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.popup-container {
  max-width: 420px; // fixed, reasonable width
  width: calc(100% - 2rem); // fluid within bounds
  max-height: min(420px, 100%);
  border-radius: 12px;
}
```

- Always centered
- Fixed max-width (420px for most dialogs)
- `width: calc(100% - 2rem)` for mobile adaptation
- Never full-screen on desktop

---

## How ZenFlow Currently Does It (Problems)

### Main Layout: Padding Hack

```
outer div → lg:ps-[var(--sidebar-width, 256px)]  ← padding-left for sidebar
  main   → mx-auto max-w-[var(--container-max-width)] lg:max-w-none
```

**Problems:**

1. Sidebar is `position: fixed` — not a flex child
2. Content uses padding-left to avoid sidebar — fragile
3. `max-w` on main either too narrow (letterboxing) or removed (stretching)
4. Body scrolls, not content area — sidebar needs `position: fixed` because of this

### Modals: Full-Screen on All Sizes

```
fixed inset-0 → covers entire viewport
```

- Phone: correct (full screen)
- Desktop: also full screen → should be centered dialog

---

## Phase 3: What to Fix (layered approach)

### Layer 1: Quick Wins (no architecture change)

**1a. Modal max-widths (Telegram pattern)**
Instead of `lg:mx-auto lg:my-8 lg:max-w-2xl`:

```
fixed inset-0 flex items-center justify-center
  → inner: w-[calc(100%-2rem)] max-w-[420px] rounded-xl
```

This is how Telegram does ALL popups. Fixed max-width, fluid within it.

**1b. Content readability**
Text-heavy components add `max-w-prose` (65ch) internally.
Dashboard cards use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` to fill width.

### Layer 2: Layout Improvement (medium risk)

**2a. Convert sidebar from fixed to flex child**

```
BEFORE:
  <div class="lg:ps-[256px]">  // padding hack
    <Sidebar class="fixed left-0" />  // fixed position
    <main>content</main>
  </div>

AFTER (Telegram pattern):
  <div class="lg:flex lg:h-screen">
    <Sidebar class="lg:w-64 lg:flex-shrink-0 lg:overflow-y-auto" />
    <main class="lg:flex-1 lg:overflow-y-auto">content</main>
  </div>
```

This eliminates ALL max-width issues because `flex: 1` automatically fills remaining space.

**Risk:** Scroll behavior changes. Components using `window.scroll` events may break. Need to test scroll-linked animations, pull-to-refresh, infinite scroll.

**2b. Independent scroll containers**

```
sidebar: overflow-y-auto (own scroll)
content: overflow-y-auto (own scroll, not body)
```

Each section scrolls independently like Telegram.

### Layer 3: Component-Level Adaptation (safe, incremental)

**3a. Container queries for reusable components**

```
@container (min-width: 640px) { grid-cols-2 }
@container (min-width: 1024px) { grid-cols-3 }
```

Components adapt to available space, not viewport.

**3b. Journal 2-panel layout on desktop**

```
<div class="lg:flex">
  <EntryList class="lg:w-80 lg:flex-shrink-0 lg:overflow-y-auto lg:border-r" />
  <Editor class="lg:flex-1" />
</div>
```

**3c. Dashboard grid adaptation**
HomeTab cards: responsive grid that fills available width.

### Layer 4: Polish (safe)

- Safe area standardization
- Keyboard handling
- iPad split screen support
- Periodic PIN reinforcement

---

## Implementation Order

| Phase | What                                | Risk   | Files                      |
| ----- | ----------------------------------- | ------ | -------------------------- |
| 3.1a  | Modal max-widths (Telegram pattern) | LOW    | 14 modal files             |
| 3.1b  | Content readability (max-w-prose)   | LOW    | HomeTab, text components   |
| 3.2a  | Sidebar fixed→flex                  | MEDIUM | Sidebar.tsx, Index.tsx     |
| 3.2b  | Independent scroll containers       | MEDIUM | Index.tsx, content wrapper |
| 3.3a  | Container queries                   | LOW    | Card components, grids     |
| 3.3b  | Journal 2-panel                     | LOW    | JournalModule.tsx          |
| 3.3c  | Dashboard grid                      | LOW    | HomeTab.tsx                |
| 3.4   | Safe area, keyboard, iPad           | LOW    | Various                    |

## Sources

- [Telegram Web K GitHub](https://github.com/morethanwords/tweb)
- [Telegram leftSidebar.scss](https://github.com/morethanwords/tweb/blob/master/src/scss/partials/_leftSidebar.scss)
- [Telegram sidebar.scss](https://github.com/morethanwords/tweb/blob/master/src/scss/partials/_sidebar.scss)
- [MDN: Responsive Design](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design)
- [Container Queries in Tailwind v4](https://www.sitepoint.com/tailwind-css-v4-container-queries-modern-layouts/)
