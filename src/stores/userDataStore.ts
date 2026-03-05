import { create } from 'zustand';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry, ReminderSettings, PrivacySettings, ScheduleEvent, MicroReflection, CanvasGoal } from '@/types';
import { defaultReminderSettings } from '@/lib/reminders';
import { needsMigration, migrateAllHabits } from '@/lib/habitMigration';

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
  setTutorialComplete: Setter<boolean>;
  setOnboardingComplete: Setter<boolean>;
  setNotificationPermissionChecked: Setter<boolean>;
  setGoogleAuthChecked: Setter<boolean>;
  setMicroReflections: Setter<MicroReflection[]>;
  setCanvasGoals: Setter<CanvasGoal[]>;
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
  userName: string;
  userNameCustom: boolean;
  hasSelectedLanguage: boolean;
  tutorialComplete: boolean;
  onboardingComplete: boolean;
  notificationPermissionChecked: boolean;
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
  setUserName: Setter<string>;
  setUserNameCustom: Setter<boolean>;
  setHasSelectedLanguage: Setter<boolean>;
  setTutorialComplete: Setter<boolean>;
  setOnboardingComplete: Setter<boolean>;
  setNotificationPermissionChecked: Setter<boolean>;
  setGoogleAuthChecked: Setter<boolean>;

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
  get: () => UserDataState & UserDataActions,
): Setter<T> {
  return (value) => {
    set((state) => ({
      [fieldName]: typeof value === 'function'
        ? (value as (prev: T) => T)(state[fieldName as keyof UserDataState] as T)
        : value,
    }));
    const dbSetter = get()._setters?.[setterKey];
    if (dbSetter) (dbSetter as Setter<T>)(get()[fieldName as keyof UserDataState] as T);
  };
}

export const useUserDataStore = create<UserDataState & UserDataActions>((set, get) => ({
  // Initial state
  moods: [],
  habits: [],
  focusSessions: [],
  gratitudeEntries: [],
  reminders: defaultReminderSettings,
  privacy: { noTracking: false, analytics: false, consentShown: false },
  scheduleEvents: [],
  microReflections: [],
  canvasGoals: [],
  userName: 'Friend',
  userNameCustom: false,
  hasSelectedLanguage: false,
  tutorialComplete: false,
  onboardingComplete: false,
  notificationPermissionChecked: false,
  googleAuthChecked: false,
  isLoading: true,
  _setters: null,

  // Actions — each updates Zustand + calls IndexedDB setter
  setMoods: createFieldAction<MoodEntry[]>('moods', 'setMoods', set, get),
  setHabits: createFieldAction<Habit[]>('habits', 'setHabits', set, get),
  setFocusSessions: createFieldAction<FocusSession[]>('focusSessions', 'setFocusSessions', set, get),
  setGratitudeEntries: createFieldAction<GratitudeEntry[]>('gratitudeEntries', 'setGratitudeEntries', set, get),
  setReminders: createFieldAction<ReminderSettings>('reminders', 'setReminders', set, get),
  setPrivacy: createFieldAction<PrivacySettings>('privacy', 'setPrivacy', set, get),
  setScheduleEvents: createFieldAction<ScheduleEvent[]>('scheduleEvents', 'setScheduleEvents', set, get),
  setMicroReflections: createFieldAction<MicroReflection[]>('microReflections', 'setMicroReflections', set, get),
  setCanvasGoals: createFieldAction<CanvasGoal[]>('canvasGoals', 'setCanvasGoals', set, get),
  setUserName: createFieldAction<string>('userName', 'setUserName', set, get),
  setUserNameCustom: createFieldAction<boolean>('userNameCustom', 'setUserNameCustom', set, get),
  setHasSelectedLanguage: createFieldAction<boolean>('hasSelectedLanguage', 'setHasSelectedLanguage', set, get),
  setTutorialComplete: createFieldAction<boolean>('tutorialComplete', 'setTutorialComplete', set, get),
  setOnboardingComplete: createFieldAction<boolean>('onboardingComplete', 'setOnboardingComplete', set, get),
  setNotificationPermissionChecked: createFieldAction<boolean>('notificationPermissionChecked', 'setNotificationPermissionChecked', set, get),
  setGoogleAuthChecked: createFieldAction<boolean>('googleAuthChecked', 'setGoogleAuthChecked', set, get),

  _registerSetters: (setters) => set({ _setters: setters }),
  _hydrateFromDB: (data) => {
    // Defensive: ensure arrays survive corrupted cloud sync data
    let habits = data.habits !== undefined
      ? (Array.isArray(data.habits) ? data.habits : [])
      : undefined;

    // v1 → v2 migration: convert old habit format to entry-based model.
    // Guard with module-level flag to prevent infinite loop:
    // _hydrateFromDB → dbSetter → useIndexedDB setState → useLayoutEffect re-fires → _hydrateFromDB again
    if (habits && habits.length > 0 && !habitsMigrationDone && needsMigration(habits)) {
      habitsMigrationDone = true; // One-shot guard — prevents re-entry even if stale data persists
      console.info('[habitMigration] Migrating v1 habits to v2 format...');
      habits = migrateAllHabits(habits);
      // Persist migrated habits back to IndexedDB
      const dbSetter = get()._setters?.setHabits;
      if (dbSetter) {
        dbSetter(habits);
      }
      console.info(`[habitMigration] Migrated ${habits.length} habits successfully.`);
    }

    const payload = {
      ...data,
      ...(data.moods !== undefined && { moods: Array.isArray(data.moods) ? data.moods : [] }),
      ...(habits !== undefined && { habits }),
      ...(data.focusSessions !== undefined && { focusSessions: Array.isArray(data.focusSessions) ? data.focusSessions : [] }),
      ...(data.gratitudeEntries !== undefined && { gratitudeEntries: Array.isArray(data.gratitudeEntries) ? data.gratitudeEntries : [] }),
      ...(data.scheduleEvents !== undefined && { scheduleEvents: Array.isArray(data.scheduleEvents) ? data.scheduleEvents : [] }),
      ...(data.microReflections !== undefined && { microReflections: Array.isArray(data.microReflections) ? data.microReflections : [] }),
      ...(data.canvasGoals !== undefined && { canvasGoals: Array.isArray(data.canvasGoals) ? data.canvasGoals : [] }),
    };

    // Belt-and-suspenders: skip set() if all values are referentially identical
    // to current store state. Prevents infinite loop even if re-entry guard fails.
    const current = get();
    const changed = Object.keys(payload).some(
      (k) => (current as unknown as Record<string, unknown>)[k] !== (payload as unknown as Record<string, unknown>)[k]
    );
    if (!changed) return;

    set(payload);
  },
}));
