# EP6_US004: Swipe-to-Delete with Rubber-Band Physics

**Status:** Done
**Epic:** 6 — Telegram-Level Polish
**Priority:** P1
**INVEST Score:** 6/6

---

## User Story

As a **diary user**, I want to swipe an entry card to delete it with satisfying rubber-band physics, so that destructive actions feel controlled, intentional, and reversible.

## Description

No swipe-to-delete exists on journal entries. This story adds Telegram-style swipe:

1. **Swipe left** reveals red delete zone with rubber-band resistance.
2. **Haptic warning** at 80px threshold (single pulse).
3. **Undo toast** for 5 seconds after deletion.
4. **Spring snap-back** on cancelled swipe.

**Zero visual regression constraint:** Purely additive. Normal taps unaffected.

## Acceptance Criteria

1. **Given** I swipe left past 80px, **Then** red delete zone reveals with rubber-band resistance and warning haptic fires once.
2. **Given** I release past threshold, **Then** card slides out (spring) and undo toast appears for 5 seconds.
3. **Given** I tap "Undo" within 5s, **Then** entry restores and card springs back to original position.
4. **Given** I release before 80px, **Then** card snaps back (stiffness 500, damping 35), no deletion.

## Technical Notes

**Standards Research:** [RSH-001](../../../research/rsh-001-telegram-polish-standards.md) — section 7

- Framer Motion `drag="x"`, `dragConstraints={{ right: 0 }}`, `dragElastic: 0.3`.
- Red background layer with trash icon behind card.
- `onDrag` threshold at -80px. `hapticWarning()` once (ref-tracked).
- Undo: soft-delete pattern, deletion tracker IDs permanent.
- Scroll conflict: `abs(deltaX) > abs(deltaY) * 2` for horizontal intent.

**Files:** `JournalEntryCard.tsx`, `JournalEntryList.tsx`

## Dependencies

- EP6_US001 recommended first

## Test Strategy

_(Planned by test planner)_

## Orchestrator Brief

```
tech: "React, Framer Motion (drag API), Capacitor Haptics"
keyFiles: ["JournalEntryCard.tsx", "JournalEntryList.tsx"]
approach: "drag='x' with rubber-band, red reveal, undo toast + soft-delete"
complexity: "High"
```

## Definition of Done

- [ ] Swipe reveals red zone with rubber-band
- [ ] Warning haptic once at 80px threshold
- [ ] Card slides out on confirmed delete
- [ ] Undo toast 5s, restores entry
- [ ] Snap-back on cancelled swipe
- [ ] Normal taps unaffected, scroll conflict resolved
- [ ] Gated by `shouldAnimate()`, no TS errors, tests pass
