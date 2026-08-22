import { create } from "zustand";
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
import { defaultReminderSettings } from "@/lib/reminders";
import { needsMigration, migrateAllHabits } from "@/lib/habitMigration";
import { logger } from "@/lib/logger";
import { registerAccountBoundaryRuntimeReset } from "@/storage/accountBoundaryRuntime";

export const defaultPrivacySettings: PrivacySettings = {
  noTracking: false,
  analytics: false,
  consentShown: false,
  pushNotifications: false,
};

// Module-level guard: prevents _hydrateFromDB from re-running migration in a loop.
// The loop occurs when migration calls dbSetter → useIndexedDB setState → useLayoutEffect
// re-fires → _hydrateFromDB → needsMigration still true (stale v1 fields) → INFINITE LOOP.
let habitsMigrationDone = false;

// Setter type matching useIndexedDB's return
type Setter<T> = (value: T | ((prev: T) => T)) => void;

// IndexedDB setters registered by bridge hook
export interface RegisteredSetters {
  setMoods: Setter<MoodEntry[]>;
  setHabits: Setter<Habit[]>;
  setFocusSessions: Setter<FocusSession[]>;
  setGratitudeEntries: Setter<GratitudeEntry[]>;
  setReminders: Setter<ReminderSettings>;
  setPrivacy: Setter<PrivacySettings>;
  setScheduleEvents: Setter<ScheduleEvent[]>;
  setUserName: Setter<string>;
  setUserNameCustom: Setter<boolean>;
  setHasSelectedLanguage: Setter<boolean>;
  setOnboardingComplete: Setter<boolean>;
  setNotificationPermissionChecked: Setter<boolean>;
  setAuthGateChecked: Setter<boolean>;
  /** @deprecated Use setAuthGateChecked. Kept for legacy storage/caller compatibility. */
  setGoogleAuthChecked: Setter<boolean>;
  setMicroReflections: Setter<MicroReflection[]>;
  setCanvasGoals: Setter<CanvasGoal[]>;
  setDayRituals: Setter<DayRitual[]>;
  setReflectionInsights: Setter<ReflectionInsightCard[]>;
}

export interface UserDataState {
  // Collection data
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];

  // Settings data
  reminders: ReminderSettings;
  privacy: PrivacySettings;
  scheduleEvents: ScheduleEvent[];
  microReflections: MicroReflection[];
  canvasGoals: CanvasGoal[];
  dayRituals: DayRitual[];
  reflectionInsights: ReflectionInsightCard[];
  userName: string;
  userNameCustom: boolean;
  hasSelectedLanguage: boolean;
  onboardingComplete: boolean;
  notificationPermissionChecked: boolean;
  authGateChecked: boolean;
  /** @deprecated Use authGateChecked. Kept as a synchronized legacy alias. */
  googleAuthChecked: boolean;

  // Loading
  isLoading: boolean;

  // Internal: IndexedDB setters (set by bridge hook)
  _setters: RegisteredSetters | null;
}

interface UserDataActions {
  setMoods: Setter<MoodEntry[]>;
  setHabits: Setter<Habit[]>;
  setFocusSessions: Setter<FocusSession[]>;
  setGratitudeEntries: Setter<GratitudeEntry[]>;
  setReminders: Setter<ReminderSettings>;
  setPrivacy: Setter<PrivacySettings>;
  setScheduleEvents: Setter<ScheduleEvent[]>;
  setMicroReflections: Setter<MicroReflection[]>;
  setCanvasGoals: Setter<CanvasGoal[]>;
  setDayRituals: Setter<DayRitual[]>;
  setReflectionInsights: Setter<ReflectionInsightCard[]>;
  setUserName: Setter<string>;
  setUserNameCustom: Setter<boolean>;
  setHasSelectedLanguage: Setter<boolean>;
  setOnboardingComplete: Setter<boolean>;
  setNotificationPermissionChecked: Setter<boolean>;
  setAuthGateChecked: Setter<boolean>;
  /** @deprecated Use setAuthGateChecked. Kept as a synchronized legacy alias. */
  setGoogleAuthChecked: Setter<boolean>;

  /** State-only publication for a mood already committed by the automation repository. */
  _publishDurableMoods: Setter<MoodEntry[]>;
  /** State-only publication for a focus session already committed by the automation repository. */
  _publishDurableFocusSessions: Setter<FocusSession[]>;
  /** State-only publication for habits already committed by the automation repository. */
  _publishDurableHabits: Setter<Habit[]>;

  _registerSetters: (setters: RegisteredSetters) => void;
  _hydrateFromDB: (data: Partial<UserDataState>) => void;
}

/**
 * Creates a setter action that updates Zustand state AND persists to IndexedDB via registered setter.
 * The Zustand update is synchronous; the IndexedDB write happens async in the background.
 */
function createFieldAction<T>(
  fieldName: string,
  setterKey: keyof RegisteredSetters,
  set: (fn: (state: UserDataState) => Partial<UserDataState>) => void,
  get: () => UserDataState & UserDataActions
): Setter<T> {
  return (value) => {
    set((state) => ({
      [fieldName]:
        typeof value === "function"
          ? (value as (prev: T) => T)(state[fieldName as keyof UserDataState] as T)
          : value,
    }));
    const dbSetter = get()._setters?.[setterKey];
    if (dbSetter) (dbSetter as unknown as Setter<T>)(get()[fieldName as keyof UserDataState] as T);
  };
}

function createAuthGateCheckedAction(
  set: (fn: (state: UserDataState) => Partial<UserDataState>) => void,
  get: () => UserDataState & UserDataActions
): Setter<boolean> {
  return (value) => {
    set((state) => {
      const nextValue = typeof value === "function" ? value(state.authGateChecked) : value;
      return {
        authGateChecked: nextValue,
        googleAuthChecked: nextValue,
      };
    });

    const dbSetter = get()._setters?.setAuthGateChecked ?? get()._setters?.setGoogleAuthChecked;
    if (dbSetter) dbSetter(get().authGateChecked);
  };
}

export const useUserDataStore = create<UserDataState & UserDataActions>((set, get) => ({
  // Initial state
  moods: [],
  habits: [],
  focusSessions: [],
  gratitudeEntries: [],
  reminders: defaultReminderSettings,
  privacy: { ...defaultPrivacySettings },
  scheduleEvents: [],
  microReflections: [],
  canvasGoals: [],
  dayRituals: [],
  reflectionInsights: [],
  userName: "Friend",
  userNameCustom: false,
  hasSelectedLanguage: false,
  onboardingComplete: false,
  notificationPermissionChecked: false,
  authGateChecked: false,
  googleAuthChecked: false,
  isLoading: true,
  _setters: null,

  // Actions — each updates Zustand + calls IndexedDB setter
  setMoods: createFieldAction<MoodEntry[]>("moods", "setMoods", set, get),
  setHabits: createFieldAction<Habit[]>("habits", "setHabits", set, get),
  setFocusSessions: createFieldAction<FocusSession[]>(
    "focusSessions",
    "setFocusSessions",
    set,
    get
  ),
  setGratitudeEntries: createFieldAction<GratitudeEntry[]>(
    "gratitudeEntries",
    "setGratitudeEntries",
    set,
    get
  ),
  setReminders: createFieldAction<ReminderSettings>("reminders", "setReminders", set, get),
  setPrivacy: createFieldAction<PrivacySettings>("privacy", "setPrivacy", set, get),
  setScheduleEvents: createFieldAction<ScheduleEvent[]>(
    "scheduleEvents",
    "setScheduleEvents",
    set,
    get
  ),
  setMicroReflections: createFieldAction<MicroReflection[]>(
    "microReflections",
    "setMicroReflections",
    set,
    get
  ),
  setCanvasGoals: createFieldAction<CanvasGoal[]>("canvasGoals", "setCanvasGoals", set, get),
  setDayRituals: createFieldAction<DayRitual[]>("dayRituals", "setDayRituals", set, get),
  setReflectionInsights: createFieldAction<ReflectionInsightCard[]>(
    "reflectionInsights",
    "setReflectionInsights",
    set,
    get
  ),
  setUserName: createFieldAction<string>("userName", "setUserName", set, get),
  setUserNameCustom: createFieldAction<boolean>("userNameCustom", "setUserNameCustom", set, get),
  setHasSelectedLanguage: createFieldAction<boolean>(
    "hasSelectedLanguage",
    "setHasSelectedLanguage",
    set,
    get
  ),
  setOnboardingComplete: createFieldAction<boolean>(
    "onboardingComplete",
    "setOnboardingComplete",
    set,
    get
  ),
  setNotificationPermissionChecked: createFieldAction<boolean>(
    "notificationPermissionChecked",
    "setNotificationPermissionChecked",
    set,
    get
  ),
  setAuthGateChecked: createAuthGateCheckedAction(set, get),
  setGoogleAuthChecked: (value) => get().setAuthGateChecked(value),

  _publishDurableMoods: (value) => {
    set((state) => ({
      moods: typeof value === "function" ? value(state.moods) : value,
    }));
  },
  _publishDurableFocusSessions: (value) => {
    set((state) => ({
      focusSessions:
        typeof value === "function" ? value(state.focusSessions) : value,
    }));
  },
  _publishDurableHabits: (value) => {
    set((state) => ({
      habits: typeof value === "function" ? value(state.habits) : value,
    }));
  },

  _registerSetters: (setters) => set({ _setters: setters }),
  _hydrateFromDB: (data) => {
    // Defensive: ensure arrays survive corrupted cloud sync data
    let habits =
      data.habits !== undefined ? (Array.isArray(data.habits) ? data.habits : []) : undefined;

    // v1 → v2 migration: convert old habit format to entry-based model.
    // Guard with module-level flag to prevent infinite loop:
    // _hydrateFromDB → dbSetter → useIndexedDB setState → useLayoutEffect re-fires → _hydrateFromDB again
    if (habits && habits.length > 0 && !habitsMigrationDone && needsMigration(habits)) {
      habitsMigrationDone = true; // One-shot guard — prevents re-entry even if stale data persists
      logger.info("[habitMigration] Migrating v1 habits to v2 format...");
      habits = migrateAllHabits(habits);
      // Persist migrated habits back to IndexedDB
      const dbSetter = get()._setters?.setHabits;
      if (dbSetter) {
        dbSetter(habits);
      }
      logger.info(`[habitMigration] Migrated ${habits.length} habits successfully.`);
    }

    const hasAuthGateChecked =
      data.authGateChecked !== undefined || data.googleAuthChecked !== undefined;
    const hydratedAuthGateChecked =
      data.authGateChecked !== undefined ? data.authGateChecked : data.googleAuthChecked;

    const payload = {
      ...data,
      ...(hasAuthGateChecked && {
        authGateChecked: hydratedAuthGateChecked,
        googleAuthChecked: hydratedAuthGateChecked,
      }),
      ...(data.moods !== undefined && { moods: Array.isArray(data.moods) ? data.moods : [] }),
      ...(habits !== undefined && { habits }),
      ...(data.focusSessions !== undefined && {
        focusSessions: Array.isArray(data.focusSessions) ? data.focusSessions : [],
      }),
      ...(data.gratitudeEntries !== undefined && {
        gratitudeEntries: Array.isArray(data.gratitudeEntries) ? data.gratitudeEntries : [],
      }),
      ...(data.scheduleEvents !== undefined && {
        scheduleEvents: Array.isArray(data.scheduleEvents) ? data.scheduleEvents : [],
      }),
      ...(data.microReflections !== undefined && {
        microReflections: Array.isArray(data.microReflections) ? data.microReflections : [],
      }),
      ...(data.canvasGoals !== undefined && {
        canvasGoals: Array.isArray(data.canvasGoals) ? data.canvasGoals : [],
      }),
      ...(data.dayRituals !== undefined && {
        dayRituals: Array.isArray(data.dayRituals) ? data.dayRituals : [],
      }),
      ...(data.reflectionInsights !== undefined && {
        reflectionInsights: Array.isArray(data.reflectionInsights) ? data.reflectionInsights : [],
      }),
    };

    // Belt-and-suspenders: skip set() if all values are referentially identical
    // to current store state. Prevents infinite loop even if re-entry guard fails.
    const current = get();
    const changed = Object.keys(payload).some(
      (k) =>
        (current as unknown as Record<string, unknown>)[k] !==
        (payload as unknown as Record<string, unknown>)[k]
    );
    if (!changed) return;

    set(payload);
  },
}));

registerAccountBoundaryRuntimeReset(() => {
  useUserDataStore.setState({ privacy: { ...defaultPrivacySettings } });
});
