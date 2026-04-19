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

import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserDataStore } from "@/stores";
import { hapticTap } from "@/lib/haptics";
import { HabitsHeroZone } from "./HabitsHeroZone";
import { HabitCreateSheet } from "./HabitCreateSheet";
import { HeroTemplateLibrarySheet } from "./hero/HeroTemplateLibrarySheet";
import { useHabitsPageState } from "./useHabitsPageState";
import { templateToHabit } from "./hero/starterHabits";
import type { HabitTemplate } from "@/lib/habitTemplates";
import type { Habit } from "@/types";

// Lazy-load V1 HabitDetailSheet — keeps its ~20KB chunk off the initial
// Habits page bundle; user only pays the cost when they actually open stats.
const HabitDetailSheetLazy = lazyWithRetry(() =>
  import("@/components/habit-hub/HabitDetailSheet").then((m) => ({
    default: m.HabitDetailSheet,
  })),
);

export const HabitsPage = memo(function HabitsPage() {
  const { t, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const mainRef = useRef<HTMLElement>(null);

  const { habits, todaysHabits, dailyProgress } = useHabitsPageState();
  const setHabits = useUserDataStore((s) => s.setHabits);

  const [createOpen, setCreateOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null);

  useEffect(() => {
    // Move focus to the <main> landmark (not the heading) so screen readers
    // announce the region while keyboard users don't see an outline drawn
    // around the title itself (A+++ polish — Law 9).
    mainRef.current?.focus();
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
  const openLibrary = useCallback(() => setLibraryOpen(true), []);
  const closeLibrary = useCallback(() => setLibraryOpen(false), []);
  const openDetail = useCallback((habit: Habit) => setDetailHabit(habit), []);
  const closeDetail = useCallback(() => setDetailHabit(null), []);

  const handleArchiveHabit = useCallback(
    (habitId: string) => {
      setHabits((prev) =>
        prev.map((h) => (h.id === habitId ? { ...h, isArchived: true } : h)),
      );
    },
    [setHabits],
  );

  const handleUnarchiveHabit = useCallback(
    (habitId: string) => {
      setHabits((prev) =>
        prev.map((h) => (h.id === habitId ? { ...h, isArchived: false } : h)),
      );
    },
    [setHabits],
  );

  const handleSkipHabit = useCallback(
    (habitId: string, date: string) => {
      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== habitId) return h;
          const entries = { ...(h.entries ?? {}) };
          entries[date] = { value: -1 };
          return { ...h, entries };
        }),
      );
    },
    [setHabits],
  );

  const handleUnskipHabit = useCallback(
    (habitId: string, date: string) => {
      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== habitId) return h;
          const entries = { ...(h.entries ?? {}) };
          const { [date]: _skip, ...rest } = entries;
          void _skip;
          return { ...h, entries: rest };
        }),
      );
    },
    [setHabits],
  );

  /** Set of V1 template ids the user has already adopted — used both by the
   *  library sheet (to show an "Added" badge) and by the picker to de-dupe. */
  const seededTemplateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const h of habits) {
      if (h.templateId) ids.add(h.templateId);
    }
    return ids;
  }, [habits]);

  const handlePickTemplate = useCallback(
    (template: HabitTemplate) => {
      setHabits((prev) => {
        // Idempotent by templateId — tapping the same template twice is a no-op.
        if (prev.some((h) => h.templateId === template.id)) return prev;
        return [...prev, templateToHabit(template, prev.length, language)];
      });
    },
    [setHabits, language],
  );

  return (
    <Bloom key="habits-page" transition={staggerDelay("primary")}>
      <main
        ref={mainRef}
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="mx-auto max-w-3xl pb-16 outline-none"
        aria-labelledby="habits-page-heading"
        data-testid="habits-page"
      >
        <header className="px-4 pt-16 md:px-6 md:pt-12">
          <h1
            id="habits-page-heading"
            className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
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
          onPickTemplate={handlePickTemplate}
          onOpenLibrary={openLibrary}
          onOpenDetail={openDetail}
        />

        <HabitCreateSheet
          open={createOpen}
          onClose={closeCreate}
          habits={habits}
          onAddHabit={handleAddHabit}
          onUpdateHabit={handleUpdateHabit}
        />

        <HeroTemplateLibrarySheet
          open={libraryOpen}
          onClose={closeLibrary}
          seededIds={seededTemplateIds}
          onPickTemplate={handlePickTemplate}
        />

        {detailHabit && (
          <Suspense fallback={null}>
            <HabitDetailSheetLazy
              habit={detailHabit}
              onClose={closeDetail}
              onEdit={handleUpdateHabit}
              onUpdate={handleUpdateHabit}
              onArchive={handleArchiveHabit}
              onUnarchive={handleUnarchiveHabit}
              onSkip={handleSkipHabit}
              onUnskip={handleUnskipHabit}
              onDelete={handleDeleteHabit}
            />
          </Suspense>
        )}
      </main>
    </Bloom>
  );
});
