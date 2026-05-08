import { useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  buildJournalSuggestions,
  buildReflectionInsights,
  createDayRitualDraft,
  getRecommendedRitualType,
  getTodayRitualSnapshot,
  mergeReflectionInsights,
  upsertDayRitual,
} from "@/lib/reflectionIntelligence";
import { useUserDataStore } from "@/stores";
import type {
  DayRitual,
  ReflectionInsightCard,
  ReflectionInsightStatus,
} from "@/types";

function insightSignature(insights: ReflectionInsightCard[]): string {
  return JSON.stringify(
    insights.map((insight) => ({
      id: insight.id,
      status: insight.status,
      title: insight.title,
      summary: insight.summary,
      experiment: insight.experiment,
      confidence: Number(insight.confidence.toFixed(3)),
      updatedAt: insight.updatedAt,
      evidence: insight.evidence,
    })),
  );
}

interface UseReflectionStudioOptions {
  excludeSuggestionSources?: Array<
    | "orb"
    | "mood"
    | "focus"
    | "habit"
    | "ritual-opening"
    | "ritual-closing"
    | "weekly-review"
  >;
}

export function useReflectionStudio(
  options: UseReflectionStudioOptions = {},
) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const {
    moods,
    habits,
    focusSessions,
    gratitudeEntries,
    dayRituals,
    reflectionInsights,
    setDayRituals,
    setReflectionInsights,
  } = useUserDataStore(
    useShallow((state) => ({
      moods: state.moods ?? [],
      habits: state.habits ?? [],
      focusSessions: state.focusSessions ?? [],
      gratitudeEntries: state.gratitudeEntries ?? [],
      dayRituals: state.dayRituals ?? [],
      reflectionInsights: state.reflectionInsights ?? [],
      setDayRituals: state.setDayRituals ?? (() => undefined),
      setReflectionInsights: state.setReflectionInsights ?? (() => undefined),
    })),
  );

  const { opening: openingRitual, closing: closingRitual } = useMemo(
    () => getTodayRitualSnapshot(dayRituals),
    [dayRituals],
  );

  const recommendedRitualType = useMemo(
    () => getRecommendedRitualType(openingRitual, closingRitual),
    [closingRitual, openingRitual],
  );

  const journalSuggestions = useMemo(
    () =>
      buildJournalSuggestions({
        moods,
        habits,
        focusSessions,
        gratitudeEntries,
        rituals: dayRituals,
        tx,
        excludeSources: options.excludeSuggestionSources,
      }),
    [
      dayRituals,
      focusSessions,
      gratitudeEntries,
      habits,
      moods,
      options.excludeSuggestionSources,
      tx,
    ],
  );

  const generatedInsights = useMemo(
    () =>
      buildReflectionInsights({
        moods,
        habits,
        focusSessions,
        gratitudeEntries,
        rituals: dayRituals,
        tx,
      }),
    [dayRituals, focusSessions, gratitudeEntries, habits, moods, tx],
  );

  const mergedInsights = useMemo(
    () => mergeReflectionInsights(reflectionInsights, generatedInsights),
    [generatedInsights, reflectionInsights],
  );

  useEffect(() => {
    if (insightSignature(reflectionInsights) === insightSignature(mergedInsights)) {
      return;
    }
    setReflectionInsights(mergedInsights);
  }, [mergedInsights, reflectionInsights, setReflectionInsights]);

  const visibleInsights = useMemo(
    () =>
      mergedInsights
        .filter((insight) => insight.status !== "dismissed")
        .slice(0, 3),
    [mergedInsights],
  );

  const saveRitual = useCallback(
    (
      type: DayRitual["type"],
      values: Partial<DayRitual>,
    ) => {
      const existing =
        type === "opening" ? openingRitual : closingRitual;
      const ritual = createDayRitualDraft(type, values, existing);
      setDayRituals((prev) => upsertDayRitual(prev, ritual));
      return ritual;
    },
    [closingRitual, openingRitual, setDayRituals],
  );

  const updateInsightStatus = useCallback(
    (id: string, status: ReflectionInsightStatus) => {
      setReflectionInsights((prev) =>
        prev.map((insight) =>
          insight.id === id
            ? { ...insight, status, updatedAt: Date.now() }
            : insight,
        ),
      );
    },
    [setReflectionInsights],
  );

  return {
    openingRitual,
    closingRitual,
    recommendedRitualType,
    journalSuggestions,
    reflectionInsights: visibleInsights,
    saveRitual,
    updateInsightStatus,
  };
}
