# EP6_US001: Diary List — Stagger & Skeleton

**Epic:** [Epic 6: Telegram-Level Polish](../../epic.md)
**Status:** In Progress
**Priority:** P0
**Complexity:** Medium
**Created:** 2026-04-14

---

## Goal

Make the diary entry list feel alive and responsive by implementing proper stagger animations on entry cards and a skeleton loader that matches the exact card layout, ensuring zero layout shift and < 100ms perceived response time.

## Acceptance Criteria

### AC1: Animation Config Foundation

- [ ] `src/config/animations.ts` exists with 5 spring presets (snappy/quick/smooth/playful/explosive), 5 duration presets (micro 100ms → celebration 800ms), 4 easing presets (enter/exit/overshoot/smooth), stagger config (40ms per item, cap at 5)
- [ ] All presets are typed and exported for reuse across Epic 6 stories

### AC2: Diary Skeleton Loader

- [ ] Loading skeleton matches exact JournalEntryCard layout: accent bar + mood dot circle (w-10 h-10) + title line + 2 content lines + meta tags row
- [ ] Uses `Skeleton` component from `src/components/ui/skeleton.tsx` with shimmer variant
- [ ] Shows 3 skeleton cards by default
- [ ] Skeleton card dimensions match real card dimensions (zero CLS)

### AC3: Stagger Animation Upgrade

- [ ] Entry cards animate with translateY(20px → 0) + opacity(0 → 1) using spring physics
- [ ] Stagger delay is 40ms per card, capped at 5 items (items 6+ appear instantly with no delay)
- [ ] Animation uses spring presets from `src/config/animations.ts`
- [ ] Total stagger animation completes within 400ms (5 items × 40ms + ~200ms spring settle)

### AC4: Reduced Motion Support

- [ ] `prefers-reduced-motion` disables all stagger and skeleton shimmer animations
- [ ] Cards appear instantly with no animation when reduced motion is enabled
- [ ] Functionality is not affected — all interactions work without animation

### AC5: Performance

- [ ] 60 FPS maintained during stagger animation (GPU-accelerated transforms only)
- [ ] Zero layout shift from skeleton → real content transition (CLS = 0)
- [ ] Skeleton visible for < 300ms on typical devices (IndexedDB fast path)

## Technical Notes

### Affected Components

- `src/features/journal/JournalEntryList.tsx` — skeleton replacement + stagger upgrade
- `src/features/journal/JournalEntryCard.tsx` — no changes expected (already has motion)
- `src/config/animations.ts` — NEW file (foundation for all Epic 6)
- `src/components/ui/skeleton.tsx` — may add diary-specific skeleton variant

### Current State

- Stagger exists (framer-motion, staggerChildren: 0.04, y:12, scale:0.97) but NOT capped at 5
- Loading skeleton is inline `animate-pulse` divs — doesn't match card layout
- No `src/config/animations.ts` — no centralized animation config
- No `prefers-reduced-motion` handling in diary list

### Patterns to Reuse

- `Skeleton` component with shimmer variant from `src/components/ui/skeleton.tsx`
- `zenMotion` from `src/lib/animationUtils.ts` — existing animation utility
- framer-motion `useReducedMotion()` hook for a11y
- Existing `containerVariants`/`itemVariants` in JournalEntryList as base

### Dependencies

- None (foundation story, no other EP6 stories required first)

### Risks

- Stagger on large lists (50+ entries) could cause jank → cap at 5 mitigates this
- Skeleton → content flash if IndexedDB is very fast → min skeleton display time

## Context

This is the **foundation story** for Epic 6 (Telegram-Level Polish). The animation config created here will be reused by all other EP6 stories. The diary list is the most-viewed screen in the app — getting the feel right here sets the standard for everything else.

**Dependency chain:** US001 (this) → US004 (swipe needs stable list). All other EP6 stories are independent.
