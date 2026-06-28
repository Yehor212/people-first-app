import { ENTRY, type FocusSession, type Habit, type MoodEntry, type ScheduleEvent } from "@/types";
import { formatDate } from "@/lib/utils";

export type PlanningMode = "today" | "schedule" | "focus" | "review";

export type PlanningPrimaryIntent =
  | "add_first_event"
  | "prepare_next_event"
  | "continue_current_event"
  | "start_focus_gap"
  | "resume_focus"
  | "review_recent_focus"
  | "resolve_conflict"
  | "close_day";

export type PlanningBridgeActionKind =
  | "log_mood"
  | "complete_habits"
  | "reflect_in_diary"
  | "plan_tomorrow";

export type PlanningBridgeTargetPage = "orb" | "habits" | "diary" | "planning";

export interface PlanningBridgeAction {
  kind: PlanningBridgeActionKind;
  targetPage: PlanningBridgeTargetPage;
}

export interface PlanningFocusBridgeState {
  endTime: number | null;
  isRunning: boolean;
  isBreak: boolean;
  label: string;
}

export interface PlanningConflict {
  first: ScheduleEvent;
  second: ScheduleEvent;
}

export interface PlanningDayPulse {
  eventCount: number;
  focusMinutesToday: number;
  pendingHabitCount: number;
  moodLoggedToday: boolean;
  conflictCount: number;
}

export interface PlanningFeatureModel {
  today: string;
  currentEvent: ScheduleEvent | null;
  nextEvent: ScheduleEvent | null;
  minutesUntilNext: number | null;
  nextFreeGapMinutes: number | null;
  conflicts: PlanningConflict[];
  primaryIntent: PlanningPrimaryIntent;
  recommendedMode: PlanningMode;
  manualEventCount: number;
  readOnlyEventCount: number;
  focusMinutesToday: number;
  dayPulse: PlanningDayPulse;
  bridgeActions: PlanningBridgeAction[];
}

interface DerivePlanningFeatureModelInput {
  now: Date;
  events: ScheduleEvent[];
  focusSessions: FocusSession[];
  focusBridge: PlanningFocusBridgeState;
  habits?: Habit[];
  moodEntries?: MoodEntry[];
}

function minutesOf(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function eventStart(event: ScheduleEvent): number {
  return minutesOf(event.startHour, event.startMinute);
}

function eventEnd(event: ScheduleEvent): number {
  return minutesOf(event.endHour, event.endMinute);
}

function isManualScheduleEvent(event: ScheduleEvent): boolean {
  return (!event.source || event.source === "manual") && event.isEditable !== false;
}

function isHabitHandledToday(habit: Habit, today: string): boolean {
  const entry = habit.entries?.[today];
  if (!entry) return false;
  return (
    entry.value === ENTRY.YES_MANUAL ||
    entry.value === ENTRY.YES_AUTO ||
    entry.value === ENTRY.SKIP ||
    entry.value > 0
  );
}

function deriveBridgeActions({
  hasUnreflectedFocus,
  focusMinutesToday,
  moodLoggedToday,
  pendingHabitCount,
  primaryIntent,
}: {
  hasUnreflectedFocus: boolean;
  focusMinutesToday: number;
  moodLoggedToday: boolean;
  pendingHabitCount: number;
  primaryIntent: PlanningPrimaryIntent;
}): PlanningBridgeAction[] {
  const actions: PlanningBridgeAction[] = [];

  if (!moodLoggedToday) {
    actions.push({ kind: "log_mood", targetPage: "orb" });
  }

  if (pendingHabitCount > 0) {
    actions.push({ kind: "complete_habits", targetPage: "habits" });
  }

  if (hasUnreflectedFocus || focusMinutesToday > 0) {
    actions.push({ kind: "reflect_in_diary", targetPage: "diary" });
  }

  if (primaryIntent === "close_day") {
    actions.push({ kind: "plan_tomorrow", targetPage: "planning" });
  }

  return actions.slice(0, 3);
}

export function derivePlanningFeatureModel({
  now,
  events,
  focusSessions,
  focusBridge,
  habits = [],
  moodEntries = [],
}: DerivePlanningFeatureModelInput): PlanningFeatureModel {
  const today = formatDate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayEvents = events
    .filter((event) => event.date === today)
    .sort((a, b) => eventStart(a) - eventStart(b));

  const currentEvent =
    todayEvents.find((event) => nowMinutes >= eventStart(event) && nowMinutes < eventEnd(event)) ??
    null;
  const nextEvent = todayEvents.find((event) => eventStart(event) > nowMinutes) ?? null;
  const minutesUntilNext = nextEvent ? Math.max(0, eventStart(nextEvent) - nowMinutes) : null;
  const nextFreeGapMinutes = nextEvent
    ? Math.max(0, eventStart(nextEvent) - nowMinutes)
    : Math.max(0, 22 * 60 - nowMinutes);

  const conflicts: PlanningConflict[] = [];
  for (let index = 0; index < todayEvents.length - 1; index += 1) {
    const first = todayEvents[index];
    const second = todayEvents[index + 1];
    if (eventEnd(first) > eventStart(second)) {
      conflicts.push({ first, second });
    }
  }

  const focusMinutesToday = focusSessions
    .filter((session) => session.date === today && session.status !== "aborted")
    .reduce((total, session) => total + session.duration, 0);

  const hasActiveFocus = focusBridge.isRunning || focusBridge.endTime !== null;
  const hasUnreflectedFocus = focusSessions.some(
    (session) =>
      session.date === today && session.status === "completed" && session.reflection == null,
  );
  const pendingHabitCount = habits.filter(
    (habit) => !habit.isArchived && !isHabitHandledToday(habit, today),
  ).length;
  const moodLoggedToday = moodEntries.some((entry) => entry.date === today);

  let primaryIntent: PlanningPrimaryIntent;
  let recommendedMode: PlanningMode;

  if (hasActiveFocus) {
    primaryIntent = "resume_focus";
    recommendedMode = "focus";
  } else if (hasUnreflectedFocus) {
    primaryIntent = "review_recent_focus";
    recommendedMode = "review";
  } else if (currentEvent) {
    primaryIntent = "continue_current_event";
    recommendedMode = "schedule";
  } else if (minutesUntilNext !== null && minutesUntilNext <= 20) {
    primaryIntent = "prepare_next_event";
    recommendedMode = "today";
  } else if (conflicts.length > 0) {
    primaryIntent = "resolve_conflict";
    recommendedMode = "schedule";
  } else if (todayEvents.length === 0) {
    primaryIntent = "add_first_event";
    recommendedMode = "schedule";
  } else if (nextFreeGapMinutes >= 25) {
    primaryIntent = "start_focus_gap";
    recommendedMode = "focus";
  } else {
    primaryIntent = "close_day";
    recommendedMode = "review";
  }

  const dayPulse: PlanningDayPulse = {
    eventCount: todayEvents.length,
    focusMinutesToday,
    pendingHabitCount,
    moodLoggedToday,
    conflictCount: conflicts.length,
  };

  return {
    today,
    currentEvent,
    nextEvent,
    minutesUntilNext,
    nextFreeGapMinutes,
    conflicts,
    primaryIntent,
    recommendedMode,
    manualEventCount: todayEvents.filter(isManualScheduleEvent).length,
    readOnlyEventCount: todayEvents.filter((event) => !isManualScheduleEvent(event)).length,
    focusMinutesToday,
    dayPulse,
    bridgeActions: deriveBridgeActions({
      hasUnreflectedFocus,
      focusMinutesToday,
      moodLoggedToday,
      pendingHabitCount,
      primaryIntent,
    }),
  };
}
