# QA Protocols — ZenFlow

Mandatory rules for all new code. Violations found during the March 2026 Final Release Audit.

## Rule 1: Functional State Updaters

ALWAYS use `setState(prev => ...)` when the new state depends on previous state.
NEVER use `setState({...closureValue, ...})` — stale closures cause data loss.

```tsx
// WRONG — stale closure
setGamificationState({ ...gamificationState, totalXp: gamificationState.totalXp + xp });

// CORRECT — functional updater
setGamificationState(prev => ({ ...prev, totalXp: prev.totalXp + xp }));
```

## Rule 2: Timer Cleanup

Every `setTimeout` / `setInterval` / `requestAnimationFrame` MUST:
- Store the ID in a `useRef`
- Be cleared in a `useEffect` cleanup function
- Be cleared before creating a new timer (prevent stacking)

```tsx
const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

useEffect(() => {
  return () => { if (timerRef.current) clearTimeout(timerRef.current); };
}, []);

const handleAction = () => {
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => { /* ... */ }, 300);
};
```

## Rule 3: Subscription Cleanup

Every `onAuthStateChange`, `addEventListener`, `addListener` MUST:
- Capture the unsubscribe/remove function
- Call it in useEffect cleanup or when no longer needed

```tsx
const { data: { subscription } } = supabase.auth.onAuthStateChange(handler);
// When done:
subscription?.unsubscribe();
```

## Rule 4: Android Back Handler

Every modal/overlay/sheet with `fixed`/`absolute` positioning and z-index >= 50 MUST call
`useBackHandler(isOpen, onClose)` or `useModalA11y(isOpen, onClose)`. No exceptions.

## Rule 5: Touch Targets (WCAG 2.5.8)

All interactive elements MUST have `min-w-[44px] min-h-[44px]`.
Use flexbox centering to keep visual icon size while expanding the touch area.

## Rule 6: RTL Compliance

- Logical properties: `start`/`end` not `left`/`right`, `ms-`/`me-` not `ml-`/`mr-`, `ps-`/`pe-` not `pl-`/`pr-`
- `inset-x-0` instead of `left-0 right-0`
- `text-start`/`text-end` instead of `text-left`/`text-right`
- Add `rtl:scale-x-[-1]` to ALL directional icons (ArrowLeft, ArrowRight, ChevronLeft, ChevronRight)

## Rule 7: Dynamic Viewport

Use `dvh` not `vh` for `max-height` / `min-height` on mobile layouts.
`vh` doesn't account for mobile browser UI (URL bar).

## Rule 8: i18n

All user-facing text (including `aria-label`) MUST use translation keys.
No hardcoded English strings in components. Use fallback pattern: `t.key || 'English fallback'`.

## Rule 9: Double-Submit Protection

Every form submission / async button MUST have:
- `isSaving` state or `useThrottledCallback`
- `disabled={isSaving}` on the button
- Reset on error via `try/catch/finally`

## Rule 10: Cascade Deletion

When deleting an entity, cascade to ALL referencing entities.
Document cascade chains in the delete handler with comments.
