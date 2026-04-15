# T2: Diary Skeleton Loader

**Story:** [EP6_US001 — Diary List: Stagger & Skeleton](../story.md)
**Type:** Implementation
**Status:** Done
**Priority:** P0
**Estimate:** 4h
**Parallel Group:** 1

---

## Goal

Replace the basic inline animate-pulse skeleton in JournalEntryList.tsx with a proper diary-specific skeleton that matches the exact JournalEntryCard layout, ensuring zero layout shift (CLS = 0) when real content loads.

## Acceptance Criteria

- [ ] Skeleton matches JournalEntryCard layout: accent bar (w-1.5) + mood circle (w-10 h-10 rounded-full) + title line + 2 content lines + meta tags row — `verify: inspect (skeleton HTML structure matches card structure)`
- [ ] Uses Skeleton component from src/components/ui/skeleton.tsx with shimmer variant — `verify: command (grep 'Skeleton' src/features/journal/JournalEntryList.tsx)`
- [ ] Shows 3 skeleton cards by default with staggered shimmer timing — `verify: inspect (3 skeleton items rendered when loading=true)`
- [ ] Skeleton card dimensions match real JournalEntryCard dimensions (zero CLS) — `verify: inspect (same padding p-3.5, same mood circle w-10 h-10, same rounded-2xl)`
- [ ] Skeleton respects prefers-reduced-motion (no shimmer when enabled, static gray) — `verify: command (grep 'reduce-motion' src/features/journal/JournalEntryList.tsx)`

## Technical Approach

### Implementation Plan

1. Create DiarySkeletonCard component (inline in JournalEntryList or extracted to same directory)
2. Build skeleton structure mirroring JournalEntryCard:
   - Outer wrapper: rounded-2xl overflow-hidden bg-card/60 border border-white/[0.08]
   - Accent bar: w-1.5 bg-muted/30 rounded-s-2xl
   - Content area: p-3.5 with flex layout
   - Mood circle: Skeleton className w-10 h-10 rounded-full
   - Title: Skeleton className h-3.5 w-1/3
   - Content lines: 2x Skeleton className h-2.5 with decreasing widths
   - Meta row: 2x small Skeleton className h-4 w-12 rounded-md + word count placeholder
3. Replace inline skeleton at lines 313-332 with DiarySkeletonCard x 3
4. Add staggered shimmer delay: each card shimmer offset by 150ms via animation-delay
5. Verify dimension matching by comparing skeleton vs real card in DevTools

### Affected Components

- `src/features/journal/JournalEntryList.tsx` — replace loading skeleton (lines 313-332)
- `src/components/ui/skeleton.tsx` — import Skeleton component (no changes to it)

### Related

- Depends on: nothing (parallel with T1)
- Blocks: nothing directly (T3 is independent of skeleton)

## Context

The current skeleton (lines 313-332 of JournalEntryList.tsx) is 3 basic animate-pulse divs that do not match the card layout at all — just a narrow bar + 3 lines. This causes a visible jump when real content loads because dimensions do not match.

The Skeleton component in ui/skeleton.tsx already supports shimmer variant with a proper CSS animation. SkeletonCard exists but is generic (12x12 icon + 2 lines) — diary needs a custom layout matching the mood circle + accent bar pattern of JournalEntryCard.
