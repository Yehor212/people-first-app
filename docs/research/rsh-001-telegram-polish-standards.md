# RSH-001: Telegram-Level Polish — Standards Research

**Epic:** 6 — Telegram-Level Polish & Micro-Interactions
**Date:** 2026-04-14
**Stack:** React 18 + Framer Motion + Capacitor 8 + Tailwind CSS

---

## 1. Spring Physics (Telegram / iOS Reference)

| Preset                | stiffness | damping | mass | Use Case                         |
| --------------------- | --------- | ------- | ---- | -------------------------------- |
| Snappy (iOS default)  | 300–400   | 25–30   | 1    | Buttons, toggles, small elements |
| Bouncy (reaction pop) | 400       | 12–15   | 0.8  | Emoji selection, sticker land    |
| Conversational        | 200–250   | 20–25   | 1    | Modals, sheets, page transitions |
| Heavy                 | 200       | 28      | 1.5  | Full-screen transitions, drawers |
| Snap-back             | 500–600   | 35–40   | 1    | Swipe cancel, rubber-band return |

**Telegram's #1 trick:** Visual feedback starts on `onPointerDown` (touch-down), not `onClick` (touch-up). This eliminates 80-120ms perceived delay.

**Settle time:** 250–400ms. Overshoot: 5–15% for interactive elements, near-zero for navigation.

## 2. Micro-Interaction Timings

| Interaction         | Duration | Config                           | Detail                      |
| ------------------- | -------- | -------------------------------- | --------------------------- |
| Emoji reaction pop  | 350ms    | spring stiffness 400, damping 12 | Scale 0→1.3→1.0             |
| Sticker land        | 400ms    | spring + squash-stretch          | Scale overshoot 1.15→1.0    |
| Context menu appear | 250ms    | cubic-bezier(0.23,1,0.32,1)      | Scale 0.9→1.0 + fade        |
| Swipe-to-reply snap | 250ms    | velocity-matched spring          | Threshold: 40px             |
| Tab switch          | 300ms    | interactive spring               | Cross-fade + translateX     |
| Floating toolbar    | 150ms    | fade + translateY(8→0)           | 100ms debounce on selection |

## 3. Haptic Feedback Pattern (Apple HIG + Telegram)

- **Light:** selections, toggles, picker scroll, tab switch
- **Medium:** action confirmed (save, send, toggle), mood select
- **Heavy/Warning:** destructive confirm, long-press threshold hit
- **Rule:** Maximum 1 haptic per gesture. Never during scroll/drag. Pulse at snap points only.

## 4. Staggered List Animation

- **Delay per item:** 30–50ms (40ms optimal). Above 60ms feels sluggish.
- **Max items to stagger:** 5–8 visible (items beyond viewport: render without animation).
- **translateY distance:** 12–20px (>30px feels like error).
- **Always pair:** translateY + opacity (0→1).
- **Framer Motion:** `staggerChildren: 0.04, delayChildren: 0.1` on parent.

## 5. Skeleton Loading (Zero CLS)

- **Match exact dimensions:** identical height, width, padding, gap as final content.
- **Shimmer:** left→right gradient sweep, 1.5s `ease-in-out` loop. RTL for ar/he.
- **Theme tokens:** use CSS vars for skeleton colors (dark mode: 15%/20% lightness).
- **Swap technique:** skeleton and content share same parent box model. Swap opacity, never remount.
- **Fade transition:** 200ms opacity on content reveal. Zero height change.
- **Reduced motion:** no shimmer animation, static 70% opacity.

## 6. Optimistic Save Pattern

| State  | Visual                | Duration                  |
| ------ | --------------------- | ------------------------- |
| Idle   | No indicator          | —                         |
| Saving | Subtle spinner/pulse  | Min 400ms display         |
| Saved  | Checkmark fade-in     | Show 1.5–2s, then fade    |
| Error  | Red indicator + retry | Persistent until resolved |
| Synced | Cloud icon (optional) | Show 1s after Saved       |

**Debounce:** 500–800ms after last keystroke for text. Immediate for toggles/selections.

## 7. Swipe-to-Delete

- **Drag threshold:** 80px to confirm, reveal at ~40px.
- **Rubber-band:** `dragElastic: 0.3` past threshold, spring stiffness 600, damping 40.
- **Snap-back:** stiffness 500, damping 35 on cancel.
- **Haptic:** warning at threshold, single pulse only.

## 8. Floating Toolbar

- **Appear:** 150ms fade + translateY(8→0) after selection stabilizes (~100ms debounce).
- **Dismiss:** immediate on scroll (no animation), 100ms fade on tap-outside.
- **Reposition:** follows selection handle with ~60ms spring delay.
- **Z-index:** above everything except system UI.

## 9. View Transitions API (2026)

- **Browser support:** Chrome 111+, Edge 111+, Safari 18+, Firefox 126+. ~92% global.
- **React:** `document.startViewTransition()` wrapping state updates.
- **Fallback:** Framer Motion `AnimatePresence` + `layoutId` for shared element.

## 10. Home Screen Widget (Existing State)

- **Android:** 3 custom widget providers (Small 2×2, Medium 4×2, Large 4×4) already implemented.
- **Bridge:** custom `WidgetPlugin.ts` → `WidgetPlugin.java` via SharedPreferences.
- **React sync:** `useWidgetSync.ts` hook (11 tests).
- **iOS:** NOT implemented. Requires WidgetKit extension + App Groups.
- **Third-party plugins:** NOT NEEDED — custom approach is superior.

## 11. Performance Rules

- **GPU-only:** animate `transform` and `opacity` only. Never animate width/height/margin.
- **will-change:** apply on animation start, remove on complete. Never permanent.
- **Stagger >20 items:** virtualize with react-window or IntersectionObserver.
- **60 FPS budget:** 16.6ms per frame. Profile with Chrome DevTools Performance tab.

---

## Existing Foundation (Already Built)

| File                             | What Exists                                                          |
| -------------------------------- | -------------------------------------------------------------------- |
| `src/lib/haptics.ts`             | 9 functions + semantic aliases (moodSelected, journalSaved, etc.)    |
| `src/lib/animations.ts`          | 7 spring presets + 4 duration presets                                |
| `src/lib/animationUtils.ts`      | zenMotion/zenTap/zenHover tokens, Dopamine settings, shouldAnimate() |
| `src/lib/platformMotion.ts`      | iOS/Android/Desktop adaptive motion                                  |
| `src/components/ui/skeleton.tsx` | shadcn skeleton primitive                                            |
| `src/plugins/WidgetPlugin.ts`    | Custom Capacitor widget bridge                                       |
| `src/hooks/useWidgetSync.ts`     | Widget data sync hook (11 tests)                                     |
