/**
 * HabitsPage (Phase 3-C) — single-zone "today's habits" page.
 *
 * Architecture decisions (post-2026-04-19 user feedback):
 *   - Garden zone removed entirely. Identity-based progress is now expressed
 *     inline by the Hero zone via {@link HeroIdentityPrompt}, not via a
 *     separate scrollable canvas. Rationale: a one-screen page beats a
 *     three-zone scroll page when there's only one primary user task ("do
 *     today's habits"). Less navigation, more action.
 *   - MindMap zone deferred per user request 2026-04-19. Will return when
 *     identity-map UX is finalized in Phase 3-C.2.
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
import { HabitCreateSheet } from "./HabitCreateSheet";
import { useHabitsPageState } from "./useHabitsPageState";
import type { Habit } from "@/types";

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
        </header>

        <HabitsHeroZone
          todaysHabits={todaysHabits}
          dailyProgress={dailyProgress}
          onToggleHabit={handleToggleHabit}
          onDeleteHabit={handleDeleteHabit}
          onCreateHabit={openCreate}
        />

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
