# Cross-Platform COMPLETE Implementation Plan (Phases 2-7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 100% implementation of the cross-platform design spec — Telegram-level adaptive experience across phone, tablet, laptop, desktop. Zero gaps.

**Architecture:** Builds on Phase 1 Foundation (committed: `ce4f026`). Each phase produces a working build. 38 tasks total across 6 phases.

**Tech Stack:** React 18 + TypeScript + Tailwind CSS + motion.dev + cmdk + react-resizable-panels + Radix UI + Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-cross-platform-design.md`
**Phase 1 (DONE):** `useDeviceTier`, `useInputMethod`, `useKeyboardShortcuts`, `AdaptiveShell`, CSS tier-adaptive containers

**Gap audit source:** Code reviewer found 60-65% coverage in prior plans. This plan fills ALL 12 identified gaps.

**Research sources:**

- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) — PanelGroup/Panel/PanelResizeHandle (used by OpenAI, Adobe)
- [React 19 useOptimistic](https://react.dev/reference/react/useOptimistic) — instant UI feedback
- [React 19 useTransition](https://react.dev/reference/react/useTransition) — non-blocking state updates
- [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) — a11y animation fallback
- [react-lightbox (shadcn registry)](https://github.com/laststance/react-lightbox) — keyboard-accessible gallery
- [cmdk](https://cmdk.paco.me/) — command palette
- [shadcn/ui resizable](https://ui.shadcn.com/docs/components/radix/resizable) — wraps react-resizable-panels

---

# Phase 2: Navigation Transformation (Tasks 1-7)

## Task 1: Extract BottomTabs from Navigation.tsx

**Files:**

- Create: `src/components/navigation/BottomTabs.tsx`
- Create: `src/components/navigation/BottomTabs.test.tsx`
- Modify: `src/components/Navigation.tsx`

- [ ] **Step 1:** Read `src/components/Navigation.tsx` (240L). Identify the `lg:hidden` bottom tab bar section.
- [ ] **Step 2:** Create `BottomTabs.tsx` — extract bottom nav JSX. Props: `activeTab`, `onTabChange`, `tabs[]`, `t` (translations).
- [ ] **Step 3:** Write test — renders tabs, highlights active, calls onTabChange on click.
- [ ] **Step 4:** Update `Navigation.tsx` to render `<BottomTabs />` instead of inline JSX.
- [ ] **Step 5:** Verify: `npx tsc --noEmit && npx vitest run src/components/navigation/`
- [ ] **Step 6:** Commit `'refactor: extract BottomTabs from Navigation.tsx'`

## Task 2: Extract Sidebar from Navigation.tsx

**Files:**

- Create: `src/components/navigation/Sidebar.tsx`
- Create: `src/components/navigation/Sidebar.test.tsx`
- Modify: `src/components/Navigation.tsx`

- [ ] **Step 1:** Extract `hidden lg:flex` sidebar section into `Sidebar.tsx`. Props: `activeTab`, `onTabChange`, `tabs[]`, `collapsed`, `onToggleCollapse`, `t`.
- [ ] **Step 2:** Add hover tooltips on collapsed sidebar icons using Radix `Tooltip`:

```tsx
{
  collapsed && (
    <Tooltip content={tab.label}>
      <button>{tab.icon}</button>
    </Tooltip>
  );
}
```

- [ ] **Step 3:** Add active tab left accent bar:

```tsx
{
  isActive && <div className="absolute start-0 top-1/4 h-1/2 w-0.5 rounded-full bg-primary" />;
}
```

- [ ] **Step 4:** Write test — renders, collapses, shows tooltips when collapsed.
- [ ] **Step 5:** Verify + commit `'refactor: extract Sidebar with hover tooltips + active accent bar'`

## Task 3: Tablet navigation — landscape side rail

**Files:**

- Modify: `src/components/layout/AdaptiveShell.tsx`

- [ ] **Step 1:** Add tablet landscape detection:

```typescript
const isTabletLandscape = useMediaQuery("(min-width: 768px) and (orientation: landscape)");
```

- [ ] **Step 2:** In AdaptiveShell: tablet landscape shows collapsed Sidebar (icon rail 64px), portrait shows BottomTabs.
- [ ] **Step 3:** Write test — tablet portrait = bottom tabs, landscape = side rail.
- [ ] **Step 4:** Verify + commit `'feat: tablet landscape side rail navigation'`

## Task 4: Integrate AdaptiveShell navigation switching

**Files:**

- Modify: `src/components/layout/AdaptiveShell.tsx`
- Modify: `src/components/Navigation.tsx`
- Modify: `src/pages/Index.tsx`

- [ ] **Step 1:** AdaptiveShell renders Sidebar (laptop+), collapsed Sidebar (tablet landscape), or BottomTabs (phone + tablet portrait).
- [ ] **Step 2:** Navigation.tsx becomes thin wrapper delegating to AdaptiveShell.
- [ ] **Step 3:** Index.tsx wraps content in `<AdaptiveShell>`.
- [ ] **Step 4:** Verify: sidebar on desktop, bottom tabs on phone. No visual regression.
- [ ] **Step 5:** Commit `'feat: tier-aware navigation via AdaptiveShell'`

## Task 5: Register ALL keyboard shortcuts

**Files:**

- Modify: `src/pages/Index.tsx`

- [ ] **Step 1:** Register COMPLETE shortcut map (all from spec):

```typescript
useKeyboardShortcuts(
  {
    "ctrl+1": () => setActiveTab("home"),
    "ctrl+2": () => setActiveTab("mindmap"),
    "ctrl+3": () => setActiveTab("garden"),
    "ctrl+4": () => setActiveTab("stats"),
    "ctrl+5": () => setActiveTab("settings"),
    "ctrl+b": () => toggleSidebarCollapse(),
    "ctrl+,": () => setActiveTab("settings"),
    "ctrl+k": () => setCommandPaletteOpen(true),
    "ctrl+n": () => handleNewJournalEntry(),
    "ctrl+h": () => handleQuickHabitCheckoff(),
    "ctrl+m": () => handleQuickMoodLog(),
    "ctrl+f": () => handleSearchCurrentView(),
    "ctrl+\\": () => toggleRightPanel(),
    escape: () => closeActiveOverlay(),
  },
  tier !== "phone"
);
```

- [ ] **Step 2:** Implement handler stubs (actual functionality wired in later phases).
- [ ] **Step 3:** Verify + commit `'feat: register all 14 keyboard shortcuts from spec'`

## Task 6: Right context panel infrastructure

**Files:**

- Create: `src/components/layout/ContextPanel.tsx`
- Create: `src/components/layout/ContextPanel.test.tsx`

- [ ] **Step 1:** Create ContextPanel — slides in from right (280px) on desktop+ tier only.

```typescript
interface ContextPanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}
```

- [ ] **Step 2:** Wire `Ctrl+\` toggle in Index.tsx.
- [ ] **Step 3:** Test + verify + commit `'feat: add right ContextPanel for desktop+ (Ctrl+\\ toggle)'`

## Task 7: Phase 2 verification

- [ ] **Step 1:** Full CI: `npx tsc --noEmit && npx eslint . && npx vitest run && vite build`
- [ ] **Step 2:** Commit `'chore: Phase 2 Navigation complete'`

---

# Phase 3: Home Tab — Bento Grid Dashboard (Tasks 8-10)

## Task 8: BentoGrid + BentoCard components

**Files:**

- Create: `src/components/layout/BentoGrid.tsx`
- Create: `src/components/layout/BentoGrid.test.tsx`

- [ ] **Step 1:** Create BentoGrid with `@container` queries:

```tsx
export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "@container",
        "grid gap-3 @sm:gap-4",
        "grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function BentoCard({
  children,
  span = "1",
  className,
}: {
  children: ReactNode;
  span?: "1" | "2" | "row";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "@container rounded-2xl border border-border/10 bg-card p-4 shadow-sm",
        "hover:shadow-md hover:-translate-y-0.5 transition-all duration-150",
        span === "2" && "@sm:col-span-2",
        span === "row" && "col-span-full",
        className
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2:** Test + commit `'feat: BentoGrid + BentoCard layout components'`

## Task 9: Adapt HomeTab with BentoGrid

**Files:**

- Modify: `src/components/tabs/HomeTab.tsx` (191L)

- [ ] **Step 1:** Wrap sections in BentoGrid: mood (span 2), habits (span 2), streaks (span 1), insights (span 1), focus timer (span 1), garden preview (span 1).
- [ ] **Step 2:** Phone naturally stacks (1 col). Tablet: 2 col. Desktop: 3-4 col.
- [ ] **Step 3:** Verify + commit `'feat: bento grid dashboard for Home tab'`

## Task 10: Tablet 2-column bento

- [ ] **Step 1:** Verify BentoGrid renders 2 columns at tablet width (768px+ container).
- [ ] **Step 2:** If needed, adjust `@sm` breakpoint in BentoGrid. Test at 768px viewport.
- [ ] **Step 3:** Commit `'fix: verify tablet 2-column bento layout'`

---

# Phase 4: Journal Tab — Master-Detail (Tasks 11-16)

## Task 11: Install react-resizable-panels

- [ ] **Step 1:** `npm install react-resizable-panels`
- [ ] **Step 2:** Commit `'deps: add react-resizable-panels for desktop split layouts'`

## Task 12: Create PanelLayout component

**Files:**

- Create: `src/components/layout/PanelLayout.tsx`
- Create: `src/components/layout/PanelLayout.test.tsx`

- [ ] **Step 1:** Wrap `react-resizable-panels` with ZenFlow styling:

```typescript
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';

interface PanelLayoutProps {
  direction?: 'horizontal' | 'vertical';
  children: ReactNode;
  onLayout?: (sizes: number[]) => void;
  autoSaveId?: string; // Persists layout to localStorage
}

export function PanelLayout({ direction = 'horizontal', children, onLayout, autoSaveId }: PanelLayoutProps) {
  return (
    <PanelGroup direction={direction} onLayout={onLayout} autoSaveId={autoSaveId}>
      {children}
    </PanelGroup>
  );
}

export function LayoutPanel({ children, defaultSize, minSize = 15, maxSize = 70, className }: {
  children: ReactNode; defaultSize: number; minSize?: number; maxSize?: number; className?: string;
}) {
  return (
    <Panel defaultSize={defaultSize} minSize={minSize} maxSize={maxSize} className={className}>
      {children}
    </Panel>
  );
}

export function ResizeHandle() {
  return (
    <PanelResizeHandle className="group w-1.5 bg-transparent hover:bg-primary/20 transition-colors duration-150 flex items-center justify-center">
      <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
    </PanelResizeHandle>
  );
}
```

- [ ] **Step 2:** Test — renders panels, handle visible on hover, respects min/max.
- [ ] **Step 3:** Commit `'feat: PanelLayout + ResizeHandle wrapping react-resizable-panels'`

## Task 13: Create MasterDetail component

**Files:**

- Create: `src/components/layout/MasterDetail.tsx`
- Create: `src/components/layout/MasterDetail.test.tsx`

- [ ] **Step 1:** Create with tier-aware behavior:

```typescript
export function MasterDetail({ master, detail, showDetail, masterSize = 30, autoSaveId }: {
  master: ReactNode; detail: ReactNode; showDetail: boolean;
  masterSize?: number; autoSaveId?: string;
}) {
  const { supportsMultiPanel } = useDeviceTier();

  if (!supportsMultiPanel) {
    return <>{showDetail ? detail : master}</>;
  }

  return (
    <PanelLayout autoSaveId={autoSaveId}>
      <LayoutPanel defaultSize={masterSize} minSize={20} maxSize={50}>
        {master}
      </LayoutPanel>
      <ResizeHandle />
      <LayoutPanel defaultSize={100 - masterSize}>
        {detail}
      </LayoutPanel>
    </PanelLayout>
  );
}
```

- [ ] **Step 2:** Test — phone: single panel. Desktop: split with resize handle.
- [ ] **Step 3:** Commit `'feat: MasterDetail component with resizable panels'`

## Task 14: Journal master-detail + metadata panel

**Files:**

- Modify: `src/features/journal/JournalModule.tsx` (1444L)

- [ ] **Step 1:** Wrap in MasterDetail: `master={<JournalEntryList />}` `detail={<JournalEntryEditor />}`
- [ ] **Step 2:** On desktop+, add 3rd panel (metadata sidebar): date, mood, tags, word count, photos grid.

```tsx
const { tier } = useDeviceTier();
// 3-panel on desktop, 2-panel on laptop, 1-panel on phone
{
  tier === "desktop" ? (
    <PanelLayout autoSaveId="journal-layout">
      <LayoutPanel defaultSize={25}>
        <JournalEntryList />
      </LayoutPanel>
      <ResizeHandle />
      <LayoutPanel defaultSize={50}>
        <JournalEntryEditor maxWidth="65ch" lineHeight={1.7} />
      </LayoutPanel>
      <ResizeHandle />
      <LayoutPanel defaultSize={25}>
        <JournalMetadataPanel />
      </LayoutPanel>
    </PanelLayout>
  ) : (
    <MasterDetail
      master={<JournalEntryList />}
      detail={<JournalEntryEditor />}
      showDetail={!!selectedEntry}
    />
  );
}
```

- [ ] **Step 3:** Apply editor typography: `max-width: 65ch`, `line-height: 1.7` on desktop.
- [ ] **Step 4:** Verify + commit `'feat: journal master-detail + 3-panel desktop layout'`

## Task 15: Wide photo gallery + lightbox

**Files:**

- Modify: `src/features/journal/JournalPhotoGallery.tsx`
- Create: `src/components/desktop/Lightbox.tsx`

- [ ] **Step 1:** Photo grid on desktop (3-4 columns via `@container`):

```tsx
const { isDesktopClass } = useDeviceTier();
<div className={cn(isDesktopClass ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2')}>
```

- [ ] **Step 2:** Create Lightbox with keyboard navigation:

```typescript
// Arrow Left/Right to navigate, Escape to close
// Shows photo metadata: date, dimensions, file size
useKeyboardShortcuts(
  {
    arrowleft: () => navigatePrev(),
    arrowright: () => navigateNext(),
    escape: () => onClose(),
  },
  open
);
```

- [ ] **Step 3:** Test + commit `'feat: wide photo grid + lightbox with keyboard navigation'`

## Task 16: Phase 4 verification

- [ ] **Step 1:** Full CI pass
- [ ] **Step 2:** Commit `'chore: Phase 4 Journal complete'`

---

# Phase 5: Desktop Power Features (Tasks 17-24)

## Task 17: Install cmdk

- [ ] **Step 1:** `npm install cmdk`
- [ ] **Step 2:** Commit `'deps: add cmdk for command palette'`

## Task 18: Command Palette with search

**Files:**

- Create: `src/components/desktop/CommandPalette.tsx`
- Create: `src/components/desktop/CommandPalette.test.tsx`

- [ ] **Step 1:** Full command palette with sections:
  - **Recent:** last 5 accessed items (stored in localStorage)
  - **Actions:** New entry, Log mood, Check habit, Toggle theme
  - **Navigation:** Go to Home/Journal/Habits/Stats/Settings
  - **Search:** fuzzy search journal entries + habit names (debounced 150ms, max 20 results)
- [ ] **Step 2:** Visual: frosted glass (`backdrop-blur-xl bg-card/95`), spring drop animation.
- [ ] **Step 3:** Keyboard: arrow keys navigate, Enter selects, Escape closes. Focus trapped while open.
- [ ] **Step 4:** Lazy-load: `const CommandPalette = lazy(() => import('./desktop/CommandPalette'))`.
- [ ] **Step 5:** Wire `Ctrl+K` in Index.tsx.
- [ ] **Step 6:** Test + commit `'feat: Ctrl+K command palette with search, recent items, actions'`

## Task 19: Generic ContextMenu wrapper

**Files:**

- Create: `src/components/desktop/ContextMenu.tsx`
- Run: `npm install @radix-ui/react-context-menu` (if not installed)

- [ ] **Step 1:** Generic wrapper:

```typescript
import * as RadixContextMenu from '@radix-ui/react-context-menu';

interface MenuItem { label: string; action: () => void; icon?: ReactNode; destructive?: boolean; }

export function ContextMenu({ trigger, items, enabled = true }: {
  trigger: ReactNode; items: MenuItem[]; enabled?: boolean;
}) {
  if (!enabled) return <>{trigger}</>;
  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>{trigger}</RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content className="z-[75] min-w-[180px] rounded-xl border bg-card p-1.5 shadow-lg">
          {items.map((item, i) => (
            <RadixContextMenu.Item key={i} onSelect={item.action}
              className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer',
                'data-[highlighted]:bg-muted', item.destructive && 'text-destructive')}>
              {item.icon}{item.label}
            </RadixContextMenu.Item>
          ))}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  );
}
```

- [ ] **Step 2:** Test + commit `'feat: generic ContextMenu wrapper for desktop right-click'`

## Task 20: Apply context menus to all elements

**Files:**

- Modify: `src/components/compact-habit-card/CompactHabitCard.tsx` — Complete, Skip, Edit, Archive, Delete
- Modify: `src/features/journal/JournalEntryList.tsx` — Open, Export, Share, Delete
- Modify: `src/components/stats/StatsPage.tsx` — Export PNG, Change date range

- [ ] **Step 1:** Wrap each element with `<ContextMenu>` gated by `useInputMethod().isMouse`.
- [ ] **Step 2:** Verify + commit `'feat: right-click context menus on habits, journal entries, stats'`

## Task 21: HoverPreview component + applications

**Files:**

- Create: `src/components/desktop/HoverPreview.tsx`

- [ ] **Step 1:** Create using Radix `HoverCard` with 200ms delay:

```typescript
import * as HoverCard from "@radix-ui/react-hover-card";
```

- [ ] **Step 2:** Apply to: habit cards (streak sparkline), mood dots (note + tags), calendar dates (day summary), sidebar tabs (name tooltip when collapsed).
- [ ] **Step 3:** Gated by `useInputMethod().canHover`.
- [ ] **Step 4:** Test + commit `'feat: hover previews on habits, moods, calendar, sidebar'`

## Task 22: DragDropZone component + habit reordering

**Files:**

- Create: `src/components/desktop/DragDropZone.tsx`
- Modify: `src/components/habit-tracker/HabitTracker.tsx`

- [ ] **Step 1:** Create DragDropZone using HTML5 Drag API:

```typescript
interface DragDropZoneProps {
  items: string[];
  onReorder: (newOrder: string[]) => void;
  renderItem: (id: string, dragHandleProps: DragHandleProps) => ReactNode;
  enabled?: boolean;
}
```

- [ ] **Step 2:** Apply to habit grid — drag to reorder, persist to Dexie.
- [ ] **Step 3:** Visual: dragged card `opacity-50`, drop target `border-2 border-primary`.
- [ ] **Step 4:** Journal photo drop from filesystem (HTML5 File API):

```typescript
const handleDrop = (e: DragEvent) => {
  const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/"));
  if (files.length) onPhotosDropped(files);
};
```

- [ ] **Step 5:** Test + commit `'feat: drag-drop for habit reorder + journal photo drop'`

## Task 23: Install @radix-ui/react-context-menu if needed

- [ ] **Step 1:** Check: `grep "react-context-menu" package.json`. If missing: `npm install @radix-ui/react-context-menu`
- [ ] **Step 2:** Commit if needed.

## Task 24: Phase 5 verification

- [ ] **Step 1:** Full CI + commit `'chore: Phase 5 Desktop Features complete'`

---

# Phase 6: Remaining Tabs + Offline/Errors (Tasks 25-31)

## Task 25: Habits grid — adaptive columns + streak sidebar

**Files:**

- Modify: `src/components/habit-tracker/HabitTracker.tsx` (500L)

- [ ] **Step 1:** `@container` grid: `grid-cols-2 @sm:grid-cols-3 @lg:grid-cols-4 @xl:grid-cols-5`
- [ ] **Step 2:** On laptop+, add collapsible streak sidebar (right side) showing streak chart for selected habit.
- [ ] **Step 3:** Tablet: 3-column with category grouping headers.
- [ ] **Step 4:** Commit `'feat: adaptive habit grid + streak sidebar on desktop'`

## Task 26: Stats tab — wide charts + filter sidebar

**Files:**

- Modify: `src/components/stats/StatsPage.tsx` (257L)

- [ ] **Step 1:** Desktop: filter sidebar (left, 220px) with date range, category, comparison selectors.
- [ ] **Step 2:** Charts expand to fill remaining width.
- [ ] **Step 3:** Hover tooltips on data points with detailed values.
- [ ] **Step 4:** Commit `'feat: stats filter sidebar + wide charts on desktop'`

## Task 27: Garden — docked toolbar + keyboard shortcuts

**Files:**

- Modify: `src/components/GardenCanvas.tsx` (217L)

- [ ] **Step 1:** Desktop: floating toolbar becomes docked left sidebar (64px).
- [ ] **Step 2:** Add garden keyboard shortcuts: `+`/`-` zoom, `r` rotate, `p` plant.
- [ ] **Step 3:** Desktop: right info panel showing selected plant details.
- [ ] **Step 4:** Commit `'feat: garden docked toolbar + keyboard shortcuts + info panel'`

## Task 28: Panel state persistence

**Files:**

- Create: `src/hooks/usePanelState.ts`

- [ ] **Step 1:** Hook that persists sidebar width, collapsed state, panel sizes to localStorage per device:

```typescript
export function usePanelState(key: string, defaultValue: number) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(`panel-${key}`);
    return stored ? Number(stored) : defaultValue;
  });
  useEffect(() => {
    localStorage.setItem(`panel-${key}`, String(value));
  }, [key, value]);
  return [value, setValue] as const;
}
```

- [ ] **Step 2:** Wire into Sidebar (collapsed state), PanelLayout (sizes), ContextPanel (open state).
- [ ] **Step 3:** Commit `'feat: panel state persistence to localStorage'`

## Task 29: Tier-specific error handling

**Files:**

- Modify: `src/components/ErrorBoundary.tsx`

- [ ] **Step 1:** Phone: full-screen error (existing behavior).
- [ ] **Step 2:** Desktop: inline error in affected panel only — other panels unaffected:

```tsx
const { supportsMultiPanel } = useDeviceTier();
if (supportsMultiPanel) {
  return (
    <div className="p-4 border border-destructive/20 rounded-xl m-2">
      <p className="text-destructive text-sm">{error.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  );
}
// Phone: existing full-screen error
```

- [ ] **Step 3:** Adaptive-width offline banner: uses container width, not viewport.
- [ ] **Step 4:** Commit `'feat: tier-specific error handling — inline on desktop, full-screen on phone'`

## Task 30: Cloud preference sync

**Files:**

- Modify: `src/storage/cloudSync.ts`

- [ ] **Step 1:** Sync user preferences to Supabase profile: sidebar expanded, default tab, theme preference.
- [ ] **Step 2:** On login, pull preferences and apply.
- [ ] **Step 3:** Commit `'feat: sync UI preferences (sidebar, theme, default tab) to cloud'`

## Task 31: Phase 6 verification

- [ ] **Step 1:** Full CI + commit `'chore: Phase 6 Remaining Tabs + Offline complete'`

---

# Phase 7: Polish — Animations, A11y, Performance (Tasks 32-38)

## Task 32: View Transitions API

**Files:**

- Create: `src/lib/viewTransitions.ts`
- Modify: `src/pages/Index.tsx`

- [ ] **Step 1:** Create utility:

```typescript
export function startViewTransition(callback: () => void): void {
  if ("startViewTransition" in document) {
    (document as any).startViewTransition(callback);
  } else {
    callback();
  }
}
```

- [ ] **Step 2:** Wrap tab switching in Index.tsx.
- [ ] **Step 3:** Add `view-transition-name` to journal entry cards for shared element morph.
- [ ] **Step 4:** Commit `'feat: View Transitions API for tabs + journal shared elements'`

## Task 33: Spring physics + centralized animations config

**Files:**

- Create: `src/lib/animations.ts`

- [ ] **Step 1:** Centralize ALL spring configs and durations:

```typescript
export const springs = {
  sidebar: { stiffness: 300, damping: 30 },
  commandPalette: { stiffness: 400, damping: 28 },
  panelResize: { stiffness: 500, damping: 35 },
  dragDrop: { stiffness: 200, damping: 20 },
  celebration: { stiffness: 600, damping: 15 },
  modal: { stiffness: 350, damping: 30 },
} as const;

export const durations = {
  micro: 120,
  component: 250,
  layout: 350,
  emphasis: 600,
} as const;
```

- [ ] **Step 2:** Replace hardcoded motion values across codebase with centralized config.
- [ ] **Step 3:** Commit `'refactor: centralize spring physics + animation durations'`

## Task 34: CSS micro-interactions + reduced motion

**Files:**

- Modify: `src/index.css`

- [ ] **Step 1:** Add Layer 3 CSS micro-interactions:

```css
/* Card hover lift */
.card-hover {
  transition:
    transform 120ms ease-out,
    box-shadow 120ms ease-out;
}
.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: var(--zen-shadow-lg);
}

/* Button press */
button:active:not(:disabled) {
  transform: scale(0.97);
}

/* Focus ring (keyboard only) */
:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
  transition: outline-offset 100ms;
}

/* Theme transitions */
*,
*::before,
*::after {
  transition:
    color 200ms,
    background-color 200ms,
    border-color 200ms;
}

/* Reduced motion: disable ALL animations */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2:** Commit `'feat: CSS micro-interactions + prefers-reduced-motion fallback'`

## Task 35: Information density per tier + tailwind config

**Files:**

- Modify: `src/index.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1:** Add tier-specific typography/density in CSS:

```css
/* Desktop information density */
@media (min-width: 1024px) {
  :root {
    --base-font-size: 15px;
    --touch-target-min: 32px;
    --line-height-body: 1.55;
  }
}
@media (min-width: 1440px) {
  :root {
    --line-height-body: 1.6;
  }
}
```

- [ ] **Step 2:** Update `tailwind.config.ts` — ensure container query plugin loaded, add `desktop` variant if missing.
- [ ] **Step 3:** Commit `'feat: tier-specific information density (font, line-height, touch targets)'`

## Task 36: React 19 optimistic updates

**Files:**

- Modify: `src/components/compact-habit-card/CompactHabitCard.tsx`
- Modify: `src/features/journal/JournalEntryEditor.tsx`

- [ ] **Step 1:** Habit completion with `useOptimistic`:

```typescript
const [optimisticCompleted, setOptimisticCompleted] = useOptimistic(completed);
const handleComplete = async () => {
  startTransition(async () => {
    setOptimisticCompleted(true);
    await syncHabitCompletion(habit.id, true);
  });
};
```

- [ ] **Step 2:** Journal save with `startTransition` for non-blocking save.
- [ ] **Step 3:** Tab switching wrapped in `startTransition` for preloading.
- [ ] **Step 4:** Commit `'feat: React 19 useOptimistic + useTransition for instant-feel interactions'`

## Task 37: Accessibility audit + fixes

**Files:**

- Modify: multiple

- [ ] **Step 1:** ARIA landmarks: AdaptiveShell sets `<nav>` (sidebar), `<main>` (content), `<aside>` (detail panel) dynamically per tier.
- [ ] **Step 2:** Skip links: add "Skip to main content" link that jumps past sidebar on desktop:

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[100]"
>
  Skip to main content
</a>
```

- [ ] **Step 3:** Keyboard navigation: arrow keys in lists (journal entries, habit grid), `Space` toggles habit, `Enter` opens entry.
- [ ] **Step 4:** Focus management: focus moves to new panel on transition, command palette traps focus + returns on close.
- [ ] **Step 5:** Screen reader `aria-live` regions: habit completion, mood logged, sync status.
- [ ] **Step 6:** Commit `'a11y: landmarks, skip links, keyboard nav, focus management, live regions'`

## Task 38: Desktop code splitting + final verification

**Files:**

- Modify: `vite.config.ts`

- [ ] **Step 1:** Code split desktop features:

```typescript
if (id.includes("src/components/desktop/")) return "desktop-features";
if (id.includes("cmdk")) return "desktop-features";
if (id.includes("react-resizable-panels")) return "desktop-features";
```

- [ ] **Step 2:** Verify phone bundle doesn't include desktop code.
- [ ] **Step 3:** Verify bundle sizes: phone < 200KB gzip, desktop < 250KB gzip.
- [ ] **Step 4:** Micro-delights: habit checkmark draw animation, streak counter spring, mood emoji bounce, journal save border flash.
- [ ] **Step 5:** Full CI: `npx tsc --noEmit && npx eslint . && npx vitest run && vite build && npm run i18n:check`
- [ ] **Step 6:** ALL tests pass (3163+ existing + new tests).
- [ ] **Step 7:** Commit `'chore: Phase 7 Polish complete — ALL 7 PHASES DONE'`

---

# Summary

| Phase           | Tasks  | Key Deliverables                                                                  | Est. Sessions   |
| --------------- | ------ | --------------------------------------------------------------------------------- | --------------- |
| 2: Navigation   | 1-7    | BottomTabs, Sidebar, tablet rail, shortcuts, ContextPanel                         | 1               |
| 3: Home         | 8-10   | BentoGrid, BentoCard, dashboard                                                   | 0.5             |
| 4: Journal      | 11-16  | react-resizable-panels, PanelLayout, MasterDetail, 3-panel, lightbox              | 1.5             |
| 5: Desktop      | 17-24  | cmdk, CommandPalette, ContextMenu, HoverPreview, DragDropZone                     | 1.5             |
| 6: Tabs+Offline | 25-31  | Habits grid, Stats sidebar, Garden toolbar, panel persistence, errors, cloud sync | 1.5             |
| 7: Polish       | 32-38  | View Transitions, springs, CSS micro, density, React 19, a11y, code split         | 1.5             |
| **TOTAL**       | **38** | **~35 new files, ~20 modified**                                                   | **~8 sessions** |

# Gap Coverage Verification

| Gap from Audit             | Covered By                   |
| -------------------------- | ---------------------------- |
| PanelLayout.tsx missing    | Task 12                      |
| ResizeHandle.tsx missing   | Task 12 (inside PanelLayout) |
| DragDropZone.tsx missing   | Task 22                      |
| Generic ContextMenu.tsx    | Task 19                      |
| Tablet navigation          | Task 3                       |
| React 19 features          | Task 36                      |
| CSS micro-interactions     | Task 34                      |
| Skip links + aria-live     | Task 37                      |
| Panel state persistence    | Task 28                      |
| Cloud preference sync      | Task 30                      |
| Error handling per tier    | Task 29                      |
| Journal 3-panel + metadata | Task 14                      |
| Lightbox                   | Task 15                      |
| Information density        | Task 35                      |
| tailwind.config.ts         | Task 35                      |
| ALL 14 shortcuts           | Task 5                       |

**Coverage: 100% of spec requirements.**

# Deep Analysis

## Risk Assessment

| Risk                                                              | Mitigation                                                                               |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| react-resizable-panels conflicts with Capacitor WebView           | Test on real Android device in Phase 4. Fallback: CSS-only flex layout                   |
| cmdk bundle size increases phone bundle                           | Lazy-loaded + code-split into desktop-features chunk (Task 38)                           |
| View Transitions API not supported in all WebViews                | Fallback to instant callback (Task 32 utility handles this)                              |
| React 19 useOptimistic not available in React 18                  | Check React version first. If 18: use manual optimistic pattern with useState            |
| 3-panel journal layout too narrow on 1024px laptops               | PanelLayout has minSize=15% constraint. Metadata panel collapses to icon bar below 250px |
| Tablet landscape side rail conflicts with existing lg: breakpoint | AdaptiveShell uses useDeviceTier (not CSS lg:) — no conflict with Tailwind breakpoints   |

## Performance Impact

| Metric        | Before (phone) | After (phone)                            | After (desktop)         |
| ------------- | -------------- | ---------------------------------------- | ----------------------- |
| Bundle (gzip) | ~180KB         | ~180KB (no change — desktop lazy-loaded) | ~230KB (+desktop chunk) |
| FCP           | ~1.3s          | ~1.3s                                    | ~0.9s (preloaded)       |
| New tests     | 3163           | 3163 + ~40 new = ~3200                   | same                    |

## Architecture Decisions

1. **react-resizable-panels over custom implementation** — battle-tested (OpenAI, Adobe), accessible, persists layout, handles min/max constraints. No reinventing the wheel.
2. **cmdk over custom command palette** — headless, accessible, handles search/keyboard/filtering. ~4KB gzip.
3. **Radix ContextMenu + HoverCard** — already in stack (9 Radix packages). Consistent API. Accessible.
4. **@container queries over viewport media queries** — components adapt to their container, not viewport. Critical for panels that can be any width.
5. **Lazy-loading desktop features** — phone users never download CommandPalette, ContextMenu, ResizeHandle, DragDropZone. Zero cost for mobile.
6. **Panel state in localStorage (not cloud)** — panel sizes are device-specific (physical screen). Preferences (theme, default tab) sync to cloud.
