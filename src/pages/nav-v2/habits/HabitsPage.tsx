/**
 * HabitsPage (Phase 3-C) — scroll-linked single page composing 3 zones:
 *   1. Hero       — today's habits + daily progress ring
 *   2. Garden     — visual identity garden (V1 GardenCanvas wrapper)
 *   3. MindMap    — identity / goal map (V1 MindMapCanvas, lazy)
 *
 * Architecture decisions (per the approved 7-point plan):
 *   - One page, three `<section>` landmarks rather than tabbed UI.
 *     Rationale: narrative continuity from "do" → "see" → "be" is the
 *     experience cue this redesign is built around.
 *   - Lazy-loaded MindMap zone keeps the canvas chunk off the initial
 *     bundle (lazyWithRetry handles stale-asset reloads).
 *   - Read-only consumer of {@link useUserDataStore} via
 *     {@link useHabitsPageState} — no mutations cross the page boundary.
 *   - Habit CRUD is delegated to V1 actions through the store directly,
 *     so existing migration / IndexedDB plumbing stays the single source
 *     of truth (Law 14).
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserDataStore } from "@/stores";
import { hapticTap } from "@/lib/haptics";
import { HabitsHeroZone } from "./HabitsHeroZone";
import { HabitGardenZone } from "./HabitGardenZone";
import { HabitMindMapZone } from "./HabitMindMapZone";
import { HabitCreateSheet } from "./HabitCreateSheet";
import { useHabitsPageState } from "./useHabitsPageState";
import type { Habit } from "@/types";

const GARDEN_ANCHOR_ID = "habits-zone-garden";
const MINDMAP_ANCHOR_ID = "habits-zone-mindmap";

export const HabitsPage = memo(function HabitsPage() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const h1Ref = useRef<HTMLHeadingElement>(null);

  const { habits, todaysHabits, dailyProgress } = useHabitsPageState();
  const setHabits = useUserDataStore((s) => s.setHabits);

  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    h1Ref.current?.focus();
  }, []);

  const handleAddHabit = useCallback(
    (habit: Habit) => {
      setHabits((prev) => [...prev, habit]);
    },
    [setHabits],
  );

  const handleUpdateHabit = useCallback(
    (habit: Habit) => {
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? habit : h)));
    },
    [setHabits],
  );

  const handleDeleteHabit = useCallback(
    (habitId: string) => {
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
    },
    [setHabits],
  );

  const handleToggleHabit = useCallback(
    (habitId: string, date: string) => {
      void hapticTap();
      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== habitId) return h;
          const entries = { ...(h.entries ?? {}) };
          const existing = entries[date];
          if (existing) {
            // Toggle off — drop the entry for the day.
            const { [date]: _drop, ...rest } = entries;
            void _drop;
            return { ...h, entries: rest };
          }
          entries[date] = { value: 1 };
          return { ...h, entries };
        }),
      );
    },
    [setHabits],
  );

  const handleScrollToGarden = useCallback(() => {
    document.getElementById(GARDEN_ANCHOR_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleScrollToMindMap = useCallback(() => {
    document.getElementById(MINDMAP_ANCHOR_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const openCreate = useCallback(() => setCreateOpen(true), []);
  const closeCreate = useCallback(() => setCreateOpen(false), []);

  return (
    <Bloom key="habits-page" transition={staggerDelay("primary")}>
      <main
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="mx-auto max-w-3xl pb-16 outline-none"
        aria-labelledby="habits-page-heading"
        data-testid="habits-page"
      >
        <header className="px-4 pt-8 md:px-6 md:pt-12">
          <h1
            ref={h1Ref}
            id="habits-page-heading"
            tabIndex={-1}
            className="font-display text-3xl font-semibold tracking-tight outline-none"
          >
            {tx.navV2Habits}
          </h1>
          <nav
            className="mt-4 flex flex-wrap gap-2 text-xs"
            aria-label={tx.navV2Habits}
            data-testid="habits-page-toc"
          >
            <a
              href={`#${GARDEN_ANCHOR_ID}`}
              onClick={(e) => {
                e.preventDefault();
                handleScrollToGarden();
              }}
              className="rounded-full border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {tx.navV2HabitsScrollToGarden}
            </a>
            <a
              href={`#${MINDMAP_ANCHOR_ID}`}
              onClick={(e) => {
                e.preventDefault();
                handleScrollToMindMap();
              }}
              className="rounded-full border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {tx.navV2HabitsScrollToMindMap}
            </a>
          </nav>
        </header>

        <HabitsHeroZone
          todaysHabits={todaysHabits}
          dailyProgress={dailyProgress}
          onToggleHabit={handleToggleHabit}
          onDeleteHabit={handleDeleteHabit}
          onCreateHabit={openCreate}
          onScrollToGarden={handleScrollToGarden}
        />

        <div id={GARDEN_ANCHOR_ID}>
          <HabitGardenZone />
        </div>

        <div id={MINDMAP_ANCHOR_ID}>
          <HabitMindMapZone />
        </div>

        <HabitCreateSheet
          open={createOpen}
          onClose={closeCreate}
          habits={habits}
          onAddHabit={handleAddHabit}
          onUpdateHabit={handleUpdateHabit}
        />
      </main>
    </Bloom>
  );
});
