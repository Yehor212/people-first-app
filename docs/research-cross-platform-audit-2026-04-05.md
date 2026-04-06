# ZenFlow Cross-Platform & Desktop Display Audit

**Date:** 2026-04-05 | **Agents:** 10 parallel (4 codebase + 6 web research) | **Status:** Research only

---

## EXECUTIVE SUMMARY

The app is **production-ready for mobile** (9.5/10) but **critically lacks desktop adaptations**. Three user-reported problems have clear root causes:

| Problem                             | Root Cause                                                                            | Severity     |
| ----------------------------------- | ------------------------------------------------------------------------------------- | ------------ |
| Stretched/incorrect text on laptop  | Container max-width capped at 672px + no responsive font scaling                      | **CRITICAL** |
| Journal too narrow, content cut off | Fixed `md:max-w-2xl` (672px) with no lg/xl breakpoints                                | **CRITICAL** |
| Scroll wheel doesn't work           | MindMapCanvas captures wheel + Radix Dialog body scroll lock + nested overflow-hidden | **HIGH**     |

---

## PART 1: DESKTOP LAYOUT PROBLEMS (Root Causes)

### 1.1 Container Width Capped at 672px

**Files:** `src/index.css:123,736` + `src/pages/Index.tsx:341`

```css
--container-max-width: 32rem; /* 512px mobile */
@media (min-width: 768px) {
  --container-max-width: 42rem; /* 672px — ONLY desktop breakpoint */
}
```

Main content: `max-w-[var(--container-max-width)]` → on 1920px laptop, 640px empty space on each side.

**Fix:** Add tiered breakpoints:

```css
@media (min-width: 1024px) {
  --container-max-width: 48rem;
} /* 768px */
@media (min-width: 1280px) {
  --container-max-width: 56rem;
} /* 896px */
@media (min-width: 1536px) {
  --container-max-width: 64rem;
} /* 1024px */
```

### 1.2 Journal Fixed at max-w-2xl

**File:** `src/features/journal/JournalModule.tsx:548`

```tsx
<div className="... md:max-w-2xl ...">
```

672px on ANY desktop screen. No `lg:` or `xl:` overrides.

**File:** `src/features/journal/JournalEntryEditor.tsx:900-901`

Editor uses `max-w-4xl` (896px) — too wide for readability (~90+ chars/line).

**Fix:** `md:max-w-2xl lg:max-w-4xl xl:max-w-5xl` for dialog, `max-w-prose` (65ch) for text content.

### 1.3 No Desktop Breakpoints At All

**File:** `tailwind.config.ts` — uses default Tailwind breakpoints but almost NO `lg:` or `xl:` overrides in components.

The app is **mobile-first with ZERO desktop adaptations**. Only one CSS media query at 768px exists.

### 1.4 Fixed Font Sizes (No Responsive Scaling)

**File:** `tailwind.config.ts:23-32`

```ts
fontSize: {
  'base': ['1.0625rem', { lineHeight: '1.5625rem' }],  // 17px — same on phone AND 4K monitor
}
```

**Fix:** Fluid typography via CSS clamp():

```css
:root {
  --font-body: clamp(1rem, 0.927rem + 0.36vw, 1.125rem); /* 16→18px */
  --font-h1: clamp(1.75rem, 1.39rem + 1.8vw, 2.25rem); /* 28→36px */
  --font-h2: clamp(1.375rem, 1.105rem + 1.35vw, 1.75rem); /* 22→28px */
}
```

### 1.5 Single-Column Layout on ALL Screen Sizes

No grid breakpoints for tablet/desktop. Cards stack vertically even on 1920px screens. Massive wasted horizontal space.

---

## PART 2: SCROLL WHEEL PROBLEMS (Root Causes)

### 2.1 MindMapCanvas Captures ALL Wheel Events

**File:** `src/components/canvas/MindMapCanvas.tsx:343-344`

```tsx
onWheel = { handleWheel };
```

Classes: `overflow-hidden touch-none overscroll-none` — triple-locked against scrolling. If `handleWheel` calls `stopPropagation()`, wheel events never reach parent scroll containers.

### 2.2 Radix Dialog Auto-Locks Body Scroll

shadcn/ui uses Radix Dialog which applies `overflow: hidden` to `<body>` when modal is open. On desktop, this:

- Removes scrollbar (layout shift ~15-17px)
- Prevents ALL wheel scrolling on background
- May not properly restore scroll after close

**Fix:** Add `scrollbar-gutter: stable` to `<html>`. Use `react-remove-scroll` (already in Radix deps) instead of body overflow:hidden.

### 2.3 Chrome Scroll Chaining Bug

When a container runs out of scrollable content, Chrome redirects wheel events to ancestor and never returns them.

**Fix:** `overscroll-behavior: contain` on ALL scroll containers.

### 2.4 AICoachChat Uses overflow-hidden (NOT scrollable)

**File:** `src/components/AICoachChat.tsx:81`

```tsx
max-h-[85dvh] overflow-hidden  // ← should be overflow-y-auto!
```

Content beyond 85dvh is permanently clipped, no scroll possible.

### 2.5 React 17+ Passive Wheel Listeners

`event.preventDefault()` in React's `onWheel` does nothing (passive by default since React 17).

**Fix:** Use `useRef` + `addEventListener('wheel', handler, { passive: false })` directly on DOM.

---

## PART 3: MOBILE CROSS-PLATFORM (Good News — Mostly Solid)

### What's Working Well (9.5/10)

| Feature             | Status                                         | File                            |
| ------------------- | ---------------------------------------------- | ------------------------------- |
| Platform detection  | Centralized via `Capacitor.getPlatform()`      | `src/lib/platform.ts`           |
| Android back button | Production-ready, LIFO modal stack             | `src/lib/androidBackHandler.ts` |
| Safe areas          | `viewport-fit=cover` + `env()` variables       | `index.html:5`, `index.css`     |
| Webkit prefixes     | `-webkit-backdrop-filter` present              | `index.css:884,3796,4130`       |
| Touch targets       | 44px minimum (WCAG AAA)                        | `components/ui/button.tsx`      |
| Haptics             | 8+ functions, try/catch wrapped                | `src/lib/haptics.ts`            |
| Push notifications  | Android FCM fully integrated                   | `src/lib/pushNotifications.ts`  |
| Deep links          | URL validation, custom events                  | `src/lib/deepLinks.ts`          |
| A11y                | WCAG 2.1 AA, live regions, focus traps         | `src/lib/a11y.ts`               |
| Viewport meta       | Correct: user-scalable=yes, viewport-fit=cover | `index.html:5`                  |
| dvh fallback        | `['100vh', '100dvh']` in Tailwind config       | `tailwind.config.ts:104-110`    |
| Dark mode           | Class-based, proper implementation             | `tailwind.config.ts:4`          |
| System fonts        | No custom @font-face, zero FOUT                | `tailwind.config.ts:17-21`      |
| Z-index system      | Documented scale (10-300+)                     | `index.css:132-150`             |
| No UA sniffing      | Clean, no navigator.userAgent                  | project-wide                    |

### Minor Gaps

| Gap                                   | Severity | Notes                                     |
| ------------------------------------- | -------- | ----------------------------------------- |
| BiometricPlugin registered but unused | Low      | Cleanup candidate                         |
| No screen orientation lock            | Low      | Consider for portrait-only                |
| RTL support limited to inputs         | Medium   | Need `start-*/end-*` everywhere for ar/he |
| `overscroll-none` (non-standard)      | Low      | Should be `overscroll-behavior: none`     |

---

## PART 4: CAPACITOR 8 SPECIFIC ISSUES (from Web Research)

### Critical

1. **Android 15 enforces edge-to-edge** — content goes behind system bars
   - GitHub: ionic-team/capacitor#7804, #7951
   - Fix: `adjustMarginsForEdgeToEdge: true` in capacitor.config.ts + SystemBars plugin

2. **`adjustMarginsForEdgeToEdge` REMOVED in Cap 8** — replaced by SystemBars core plugin
   - Must migrate to CSS `env()` variables only

3. **ProGuard deprecation** — `proguard-android.txt` breaks builds with AS 2025.2.3+
   - GitHub: ionic-team/capacitor#8355
   - Fix: change to `proguard-android-optimize.txt`

### High

4. **Keyboard overlap on Android 15+** — persistent gray space at bottom
   - GitHub: ionic-team/capacitor#8166, #8289
   - Fix: `KeyboardResize.None` + manual padding via visualViewport

5. **iOS keyboard doesn't auto-scroll to focused input**
   - GitHub: ionic-team/capacitor#5635
   - Fix: `scrollIntoView()` on focus

6. **Chromium < 140 reports wrong safe area values (0px)**
   - Fix: install `@capacitor-community/safe-area` polyfill

### Medium

7. **Android 12+ overscroll stretch effect** — can't disable via CSS
   - GitHub: ionic-team/capacitor#5384

8. **Tap-to-stop-scroll triggers click on Android**
   - GitHub: ionic-team/capacitor#6826

9. **Dark mode on Android WebView** — doesn't honor `prefers-color-scheme` by default
   - Fix: `WebSettingsCompat.setAlgorithmicDarkeningAllowed()` or `color-scheme: light dark` in CSS

---

## PART 5: RECOMMENDED SOLUTIONS (Phased)

### Phase 1: Quick Wins (1-2 hours)

1. **Add desktop breakpoints to `--container-max-width`** in `index.css`
2. **Fix AICoachChat** `overflow-hidden` → `overflow-y-auto`
3. **Add `scrollbar-gutter: stable`** to `<html>` in `index.css`
4. **Add `overscroll-behavior: contain`** to all scroll containers
5. **Fix `overscroll-none`** → `overscroll-y-contain` on MindMapCanvas

### Phase 2: Desktop Typography (30 min)

6. **Add fluid typography** via `clamp()` in `index.css` root variables
7. **Add `max-w-prose` (65ch)** to text-heavy sections (journal entries, notes)
8. **Add responsive padding** `md:px-6 lg:px-8` to main container

### Phase 3: Journal Desktop Layout (2-3 hours)

9. **Widen journal dialog** `md:max-w-2xl lg:max-w-4xl xl:max-w-5xl`
10. **Constrain journal text** to `max-w-prose mx-auto` for readability
11. **Add responsive grid** for journal entry list at `lg:` breakpoint

### Phase 4: Full Desktop Adaptation (Optional, larger effort)

12. **Sidebar navigation** at `lg:` breakpoint (hide bottom nav, show sidebar)
13. **Master-detail split** for journal (entry list + editor side by side)
14. **Container queries** for card components
15. **Multi-column grids** for stats/garden tabs at desktop

### Phase 5: Capacitor 8 Migration

16. **Migrate edge-to-edge** to SystemBars plugin
17. **Fix ProGuard** setting
18. **Install `@capacitor-community/safe-area`** polyfill
19. **Add `color-scheme: light dark`** to `:root`

---

## PART 6: INDUSTRY BENCHMARKS

All successful apps constrain prose content width on desktop:

| App              | Content Width        | Strategy                         |
| ---------------- | -------------------- | -------------------------------- |
| Notion           | ~900px (toggle full) | Sidebar 240px + centered content |
| Day One          | ~700px               | 3-column layout                  |
| Bear             | ~680px               | 3-column layout                  |
| Apple Notes      | ~700px               | 2-column layout                  |
| Todoist          | ~700px               | Sidebar + centered content       |
| Obsidian         | ~700px (toggle)      | Sidebar + panes                  |
| Telegram Desktop | ~680px               | Sidebar + chat area              |

**Consensus: 650-900px content width with sidebar navigation on desktop.**

---

## SOURCES

### Web Research (30+ sources)

- Capacitor 8 Update Guide: capacitorjs.com/docs/updating/8-0
- Capacitor GitHub Issues: #7804, #7951, #8166, #8289, #8355, #8325, #5384, #5635, #6826
- Baymard Institute: Optimal Line Length (45-75 chars, ideal 66)
- Smashing Magazine: Fluid Typography with clamp()
- MDN: overscroll-behavior, env(), clamp(), container queries
- Chrome Developers: WebView overview, 300ms delay fix
- React Issue #22794: Passive wheel listeners
- Ben Nadel: Chrome scroll chaining bug
- Capgo: Animation Performance in Capacitor
- web.dev: PWA Window Management

### Codebase Analysis (43+ files scanned)

- Platform: `src/lib/platform.ts`
- Back handler: `src/lib/androidBackHandler.ts`
- Layout: `src/pages/Index.tsx`, `src/index.css`
- Journal: `src/features/journal/JournalModule.tsx`, `JournalEntryEditor.tsx`
- Config: `tailwind.config.ts`, `capacitor.config.ts`
- Scroll: `src/components/canvas/MindMapCanvas.tsx`, `src/components/AICoachChat.tsx`
- A11y: `src/lib/a11y.ts`
- Viewport: `index.html`
