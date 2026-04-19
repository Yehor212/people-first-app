/**
 * HabitMindMapZone — Phase 3-C zone 3.
 *
 * Lazy-loads the V1 {@link MindMapCanvas} via {@link lazyWithRetry} so the
 * heavy canvas chunk only ships when a user actually scrolls to the identity
 * zone. Suspense fallback renders a paper-tone skeleton; failed chunk loads
 * fall back to a soft "tap to retry" message courtesy of lazyWithRetry's
 * built-in reload pathway.
 *
 * The canvas is intentionally read-only here — Phase 3-C does not migrate the
 * goal-creation flow yet, so handlers are inert wrappers that intentionally
 * close menus rather than mutating state.
 */

import { memo, Suspense, useCallback, useMemo } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useShallow } from "zustand/react/shallow";
import { useUserDataStore, useUIStore } from "@/stores";
import { useLanguage } from "@/contexts/LanguageContext";
import type { MoodType } from "@/types";

const MindMapCanvas = lazyWithRetry(
  () =>
    import("@/components/canvas/MindMapCanvas").then((m) => ({
      default: m.MindMapCanvas,
    })),
  "MindMapCanvas",
);

const noop = () => {
  /* read-only zone: Phase 3-C exposes the visualization, not editing */
};

function MindMapSkeleton() {
  return (
    <div
      className="relative mx-auto h-[420px] w-full max-w-2xl overflow-hidden rounded-2xl border border-border/50 bg-card/40"
      role="status"
      aria-live="polite"
      data-testid="habits-mindmap-skeleton"
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted/30 via-transparent to-muted/30" />
      <span className="sr-only">Loading identity map…</span>
    </div>
  );
}

export const HabitMindMapZone = memo(function HabitMindMapZone() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;

  const { moods, canvasGoals } = useUserDataStore(
    useShallow((s) => ({
      moods: s.moods,
      canvasGoals: s.canvasGoals,
    })),
  );
  const canvasMode = useUIStore((s) => s.canvasMode);

  const latestMood: MoodType | null = useMemo(() => {
    if (!Array.isArray(moods) || moods.length === 0) return null;
    return moods[moods.length - 1]?.mood ?? null;
  }, [moods]);

  const handleEmotionSave = useCallback((_mood: MoodType, _text?: string) => {
    /* read-only — see file header */
    void _mood;
    void _text;
  }, []);

  const handleGoalCreate = useCallback(
    (_title: string, _parentId: string | null, _icon?: string) => {
      void _title;
      void _parentId;
      void _icon;
    },
    [],
  );

  const handleGoalUpdate = useCallback(
    (_goalId: string, _val: string | undefined) => {
      void _goalId;
      void _val;
    },
    [],
  );

  return (
    <section
      aria-labelledby="habits-mindmap-heading"
      data-testid="habits-mindmap-zone"
      className="px-4 py-8 md:px-6 md:py-12"
    >
      <h2
        id="habits-mindmap-heading"
        className="mb-4 font-display text-xl font-semibold tracking-tight text-foreground"
      >
        {tx.navV2HabitsMindMap}
      </h2>
      <Suspense fallback={<MindMapSkeleton />}>
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/30">
          <MindMapCanvas
            latestMood={latestMood}
            canvasGoals={Array.isArray(canvasGoals) ? canvasGoals : []}
            canvasMode={canvasMode}
            onRootTap={noop}
            onCanvasBackgroundTap={noop}
            onEmotionSelect={noop}
            onGoalSelect={noop}
            onEmotionSave={handleEmotionSave}
            onEmotionCancel={noop}
            onGoalCreate={handleGoalCreate}
            onGoalToggle={noop}
            onGoalDelete={noop}
            onGoalUpdateIcon={handleGoalUpdate}
            onGoalUpdateEmoji={handleGoalUpdate}
            onGoalUpdateColor={handleGoalUpdate}
            onGoalCancel={noop}
          />
        </div>
      </Suspense>
    </section>
  );
});
