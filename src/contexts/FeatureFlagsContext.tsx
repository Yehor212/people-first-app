/**
 * Resolves optional ZenFlow modules from reviewed user defaults, onboarding,
 * and authoritative local activity. Release/security capabilities are
 * classified by the manifest but cannot be enabled by this provider.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  computeGardenGateStage,
  getFeaturesForGardenStage,
  isFeatureUnlocked,
  type FeatureId,
  type GardenGateStage,
} from "@/lib/onboardingFlow";
import {
  evaluateFeatureAvailability,
  getReviewedFeatureDefault,
  type BehavioralUnlockState,
  type FeatureAvailability,
  type ToggleableFeature,
} from "@/lib/featureAvailability";
import { SK } from "@/lib/storageKeys";
import { getToday } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useUserDataStore } from "@/stores";
import { db } from "@/storage/db";
import {
  assertDataWriteBoundaryGeneration,
  captureDataWriteBoundaryGeneration,
  subscribeDataRefresh,
} from "@/hooks/useIndexedDB";
import {
  assertOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
  subscribeOriginAccountBoundaryObservation,
  waitForAccountBoundaryDataSettlement,
} from "@/storage/accountBoundaryRuntime";

export type { FeatureAvailability, ToggleableFeature } from "@/lib/featureAvailability";

export type FeatureFlags = Record<ToggleableFeature, boolean>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  focusTimer: true,
  breathingExercise: true,
  gratitudeJournal: true,
  quests: true,
  tasks: true,
  challenges: true,
  aiCoach: false,
  innerWorld: true,
  deltaSync: true,
};

export type JournalEntryCountState =
  | { status: "loading" }
  | { status: "ready"; count: number }
  | { status: "error" };

interface FeatureFlagsContextType {
  flags: FeatureFlags;
  journalEntryCountState: JournalEntryCountState;
  setFlag: (feature: ToggleableFeature, enabled: boolean) => void;
  isFeatureEnabled: (feature: ToggleableFeature) => boolean;
  getFeatureAvailability: (feature: ToggleableFeature) => FeatureAvailability;
  isFeatureVisible: (feature: ToggleableFeature) => boolean;
  resetFlags: () => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

const FEATURE_TO_ONBOARDING: Partial<Record<ToggleableFeature, FeatureId>> = {
  focusTimer: "focusTimer",
  quests: "quests",
  tasks: "tasks",
  challenges: "challenges",
};

interface GardenAvailabilitySnapshot {
  features: FeatureId[];
  daysActive: number;
}

function knownGardenStageWithoutJournal(input: {
  habitsCompleted: number;
  focusSessionsCompleted: number;
  daysActive: number;
}): GardenGateStage {
  if (input.daysActive >= 14) return "flourishing";
  if (input.focusSessionsCompleted >= 1 && input.habitsCompleted >= 5) return "growing";
  if (input.habitsCompleted >= 3) return "sprout";
  return "seed";
}

function journalCountCouldChangeUnlock(
  feature: ToggleableFeature,
  daysActive: number,
  state: JournalEntryCountState
): boolean {
  return (
    state.status !== "ready" &&
    daysActive >= 7 &&
    daysActive < 14 &&
    (feature === "quests" || feature === "challenges")
  );
}

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useLocalStorage<FeatureFlags>(SK.FEATURE_FLAGS, DEFAULT_FEATURE_FLAGS);
  const [journalEntryCountState, setJournalEntryCountState] = useState<JournalEntryCountState>({
    status: "loading",
  });

  const habits = useUserDataStore((state) => state.habits);
  const focusSessions = useUserDataStore((state) => state.focusSessions);
  const moods = useUserDataStore((state) => state.moods);

  useEffect(() => {
    let active = true;
    let requestSequence = 0;
    // A newly opened tab may mount after the durable generation advances but
    // before the originating tab finishes purging the previous owner's rows.
    // Acquire DATA once on mount so that late observers cannot publish a stale
    // count under the already-new generation.
    let pendingBoundarySettlement: Promise<void> | null =
      waitForAccountBoundaryDataSettlement();

    const loadJournalCount = async (
      signal?: AbortSignal,
      resetToLoading = false
    ): Promise<void> => {
      const requestId = ++requestSequence;
      let awaitedSettlement: Promise<void> | null = null;
      if (resetToLoading && active) setJournalEntryCountState({ status: "loading" });
      try {
        awaitedSettlement = pendingBoundarySettlement;
        if (awaitedSettlement) {
          await awaitedSettlement;
          if (pendingBoundarySettlement === awaitedSettlement) {
            pendingBoundarySettlement = null;
          }
        }
        if (!active || signal?.aborted || requestId !== requestSequence) return;
        // Capture both generations only after DATA proves the account purge and
        // its final refresh have released the owner boundary.
        const dataGeneration = captureDataWriteBoundaryGeneration();
        const originGeneration = captureOriginAccountBoundaryGeneration();
        const count = await db.journalEntries.count();
        if (!Number.isSafeInteger(count) || count < 0) {
          throw new Error("Invalid diary count");
        }
        if (!active || signal?.aborted || requestId !== requestSequence) return;
        assertDataWriteBoundaryGeneration(dataGeneration);
        assertOriginAccountBoundaryGeneration(originGeneration);
        setJournalEntryCountState({ status: "ready", count });
      } catch {
        if (awaitedSettlement && pendingBoundarySettlement === awaitedSettlement) {
          pendingBoundarySettlement = null;
        }
        if (!active || signal?.aborted || requestId !== requestSequence) return;
        logger.warn("[FeatureAvailability] Authoritative diary count is unavailable");
        setJournalEntryCountState({ status: "error" });
      }
    };

    const unsubscribeRefresh = subscribeDataRefresh((signal) => loadJournalCount(signal, false));
    const unsubscribeBoundary = subscribeOriginAccountBoundaryObservation(() => {
      pendingBoundarySettlement = waitForAccountBoundaryDataSettlement();
      void loadJournalCount(undefined, true);
    });
    void loadJournalCount(undefined, true);

    return () => {
      active = false;
      requestSequence += 1;
      unsubscribeRefresh();
      unsubscribeBoundary();
    };
  }, []);

  const gardenAvailability = useMemo<GardenAvailabilitySnapshot>(() => {
    const today = getToday();
    const habitsCompleted = habits.reduce(
      (sum, habit) =>
        sum + Object.values(habit.entries || {}).filter((entry) => entry.value === 2).length,
      0
    );
    const focusSessionsCompleted = focusSessions.length;
    const daysActive = new Set(moods.map((mood) => mood.date || today)).size;
    const stage =
      journalEntryCountState.status === "ready"
        ? computeGardenGateStage({
            habitsCompleted,
            focusSessionsCompleted,
            journalEntries: journalEntryCountState.count,
            daysActive,
          })
        : knownGardenStageWithoutJournal({
            habitsCompleted,
            focusSessionsCompleted,
            daysActive,
          });

    return { features: getFeaturesForGardenStage(stage), daysActive };
  }, [focusSessions, habits, journalEntryCountState, moods]);

  const setFlag = useCallback(
    (feature: ToggleableFeature, enabled: boolean) => {
      setFlags((previous) => ({ ...previous, [feature]: enabled }));
    },
    [setFlags]
  );

  const isFeatureEnabled = useCallback(
    (feature: ToggleableFeature): boolean => {
      const storedValue = flags?.[feature];
      if (typeof storedValue === "boolean") return storedValue;
      return getReviewedFeatureDefault(feature) ?? false;
    },
    [flags]
  );

  const getFeatureAvailability = useCallback(
    (feature: ToggleableFeature): FeatureAvailability => {
      const onboardingFeature = FEATURE_TO_ONBOARDING[feature];
      const calendarUnlocked = onboardingFeature ? isFeatureUnlocked(onboardingFeature) : false;
      let behavioralUnlock: BehavioralUnlockState = onboardingFeature
        ? gardenAvailability.features.includes(onboardingFeature)
          ? "unlocked"
          : "locked"
        : "locked";

      if (
        behavioralUnlock === "locked" &&
        journalCountCouldChangeUnlock(
          feature,
          gardenAvailability.daysActive,
          journalEntryCountState
        )
      ) {
        behavioralUnlock =
          journalEntryCountState.status === "error" ? "unknown-error" : "unknown-loading";
      }

      return evaluateFeatureAvailability(feature, {
        userFlags: flags,
        calendarUnlocked,
        behavioralUnlock,
      });
    },
    [flags, gardenAvailability, journalEntryCountState]
  );

  const isFeatureVisible = useCallback(
    (feature: ToggleableFeature): boolean => getFeatureAvailability(feature).visible,
    [getFeatureAvailability]
  );

  const resetFlags = useCallback(() => {
    setFlags(DEFAULT_FEATURE_FLAGS);
  }, [setFlags]);

  const value = useMemo<FeatureFlagsContextType>(
    () => ({
      flags,
      journalEntryCountState,
      setFlag,
      isFeatureEnabled,
      getFeatureAvailability,
      isFeatureVisible,
      resetFlags,
    }),
    [
      flags,
      getFeatureAvailability,
      isFeatureEnabled,
      isFeatureVisible,
      journalEntryCountState,
      resetFlags,
      setFlag,
    ]
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags(): FeatureFlagsContextType {
  return requireFeatureFlagsProvider(useContext(FeatureFlagsContext));
}

export function requireFeatureFlagsProvider<T>(context: T | undefined): T {
  if (!context) {
    throw new Error("useFeatureFlags must be used within a FeatureFlagsProvider");
  }
  return context;
}

export function useFeatureVisible(feature: ToggleableFeature): boolean {
  return useFeatureFlags().isFeatureVisible(feature);
}
