/**
 * Feature Flags Context
 *
 * Resolves optional app modules from onboarding and progressive unlocks.
 * Works alongside the progressive unlock system from onboardingFlow.ts
 * AND the behavioral Garden Gate system (IA Blueprint Phase 5).
 *
 * Core features (mood, habits) are always enabled.
 * Other features can be toggled by the user after being unlocked.
 */

import {
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { runWithSettledDataRead, subscribeDataRefresh } from "@/hooks/useIndexedDB";
import {
  isFeatureUnlocked,
  FeatureId,
  computeGardenGateStage,
  getFeaturesForGardenStage,
} from "@/lib/onboardingFlow";
import { SK } from "@/lib/storageKeys";
import { useUserDataStore } from "@/stores";
import { getToday } from "@/lib/utils";
import { getEntryCount } from "@/features/journal";
import { logger } from "@/lib/logger";
import {
  getFeatureAvailability as evaluateFeatureAvailability,
  type FeatureAvailability,
  type FeatureUnlockAuthorityState,
  type ToggleableFeature as AvailabilityToggleableFeature,
} from "@/lib/featureAvailability";
import {
  registerAccountBoundaryRuntimeReset,
  subscribeOriginAccountBoundaryGeneration,
  waitForAccountBoundaryDataSettlement,
} from "@/storage/accountBoundaryRuntime";

// All toggleable features
export type ToggleableFeature = AvailabilityToggleableFeature;

// Feature flags state
export interface FeatureFlags {
  focusTimer: boolean;
  breathingExercise: boolean;
  gratitudeJournal: boolean;
  quests: boolean;
  tasks: boolean;
  challenges: boolean;
  aiCoach: boolean;
  innerWorld: boolean;
  deltaSync: boolean;
}

// Default: all features enabled (except AI Coach and deltaSync - gradual rollout)
const DEFAULT_FLAGS: FeatureFlags = {
  focusTimer: true,
  breathingExercise: true,
  gratitudeJournal: true,
  quests: true,
  tasks: true,
  challenges: true,
  aiCoach: false, // Hidden until AI is working
  innerWorld: true,
  deltaSync: true, // Enabled: event-based incremental sync (migration 20260405 applied)
};

interface FeatureFlagsContextType {
  flags: FeatureFlags;
  setFlag: (feature: ToggleableFeature, enabled: boolean) => void;
  isFeatureEnabled: (feature: ToggleableFeature) => boolean;
  getFeatureAvailability: (feature: ToggleableFeature) => FeatureAvailability;
  isFeatureVisible: (feature: ToggleableFeature) => boolean;
  resetFlags: () => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

// Map toggleable features to onboarding feature IDs
const FEATURE_TO_ONBOARDING: Partial<Record<ToggleableFeature, FeatureId>> = {
  focusTimer: "focusTimer",
  quests: "quests",
  tasks: "tasks",
  challenges: "challenges",
};

type JournalEntryCountState =
  | { status: "loading" }
  | { status: "ready"; count: number }
  | { status: "unavailable" };

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useLocalStorage<FeatureFlags>(SK.FEATURE_FLAGS, DEFAULT_FLAGS);
  const [journalEntryCount, setJournalEntryCount] = useState<JournalEntryCountState>({
    status: "loading",
  });
  const journalCountReadGenerationRef = useRef(0);

  // Garden Gate stats from user data (IA Blueprint Phase 5)
  const habits = useUserDataStore((s) => s.habits);
  const focusSessions = useUserDataStore((s) => s.focusSessions);
  const moods = useUserDataStore((s) => s.moods);

  const loadJournalEntryCount = useCallback(
    async (options: { settled: boolean; signal?: AbortSignal }): Promise<void> => {
      const readGeneration = journalCountReadGenerationRef.current + 1;
      journalCountReadGenerationRef.current = readGeneration;
      if (options.signal?.aborted) return;

      try {
        const count = options.settled
          ? await runWithSettledDataRead(getEntryCount)
          : await getEntryCount();
        if (options.signal?.aborted || journalCountReadGenerationRef.current !== readGeneration) {
          return;
        }
        if (!Number.isSafeInteger(count) || count < 0) {
          throw new Error("Journal entry count was not a valid non-negative integer");
        }
        setJournalEntryCount({ status: "ready", count });
      } catch (error) {
        if (options.signal?.aborted || journalCountReadGenerationRef.current !== readGeneration) {
          return;
        }
        logger.warn("[FeatureFlags] Journal entry count is unavailable", error);
        setJournalEntryCount({ status: "unavailable" });
      }
    },
    []
  );

  const resetJournalEntryCountForAccountBoundary = useCallback(() => {
    journalCountReadGenerationRef.current += 1;
    setJournalEntryCount({ status: "loading" });
  }, []);

  useEffect(() => {
    void loadJournalEntryCount({ settled: true });
    const unsubscribeRefresh = subscribeDataRefresh((signal) =>
      loadJournalEntryCount({ settled: false, signal })
    );
    return () => {
      journalCountReadGenerationRef.current += 1;
      unsubscribeRefresh();
    };
  }, [loadJournalEntryCount]);

  useEffect(() => {
    const unregisterRuntimeReset = registerAccountBoundaryRuntimeReset(
      resetJournalEntryCountForAccountBoundary
    );
    const unsubscribeGeneration = subscribeOriginAccountBoundaryGeneration(() => {
      resetJournalEntryCountForAccountBoundary();
      const boundaryReadGeneration = journalCountReadGenerationRef.current;
      void waitForAccountBoundaryDataSettlement()
        .then(() => {
          if (journalCountReadGenerationRef.current !== boundaryReadGeneration) return;
          return loadJournalEntryCount({ settled: true });
        })
        .catch((error) => {
          if (journalCountReadGenerationRef.current !== boundaryReadGeneration) return;
          logger.warn("[FeatureFlags] Account-boundary journal count refresh failed", error);
          setJournalEntryCount({ status: "unavailable" });
        });
    });
    return () => {
      unsubscribeGeneration();
      unregisterRuntimeReset();
    };
  }, [loadJournalEntryCount, resetJournalEntryCountForAccountBoundary]);

  // Compute garden gate features only after the authoritative count is available.
  const gardenGateFeatures = useMemo(() => {
    if (journalEntryCount.status !== "ready") return null;
    const today = getToday();
    const habitsCompleted = habits.reduce(
      (sum, h) => sum + Object.values(h.entries || {}).filter((e) => e.value === 2).length,
      0
    );
    const focusSessionsCompleted = focusSessions.length;
    // Approximate daysActive from unique mood dates
    const uniqueDates = new Set(moods.map((m) => m.date || today));
    const daysActive = uniqueDates.size;

    const stage = computeGardenGateStage({
      habitsCompleted,
      focusSessionsCompleted,
      journalEntries: journalEntryCount.count,
      daysActive,
    });

    return getFeaturesForGardenStage(stage);
  }, [habits, focusSessions, journalEntryCount, moods]);

  // Set a single feature flag
  const setFlag = useCallback(
    (feature: ToggleableFeature, enabled: boolean) => {
      setFlags((prev) => ({
        ...prev,
        [feature]: enabled,
      }));
    },
    [setFlags]
  );

  // Check if feature is enabled by user
  const isFeatureEnabled = useCallback(
    (feature: ToggleableFeature): boolean => {
      return flags[feature] === true;
    },
    [flags]
  );

  const getFeatureAvailability = useCallback(
    (feature: ToggleableFeature): FeatureAvailability => {
      const onboardingFeature = FEATURE_TO_ONBOARDING[feature];
      const onboarding: FeatureUnlockAuthorityState = !onboardingFeature
        ? "not-required"
        : isFeatureUnlocked(onboardingFeature)
          ? "unlocked"
          : "locked";
      const localTruth: FeatureUnlockAuthorityState = !onboardingFeature
        ? "not-required"
        : journalEntryCount.status === "loading"
          ? "loading"
          : journalEntryCount.status === "unavailable"
            ? "unavailable"
            : gardenGateFeatures?.includes(onboardingFeature)
              ? "unlocked"
              : "locked";

      return evaluateFeatureAvailability(feature, {
        userEnabled: flags[feature],
        onboarding,
        localTruth,
      });
    },
    [flags, gardenGateFeatures, journalEntryCount.status]
  );

  // Compatibility adapter: structured availability remains the single decision owner.
  const isFeatureVisible = useCallback(
    (feature: ToggleableFeature): boolean => getFeatureAvailability(feature).visible,
    [getFeatureAvailability]
  );

  // Reset all flags to defaults
  const resetFlags = useCallback(() => {
    setFlags(DEFAULT_FLAGS);
  }, [setFlags]);

  const value = useMemo(
    () => ({
      flags,
      setFlag,
      isFeatureEnabled,
      getFeatureAvailability,
      isFeatureVisible,
      resetFlags,
    }),
    [flags, setFlag, isFeatureEnabled, getFeatureAvailability, isFeatureVisible, resetFlags]
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (!context) {
    throw new Error("useFeatureFlags must be used within a FeatureFlagsProvider");
  }
  return context;
}

// Convenience hook for checking a single feature
export function useFeatureVisible(feature: ToggleableFeature): boolean {
  const { isFeatureVisible } = useFeatureFlags();
  return isFeatureVisible(feature);
}
