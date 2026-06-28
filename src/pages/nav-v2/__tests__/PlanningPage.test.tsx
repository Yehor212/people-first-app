import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlanningPage } from "../planning/PlanningPage";
import { ENTRY, type FocusSession, type Habit, type MoodEntry, type ScheduleEvent } from "@/types";
import { useUserDataStore } from "@/stores/userDataStore";
import { useUIStore } from "@/stores/uiStore";
import { getToday } from "@/lib/utils";
import { syncSetting } from "@/storage/sync/syncSettings";
import { triggerSync } from "@/storage/cloudSync";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Planning: "Planning",
      navV2PlanningHeading: "Plan your next ritual",
      navV2PlanningSubcopy: "Schedule and focus live together here.",
      navV2PlanningEmpty: "No events yet",
      navV2PlanningLoading: "Preparing planning...",
      planningModeToday: "Today",
      planningModeSchedule: "Schedule",
      planningModeFocus: "Focus",
      planningModeReview: "Review",
      todayMinutes: "min today",
      planningActionTitle: "Next step",
      planningActionAddEvent: "Add to schedule",
      planningActionStartFocus: "Start focus",
      planningActionReview: "Review",
      planningActionOpenSchedule: "Open schedule",
      planningIntent_add_first_event: "Add the first anchor for today.",
      planningIntent_prepare_next_event: "Prepare for what is next.",
      planningIntent_continue_current_event: "Stay with the current event.",
      planningIntent_start_focus_gap: "Use this open space for focus.",
      planningIntent_resume_focus: "Your focus timer is active.",
      planningIntent_review_recent_focus: "Capture the last focus session.",
      planningIntent_resolve_conflict: "There is an overlap to review.",
      planningIntent_close_day: "Close the day with a short review.",
      planningPulseTitle: "Day pulse",
      planningPulseEvents: "Events",
      planningPulseFocus: "Focus",
      planningPulseHabits: "Habits",
      planningPulseMood: "Mood",
      planningPulseMoodDone: "Logged",
      planningPulseMoodOpen: "Open",
      planningPulseHabitCount: "{count} left",
      planningBridgeTitle: "Helpful next moves",
      planningBridgeLogMood: "Log mood",
      planningBridgeLogMoodDesc: "Check in before the day moves on.",
      planningBridgeCompleteHabits: "Finish habits",
      planningBridgeCompleteHabitsDesc: "Clear the loops still waiting today.",
      planningBridgeReflectDiary: "Reflect in diary",
      planningBridgeReflectDiaryDesc: "Turn today into a note you can revisit.",
      planningBridgePlanTomorrow: "Plan tomorrow",
      planningBridgePlanTomorrowDesc: "Leave one clear anchor for the next day.",
      viewSchedule: "View schedule",
      focus: "Focus",
    },
    isRTL: false,
    language: "en",
  }),
}));

vi.mock("@/components/GlobalScheduleBar", () => ({
  GlobalScheduleBar: ({ events }: { events: ScheduleEvent[] }) => (
    <button type="button" data-testid="planning-now-next-strip">
      now-next:{events.length}
    </button>
  ),
}));

vi.mock("@/components/ScheduleTimeline", () => ({
  ScheduleTimeline: ({
    events,
    onAddEvent,
    onDeleteEvent,
  }: {
    events: ScheduleEvent[];
    onAddEvent?: (event: Omit<ScheduleEvent, "id">) => void;
    onDeleteEvent?: (id: string) => void;
  }) => (
    <section data-testid="planning-schedule-timeline">
      <span data-testid="planning-schedule-count">{events.length}</span>
      <button
        type="button"
        onClick={() =>
          onAddEvent?.({
            title: "Plan review",
            startHour: 12,
            startMinute: 0,
            endHour: 12,
            endMinute: 30,
            color: "#22c55e",
            date: getToday(),
            source: "manual",
            isEditable: true,
          })
        }
      >
        add manual event
      </button>
      <button type="button" onClick={() => onDeleteEvent?.("manual-1")}>
        delete manual event
      </button>
      <button type="button" onClick={() => onDeleteEvent?.("habit-1")}>
        delete habit event
      </button>
    </section>
  ),
}));

vi.mock("@/components/FocusTimer", () => ({
  FocusTimer: ({
    sessions,
    onCompleteSession,
    onMinuteUpdate,
  }: {
    sessions: FocusSession[];
    onCompleteSession: (session: FocusSession) => void;
    onMinuteUpdate?: (minutes: number) => void;
  }) => (
    <section data-testid="planning-focus-timer">
      focus:{sessions.length}
      <button type="button" onClick={() => onMinuteUpdate?.(7)}>
        minute update
      </button>
      <button
        type="button"
        onClick={() =>
          onCompleteSession({
            id: "focus-1",
            duration: 25,
            completedAt: Date.now(),
            date: getToday(),
            status: "completed",
          })
        }
      >
        complete focus
      </button>
    </section>
  ),
}));

vi.mock("@/storage/sync/syncSettings", () => ({
  syncSetting: vi.fn(async () => undefined),
}));

vi.mock("@/storage/cloudSync", () => ({
  triggerSync: vi.fn(),
}));

const manualEvent = (): ScheduleEvent => ({
  id: "manual-1",
  title: "Walk",
  startHour: 10,
  startMinute: 0,
  endHour: 10,
  endMinute: 30,
  color: "#06b6d4",
  date: getToday(),
  source: "manual",
  isEditable: true,
});

const habitEvent = (): ScheduleEvent => ({
  id: "habit-1",
  title: "Habit walk",
  startHour: 11,
  startMinute: 0,
  endHour: 11,
  endMinute: 15,
  color: "#f59e0b",
  date: getToday(),
  source: "habit",
  habitId: "habit-walk",
  isEditable: false,
});

const pendingHabit = (): Habit => ({
  id: "habit-pending",
  name: "Walk",
  icon: "walk",
  color: 1,
  position: 0,
  createdAt: Date.now(),
  habitType: "boolean",
  frequency: { numerator: 1, denominator: 1 },
  question: "Did you walk?",
  description: "",
  isArchived: false,
  targetValue: 1,
  targetType: "atLeast",
  unit: "",
  entries: {},
  reminders: [],
});

const completedHabit = (): Habit => ({
  ...pendingHabit(),
  id: "habit-complete",
  entries: { [getToday()]: { value: ENTRY.YES_MANUAL } },
});

const moodEntry = (): MoodEntry => ({
  id: "mood-1",
  mood: "good",
  date: getToday(),
  timestamp: Date.now(),
});

describe("PlanningPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserDataStore.setState({
      scheduleEvents: [],
      habits: [],
      focusSessions: [],
      isLoading: false,
      _setters: null,
    });
    useUIStore.setState({ currentFocusMinutes: undefined });
  });

  it("renders the V2 page root, Now/Next strip, ScheduleTimeline and FocusTimer", async () => {
    useUserDataStore.setState({
      scheduleEvents: [manualEvent()],
      focusSessions: [
        {
          id: "session-1",
          duration: 15,
          completedAt: Date.now(),
          date: getToday(),
          status: "completed",
        },
      ],
    });

    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    expect(screen.getByTestId("planning-page")).toHaveAttribute(
      "data-v2-readable-page",
      "planning",
    );
    expect(screen.getByTestId("planning-page").className).toContain("v2-fullscreen-page");
    expect(screen.getByTestId("planning-now-next-strip")).toHaveTextContent("now-next:1");
    expect(await screen.findByTestId("planning-schedule-timeline")).toBeInTheDocument();
    expect(await screen.findByTestId("planning-focus-timer")).toHaveTextContent("focus:1");
  });

  it("pins transferred V1 planning surfaces to the dark theme variant", async () => {
    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    const page = screen.getByTestId("planning-page");
    expect(page).toHaveAttribute("data-planning-theme", "v1-dark");
    expect(page.className).toContain("dark");

    const darkScope = screen.getByTestId("planning-v1-dark-scope");
    expect(darkScope).toHaveAttribute("data-planning-v1-theme", "dark");
    expect(darkScope.className).toContain("dark");

    expect(
      (await screen.findByTestId("planning-schedule-timeline")).closest(
        '[data-planning-v1-theme="dark"]',
      ),
    ).toBe(darkScope);
    expect(
      (await screen.findByTestId("planning-focus-timer")).closest(
        '[data-planning-v1-theme="dark"]',
      ),
    ).toBe(darkScope);
  });

  it("keeps an empty schedule usable", () => {
    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    expect(screen.getByText("No events yet")).toBeInTheDocument();
    expect(screen.getByTestId("planning-schedule-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("planning-focus-timer")).toBeInTheDocument();
  });

  it("renders an accessible internal mode rail", () => {
    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    expect(screen.getByTestId("planning-mode-rail")).toBeInTheDocument();
    expect(screen.getByTestId("planning-mode-today")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("planning-mode-focus"));

    expect(screen.getByTestId("planning-mode-focus")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("planning-mode-today")).toHaveAttribute("aria-pressed", "false");
  });

  it("routes the primary Planning action to the schedule mode on an empty day", () => {
    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    fireEvent.click(screen.getByTestId("planning-primary-action"));

    expect(screen.getByTestId("planning-mode-schedule")).toHaveAttribute("aria-pressed", "true");
  });

  it("renders a day pulse and contextual cross-tab bridge actions", () => {
    useUserDataStore.setState({
      scheduleEvents: [manualEvent()],
      habits: [pendingHabit()],
      moods: [],
      focusSessions: [
        {
          id: "session-1",
          duration: 25,
          completedAt: Date.now(),
          date: getToday(),
          status: "completed",
        },
      ],
    });

    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    expect(screen.getByTestId("planning-day-pulse")).toHaveTextContent("Day pulse");
    expect(screen.getByTestId("planning-pulse-habits")).toHaveTextContent("1 left");
    expect(screen.getByTestId("planning-pulse-mood")).toHaveTextContent("Open");

    expect(screen.getByTestId("planning-bridge-actions")).toHaveTextContent("Helpful next moves");
    expect(screen.getByTestId("planning-bridge-action-log_mood")).toHaveAttribute("href", expect.stringContaining("/orb"));
    expect(screen.getByTestId("planning-bridge-action-complete_habits")).toHaveAttribute("href", expect.stringContaining("/habits"));
    expect(screen.getByTestId("planning-bridge-action-reflect_in_diary")).toHaveAttribute("href", expect.stringContaining("/diary"));
  });

  it("keeps bridge actions quiet when mood and habits are already handled", () => {
    useUserDataStore.setState({
      scheduleEvents: [manualEvent()],
      habits: [completedHabit()],
      moods: [moodEntry()],
      focusSessions: [],
    });

    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    expect(screen.getByTestId("planning-pulse-habits")).toHaveTextContent("0 left");
    expect(screen.getByTestId("planning-pulse-mood")).toHaveTextContent("Logged");
    expect(screen.queryByTestId("planning-bridge-action-log_mood")).not.toBeInTheDocument();
    expect(screen.queryByTestId("planning-bridge-action-complete_habits")).not.toBeInTheDocument();
  });
  it("adds and deletes manual events through the schedule store and settings sync", async () => {
    useUserDataStore.setState({ scheduleEvents: [manualEvent()] });

    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "add manual event" }));
    await waitFor(() => expect(syncSetting).toHaveBeenCalledWith(
      "zenflow-schedule-events",
      expect.arrayContaining([expect.objectContaining({ title: "Plan review" })]),
    ));
    expect(triggerSync).toHaveBeenCalled();
    expect(useUserDataStore.getState().scheduleEvents).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "delete manual event" }));
    await waitFor(() => expect(useUserDataStore.getState().scheduleEvents).toHaveLength(1));
    expect(useUserDataStore.getState().scheduleEvents[0]?.title).toBe("Plan review");
  });

  it("does not delete habit/google/task events directly from Planning", () => {
    useUserDataStore.setState({ scheduleEvents: [manualEvent(), habitEvent()] });

    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "delete habit event" }));

    expect(useUserDataStore.getState().scheduleEvents).toEqual([manualEvent(), habitEvent()]);
    expect(syncSetting).not.toHaveBeenCalled();
  });

  it("passes completed focus sessions and minute updates through the V1 focus path", () => {
    const onCompleteFocusSession = vi.fn();
    render(<PlanningPage onCompleteFocusSession={onCompleteFocusSession} />);

    fireEvent.click(screen.getByRole("button", { name: "minute update" }));
    expect(useUIStore.getState().currentFocusMinutes).toBe(7);

    fireEvent.click(screen.getByRole("button", { name: "complete focus" }));
    expect(onCompleteFocusSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "focus-1", duration: 25, status: "completed" }),
    );
  });

  it("renders a non-blocking review lane that can return to focus mode", () => {
    useUserDataStore.setState({
      focusSessions: [
        {
          id: "session-1",
          duration: 15,
          completedAt: Date.now(),
          date: getToday(),
          label: "Deep work",
          reflection: 4,
          status: "completed",
        },
      ],
    });

    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    expect(screen.getByTestId("planning-review-lane")).toHaveTextContent("15 min today");
    fireEvent.click(screen.getByTestId("planning-review-focus-action"));

    expect(screen.getByTestId("planning-mode-focus")).toHaveAttribute("aria-pressed", "true");
  });
});
