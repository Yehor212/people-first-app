# QA Protocols — ZenFlow

Rules for all future code. Violation = regression risk.

## 1. Data Integrity: Cascade Delete

Every entity deletion MUST cascade-clean dependent data:
- `handleDeleteHabit` → clean scheduleEvents, reminders.habitIds, challenges
- Before adding a new deletable entity, map all foreign-key references

## 2. Async/Mutation Guard

Every button triggering an async call or state mutation MUST have:
- `disabled` state or `useThrottledCallback` (800ms default)
- Visual feedback (opacity, spinner) while processing
- Pattern: `useThrottledCallback` from `src/hooks/useThrottledCallback.ts`

## 3. Touch Targets (WCAG 2.5.8)

All interactive elements MUST have >= 44x44px touch area:
- Use `min-w-[44px] min-h-[44px]` on the clickable container
- Visual element can be smaller (e.g., `w-8 h-8`) inside the touch container
- Verify on 320px viewport — no overflow

## 4. RTL (Arabic & Hebrew)

- **Text alignment**: `text-start` / `text-end` only. Never `text-left` / `text-right`
- **Margins/padding**: `ms-` / `me-` only. Never `ml-` / `mr-`
- **Positioning**: `start-` / `end-` only. Never `left:` / `right:` in inline styles (use `insetInlineStart` / `insetInlineEnd`)
- **Directional icons**: All ChevronLeft/Right, ArrowLeft/Right MUST have `rtl:scale-x-[-1]`

## 5. Infinite Animations

- **Forbidden**: `repeat: Infinity` in Framer Motion (leaks during exit animation)
- **Required**: CSS `@keyframes` with `motion-safe:` or `prefers-reduced-motion` media query
- All infinite animations MUST stop when component unmounts

## 6. Cross-Platform Matrix

Every PR touching UI must be mentally tested against:
- iPhone 15 (notch + home indicator + safe area)
- Samsung Galaxy (hardware back button)
- Desktop Chrome (mouse-only, keyboard-only navigation)
