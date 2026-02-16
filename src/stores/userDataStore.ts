import { create } from 'zustand';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry, ReminderSettings, PrivacySettings, ScheduleEvent } from '@/types';
import { defaultReminderSettings } from '@/lib/reminders';

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
  setUserName: createFieldAction<string>('userName', 'setUserName', set, get),
  setUserNameCustom: createFieldAction<boolean>('userNameCustom', 'setUserNameCustom', set, get),
  setHasSelectedLanguage: createFieldAction<boolean>('hasSelectedLanguage', 'setHasSelectedLanguage', set, get),
  setTutorialComplete: createFieldAction<boolean>('tutorialComplete', 'setTutorialComplete', set, get),
  setOnboardingComplete: createFieldAction<boolean>('onboardingComplete', 'setOnboardingComplete', set, get),
  setNotificationPermissionChecked: createFieldAction<boolean>('notificationPermissionChecked', 'setNotificationPermissionChecked', set, get),
  setGoogleAuthChecked: createFieldAction<boolean>('googleAuthChecked', 'setGoogleAuthChecked', set, get),

  _registerSetters: (setters) => set({ _setters: setters }),
  _hydrateFromDB: (data) => set({
    ...data,
    // Defensive: ensure arrays survive corrupted cloud sync data
    ...(data.moods !== undefined && { moods: Array.isArray(data.moods) ? data.moods : [] }),
    ...(data.habits !== undefined && { habits: Array.isArray(data.habits) ? data.habits : [] }),
    ...(data.focusSessions !== undefined && { focusSessions: Array.isArray(data.focusSessions) ? data.focusSessions : [] }),
    ...(data.gratitudeEntries !== undefined && { gratitudeEntries: Array.isArray(data.gratitudeEntries) ? data.gratitudeEntries : [] }),
    ...(data.scheduleEvents !== undefined && { scheduleEvents: Array.isArray(data.scheduleEvents) ? data.scheduleEvents : [] }),
  }),
}));
