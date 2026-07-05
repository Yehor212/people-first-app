import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/reminders", () => ({
  defaultReminderSettings: {
    enabled: false,
    moodTimeMorning: "09:00",
    moodTimeAfternoon: "14:00",
    moodTimeEvening: "20:00",
    habitTime: "21:00",
    focusTime: "10:00",
    days: [1, 2, 3, 4, 5],
    quietHours: { start: "22:00", end: "08:00" },
    habitIds: [],
  },
}));

import { useUserDataStore } from "@/stores/userDataStore";
import type { RegisteredSetters } from "@/stores/userDataStore";
import type {
  MoodEntry,
  Habit,
  FocusSession,
  GratitudeEntry,
  ScheduleEvent,
  DayRitual,
  ReflectionInsightCard,
} from "@/types";
import { makeTestHabit } from "@/test/habitFixtures";

const initialState = useUserDataStore.getState();

function createMockSetters(): RegisteredSetters {
  return {
    setMoods: vi.fn(),
    setHabits: vi.fn(),
    setFocusSessions: vi.fn(),
    setGratitudeEntries: vi.fn(),
    setReminders: vi.fn(),
    setPrivacy: vi.fn(),
    setScheduleEvents: vi.fn(),
    setUserName: vi.fn(),
    setUserNameCustom: vi.fn(),
    setHasSelectedLanguage: vi.fn(),
    setOnboardingComplete: vi.fn(),
    setNotificationPermissionChecked: vi.fn(),
    setAuthGateChecked: vi.fn(),
    setGoogleAuthChecked: vi.fn(),
    setMicroReflections: vi.fn(),
    setCanvasGoals: vi.fn(),
    setDayRituals: vi.fn(),
    setReflectionInsights: vi.fn(),
  };
}

function makeMood(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return { id: "1", mood: "good", date: "2025-01-01", timestamp: 1000, ...overrides };
}

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return makeTestHabit({
    id: "h1",
    name: "Test Habit",
    icon: "star",
    createdAt: 1000,
    ...overrides,
  });
}

function makeFocusSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return { id: "f1", duration: 25, completedAt: 1000, date: "2025-01-01", ...overrides };
}

function makeGratitudeEntry(overrides: Partial<GratitudeEntry> = {}): GratitudeEntry {
  return {
    id: "g1",
    text: "Grateful for tests",
    date: "2025-01-01",
    timestamp: 1000,
    ...overrides,
  };
}

function makeScheduleEvent(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: "s1",
    title: "Meeting",
    startHour: 9,
    startMinute: 0,
    endHour: 10,
    endMinute: 0,
    color: "#00f",
    ...overrides,
  } as ScheduleEvent;
}

function makeDayRitual(overrides: Partial<DayRitual> = {}): DayRitual {
  return {
    id: "opening-2025-01-01",
    type: "opening",
    date: "2025-01-01",
    timestamp: 1000,
    updatedAt: 1000,
    priorities: ["Protect focus"],
    wins: [],
    drains: [],
    ...overrides,
  };
}

function makeReflectionInsight(
  overrides: Partial<ReflectionInsightCard> = {}
): ReflectionInsightCard {
  return {
    id: "insight-1",
    source: "ritual-pattern",
    title: "Morning check-ins anchor your focus",
    summary: "You focus longer on days that start with intention.",
    experiment: "Repeat your opening ritual before the first session.",
    confidence: 0.82,
    impact: "high",
    evidence: [{ label: "Ritual days", detail: "42 minutes avg" }],
    status: "new",
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

beforeEach(() => {
  useUserDataStore.setState(initialState, true);
});

// =========================================================================
// 1. Initial state
// =========================================================================
describe("userDataStore initial state", () => {
  it("moods defaults to empty array", () => {
    expect(useUserDataStore.getState().moods).toEqual([]);
  });

  it("habits defaults to empty array", () => {
    expect(useUserDataStore.getState().habits).toEqual([]);
  });

  it("focusSessions defaults to empty array", () => {
    expect(useUserDataStore.getState().focusSessions).toEqual([]);
  });

  it("gratitudeEntries defaults to empty array", () => {
    expect(useUserDataStore.getState().gratitudeEntries).toEqual([]);
  });

  it("scheduleEvents defaults to empty array", () => {
    expect(useUserDataStore.getState().scheduleEvents).toEqual([]);
  });

  it("dayRituals defaults to empty array", () => {
    expect(useUserDataStore.getState().dayRituals).toEqual([]);
  });

  it("reflectionInsights defaults to empty array", () => {
    expect(useUserDataStore.getState().reflectionInsights).toEqual([]);
  });

  it("reminders defaults to defaultReminderSettings", () => {
    expect(useUserDataStore.getState().reminders).toEqual({
      enabled: false,
      moodTimeMorning: "09:00",
      moodTimeAfternoon: "14:00",
      moodTimeEvening: "20:00",
      habitTime: "21:00",
      focusTime: "10:00",
      days: [1, 2, 3, 4, 5],
      quietHours: { start: "22:00", end: "08:00" },
      habitIds: [],
    });
  });

  it("privacy defaults to tracking, analytics, consent, and push notifications off", () => {
    expect(useUserDataStore.getState().privacy).toEqual({
      noTracking: false,
      analytics: false,
      consentShown: false,
      pushNotifications: false,
    });
  });

  it('userName defaults to "Friend"', () => {
    expect(useUserDataStore.getState().userName).toBe("Friend");
  });

  it("userNameCustom defaults to false", () => {
    expect(useUserDataStore.getState().userNameCustom).toBe(false);
  });

  it("hasSelectedLanguage defaults to false", () => {
    expect(useUserDataStore.getState().hasSelectedLanguage).toBe(false);
  });

  it("does not expose the removed tutorial completion gate", () => {
    expect("tutorialComplete" in useUserDataStore.getState()).toBe(false);
    expect("setTutorialComplete" in useUserDataStore.getState()).toBe(false);
  });

  it("onboardingComplete defaults to false", () => {
    expect(useUserDataStore.getState().onboardingComplete).toBe(false);
  });

  it("notificationPermissionChecked defaults to false", () => {
    expect(useUserDataStore.getState().notificationPermissionChecked).toBe(false);
  });

  it("authGateChecked defaults to false", () => {
    expect(useUserDataStore.getState().authGateChecked).toBe(false);
  });

  it("legacy googleAuthChecked defaults to false", () => {
    expect(useUserDataStore.getState().googleAuthChecked).toBe(false);
  });

  it("isLoading defaults to true", () => {
    expect(useUserDataStore.getState().isLoading).toBe(true);
  });

  it("_setters defaults to null", () => {
    expect(useUserDataStore.getState()._setters).toBeNull();
  });
});

// =========================================================================
// 2. Direct value setters
// =========================================================================
describe("direct value setters", () => {
  it("setMoods sets moods array", () => {
    const moods = [makeMood()];
    useUserDataStore.getState().setMoods(moods);
    expect(useUserDataStore.getState().moods).toEqual(moods);
  });

  it("setHabits sets habits array", () => {
    const habits = [makeHabit()];
    useUserDataStore.getState().setHabits(habits);
    expect(useUserDataStore.getState().habits).toEqual(habits);
  });

  it("setFocusSessions sets focusSessions array", () => {
    const sessions = [makeFocusSession()];
    useUserDataStore.getState().setFocusSessions(sessions);
    expect(useUserDataStore.getState().focusSessions).toEqual(sessions);
  });

  it("setGratitudeEntries sets gratitudeEntries array", () => {
    const entries = [makeGratitudeEntry()];
    useUserDataStore.getState().setGratitudeEntries(entries);
    expect(useUserDataStore.getState().gratitudeEntries).toEqual(entries);
  });

  it("setScheduleEvents sets scheduleEvents array", () => {
    const events = [makeScheduleEvent()];
    useUserDataStore.getState().setScheduleEvents(events);
    expect(useUserDataStore.getState().scheduleEvents).toEqual(events);
  });

  it("setDayRituals sets dayRituals array", () => {
    const rituals = [makeDayRitual()];
    useUserDataStore.getState().setDayRituals(rituals);
    expect(useUserDataStore.getState().dayRituals).toEqual(rituals);
  });

  it("setReflectionInsights sets reflectionInsights array", () => {
    const insights = [makeReflectionInsight()];
    useUserDataStore.getState().setReflectionInsights(insights);
    expect(useUserDataStore.getState().reflectionInsights).toEqual(insights);
  });

  it("setReminders sets reminders object", () => {
    const reminders = {
      enabled: true,
      moodTimeMorning: "08:00",
      moodTimeAfternoon: "13:00",
      moodTimeEvening: "19:00",
      habitTime: "20:00",
      focusTime: "09:00",
      days: [1, 2, 3],
      quietHours: { start: "23:00", end: "07:00" },
      habitIds: ["h1"],
    };
    useUserDataStore.getState().setReminders(reminders);
    expect(useUserDataStore.getState().reminders).toEqual(reminders);
  });

  it("setPrivacy sets privacy object", () => {
    const privacy = { noTracking: true, analytics: true, consentShown: true };
    useUserDataStore.getState().setPrivacy(privacy);
    expect(useUserDataStore.getState().privacy).toEqual(privacy);
  });

  it("setUserName sets userName", () => {
    useUserDataStore.getState().setUserName("Alice");
    expect(useUserDataStore.getState().userName).toBe("Alice");
  });

  it("setUserNameCustom sets userNameCustom", () => {
    useUserDataStore.getState().setUserNameCustom(true);
    expect(useUserDataStore.getState().userNameCustom).toBe(true);
  });

  it("setHasSelectedLanguage sets hasSelectedLanguage", () => {
    useUserDataStore.getState().setHasSelectedLanguage(true);
    expect(useUserDataStore.getState().hasSelectedLanguage).toBe(true);
  });

  it("setOnboardingComplete sets onboardingComplete", () => {
    useUserDataStore.getState().setOnboardingComplete(true);
    expect(useUserDataStore.getState().onboardingComplete).toBe(true);
  });

  it("setNotificationPermissionChecked sets notificationPermissionChecked", () => {
    useUserDataStore.getState().setNotificationPermissionChecked(true);
    expect(useUserDataStore.getState().notificationPermissionChecked).toBe(true);
  });

  it("setAuthGateChecked sets the provider-neutral auth gate flag", () => {
    useUserDataStore.getState().setAuthGateChecked(true);
    const state = useUserDataStore.getState();
    expect(state.authGateChecked).toBe(true);
    expect(state.googleAuthChecked).toBe(true);
  });

  it("legacy setGoogleAuthChecked updates the provider-neutral auth gate flag", () => {
    useUserDataStore.getState().setGoogleAuthChecked(true);
    const state = useUserDataStore.getState();
    expect(state.authGateChecked).toBe(true);
    expect(state.googleAuthChecked).toBe(true);
  });
});

// =========================================================================
// 3. Function updater (prev => newValue)
// =========================================================================
describe("function updaters", () => {
  it("setMoods with function appends to existing moods", () => {
    const mood1 = makeMood({ id: "m1" });
    const mood2 = makeMood({ id: "m2", mood: "great" });
    useUserDataStore.getState().setMoods([mood1]);
    useUserDataStore.getState().setMoods((prev) => [...prev, mood2]);
    expect(useUserDataStore.getState().moods).toEqual([mood1, mood2]);
  });

  it("setHabits with function appends to existing habits", () => {
    const h1 = makeHabit({ id: "h1" });
    const h2 = makeHabit({ id: "h2", name: "Second" });
    useUserDataStore.getState().setHabits([h1]);
    useUserDataStore.getState().setHabits((prev) => [...prev, h2]);
    expect(useUserDataStore.getState().habits).toEqual([h1, h2]);
  });

  it("setFocusSessions with function filters existing sessions", () => {
    const s1 = makeFocusSession({ id: "f1" });
    const s2 = makeFocusSession({ id: "f2" });
    useUserDataStore.getState().setFocusSessions([s1, s2]);
    useUserDataStore.getState().setFocusSessions((prev) => prev.filter((s) => s.id !== "f1"));
    expect(useUserDataStore.getState().focusSessions).toEqual([s2]);
  });

  it("setGratitudeEntries with function appends", () => {
    const g1 = makeGratitudeEntry({ id: "g1" });
    const g2 = makeGratitudeEntry({ id: "g2" });
    useUserDataStore.getState().setGratitudeEntries([g1]);
    useUserDataStore.getState().setGratitudeEntries((prev) => [...prev, g2]);
    expect(useUserDataStore.getState().gratitudeEntries).toEqual([g1, g2]);
  });

  it("setScheduleEvents with function appends", () => {
    const ev1 = makeScheduleEvent({ id: "ev1" });
    const ev2 = makeScheduleEvent({ id: "ev2" });
    useUserDataStore.getState().setScheduleEvents([ev1]);
    useUserDataStore.getState().setScheduleEvents((prev) => [...prev, ev2]);
    expect(useUserDataStore.getState().scheduleEvents).toEqual([ev1, ev2]);
  });

  it("setUserName with function transforms value", () => {
    useUserDataStore.getState().setUserName("Bob");
    useUserDataStore.getState().setUserName((prev) => prev + "!");
    expect(useUserDataStore.getState().userName).toBe("Bob!");
  });

  it("setUserNameCustom with function toggles value", () => {
    useUserDataStore.getState().setUserNameCustom(false);
    useUserDataStore.getState().setUserNameCustom((prev) => !prev);
    expect(useUserDataStore.getState().userNameCustom).toBe(true);
  });
});

// =========================================================================
// 4. Bridge pattern: _registerSetters + setter calls IndexedDB setter
// =========================================================================
describe("bridge pattern (_registerSetters)", () => {
  it("_registerSetters stores the setters object", () => {
    const setters = createMockSetters();
    useUserDataStore.getState()._registerSetters(setters);
    expect(useUserDataStore.getState()._setters).toBe(setters);
  });

  it("setMoods calls registered IndexedDB setter with current Zustand value", () => {
    const setters = createMockSetters();
    useUserDataStore.getState()._registerSetters(setters);
    const moods = [makeMood()];
    useUserDataStore.getState().setMoods(moods);
    expect(setters.setMoods).toHaveBeenCalledWith(moods);
  });

  it("setHabits calls registered IndexedDB setter", () => {
    const setters = createMockSetters();
    useUserDataStore.getState()._registerSetters(setters);
    const habits = [makeHabit()];
    useUserDataStore.getState().setHabits(habits);
    expect(setters.setHabits).toHaveBeenCalledWith(habits);
  });

  it("setUserName calls registered IndexedDB setter with updated value", () => {
    const setters = createMockSetters();
    useUserDataStore.getState()._registerSetters(setters);
    useUserDataStore.getState().setUserName("Alice");
    expect(setters.setUserName).toHaveBeenCalledWith("Alice");
  });

  it("setPrivacy calls registered IndexedDB setter", () => {
    const setters = createMockSetters();
    useUserDataStore.getState()._registerSetters(setters);
    const privacy = { noTracking: true, analytics: false, consentShown: true };
    useUserDataStore.getState().setPrivacy(privacy);
    expect(setters.setPrivacy).toHaveBeenCalledWith(privacy);
  });

  it("function updater calls IndexedDB setter with resolved value (not the function)", () => {
    const setters = createMockSetters();
    useUserDataStore.getState()._registerSetters(setters);
    const mood1 = makeMood({ id: "m1" });
    const mood2 = makeMood({ id: "m2" });
    useUserDataStore.getState().setMoods([mood1]);
    useUserDataStore.getState().setMoods((prev) => [...prev, mood2]);
    // The IndexedDB setter should receive the resolved array, not the function
    expect(setters.setMoods).toHaveBeenLastCalledWith([mood1, mood2]);
  });
});

// =========================================================================
// 5. Without registered setters (no crash)
// =========================================================================
describe("without registered setters", () => {
  it("setter only updates Zustand state (no crash)", () => {
    expect(useUserDataStore.getState()._setters).toBeNull();
    const moods = [makeMood()];
    useUserDataStore.getState().setMoods(moods);
    expect(useUserDataStore.getState().moods).toEqual(moods);
  });

  it("all setters work without registered setters", () => {
    expect(useUserDataStore.getState()._setters).toBeNull();
    useUserDataStore.getState().setHabits([makeHabit()]);
    useUserDataStore.getState().setFocusSessions([makeFocusSession()]);
    useUserDataStore.getState().setGratitudeEntries([makeGratitudeEntry()]);
    useUserDataStore.getState().setScheduleEvents([makeScheduleEvent()]);
    useUserDataStore.getState().setUserName("Test");
    useUserDataStore.getState().setUserNameCustom(true);
    useUserDataStore.getState().setHasSelectedLanguage(true);
    useUserDataStore.getState().setOnboardingComplete(true);
    useUserDataStore.getState().setNotificationPermissionChecked(true);
    useUserDataStore.getState().setAuthGateChecked(true);

    const state = useUserDataStore.getState();
    expect(state.habits).toHaveLength(1);
    expect(state.focusSessions).toHaveLength(1);
    expect(state.gratitudeEntries).toHaveLength(1);
    expect(state.scheduleEvents).toHaveLength(1);
    expect(state.userName).toBe("Test");
    expect(state.userNameCustom).toBe(true);
    expect(state.hasSelectedLanguage).toBe(true);
    expect(state.onboardingComplete).toBe(true);
    expect(state.notificationPermissionChecked).toBe(true);
    expect(state.googleAuthChecked).toBe(true);
  });

  it("function updater works without registered setters", () => {
    expect(useUserDataStore.getState()._setters).toBeNull();
    useUserDataStore.getState().setMoods([makeMood({ id: "m1" })]);
    useUserDataStore.getState().setMoods((prev) => [...prev, makeMood({ id: "m2" })]);
    expect(useUserDataStore.getState().moods).toHaveLength(2);
  });
});

// =========================================================================
// 6. _hydrateFromDB
// =========================================================================
describe("_hydrateFromDB", () => {
  it("partial data merges correctly without overwriting other fields", () => {
    useUserDataStore.getState().setUserName("OriginalName");
    useUserDataStore.getState()._hydrateFromDB({ onboardingComplete: true });
    expect(useUserDataStore.getState().onboardingComplete).toBe(true);
    expect(useUserDataStore.getState().userName).toBe("OriginalName");
  });

  it("hydrates multiple fields at once", () => {
    useUserDataStore.getState()._hydrateFromDB({
      userName: "HydratedUser",
      onboardingComplete: true,
      authGateChecked: true,
      isLoading: false,
    });
    const state = useUserDataStore.getState();
    expect(state.userName).toBe("HydratedUser");
    expect(state.onboardingComplete).toBe(true);
    expect(state.authGateChecked).toBe(true);
    expect(state.googleAuthChecked).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it("hydrates the provider-neutral auth gate flag from the legacy Google auth field", () => {
    useUserDataStore.getState()._hydrateFromDB({ googleAuthChecked: true });
    const state = useUserDataStore.getState();
    expect(state.authGateChecked).toBe(true);
    expect(state.googleAuthChecked).toBe(true);
  });

  it("non-array moods value is converted to empty array", () => {
    useUserDataStore.getState()._hydrateFromDB({
      moods: "corrupted" as unknown as MoodEntry[],
    });
    expect(useUserDataStore.getState().moods).toEqual([]);
  });

  it("non-array habits value is converted to empty array", () => {
    useUserDataStore.getState()._hydrateFromDB({
      habits: "corrupted" as unknown as Habit[],
    });
    expect(useUserDataStore.getState().habits).toEqual([]);
  });

  it("non-array focusSessions value is converted to empty array", () => {
    useUserDataStore.getState()._hydrateFromDB({
      focusSessions: 42 as unknown as FocusSession[],
    });
    expect(useUserDataStore.getState().focusSessions).toEqual([]);
  });

  it("non-array gratitudeEntries value is converted to empty array", () => {
    useUserDataStore.getState()._hydrateFromDB({
      gratitudeEntries: { broken: true } as unknown as GratitudeEntry[],
    });
    expect(useUserDataStore.getState().gratitudeEntries).toEqual([]);
  });

  it("non-array scheduleEvents value is converted to empty array", () => {
    useUserDataStore.getState()._hydrateFromDB({
      scheduleEvents: null as unknown as ScheduleEvent[],
    });
    expect(useUserDataStore.getState().scheduleEvents).toEqual([]);
  });

  it("valid arrays are preserved as-is", () => {
    const moods = [makeMood({ id: "hm1" })];
    const habits = [makeHabit({ id: "hh1" })];
    const sessions = [makeFocusSession({ id: "hf1" })];
    const entries = [makeGratitudeEntry({ id: "hg1" })];
    const events = [makeScheduleEvent({ id: "hs1" })];
    useUserDataStore.getState()._hydrateFromDB({
      moods,
      habits,
      focusSessions: sessions,
      gratitudeEntries: entries,
      scheduleEvents: events,
    });
    const state = useUserDataStore.getState();
    expect(state.moods).toEqual(moods);
    expect(state.habits).toEqual(habits);
    expect(state.focusSessions).toEqual(sessions);
    expect(state.gratitudeEntries).toEqual(entries);
    expect(state.scheduleEvents).toEqual(events);
  });

  it("undefined fields are not overwritten when key is absent", () => {
    useUserDataStore.getState().setUserName("Keep");
    // Hydrate with a partial that does not include userName at all
    useUserDataStore.getState()._hydrateFromDB({ onboardingComplete: true });
    expect(useUserDataStore.getState().userName).toBe("Keep");
  });

  it("explicit undefined value does overwrite (Zustand set behavior)", () => {
    useUserDataStore.getState().setUserName("Keep");
    useUserDataStore.getState()._hydrateFromDB({ userName: undefined });
    // Zustand set({userName: undefined}) sets the field to undefined
    expect(useUserDataStore.getState().userName).toBeUndefined();
  });

  it("hydrating with empty object changes nothing", () => {
    const before = useUserDataStore.getState();
    useUserDataStore.getState()._hydrateFromDB({});
    const after = useUserDataStore.getState();
    // Compare relevant data fields (state object identity may differ)
    expect(after.moods).toEqual(before.moods);
    expect(after.habits).toEqual(before.habits);
    expect(after.userName).toBe(before.userName);
    expect(after.isLoading).toBe(before.isLoading);
  });

  it("undefined moods does not trigger array conversion (field untouched)", () => {
    const existingMoods = [makeMood({ id: "keep-me" })];
    useUserDataStore.getState().setMoods(existingMoods);
    useUserDataStore.getState()._hydrateFromDB({ userName: "OnlyName" });
    expect(useUserDataStore.getState().moods).toEqual(existingMoods);
  });

  it("migrates legacy habits without crashing when migration logging runs", () => {
    const setters = createMockSetters();
    useUserDataStore.getState()._registerSetters(setters);

    const legacyHabit = {
      id: "legacy-h1",
      name: "Legacy habit",
      icon: "star",
      color: "#4a9d7c",
      createdAt: 1000,
      completedDates: ["2025-01-01"],
    } as unknown as Habit;

    expect(() => {
      useUserDataStore.getState()._hydrateFromDB({ habits: [legacyHabit] });
    }).not.toThrow();

    expect(setters.setHabits).toHaveBeenCalledTimes(1);
    expect(useUserDataStore.getState().habits[0]?.entries["2025-01-01"]?.value).toBe(2);
  });
});
