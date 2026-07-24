import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getPendingDataWriteBarrierMode, useIndexedDB } from "@/hooks/useIndexedDB";
import { db } from "@/storage/db";
import { getDeletedHabitIds } from "@/storage/deletionTracker";
import { defaultReminderSettings, migrateStoredReminderSettings } from "@/lib/reminders";
import {
  defaultPrivacySettings,
  useUserDataStore,
  type RegisteredSetters,
} from "./userDataStore";
import { SK } from "@/lib/storageKeys";
import { logger } from "@/lib/logger";
import {
  captureOriginAccountBoundaryGeneration,
  isAccountBoundaryChangedError,
  isOriginAccountBoundaryGenerationCurrent,
} from "@/storage/accountBoundaryRuntime";
import {
  commitProfilePreferencePatch,
  readAuthoritativeProfilePreference,
  readProfileRecoveryPreference,
  type ProfilePreference,
} from "@/storage/settingsPreferencePersistence";
import type {
  MoodEntry,
  Habit,
  FocusSession,
  GratitudeEntry,
  ReminderSettings,
  PrivacySettings,
  ScheduleEvent,
  MicroReflection,
  CanvasGoal,
  DayRitual,
  ReflectionInsightCard,
} from "@/types";
import {
  runtimeMoodEntrySchema,
  runtimeHabitSchema,
  runtimeFocusSessionSchema,
  runtimeGratitudeEntrySchema,
  reminderSettingsSchema,
  privacySettingsSchema,
  scheduleEventSchema,
  microReflectionSchema,
  canvasGoalSchema,
  dayRitualSchema,
  reflectionInsightCardSchema,
} from "@/lib/schemas";

const filterTombstonedHabits = async (items: unknown[]): Promise<unknown[]> => {
  const deletedIds = await getDeletedHabitIds();
  if (deletedIds.size === 0) return items;
  return items.filter((item) => {
    if (!item || typeof item !== "object") return true;
    const id = (item as { id?: unknown }).id;
    return typeof id !== "string" || !deletedIds.has(id);
  });
};

const DEFAULT_PROFILE_PREFERENCE: ProfilePreference = {
  name: "Friend",
  userChosen: false,
};

/**
 * Bridge hook: loads all user data from IndexedDB via useIndexedDB hooks,
 * syncs values into the Zustand userDataStore, and registers persistence setters.
 *
 * Must be called exactly once in the top-level component (Index.tsx).
 * After hydration, all components can read from useUserDataStore instead of props.
 */
export function useHydrateUserData(): void {
  // ── 14 useIndexedDB calls (moved from Index.tsx) ──

  const profilePreferenceRef = useRef<ProfilePreference>(DEFAULT_PROFILE_PREFERENCE);
  const [profilePreference, setProfilePreference] = useState<ProfilePreference | null>(null);
  const profileResolutionSequenceRef = useRef(0);
  const profileWriteScheduledRef = useRef(false);
  const profileWriteGenerationRef = useRef<string | null>(null);
  const profileWritePatchRef = useRef<Partial<ProfilePreference>>({});
  const profileWriteRevisionRef = useRef(0);

  const [hasSelectedLanguage, setHasSelectedLanguage, isLoadingLangSelected] = useIndexedDB({
    table: db.settings,
    localStorageKey: "zenflow-language-selected",
    initialValue: false,
    idField: "key",
  });

  const [hydratedUserName, , isLoadingUserName] = useIndexedDB({
    table: db.settings,
    localStorageKey: "zenflow-username",
    initialValue: "Friend",
    idField: "key",
    readFallbackValue: () => readProfileRecoveryPreference().name,
    persistFallbackOnRead: false,
  });

  const [hydratedUserNameCustom, , isLoadingUserNameCustom] = useIndexedDB({
    table: db.settings,
    localStorageKey: "zenflow-username-custom",
    initialValue: false,
    idField: "key",
    readFallbackValue: () => readProfileRecoveryPreference().userChosen,
    persistFallbackOnRead: false,
  });

  useEffect(() => {
    if (isLoadingUserName || isLoadingUserNameCustom) return;
    const sequence = profileResolutionSequenceRef.current + 1;
    profileResolutionSequenceRef.current = sequence;
    let active = true;

    const resolveProfilePreference = async () => {
      let next: ProfilePreference;
      try {
        const snapshot = await readAuthoritativeProfilePreference();
        next = snapshot.kind === "complete"
          ? snapshot.profile
          : snapshot.kind === "absent"
            ? readProfileRecoveryPreference()
            : { ...DEFAULT_PROFILE_PREFERENCE };
      } catch (error) {
        if (isAccountBoundaryChangedError(error)) {
          next = { ...DEFAULT_PROFILE_PREFERENCE };
        } else {
          logger.warn(
            "[useHydrateUserData] Authoritative profile pair unavailable; using one recovery envelope",
            error,
          );
          next = readProfileRecoveryPreference();
        }
      }

      if (!active || profileResolutionSequenceRef.current !== sequence) return;
      profilePreferenceRef.current = next;
      setProfilePreference(next);
    };

    void resolveProfilePreference();
    return () => {
      active = false;
    };
  }, [
    hydratedUserName,
    hydratedUserNameCustom,
    isLoadingUserName,
    isLoadingUserNameCustom,
  ]);

  const scheduleProfilePairWrite = useCallback((patch: Partial<ProfilePreference>) => {
    // Ordinary sync/import barriers preserve this action by queuing its atomic
    // pair commit. Only an account-boundary purge may discard it: replaying an
    // expired realm's optimistic profile after deletion would resurrect data.
    if (getPendingDataWriteBarrierMode() === "discard") return;
    profileWritePatchRef.current = { ...profileWritePatchRef.current, ...patch };
    profileWriteRevisionRef.current += 1;
    if (profileWriteScheduledRef.current) return;
    profileWriteScheduledRef.current = true;
    profileWriteGenerationRef.current = captureOriginAccountBoundaryGeneration();

    queueMicrotask(() => {
      profileWriteScheduledRef.current = false;
      const generation = profileWriteGenerationRef.current;
      profileWriteGenerationRef.current = null;
      const requestedPatch = profileWritePatchRef.current;
      profileWritePatchRef.current = {};
      const revision = profileWriteRevisionRef.current;
      if (!generation || !isOriginAccountBoundaryGenerationCurrent(generation)) return;

      void commitProfilePreferencePatch(requestedPatch).then(
        (committed) => {
          if (profileWriteRevisionRef.current !== revision) return;
          profilePreferenceRef.current = committed;
          setProfilePreference(committed);
        },
        (error) => {
          logger.error("[useHydrateUserData] Atomic profile preference write failed:", error);
        },
      );
    });
  }, []);

  const setUserName = useCallback(
    (value: string | ((previous: string) => string)) => {
      const previous = profilePreferenceRef.current;
      const name = typeof value === "function" ? value(previous.name) : value;
      const next = { ...previous, name };
      profilePreferenceRef.current = next;
      setProfilePreference(next);
      scheduleProfilePairWrite({ name });
    },
    [scheduleProfilePairWrite],
  );

  const setUserNameCustom = useCallback(
    (value: boolean | ((previous: boolean) => boolean)) => {
      const previous = profilePreferenceRef.current;
      const userChosen =
        typeof value === "function" ? value(previous.userChosen) : value;
      const next = { ...previous, userChosen };
      profilePreferenceRef.current = next;
      setProfilePreference(next);
      scheduleProfilePairWrite({ userChosen });
    },
    [scheduleProfilePairWrite],
  );

  const userName = profilePreference?.name ?? DEFAULT_PROFILE_PREFERENCE.name;
  const userNameCustom =
    profilePreference?.userChosen ?? DEFAULT_PROFILE_PREFERENCE.userChosen;

  const [moods, setMoods, isLoadingMoods] = useIndexedDB<MoodEntry[]>({
    table: db.moods,
    localStorageKey: "zenflow-moods",
    initialValue: [],
    itemSchema: runtimeMoodEntrySchema,
  });

  const [habits, setHabits, isLoadingHabits] = useIndexedDB<Habit[]>({
    table: db.habits,
    localStorageKey: "zenflow-habits",
    initialValue: [],
    itemSchema: runtimeHabitSchema,
    fallbackArrayFilter: filterTombstonedHabits,
  });

  const [focusSessions, setFocusSessions, isLoadingFocus] = useIndexedDB<FocusSession[]>({
    table: db.focusSessions,
    localStorageKey: "zenflow-focus",
    initialValue: [],
    itemSchema: runtimeFocusSessionSchema,
  });

  const [gratitudeEntries, setGratitudeEntries, isLoadingGratitude] = useIndexedDB<
    GratitudeEntry[]
  >({
    table: db.gratitudeEntries,
    localStorageKey: "zenflow-gratitude",
    initialValue: [],
    itemSchema: runtimeGratitudeEntrySchema,
  });

  const [reminders, setReminders, isLoadingReminders] = useIndexedDB<ReminderSettings>({
    table: db.settings,
    localStorageKey: "zenflow-reminders",
    initialValue: defaultReminderSettings,
    idField: "key",
    objectSchema: reminderSettingsSchema,
    migrateStoredValue: migrateStoredReminderSettings,
  });

  const [onboardingComplete, setOnboardingComplete, isLoadingOnboarding] = useIndexedDB({
    table: db.settings,
    localStorageKey: "zenflow-onboarding-complete",
    initialValue: false,
    idField: "key",
  });

  const [
    notificationPermissionChecked,
    setNotificationPermissionChecked,
    isLoadingNotificationPermission,
  ] = useIndexedDB({
    table: db.settings,
    localStorageKey: "zenflow-notification-permission-checked",
    initialValue: false,
    idField: "key",
  });

  const [authGateChecked, setAuthGateChecked, isLoadingAuthGate] = useIndexedDB({
    table: db.settings,
    // Legacy storage key: keep it so existing signed-in users do not lose gate state.
    localStorageKey: "zenflow-google-auth-checked",
    initialValue: false,
    idField: "key",
  });

  const [privacy, setPrivacy, isLoadingPrivacy] = useIndexedDB<PrivacySettings>({
    table: db.settings,
    localStorageKey: SK.PRIVACY,
    initialValue: defaultPrivacySettings,
    idField: "key",
    objectSchema: privacySettingsSchema,
  });

  const [scheduleEvents, setScheduleEvents, isLoadingSchedule] = useIndexedDB<ScheduleEvent[]>({
    table: db.settings,
    localStorageKey: "zenflow-schedule-events",
    initialValue: [],
    idField: "key",
    itemSchema: scheduleEventSchema,
  });

  const [microReflections, setMicroReflections, isLoadingMicroReflections] = useIndexedDB<
    MicroReflection[]
  >({
    table: db.settings,
    localStorageKey: "zenflow-micro-reflections",
    initialValue: [],
    idField: "key",
    itemSchema: microReflectionSchema,
  });

  const [canvasGoals, setCanvasGoals, isLoadingCanvasGoals] = useIndexedDB<CanvasGoal[]>({
    table: db.settings,
    localStorageKey: "zenflow-canvas-goals",
    initialValue: [],
    idField: "key",
    itemSchema: canvasGoalSchema,
  });

  const [dayRituals, setDayRituals, isLoadingDayRituals] = useIndexedDB<DayRitual[]>({
    table: db.settings,
    localStorageKey: "zenflow-day-rituals",
    initialValue: [],
    idField: "key",
    itemSchema: dayRitualSchema,
  });

  const [reflectionInsights, setReflectionInsights, isLoadingReflectionInsights] = useIndexedDB<
    ReflectionInsightCard[]
  >({
    table: db.settings,
    localStorageKey: "zenflow-reflection-insights",
    initialValue: [],
    idField: "key",
    itemSchema: reflectionInsightCardSchema,
  });

  // ── Register IndexedDB setters (once, via stable refs) ──

  const settersRef = useRef<RegisteredSetters>({
    setMoods,
    setHabits,
    setFocusSessions,
    setGratitudeEntries,
    setReminders,
    setPrivacy,
    setScheduleEvents,
    setMicroReflections,
    setCanvasGoals,
    setDayRituals,
    setReflectionInsights,
    setUserName,
    setUserNameCustom,
    setHasSelectedLanguage,
    setOnboardingComplete,
    setNotificationPermissionChecked,
    setAuthGateChecked,
    setGoogleAuthChecked: setAuthGateChecked,
  });
  // Keep ref current (useIndexedDB setters are useCallback-stable, but update ref just in case)
  settersRef.current = {
    setMoods,
    setHabits,
    setFocusSessions,
    setGratitudeEntries,
    setReminders,
    setPrivacy,
    setScheduleEvents,
    setMicroReflections,
    setCanvasGoals,
    setDayRituals,
    setReflectionInsights,
    setUserName,
    setUserNameCustom,
    setHasSelectedLanguage,
    setOnboardingComplete,
    setNotificationPermissionChecked,
    setAuthGateChecked,
    setGoogleAuthChecked: setAuthGateChecked,
  };

  useEffect(() => {
    // Register stable wrappers that delegate to the latest setter refs
    const stableSetters: RegisteredSetters = {
      setMoods: (v) => settersRef.current.setMoods(v),
      setHabits: (v) => settersRef.current.setHabits(v),
      setFocusSessions: (v) => settersRef.current.setFocusSessions(v),
      setGratitudeEntries: (v) => settersRef.current.setGratitudeEntries(v),
      setReminders: (v) => settersRef.current.setReminders(v),
      setPrivacy: (v) => settersRef.current.setPrivacy(v),
      setScheduleEvents: (v) => settersRef.current.setScheduleEvents(v),
      setMicroReflections: (v) => settersRef.current.setMicroReflections(v),
      setCanvasGoals: (v) => settersRef.current.setCanvasGoals(v),
      setDayRituals: (v) => settersRef.current.setDayRituals(v),
      setReflectionInsights: (v) => settersRef.current.setReflectionInsights(v),
      setUserName: (v) => settersRef.current.setUserName(v),
      setUserNameCustom: (v) => settersRef.current.setUserNameCustom(v),
      setHasSelectedLanguage: (v) => settersRef.current.setHasSelectedLanguage(v),
      setOnboardingComplete: (v) => settersRef.current.setOnboardingComplete(v),
      setNotificationPermissionChecked: (v) =>
        settersRef.current.setNotificationPermissionChecked(v),
      setAuthGateChecked: (v) => settersRef.current.setAuthGateChecked(v),
      setGoogleAuthChecked: (v) => settersRef.current.setAuthGateChecked(v),
    };
    useUserDataStore.getState()._registerSetters(stableSetters);
  }, []);

  // ── Sync values from useIndexedDB → Zustand store ──

  const isLoading =
    profilePreference === null ||
    isLoadingLangSelected ||
    isLoadingUserName ||
    isLoadingUserNameCustom ||
    isLoadingMoods ||
    isLoadingHabits ||
    isLoadingFocus ||
    isLoadingGratitude ||
    isLoadingReminders ||
    isLoadingOnboarding ||
    isLoadingPrivacy ||
    isLoadingNotificationPermission ||
    isLoadingAuthGate ||
    isLoadingSchedule ||
    isLoadingMicroReflections ||
    isLoadingCanvasGoals ||
    isLoadingDayRituals ||
    isLoadingReflectionInsights;

  // Guard: prevent re-entry during the same synchronous render cycle.
  // _hydrateFromDB → set() → Zustand notify → re-render → useLayoutEffect fires again.
  // Without this, migration's dbSetter creates new array refs → infinite loop → React #185.
  const isHydratingRef = useRef(false);

  useLayoutEffect(() => {
    if (isHydratingRef.current) return;
    isHydratingRef.current = true;

    useUserDataStore.getState()._hydrateFromDB({
      moods,
      habits,
      focusSessions,
      gratitudeEntries,
      reminders,
      privacy,
      scheduleEvents,
      microReflections,
      canvasGoals,
      dayRituals,
      reflectionInsights,
      userName,
      userNameCustom,
      hasSelectedLanguage,
      onboardingComplete,
      notificationPermissionChecked,
      authGateChecked,
      googleAuthChecked: authGateChecked,
      isLoading,
    });

    // Release after microtask — allows next legitimate data change to hydrate
    queueMicrotask(() => {
      isHydratingRef.current = false;
    });
  }, [
    moods,
    habits,
    focusSessions,
    gratitudeEntries,
    reminders,
    privacy,
    scheduleEvents,
    microReflections,
    canvasGoals,
    dayRituals,
    reflectionInsights,
    userName,
    userNameCustom,
    hasSelectedLanguage,
    onboardingComplete,
    notificationPermissionChecked,
    authGateChecked,
    isLoading,
  ]);
}
