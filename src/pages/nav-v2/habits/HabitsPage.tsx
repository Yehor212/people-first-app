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
import { analytics } from "@/lib/analytics";
import { setEntryValue, toStoredValue } from "@/lib/habits";
import { HabitsHeroZone } from "./HabitsHeroZone";
import { HabitCreateSheet } from "./HabitCreateSheet";
import { HeroTemplateLibrarySheet } from "./hero/HeroTemplateLibrarySheet";
import { useHabitsPageState } from "./useHabitsPageState";
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
  const { t } = useLanguage();
  const tx = t;
  const mainRef = useRef<HTMLElement>(null);

  const { habits, todaysHabits, dailyProgress } = useHabitsPageState();
  const setHabits = useUserDataStore((s) => s.setHabits);

  const [createOpen, setCreateOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null);
  const [pendingDetailEditHabit, setPendingDetailEditHabit] = useState<Habit | null>(null);
  /** Habit passed to HabitCreateSheet in edit mode (null = create mode). */
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  /** Template passed to HabitCreateSheet for setup-before-save flow. */
  const [selectedTemplate, setSelectedTemplate] = useState<HabitTemplate | null>(null);

  /** Focus-return: track the element that triggered the most recent sheet
   *  open so the sheet's close handler can restore focus there (spec §11
   *  a11y criterion: "Focus returns to invoking element on sheet close"). */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const captureReturnFocus = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) returnFocusRef.current = active;
  }, []);
  const restoreReturnFocus = useCallback(() => {
    const el = returnFocusRef.current;
    if (el && document.contains(el)) el.focus();
    returnFocusRef.current = null;
  }, []);

  useEffect(() => {
    // Move focus to the <main> landmark (not the heading) so screen readers
    // announce the region while keyboard users don't see an outline drawn
    // around the title itself (A+++ polish — Law 9).
    mainRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!pendingDetailEditHabit || detailHabit) return;
    setEditingHabit(pendingDetailEditHabit);
    setSelectedTemplate(null);
    setCreateOpen(true);
    setPendingDetailEditHabit(null);
  }, [detailHabit, pendingDetailEditHabit]);

  const handleAddHabit = useCallback(
    (habit: Habit) => {
      if (habit.templateId && habits.some((h) => h.templateId === habit.templateId)) {
        return;
      }
      setHabits((prev) => [...prev, habit]);
      analytics.habitCreated(habit.templateId ? "template" : "custom", habits.length + 1);
    },
    [setHabits, habits],
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

  /**
   * Numerical habit +/- adjustment. Mirrors V1 `useHabitHandlers.handleAdjustHabit`
   * semantics: values are stored ×1000 for precision, `toStoredValue` handles
   * the conversion. Emits `habit_completed` when the delta transitions the
   * habit across its target threshold (atLeast ≥ target, atMost ≤ target).
   *
   * Cross-platform: pointer events are universal (iOS/Android/Desktop); the
   * haptic wrapper is Capacitor-aware and no-ops on web. The inner CompactHabitCard
   * +/- buttons are ≥44px per V1 design (Law 9 touch-target).
   */
  const handleAdjustHabit = useCallback(
    (habitId: string, date: string, delta: number) => {
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;
      void hapticTap();
      const currentStored = habit.entries?.[date]?.value ?? 0;
      const currentReal = currentStored > 0 ? currentStored / 1000 : 0;
      const newReal = Math.max(0, currentReal + delta);
      const newStored = toStoredValue(newReal);
      const target = habit.targetValue ?? 0;
      const isAtMost = habit.targetType === "atMost";
      const prevMet =
        target > 0 &&
        (isAtMost ? currentReal > 0 && currentReal <= target : currentReal >= target);
      const nowMet =
        target > 0 && (isAtMost ? newReal > 0 && newReal <= target : newReal >= target);
      const justCompleted = !prevMet && nowMet;

      setHabits((prev) =>
        prev.map((h) =>
          h.id !== habitId
            ? h
            : { ...h, entries: setEntryValue(h.entries || {}, date, newStored) },
        ),
      );

      if (justCompleted) {
        analytics.habitCompleted(
          habit.name,
          habits.filter((h) => !h.isArchived).length,
        );
      }
    },
    [habits, setHabits],
  );

  const handleToggleHabit = useCallback(
    (habitId: string, date: string) => {
      // Compute the completion transition BEFORE the setter runs so the
      // emission is pure (no state-mutation flag inside the updater). This
      // also keeps the §15 contract parity with V1's useHabitHandlers —
      // without this, V2 toggles would silently bypass `habit_completed`.
      const habit = habits.find((h) => h.id === habitId);
      const isCompletingNow = habit != null && habit.entries?.[date] == null;
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
      if (isCompletingNow && habit) {
        // §15 retention metric — habit.name carries length-only PII gate at
        // the Analytics layer (see analytics.ts). total_habits is the active
        // (non-archived) count so the aggregator can filter ≥3-habit users.
        analytics.habitCompleted(
          habit.name,
          habits.filter((h) => !h.isArchived).length,
        );
      }
    },
    [habits, setHabits],
  );

  const openCreate = useCallback(() => {
    captureReturnFocus();
    setEditingHabit(null);
    setSelectedTemplate(null);
    setCreateOpen(true);
  }, [captureReturnFocus]);
  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setEditingHabit(null);
    setSelectedTemplate(null);
    restoreReturnFocus();
  }, [restoreReturnFocus]);
  /**
   * Pencil button on a habit card → opens HabitCreateSheet in edit mode with
   * the habit prefilled. Shorter path than long-press → detail sheet → Edit
   * button, which was the complaint that Edit semantics and Detail semantics
   * had collapsed onto the same affordance.
   */
  const openEditForm = useCallback(
    (habit: Habit) => {
      captureReturnFocus();
      setEditingHabit(habit);
      setSelectedTemplate(null);
      setCreateOpen(true);
    },
    [captureReturnFocus],
  );
  const openTemplateSetup = useCallback(
    (template: HabitTemplate) => {
      captureReturnFocus();
      setEditingHabit(null);
      setSelectedTemplate(template);
      setLibraryOpen(false);
      setCreateOpen(true);
    },
    [captureReturnFocus],
  );
  const openLibrary = useCallback(() => {
    captureReturnFocus();
    setLibraryOpen(true);
  }, [captureReturnFocus]);
  const closeLibrary = useCallback(() => {
    setLibraryOpen(false);
    restoreReturnFocus();
  }, [restoreReturnFocus]);
  const openDetail = useCallback(
    (habit: Habit) => {
      captureReturnFocus();
      setDetailHabit(habit);
      analytics.habitDetailOpened(habits.length);
    },
    [captureReturnFocus, habits.length],
  );
  const closeDetail = useCallback(() => {
    setDetailHabit(null);
    restoreReturnFocus();
  }, [restoreReturnFocus]);
  const openEditFromDetail = useCallback((habit: Habit) => {
    setPendingDetailEditHabit(habit);
    setDetailHabit(null);
  }, []);

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
      if (habits.some((h) => h.templateId === template.id)) return;
      openTemplateSetup(template);
    },
    [habits, openTemplateSetup],
  );

  return (
    <Bloom key="habits-page" transition={staggerDelay("primary")}>
      <main
        ref={mainRef}
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="relative mx-auto max-w-3xl pb-16 outline-none motion-safe:transition-[background] motion-safe:duration-700"
        style={
          // Subliminal progress tint — warm cream → soft emerald wash as completion grows.
          // Caps at 4% alpha so it stays as subtext, not a chrome take-over.
          // Design rationale: docs/design-animation-audit.md §4.1 item 3.
          dailyProgress.total > 0
            ? {
                backgroundImage: `linear-gradient(180deg, transparent 0%, hsl(var(--primary) / ${dailyProgress.ratio * 0.04}) 100%)`,
              }
            : undefined
        }
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
          onAdjustHabit={handleAdjustHabit}
          onDeleteHabit={handleDeleteHabit}
          onSkipHabit={handleSkipHabit}
          onUnskipHabit={handleUnskipHabit}
          onArchiveHabit={handleArchiveHabit}
          onUnarchiveHabit={handleUnarchiveHabit}
          onCreateHabit={openCreate}
          onEditHabit={openEditForm}
          onPickTemplate={handlePickTemplate}
          onOpenLibrary={openLibrary}
          onOpenDetail={openDetail}
        />

        <HabitCreateSheet
          open={createOpen}
          onClose={closeCreate}
          habits={habits}
          editHabit={editingHabit}
          template={selectedTemplate}
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
              onEdit={openEditFromDetail}
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
