import { describe, expect, it } from "vitest";
import { getToday } from "@/lib/utils";
import { ENTRY, type FocusSession, type Habit, type MoodEntry, type ScheduleEvent } from "@/types";
import { derivePlanningFeatureModel } from "../planningFeatureModel";

const today = getToday();

function event(partial: Partial<ScheduleEvent>): ScheduleEvent {
  return {
    id: partial.id ?? "event-1",
    title: partial.title ?? "Review",
    startHour: partial.startHour ?? 10,
    startMinute: partial.startMinute ?? 0,
    endHour: partial.endHour ?? 10,
    endMinute: partial.endMinute ?? 30,
    color: partial.color ?? "work",
    date: partial.date ?? today,
    source: partial.source ?? "manual",
    isEditable: partial.isEditable ?? true,
  };
}

function focus(partial: Partial<FocusSession>): FocusSession {
  return {
    id: partial.id ?? "focus-1",
    duration: partial.duration ?? 25,
    completedAt: partial.completedAt ?? Date.now(),
    date: partial.date ?? today,
    label: partial.label,
    reflection: partial.reflection,
    status: partial.status ?? "completed",
  };
}

function habit(partial: Partial<Habit>): Habit {
  return {
    id: partial.id ?? "habit-1",
    name: partial.name ?? "Walk",
    icon: partial.icon ?? "walk",
    color: partial.color ?? 1,
    position: partial.position ?? 0,
    createdAt: partial.createdAt ?? Date.now(),
    habitType: partial.habitType ?? "boolean",
    frequency: partial.frequency ?? { numerator: 1, denominator: 1 },
    question: partial.question ?? "Did you walk?",
    description: partial.description ?? "",
    isArchived: partial.isArchived ?? false,
    targetValue: partial.targetValue ?? 1,
    targetType: partial.targetType ?? "atLeast",
    unit: partial.unit ?? "",
    entries: partial.entries ?? {},
    reminders: partial.reminders ?? [],
    ...partial,
  };
}

function mood(partial: Partial<MoodEntry>): MoodEntry {
  return {
    id: partial.id ?? "mood-1",
    mood: partial.mood ?? "good",
    date: partial.date ?? today,
    timestamp: partial.timestamp ?? Date.now(),
    ...partial,
  };
}

describe("derivePlanningFeatureModel", () => {
  it("prioritizes an active focus timer above schedule suggestions", () => {
    const model = derivePlanningFeatureModel({
      now: new Date(`${today}T09:50:00`),
      events: [event({ startHour: 10 })],
      focusSessions: [],
      focusBridge: {
        endTime: Date.now() + 1_200_000,
        isRunning: true,
        isBreak: false,
        label: "Deep work",
      },
    });

    expect(model.primaryIntent).toBe("resume_focus");
    expect(model.recommendedMode).toBe("focus");
  });

  it("suggests reviewing a completed focus session before schedule actions", () => {
    const model = derivePlanningFeatureModel({
      now: new Date(`${today}T09:45:00`),
      events: [event({ startHour: 10, startMinute: 0 })],
      focusSessions: [focus({ reflection: undefined })],
      focusBridge: { endTime: null, isRunning: false, isBreak: false, label: "" },
    });

    expect(model.primaryIntent).toBe("review_recent_focus");
    expect(model.recommendedMode).toBe("review");
  });

  it("suggests preparing when the next event starts within twenty minutes", () => {
    const model = derivePlanningFeatureModel({
      now: new Date(`${today}T09:45:00`),
      events: [event({ startHour: 10, startMinute: 0 })],
      focusSessions: [],
      focusBridge: { endTime: null, isRunning: false, isBreak: false, label: "" },
    });

    expect(model.primaryIntent).toBe("prepare_next_event");
    expect(model.nextEvent?.title).toBe("Review");
    expect(model.minutesUntilNext).toBe(15);
  });

  it("detects overlapping schedule events as a conflict", () => {
    const model = derivePlanningFeatureModel({
      now: new Date(`${today}T08:00:00`),
      events: [
        event({ id: "a", startHour: 10, endHour: 11 }),
        event({ id: "b", startHour: 10, startMinute: 30, endHour: 11, endMinute: 30 }),
      ],
      focusSessions: [],
      focusBridge: { endTime: null, isRunning: false, isBreak: false, label: "" },
    });

    expect(model.primaryIntent).toBe("resolve_conflict");
    expect(model.conflicts).toHaveLength(1);
  });

  it("keeps an empty day schedule-first instead of treating the whole day as a focus gap", () => {
    const model = derivePlanningFeatureModel({
      now: new Date(`${today}T08:00:00`),
      events: [],
      focusSessions: [],
      focusBridge: { endTime: null, isRunning: false, isBreak: false, label: "" },
    });

    expect(model.primaryIntent).toBe("add_first_event");
    expect(model.recommendedMode).toBe("schedule");
  });

  it("counts manual and read-only events separately", () => {
    const model = derivePlanningFeatureModel({
      now: new Date(`${today}T08:00:00`),
      events: [
        event({ id: "manual", source: "manual", isEditable: true }),
        event({ id: "habit", source: "habit", isEditable: false }),
      ],
      focusSessions: [],
      focusBridge: { endTime: null, isRunning: false, isBreak: false, label: "" },
    });

    expect(model.manualEventCount).toBe(1);
    expect(model.readOnlyEventCount).toBe(1);
  });

  it("summarizes the day pulse across schedule, focus, habits and mood", () => {
    const model = derivePlanningFeatureModel({
      now: new Date(`${today}T14:00:00`),
      events: [
        event({ id: "manual", startHour: 15, endHour: 16 }),
        event({
          id: "habit-event",
          startHour: 17,
          endHour: 17,
          endMinute: 20,
          source: "habit",
          isEditable: false,
        }),
      ],
      focusSessions: [focus({ duration: 25 })],
      focusBridge: { endTime: null, isRunning: false, isBreak: false, label: "" },
      habits: [
        habit({ id: "done", entries: { [today]: { value: ENTRY.YES_MANUAL } } }),
        habit({ id: "pending", entries: {} }),
        habit({ id: "archived", isArchived: true, entries: {} }),
      ],
      moodEntries: [mood({ date: today })],
    });

    expect(model.dayPulse).toEqual({
      eventCount: 2,
      focusMinutesToday: 25,
      pendingHabitCount: 1,
      moodLoggedToday: true,
      conflictCount: 0,
    });
  });

  it("counts only incomplete habits that are due on the model date", () => {
    const modelDate = "2026-07-29";
    const model = derivePlanningFeatureModel({
      now: new Date(`${modelDate}T14:00:00`),
      events: [],
      focusSessions: [],
      focusBridge: { endTime: null, isRunning: false, isBreak: false, label: "" },
      habits: [
        habit({
          id: "due-wednesday",
          schedule: {
            mode: "specificDays",
            period: "week",
            targetCount: 1,
            dueDays: [3],
          },
          entries: {},
        }),
        habit({
          id: "not-due-thursday",
          schedule: {
            mode: "specificDays",
            period: "week",
            targetCount: 1,
            dueDays: [4],
          },
          entries: {},
        }),
        habit({
          id: "completed-wednesday",
          schedule: {
            mode: "specificDays",
            period: "week",
            targetCount: 1,
            dueDays: [3],
          },
          entries: { [modelDate]: { value: ENTRY.YES_MANUAL } },
        }),
      ],
      moodEntries: [],
    });

    expect(model.dayPulse.pendingHabitCount).toBe(1);
    expect(model.bridgeActions.map((action) => action.kind)).toContain("complete_habits");
  });

  it("suggests cross-tab bridge actions only when they help the next user step", () => {
    const model = derivePlanningFeatureModel({
      now: new Date(`${today}T20:30:00`),
      events: [event({ startHour: 10, endHour: 11 })],
      focusSessions: [focus({ duration: 25, reflection: undefined })],
      focusBridge: { endTime: null, isRunning: false, isBreak: false, label: "" },
      habits: [habit({ entries: {} })],
      moodEntries: [],
    });

    expect(model.bridgeActions.map((action) => action.kind)).toEqual([
      "log_mood",
      "complete_habits",
      "reflect_in_diary",
    ]);
    expect(model.bridgeActions.map((action) => action.targetPage)).toEqual([
      "orb",
      "habits",
      "diary",
    ]);
    expect(model.bridgeActions).toHaveLength(3);
  });
});
