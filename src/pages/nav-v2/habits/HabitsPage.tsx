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
 *   - Habit CRUD is delegated through the store directly, so existing
 *     migration / IndexedDB plumbing stays the single source of truth (Law 14).
 */

import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserDataStore } from "@/stores";
import { hapticTap } from "@/lib/haptics";
import { analytics } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { doesNumericalStoredValueMeetTarget, setEntryValue, toStoredValue } from "@/lib/habits";
import { getChallenges, saveChallenges } from "@/lib/challengeStorage";
import { getToday } from "@/lib/utils";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { triggerSync } from "@/storage/cloudSync";
import { trackDeletedHabitId } from "@/storage/deletionTracker";
import { deleteHabitFromCloud, syncHabit, syncHabitCompletion } from "@/storage/realtimeSync";
import { ENTRY } from "@/types";
import { HabitsHeroZone } from "./HabitsHeroZone";
import { HabitCreateSheet } from "./HabitCreateSheet";
import { HeroTemplateLibrarySheet } from "./hero/HeroTemplateLibrarySheet";
import { useHabitsPageState } from "./useHabitsPageState";
import type { HabitTemplate } from "@/lib/habitTemplates";
import type { Habit } from "@/types";
import type { HabitEntrySource } from "@/types";
import type { NumericalEntryAction } from "@/lib/habitNumericalInteraction";
// Lazy-load HabitDetailSheet — keeps its ~20KB chunk off the initial
// Habits page bundle; user only pays the cost when they actually open stats.
const HabitDetailSheetLazy = lazyWithRetry(
  () =>
    import("@/components/habit-hub/HabitDetailSheet").then((m) => ({
      default: m.HabitDetailSheet,
    })),
  "HabitDetailSheet"
);

const HABIT_FIELD_SEEDS = [
  { left: "10%", top: "19%", size: "0.34rem", delay: "0ms", role: "body" },
  { left: "83%", top: "13%", size: "0.28rem", delay: "420ms", role: "focus" },
  { left: "24%", top: "41%", size: "0.42rem", delay: "780ms", role: "energy" },
  { left: "72%", top: "36%", size: "0.3rem", delay: "1140ms", role: "rest" },
  { left: "14%", top: "67%", size: "0.24rem", delay: "1520ms", role: "gratitude" },
  { left: "91%", top: "62%", size: "0.36rem", delay: "1960ms", role: "space" },
] as const;

const HABIT_FIELD_SPECTRUM = ["energy", "body", "focus", "gratitude", "rest"] as const;

function HabitFieldBackdrop({ isEmpty, animate }: { isEmpty: boolean; animate: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="habit-field-backdrop"
      data-testid="habit-field-backdrop"
      data-habit-state={isEmpty ? "empty" : "active"}
      data-animate={animate ? "true" : "false"}
    >
      <span className="habit-field-backdrop__source-beam" />
      <span className="habit-field-backdrop__prism" />
      {HABIT_FIELD_SPECTRUM.map((role) => (
        <span key={role} className="habit-field-backdrop__spectrum" data-spectrum-role={role} />
      ))}
      <span className="habit-field-backdrop__canopy" />
      <span className="habit-field-backdrop__cue-ring habit-field-backdrop__cue-ring--first" />
      <span className="habit-field-backdrop__cue-ring habit-field-backdrop__cue-ring--second" />
      <span className="habit-field-backdrop__progress-lane" />
      <span className="habit-field-backdrop__root-map" />
      {HABIT_FIELD_SEEDS.map((seed) => (
        <span
          key={`${seed.role}-${seed.left}-${seed.top}`}
          className="habit-field-backdrop__seed"
          data-seed-role={seed.role}
          style={
            {
              "--seed-left": seed.left,
              "--seed-top": seed.top,
              "--seed-size": seed.size,
              "--seed-delay": seed.delay,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export const HabitsPage = memo(function HabitsPage() {
  const { t } = useLanguage();
  const tx = t;
  const mainRef = useRef<HTMLElement>(null);
  const { habits, todaysHabits, dailyProgress, isEmpty: hasNoActiveHabits } = useHabitsPageState();
  const animateBackdrop = useShouldAnimate();
  const setHabits = useUserDataStore((s) => s.setHabits);
  const setScheduleEvents = useUserDataStore((s) => s.setScheduleEvents);
  const setReminders = useUserDataStore((s) => s.setReminders);
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
    mainRef.current?.focus({ preventScroll: true });
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
      triggerSync();
      void syncHabit(habit).catch((err) => logger.warn("[V2 Habits] Add sync failed:", err));
    },
    [setHabits, habits]
  );

  const handleUpdateHabit = useCallback(
    (habit: Habit) => {
      const updatedHabit = { ...habit, updatedAt: new Date().toISOString() };
      setHabits((prev) => prev.map((h) => (h.id === updatedHabit.id ? updatedHabit : h)));
      triggerSync();
      void syncHabit(updatedHabit).catch((err) =>
        logger.warn("[V2 Habits] Update sync failed:", err)
      );
    },
    [setHabits]
  );
  const handleDeleteHabit = useCallback(
    (habitId: string) => {
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
      setScheduleEvents((prev) => prev.filter((e) => e.habitId !== habitId));
      setReminders((prev) => ({
        ...prev,
        habitIds: Array.isArray(prev.habitIds) ? prev.habitIds.filter((id) => id !== habitId) : [],
      }));

      const challenges = getChallenges();
      const filtered = challenges.filter((c) => c.habitId !== habitId);
      if (filtered.length !== challenges.length) {
        saveChallenges(filtered);
      }

      void trackDeletedHabitId(habitId);
      void deleteHabitFromCloud(habitId).catch((err) => {
        // graceful: local delete already succeeded; deletion tracker + backup
        // sync keep the delete authoritative until granular cloud delete retries.
        logger.error("[V2 Habits] Cloud delete failed:", err);
      });
      triggerSync();
    },
    [setHabits, setScheduleEvents, setReminders]
  );

  const entryMetadata = useCallback(
    (date: string, source: HabitEntrySource) => ({
      loggedAt: new Date().toISOString(),
      source: date === getToday() ? source : "calendar",
    }),
    []
  );

  const recordNumericalValue = useCallback(
    (
      habit: Habit,
      date: string,
      realValue: number | null,
      source: HabitEntrySource = "quickTap"
    ) => {
      const previousStored = habit.entries?.[date]?.value;
      const nextStored = realValue === null ? undefined : toStoredValue(Math.max(0, realValue));
      const prevMet = doesNumericalStoredValueMeetTarget(habit, previousStored);
      const nowMet = doesNumericalStoredValueMeetTarget(habit, nextStored);

      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== habit.id) return h;
          const entries =
            nextStored === undefined
              ? setEntryValue(h.entries || {}, date, ENTRY.UNKNOWN)
              : setEntryValue(
                  h.entries || {},
                  date,
                  nextStored,
                  undefined,
                  entryMetadata(date, source)
                );
          return { ...h, entries, updatedAt: new Date().toISOString() };
        })
      );

      triggerSync();
      void syncHabitCompletion(
        habit.id,
        date,
        nowMet,
        realValue == null ? undefined : Math.max(1, Math.round(realValue)),
        nextStored,
        {
          habitType: habit.habitType ?? "numerical",
          targetType: habit.targetType,
          entryValue: nextStored ?? ENTRY.UNKNOWN,
        }
      ).catch((err) => logger.warn("[V2 Habits] Numerical sync failed:", err));

      if (!prevMet && nowMet) {
        analytics.habitCompleted(habits.filter((h) => !h.isArchived).length);
      }
    },
    [habits, setHabits, entryMetadata]
  );

  /**
   * Numerical habit +/- adjustment. Mirrors `useHabitHandlers.handleAdjustHabit`
   * semantics: values are stored ×1000 for precision, `toStoredValue` handles
   * the conversion. Emits `habit_completed` when the delta transitions the
   * habit across its target threshold (atLeast ≥ target, atMost ≤ target).
   *
   * Cross-platform: pointer events are universal (iOS/Android/Desktop); the
   * haptic wrapper is Capacitor-aware and no-ops on web. The inner CompactHabitCard
   * +/- buttons are >=44px per touch-target law.
   */
  const handleAdjustHabit = useCallback(
    (habitId: string, date: string, delta: number) => {
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;
      void hapticTap();
      const currentStored = habit.entries?.[date]?.value;
      const currentEntryValue = currentStored ?? 0;
      const currentReal = currentEntryValue > 0 ? currentEntryValue / 1000 : 0;
      const newReal = Math.max(0, currentReal + delta);
      recordNumericalValue(habit, date, newReal, "quickTap");
    },
    [habits, recordNumericalValue]
  );

  const handleNumericalAction = useCallback(
    (habitId: string, date: string, action: NumericalEntryAction) => {
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;
      if (action.type === "openExactInput") {
        setDetailHabit(habit);
        return;
      }
      if (action.type === "adjust") {
        handleAdjustHabit(habitId, date, action.delta);
        return;
      }
      if (action.type === "clear") {
        recordNumericalValue(habit, date, null);
        return;
      }
      recordNumericalValue(habit, date, action.value, "quickTap");
    },
    [habits, handleAdjustHabit, recordNumericalValue]
  );
  const handleToggleHabit = useCallback(
    (habitId: string, date: string) => {
      // Compute the completion transition BEFORE the setter runs so the
      // emission is pure (no state-mutation flag inside the updater). This
      // also keeps the section 15 contract parity with useHabitHandlers —
      // without this, V2 toggles would silently bypass `habit_completed`.
      const habit = habits.find((h) => h.id === habitId);
      const isCompletingNow = habit != null && habit.entries?.[date] == null;
      const nextValue =
        habit != null && habit.entries?.[date] == null ? ENTRY.YES_MANUAL : ENTRY.UNKNOWN;
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
          entries[date] = {
            value: ENTRY.YES_MANUAL,
            ...entryMetadata(date, "quickTap"),
          };
          return { ...h, entries, updatedAt: new Date().toISOString() };
        })
      );
      triggerSync();
      void syncHabitCompletion(habitId, date, nextValue === ENTRY.YES_MANUAL, 1, undefined, {
        habitType: habit?.habitType ?? "boolean",
        targetType: habit?.targetType,
        entryValue: nextValue,
      }).catch((err) => logger.warn("[V2 Habits] Toggle sync failed:", err));
      if (isCompletingNow && habit) {
        // FR-031: only the active aggregate count crosses the analytics boundary.
        analytics.habitCompleted(habits.filter((h) => !h.isArchived).length);
      }
    },
    [habits, setHabits, entryMetadata]
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
    [captureReturnFocus]
  );
  const openTemplateSetup = useCallback(
    (template: HabitTemplate) => {
      captureReturnFocus();
      setEditingHabit(null);
      setSelectedTemplate(template);
      setLibraryOpen(false);
      setCreateOpen(true);
    },
    [captureReturnFocus]
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
    [captureReturnFocus, habits.length]
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
      const updatedAt = new Date().toISOString();
      const habit = habits.find((h) => h.id === habitId);
      setHabits((prev) =>
        prev.map((h) => (h.id === habitId ? { ...h, isArchived: true, updatedAt } : h))
      );
      triggerSync();
      if (habit) {
        void syncHabit({ ...habit, isArchived: true, updatedAt }).catch((err) =>
          logger.warn("[V2 Habits] Archive sync failed:", err)
        );
      }
    },
    [habits, setHabits]
  );

  const handleUnarchiveHabit = useCallback(
    (habitId: string) => {
      const updatedAt = new Date().toISOString();
      const habit = habits.find((h) => h.id === habitId);
      setHabits((prev) =>
        prev.map((h) => (h.id === habitId ? { ...h, isArchived: false, updatedAt } : h))
      );
      triggerSync();
      if (habit) {
        void syncHabit({ ...habit, isArchived: false, updatedAt }).catch((err) =>
          logger.warn("[V2 Habits] Unarchive sync failed:", err)
        );
      }
    },
    [habits, setHabits]
  );

  const handleSkipHabit = useCallback(
    (habitId: string, date: string) => {
      const habit = habits.find((h) => h.id === habitId);
      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== habitId) return h;
          const entries = { ...(h.entries ?? {}) };
          entries[date] = {
            value: ENTRY.SKIP,
            ...entryMetadata(date, "skip"),
          };
          return { ...h, entries, updatedAt: new Date().toISOString() };
        })
      );
      triggerSync();
      void syncHabitCompletion(habitId, date, false, undefined, undefined, {
        habitType: habit?.habitType ?? "boolean",
        targetType: habit?.targetType,
        entryValue: ENTRY.SKIP,
      }).catch((err) => logger.warn("[V2 Habits] Skip sync failed:", err));
    },
    [habits, setHabits, entryMetadata]
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
        })
      );
      triggerSync();
      void syncHabitCompletion(habitId, date, false).catch((err) =>
        logger.warn("[V2 Habits] Unskip sync failed:", err)
      );
    },
    [setHabits]
  );

  /** Set of starter template ids the user has already adopted — used both by
   *  the library sheet (to show an "Added" badge) and by the picker to de-dupe. */
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
    [habits, openTemplateSetup]
  );

  const isEmpty = hasNoActiveHabits;
  const habitFieldStyle = {
    "--habit-field-progress": dailyProgress.total > 0 ? dailyProgress.ratio : 0,
    "--habit-field-density": Math.min(todaysHabits.length, 8),
  } as CSSProperties;

  return (
    <Bloom key="habits-page" transition={staggerDelay("primary")}>
      <main
        ref={mainRef}
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className="v2-fullscreen-page v2-readable-page v2-readable-page--ambient relative isolate min-h-[var(--app-viewport-height)] w-full overflow-hidden pb-16 outline-none motion-safe:transition-[background] motion-safe:duration-700"
        style={habitFieldStyle}
        aria-labelledby="habits-page-heading"
        data-testid="habits-page"
        data-v2-readable-page="habits"
        data-habit-state={isEmpty ? "empty" : "active"}
        data-habit-count={todaysHabits.length}
      >
        <HabitFieldBackdrop isEmpty={isEmpty} animate={animateBackdrop} />
        <div className="relative z-[2] mx-auto min-h-[var(--app-viewport-height)] w-full max-w-3xl lg:max-w-none">
          <header className="mx-auto min-h-[5.75rem] w-full max-w-[88rem] px-4 ps-[4.5rem] pt-[calc(var(--safe-top)+1.75rem)] min-[360px]:ps-20 md:min-h-0 md:px-6 md:ps-6 md:pt-12 lg:px-10 lg:pt-14 xl:px-14">
            <h1
              id="habits-page-heading"
              className="break-words font-display text-base font-semibold leading-[1.08] tracking-tight text-foreground [hyphens:manual] [overflow-wrap:normal] min-[360px]:text-lg sm:text-3xl md:text-4xl lg:text-display-5xl"
            >
              {tx.navV2Habits}
            </h1>
          </header>

          <HabitsHeroZone
            todaysHabits={todaysHabits}
            hasActiveHabits={!hasNoActiveHabits}
            dailyProgress={dailyProgress}
            onToggleHabit={handleToggleHabit}
            onAdjustHabit={handleAdjustHabit}
            onNumericalAction={handleNumericalAction}
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
        </div>

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
