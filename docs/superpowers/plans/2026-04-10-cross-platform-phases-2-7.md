# Cross-Platform Phases 2-7: Complete Implementation Plan

> **Governance update (2026-08-14):** Execute only an explicitly authorized task and do so SOLO. Use `superpowers:executing-plans` only for an approved plan; do not invoke subagents or auto-start the next task. Existing checkboxes are tracking only.

**Goal:** Transform ZenFlow from mobile-first to a Telegram-level cross-platform experience across phone, tablet, laptop, and desktop — with adaptive layouts, desktop power features, and 2026-standard animations.

**Architecture:** Builds on Phase 1 Foundation (useDeviceTier, useInputMethod, useKeyboardShortcuts, AdaptiveShell, CSS containers). Each phase produces a working build. Phases are sequential but tasks within phases can be parallelized.

**Tech Stack:** React 18 + TypeScript + Tailwind CSS + motion.dev (framer-motion) + cmdk + Radix UI + Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-cross-platform-design.md`
**Phase 1 (done):** `docs/superpowers/plans/2026-04-09-cross-platform-phase1-foundation.md`

**Prerequisite:** Phase 1 must be committed (hooks: useDeviceTier, useInputMethod, useKeyboardShortcuts; component: AdaptiveShell; CSS: tier-adaptive containers).

---

# Phase 2: Navigation Transformation

**Goal:** Replace hardcoded `lg:` sidebar/bottom-tab switching with tier-aware AdaptiveShell-driven navigation.

## Task 1: Extract BottomTabs component from Navigation.tsx

**Files:**

- Create: `src/components/navigation/BottomTabs.tsx`
- Create: `src/components/navigation/BottomTabs.test.tsx`
- Modify: `src/components/Navigation.tsx`

- [ ] **Step 1: Read Navigation.tsx fully** to identify bottom tabs JSX (the `lg:hidden` section)

- [ ] **Step 2: Create BottomTabs.tsx**

Extract the bottom tab bar JSX from Navigation.tsx into a standalone component. Props:

```typescript
interface BottomTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  tabs: TabConfig[];
}
```

- [ ] **Step 3: Write test**

```typescript
// src/components/navigation/BottomTabs.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BottomTabs } from './BottomTabs';

describe('BottomTabs', () => {
  const tabs = [
    { id: 'home', label: 'Home', icon: 'Home' },
    { id: 'garden', label: 'Garden', icon: 'Sprout' },
  ];

  it('renders all tab buttons', () => {
    render(<BottomTabs activeTab="home" onTabChange={() => {}} tabs={tabs as any} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('highlights active tab', () => {
    render(<BottomTabs activeTab="home" onTabChange={() => {}} tabs={tabs as any} />);
    const homeBtn = screen.getAllByRole('button')[0];
    expect(homeBtn.className).toContain('text-primary');
  });
});
```

- [ ] **Step 4: Verify** `npx tsc --noEmit && npx vitest run src/components/navigation/`
- [ ] **Step 5: Commit** `'refactor: extract BottomTabs from Navigation.tsx'`

## Task 2: Extract Sidebar component from Navigation.tsx

**Files:**

- Create: `src/components/navigation/Sidebar.tsx`
- Create: `src/components/navigation/Sidebar.test.tsx`
- Modify: `src/components/Navigation.tsx`

- [ ] **Step 1: Extract sidebar JSX** (the `hidden lg:flex` section) into standalone component

Props:

```typescript
interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  tabs: TabConfig[];
  collapsed: boolean;
  onToggleCollapse: () => void;
}
```

- [ ] **Step 2: Write test** — renders tabs, toggles collapse, shows tooltips when collapsed
- [ ] **Step 3: Verify and commit** `'refactor: extract Sidebar from Navigation.tsx'`

## Task 3: Integrate navigation with AdaptiveShell

**Files:**

- Modify: `src/components/layout/AdaptiveShell.tsx`
- Modify: `src/components/Navigation.tsx`
- Modify: `src/pages/Index.tsx`

- [ ] **Step 1: Update AdaptiveShell** to conditionally render Sidebar (laptop+) or BottomTabs (phone/tablet)

```typescript
export function AdaptiveShell({ children, className }: AdaptiveShellProps) {
  const { tier, isDesktopClass } = useDeviceTier();
  // ... existing tier sync

  return (
    <div data-device-tier={tier} className={cn('adaptive-shell', isDesktop && 'desktop-class', className)}>
      {isDesktopClass ? <Sidebar {...navProps} /> : null}
      <main className={cn(isDesktopClass && 'lg:ps-[var(--sidebar-width,256px)]')}>
        {children}
      </main>
      {!isDesktopClass ? <BottomTabs {...navProps} /> : null}
    </div>
  );
}
```

- [ ] **Step 2: Update Navigation.tsx** to delegate to AdaptiveShell (or become a thin wrapper)
- [ ] **Step 3: Update Index.tsx** to wrap content in AdaptiveShell
- [ ] **Step 4: Verify** — sidebar on desktop viewport, bottom tabs on mobile
- [ ] **Step 5: Commit** `'feat: tier-aware navigation — sidebar on desktop, tabs on mobile'`

## Task 4: Register global keyboard shortcuts

**Files:**

- Modify: `src/pages/Index.tsx`

- [ ] **Step 1: Wire useKeyboardShortcuts** into Index.tsx with tab switching shortcuts

```typescript
const { tier } = useDeviceTier();
useKeyboardShortcuts(
  {
    "ctrl+1": () => setActiveTab("home"),
    "ctrl+2": () => setActiveTab("mindmap"),
    "ctrl+3": () => setActiveTab("garden"),
    "ctrl+4": () => setActiveTab("stats"),
    "ctrl+5": () => setActiveTab("settings"),
    "ctrl+b": () => toggleSidebarCollapse(),
    "ctrl+,": () => setActiveTab("settings"),
  },
  tier !== "phone"
); // Disable on phone
```

- [ ] **Step 2: Verify** shortcuts work on desktop viewport
- [ ] **Step 3: Commit** `'feat: global keyboard shortcuts for tab switching and sidebar toggle'`

## Task 5: Phase 2 integration verification

- [ ] **Step 1: Full CI** `npx tsc --noEmit && npx eslint . --max-warnings=96 && npx vitest run && vite build`
- [ ] **Step 2: Commit** `'chore: Phase 2 Navigation complete'`

---

# Phase 3: Home Tab — Bento Grid Dashboard

**Goal:** Transform Home tab from vertical scroll into a bento grid dashboard on desktop.

## Task 6: Create BentoGrid layout component

**Files:**

- Create: `src/components/layout/BentoGrid.tsx`
- Create: `src/components/layout/BentoGrid.test.tsx`

```typescript
// src/components/layout/BentoGrid.tsx
interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div className={cn(
      '@container',
      'grid gap-3 @sm:gap-4',
      'grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-4',
      className
    )}>
      {children}
    </div>
  );
}

interface BentoCardProps {
  children: ReactNode;
  span?: '1' | '2' | 'full';
  className?: string;
}

export function BentoCard({ children, span = '1', className }: BentoCardProps) {
  return (
    <div className={cn(
      '@container rounded-2xl border border-border/10 bg-card p-4 shadow-sm',
      'hover:shadow-md transition-shadow duration-150',
      span === '2' && '@sm:col-span-2',
      span === 'full' && 'col-span-full',
      className
    )}>
      {children}
    </div>
  );
}
```

- [ ] **Step 1: Create component + test** (renders grid, cards get correct span classes)
- [ ] **Step 2: Verify and commit** `'feat: add BentoGrid + BentoCard layout components'`

## Task 7: Adapt HomeTab to use BentoGrid on desktop

**Files:**

- Modify: `src/components/tabs/HomeTab.tsx`

- [ ] **Step 1: Read HomeTab.tsx** (191 lines) and identify the 3 sections
- [ ] **Step 2: Wrap in BentoGrid** — mood card (span 2), habits (span 2), streaks (span 1), insights (span 1)
- [ ] **Step 3: Phone layout unchanged** — BentoGrid with `@container` naturally stacks on narrow containers
- [ ] **Step 4: Verify and commit** `'feat: bento grid dashboard layout for Home tab on desktop'`

---

# Phase 4: Journal Tab — Master-Detail Layout

**Goal:** Journal becomes a master-detail split on desktop (list + editor side-by-side).

## Task 8: Create MasterDetail layout component

**Files:**

- Create: `src/components/layout/MasterDetail.tsx`
- Create: `src/components/layout/MasterDetail.test.tsx`

```typescript
// src/components/layout/MasterDetail.tsx
interface MasterDetailProps {
  master: ReactNode;
  detail: ReactNode;
  showDetail: boolean;
  masterWidth?: string; // default '30%'
  className?: string;
}

export function MasterDetail({ master, detail, showDetail, masterWidth = '30%', className }: MasterDetailProps) {
  const { supportsMultiPanel } = useDeviceTier();

  if (!supportsMultiPanel) {
    // Phone/tablet: show one panel at a time
    return <>{showDetail ? detail : master}</>;
  }

  // Desktop: side-by-side split
  return (
    <div className={cn('flex h-full', className)}>
      <div className="shrink-0 border-e border-border overflow-y-auto" style={{ width: masterWidth }}>
        {master}
      </div>
      <div className="flex-1 overflow-y-auto">
        {detail}
      </div>
    </div>
  );
}
```

- [ ] **Step 1: Create component + test** (single-panel on phone mock, split on desktop mock)
- [ ] **Step 2: Verify and commit** `'feat: add MasterDetail layout component'`

## Task 9: Integrate MasterDetail into JournalModule

**Files:**

- Modify: `src/features/journal/JournalModule.tsx`

- [ ] **Step 1: Read JournalModule** and identify list vs editor sections
- [ ] **Step 2: Wrap in MasterDetail** — `master={<JournalEntryList />}` `detail={<JournalEntryEditor />}`
- [ ] **Step 3: On phone** — existing behavior unchanged (full-screen list, full-screen editor)
- [ ] **Step 4: On desktop** — list panel (30%) + editor panel (70%) side-by-side
- [ ] **Step 5: Verify and commit** `'feat: journal master-detail layout on desktop'`

## Task 10: Wide media gallery for journal photos

**Files:**

- Modify: `src/features/journal/JournalPhotoGallery.tsx`

- [ ] **Step 1: Read JournalPhotoGallery** and change photo layout to grid on desktop

```typescript
const { isDesktopClass } = useDeviceTier();
// Phone: vertical stack. Desktop: grid
<div className={cn(isDesktopClass ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2')}>
```

- [ ] **Step 2: Verify and commit** `'feat: wide photo grid gallery on desktop journal'`

---

# Phase 5: Desktop Power Features

**Goal:** Add command palette, context menus, hover previews, drag-and-drop.

## Task 11: Install cmdk and create Command Palette

**Files:**

- Run: `npm install cmdk`
- Create: `src/components/desktop/CommandPalette.tsx`
- Create: `src/components/desktop/CommandPalette.test.tsx`
- Modify: `src/pages/Index.tsx` (register Ctrl+K shortcut)

- [ ] **Step 1: Install cmdk**

```bash
npm install cmdk
```

- [ ] **Step 2: Create CommandPalette component**

```typescript
// src/components/desktop/CommandPalette.tsx
import { Command } from 'cmdk';
import { useState, useEffect } from 'react';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}

export function CommandPalette({ open, onClose, onAction }: CommandPaletteProps) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-[20%] inset-x-4 z-[81] max-w-lg mx-auto">
        <Command className="rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <Command.Input
            placeholder="Search actions, entries, settings..."
            className="w-full px-4 py-3 text-base bg-transparent outline-none placeholder:text-muted-foreground/50"
            autoFocus
          />
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
            <Command.Group heading="Actions">
              <Command.Item onSelect={() => onAction('new-entry')} className="px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-muted">
                New journal entry
              </Command.Item>
              <Command.Item onSelect={() => onAction('log-mood')} className="px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-muted">
                Log mood
              </Command.Item>
              <Command.Item onSelect={() => onAction('check-habit')} className="px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-muted">
                Check off habit
              </Command.Item>
              <Command.Item onSelect={() => onAction('toggle-theme')} className="px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-muted">
                Toggle dark mode
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Navigation">
              <Command.Item onSelect={() => onAction('goto-home')} className="px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-muted">
                Go to Home
              </Command.Item>
              <Command.Item onSelect={() => onAction('goto-journal')} className="px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-muted">
                Go to Journal
              </Command.Item>
              <Command.Item onSelect={() => onAction('goto-settings')} className="px-3 py-2 rounded-lg cursor-pointer data-[selected=true]:bg-muted">
                Go to Settings
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Register Ctrl+K** in Index.tsx to toggle command palette
- [ ] **Step 4: Lazy-load** — `const CommandPalette = lazy(() => import('./desktop/CommandPalette'))`
- [ ] **Step 5: Write test + verify + commit** `'feat: add Ctrl+K command palette for desktop'`

## Task 12: Right-click context menus

**Files:**

- Create: `src/components/desktop/HabitContextMenu.tsx`
- Modify: `src/components/compact-habit-card/CompactHabitCard.tsx`

- [ ] **Step 1: Create HabitContextMenu** using Radix UI `ContextMenu` (check if @radix-ui/react-context-menu is installed, if not install it)

```typescript
// Wraps habit card with right-click menu: Complete, Skip, Edit, Archive, Delete
import * as ContextMenu from "@radix-ui/react-context-menu";
```

- [ ] **Step 2: Wrap CompactHabitCard** in context menu on desktop only

```typescript
const { isMouse } = useInputMethod();
// Only show context menu for mouse users (not touch)
if (isMouse) return <HabitContextMenu habit={habit}><Card /></HabitContextMenu>;
return <Card />;
```

- [ ] **Step 3: Verify and commit** `'feat: right-click context menu on habit cards (desktop)'`

## Task 13: Hover previews

**Files:**

- Create: `src/components/desktop/HoverPreview.tsx`

- [ ] **Step 1: Create generic HoverPreview** wrapper using Radix `HoverCard`

```typescript
// src/components/desktop/HoverPreview.tsx
import * as HoverCard from '@radix-ui/react-hover-card';

interface HoverPreviewProps {
  trigger: ReactNode;
  content: ReactNode;
  enabled?: boolean;
  openDelay?: number;
}

export function HoverPreview({ trigger, content, enabled = true, openDelay = 200 }: HoverPreviewProps) {
  if (!enabled) return <>{trigger}</>;
  return (
    <HoverCard.Root openDelay={openDelay}>
      <HoverCard.Trigger asChild>{trigger}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="z-[75] rounded-xl border bg-card p-3 shadow-lg animate-fade-in"
          sideOffset={8}
        >
          {content}
          <HoverCard.Arrow className="fill-card" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
```

- [ ] **Step 2: Apply to habit cards** — hover shows 7-day streak sparkline
- [ ] **Step 3: Verify and commit** `'feat: hover previews for habit cards on desktop'`

## Task 14: Drag-and-drop for habit reordering

**Files:**

- Modify: `src/components/habit-tracker/HabitTracker.tsx`

- [ ] **Step 1: Add HTML5 draggable** to habit cards on desktop

```typescript
const { isMouse } = useInputMethod();
// Only enable drag on mouse devices
<div draggable={isMouse} onDragStart={...} onDragOver={...} onDrop={...}>
```

- [ ] **Step 2: Visual feedback** — dragged card gets `opacity-50`, drop target gets `border-2 border-primary`
- [ ] **Step 3: Persist reorder** to Dexie storage
- [ ] **Step 4: Verify and commit** `'feat: drag-and-drop habit reordering on desktop'`

---

# Phase 6: Remaining Tabs Adaptation

**Goal:** Adapt Habits grid, Stats charts, and Garden canvas for desktop layouts.

## Task 15: Habits tab — adaptive grid columns

**Files:**

- Modify: `src/components/habit-tracker/HabitTracker.tsx`

- [ ] **Step 1: Use @container queries** for grid columns

```typescript
<div className="@container">
  <div className="grid grid-cols-2 @sm:grid-cols-3 @lg:grid-cols-4 @xl:grid-cols-5 gap-3">
    {habits.map(habit => <CompactHabitCard key={habit.id} {...habit} />)}
  </div>
</div>
```

- [ ] **Step 2: Verify** grid expands on desktop, stays 2-col on phone
- [ ] **Step 3: Commit** `'feat: adaptive habit grid columns via container queries'`

## Task 16: Stats tab — wide chart layout

**Files:**

- Modify: `src/components/stats/StatsPage.tsx`

- [ ] **Step 1: Add filter sidebar** on desktop using MasterDetail or conditional layout

```typescript
const { supportsMultiPanel } = useDeviceTier();
// Desktop: charts + filter sidebar. Phone: stacked charts
```

- [ ] **Step 2: Charts get more horizontal space** on desktop viewport
- [ ] **Step 3: Verify and commit** `'feat: wide chart layout + filter sidebar for Stats on desktop'`

## Task 17: Garden/Canvas — docked toolbar

**Files:**

- Modify: `src/components/GardenCanvas.tsx`

- [ ] **Step 1: On desktop** — floating toolbar becomes docked left sidebar
- [ ] **Step 2: Add keyboard shortcuts** for garden actions (zoom, rotate)
- [ ] **Step 3: Verify and commit** `'feat: docked toolbar + keyboard shortcuts for Garden on desktop'`

---

# Phase 7: Polish — Animations, Performance, Accessibility

**Goal:** Tune animations to 2026 standards, optimize performance per tier, run accessibility audit.

## Task 18: View Transitions API for tab switching

**Files:**

- Create: `src/lib/viewTransitions.ts`
- Modify: `src/pages/Index.tsx`

```typescript
// src/lib/viewTransitions.ts
export function startViewTransition(callback: () => void): void {
  if ("startViewTransition" in document) {
    (document as any).startViewTransition(callback);
  } else {
    callback(); // Fallback: instant switch
  }
}
```

- [ ] **Step 1: Create viewTransitions utility**
- [ ] **Step 2: Wrap tab switching** in Index.tsx with `startViewTransition()`
- [ ] **Step 3: Add CSS** `::view-transition-*` selectors for cross-fade animation
- [ ] **Step 4: Verify and commit** `'feat: View Transitions API for tab switching on desktop'`

## Task 19: Spring physics tuning

**Files:**

- Create: `src/lib/animations.ts`

```typescript
// src/lib/animations.ts — centralized spring configs
export const springs = {
  sidebar: { stiffness: 300, damping: 30 },
  commandPalette: { stiffness: 400, damping: 28 },
  panelResize: { stiffness: 500, damping: 35 },
  dragDrop: { stiffness: 200, damping: 20 },
  celebration: { stiffness: 600, damping: 15 },
  modal: { stiffness: 350, damping: 30 },
} as const;

export const durations = {
  micro: 120, // hover, press
  component: 250, // panel, menu
  layout: 350, // sidebar, split
  emphasis: 600, // celebration
} as const;
```

- [ ] **Step 1: Create animations config**
- [ ] **Step 2: Replace hardcoded durations** in existing motion components with centralized springs
- [ ] **Step 3: Verify and commit** `'refactor: centralize spring physics config'`

## Task 20: Desktop-only code splitting

**Files:**

- Modify: `vite.config.ts`

- [ ] **Step 1: Add manualChunks** for desktop features

```typescript
// In vite.config.ts manualChunks:
if (id.includes("src/components/desktop/")) return "desktop-features";
if (id.includes("cmdk")) return "desktop-features";
```

- [ ] **Step 2: Verify** phone bundle doesn't include desktop code
- [ ] **Step 3: Commit** `'perf: code-split desktop features into separate chunk'`

## Task 21: Accessibility audit

**Files:**

- Modify: multiple files

- [ ] **Step 1: Verify keyboard navigation** — Tab through sidebar, main, detail panel
- [ ] **Step 2: Verify ARIA landmarks** change per tier (nav, main, complementary)
- [ ] **Step 3: Verify focus management** — focus visible on keyboard, hidden on mouse
- [ ] **Step 4: Verify skip links** work on desktop
- [ ] **Step 5: Verify reduced motion** — all animations disabled when `prefers-reduced-motion`
- [ ] **Step 6: Fix any issues found**
- [ ] **Step 7: Commit** `'a11y: cross-platform accessibility audit fixes'`

## Task 22: Final integration + performance test

- [ ] **Step 1: Full CI**

```bash
npx tsc --noEmit && npx eslint . --max-warnings=96 && npx vitest run && vite build && npm run i18n:check
```

- [ ] **Step 2: Verify bundle sizes** — phone < 200KB gzip, desktop < 250KB gzip
- [ ] **Step 3: Verify no regressions** — all existing 3163+ tests pass
- [ ] **Step 4: Final commit** `'chore: cross-platform Phase 7 complete — all 7 phases done'`

---

## Phase Summary

| Phase               | Tasks        | Key Deliverables                                                      |
| ------------------- | ------------ | --------------------------------------------------------------------- |
| Phase 2: Navigation | 1-5          | BottomTabs + Sidebar extraction, AdaptiveShell integration, shortcuts |
| Phase 3: Home Tab   | 6-7          | BentoGrid + BentoCard, dashboard layout                               |
| Phase 4: Journal    | 8-10         | MasterDetail component, split layout, wide photos                     |
| Phase 5: Desktop    | 11-14        | Command palette, context menus, hover previews, drag-drop             |
| Phase 6: Tabs       | 15-17        | Habits grid, Stats charts, Garden toolbar                             |
| Phase 7: Polish     | 18-22        | View Transitions, spring config, code splitting, a11y, perf           |
| **Total**           | **22 tasks** | **~30 new files, ~15 modified**                                       |

## Execution Order

Phases MUST be sequential (each depends on previous). Tasks within a phase can be parallelized where files don't overlap.

**Estimated effort per phase:**

- Phase 2: 1 session
- Phase 3: 0.5 session
- Phase 4: 1 session
- Phase 5: 1.5 sessions
- Phase 6: 1 session
- Phase 7: 1 session

**Total: ~6 sessions to complete all 7 phases.**
