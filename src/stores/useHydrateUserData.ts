import { useEffect, useLayoutEffect, useRef } from 'react';
import { useIndexedDB } from '@/hooks/useIndexedDB';
import { db } from '@/storage/db';
import { defaultReminderSettings } from '@/lib/reminders';
import { useUserDataStore, type RegisteredSetters } from './userDataStore';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry, ReminderSettings, PrivacySettings, ScheduleEvent, MicroReflection } from '@/types';
import {
  runtimeMoodEntrySchema,
  runtimeHabitSchema,
  runtimeFocusSessionSchema,
  runtimeGratitudeEntrySchema,
  reminderSettingsSchema,
  privacySettingsSchema,
  scheduleEventSchema,
  microReflectionSchema,
} from '@/lib/schemas';

/**
 * Bridge hook: loads all user data from IndexedDB via useIndexedDB hooks,
 * syncs values into the Zustand userDataStore, and registers persistence setters.
 *
 * Must be called exactly once in the top-level component (Index.tsx).
 * After hydration, all components can read from useUserDataStore instead of props.
 */
export function useHydrateUserData(): void {
  // ── 14 useIndexedDB calls (moved from Index.tsx) ──

  const [hasSelectedLanguage, setHasSelectedLanguage, isLoadingLangSelected] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-language-selected',
    initialValue: false,
    idField: 'key',
  });

  const [userName, setUserName, isLoadingUserName] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-username',
    initialValue: 'Friend',
    idField: 'key',
  });

  const [userNameCustom, setUserNameCustom, isLoadingUserNameCustom] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-username-custom',
    initialValue: false,
    idField: 'key',
  });

  const [moods, setMoods, isLoadingMoods] = useIndexedDB<MoodEntry[]>({
    table: db.moods,
    localStorageKey: 'zenflow-moods',
    initialValue: [],
    itemSchema: runtimeMoodEntrySchema,
  });

  const [habits, setHabits, isLoadingHabits] = useIndexedDB<Habit[]>({
    table: db.habits,
    localStorageKey: 'zenflow-habits',
    initialValue: [],
    itemSchema: runtimeHabitSchema,
  });

  const [focusSessions, setFocusSessions, isLoadingFocus] = useIndexedDB<FocusSession[]>({
    table: db.focusSessions,
    localStorageKey: 'zenflow-focus',
    initialValue: [],
    itemSchema: runtimeFocusSessionSchema,
  });

  const [gratitudeEntries, setGratitudeEntries, isLoadingGratitude] = useIndexedDB<GratitudeEntry[]>({
    table: db.gratitudeEntries,
    localStorageKey: 'zenflow-gratitude',
    initialValue: [],
    itemSchema: runtimeGratitudeEntrySchema,
  });

  const [reminders, setReminders, isLoadingReminders] = useIndexedDB<ReminderSettings>({
    table: db.settings,
    localStorageKey: 'zenflow-reminders',
    initialValue: defaultReminderSettings,
    idField: 'key',
    objectSchema: reminderSettingsSchema,
  });

  const [tutorialComplete, setTutorialComplete, isLoadingTutorial] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-tutorial-complete',
    initialValue: false,
    idField: 'key',
  });

  const [onboardingComplete, setOnboardingComplete, isLoadingOnboarding] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-onboarding-complete',
    initialValue: false,
    idField: 'key',
  });

  const [notificationPermissionChecked, setNotificationPermissionChecked, isLoadingNotificationPermission] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-notification-permission-checked',
    initialValue: false,
    idField: 'key',
  });

  const [googleAuthChecked, setGoogleAuthChecked, isLoadingGoogleAuth] = useIndexedDB({
    table: db.settings,
    localStorageKey: 'zenflow-google-auth-checked',
    initialValue: false,
    idField: 'key',
  });

  const [privacy, setPrivacy, isLoadingPrivacy] = useIndexedDB<PrivacySettings>({
    table: db.settings,
    localStorageKey: 'zenflow-privacy',
    initialValue: { noTracking: false, analytics: false, consentShown: false },
    idField: 'key',
    objectSchema: privacySettingsSchema,
  });

  const [scheduleEvents, setScheduleEvents, isLoadingSchedule] = useIndexedDB<ScheduleEvent[]>({
    table: db.settings,
    localStorageKey: 'zenflow-schedule-events',
    initialValue: [],
    idField: 'key',
    itemSchema: scheduleEventSchema,
  });

  const [microReflections, setMicroReflections, isLoadingMicroReflections] = useIndexedDB<MicroReflection[]>({
    table: db.settings,
    localStorageKey: 'zenflow-micro-reflections',
    initialValue: [],
    idField: 'key',
    itemSchema: microReflectionSchema,
  });

  // ── Register IndexedDB setters (once, via stable refs) ──

  const settersRef = useRef<RegisteredSetters>({
    setMoods, setHabits, setFocusSessions, setGratitudeEntries,
    setReminders, setPrivacy, setScheduleEvents, setMicroReflections,
    setUserName, setUserNameCustom, setHasSelectedLanguage,
    setTutorialComplete, setOnboardingComplete,
    setNotificationPermissionChecked, setGoogleAuthChecked,
  });
  // Keep ref current (useIndexedDB setters are useCallback-stable, but update ref just in case)
  settersRef.current = {
    setMoods, setHabits, setFocusSessions, setGratitudeEntries,
    setReminders, setPrivacy, setScheduleEvents, setMicroReflections,
    setUserName, setUserNameCustom, setHasSelectedLanguage,
    setTutorialComplete, setOnboardingComplete,
    setNotificationPermissionChecked, setGoogleAuthChecked,
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
      setUserName: (v) => settersRef.current.setUserName(v),
      setUserNameCustom: (v) => settersRef.current.setUserNameCustom(v),
      setHasSelectedLanguage: (v) => settersRef.current.setHasSelectedLanguage(v),
      setTutorialComplete: (v) => settersRef.current.setTutorialComplete(v),
      setOnboardingComplete: (v) => settersRef.current.setOnboardingComplete(v),
      setNotificationPermissionChecked: (v) => settersRef.current.setNotificationPermissionChecked(v),
      setGoogleAuthChecked: (v) => settersRef.current.setGoogleAuthChecked(v),
    };
    useUserDataStore.getState()._registerSetters(stableSetters);
  }, []);

  // ── Sync values from useIndexedDB → Zustand store ──

  const isLoading =
    isLoadingLangSelected || isLoadingUserName || isLoadingUserNameCustom ||
    isLoadingMoods || isLoadingHabits || isLoadingFocus || isLoadingGratitude ||
    isLoadingReminders || isLoadingTutorial || isLoadingOnboarding ||
    isLoadingPrivacy || isLoadingNotificationPermission || isLoadingGoogleAuth ||
    isLoadingSchedule || isLoadingMicroReflections;

  useLayoutEffect(() => {
    useUserDataStore.getState()._hydrateFromDB({
      moods, habits, focusSessions, gratitudeEntries,
      reminders, privacy, scheduleEvents, microReflections,
      userName, userNameCustom, hasSelectedLanguage,
      tutorialComplete, onboardingComplete,
      notificationPermissionChecked, googleAuthChecked,
      isLoading,
    });
  }, [
    moods, habits, focusSessions, gratitudeEntries,
    reminders, privacy, scheduleEvents, microReflections,
    userName, userNameCustom, hasSelectedLanguage,
    tutorialComplete, onboardingComplete,
    notificationPermissionChecked, googleAuthChecked,
    isLoading,
  ]);
}
