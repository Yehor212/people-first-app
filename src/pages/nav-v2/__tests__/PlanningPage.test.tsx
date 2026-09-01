import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlanningPage } from "../planning/PlanningPage";
import { buildPlanningBridgeHref } from "../planning/PlanningBridgeActions";
import { ENTRY, type FocusSession, type Habit, type MoodEntry, type ScheduleEvent } from "@/types";
import { useUserDataStore } from "@/stores/userDataStore";
import { useUIStore } from "@/stores/uiStore";
import { formatDate, getToday } from "@/lib/utils";
import { persistManualScheduleEvents } from "@/features/automation";
import * as animationUtils from "@/lib/animationUtils";

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
      planningActionAddEvent: "Open schedule to add an event",
      planningActionStartFocus: "Open focus timer",
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
      planningPulseConflicts: "Overlaps",
      planningPulseMoodDone: "Logged",
      planningPulseMoodOpen: "Open",
      planningPulseHabitCount: "{count} left",
      planningPulseConflictCount: "{count} conflict",
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
    initialSelectedDate,
    onAddEvent,
    onDeleteEvent,
  }: {
    events: ScheduleEvent[];
    initialSelectedDate?: string;
    onAddEvent?: (event: Omit<ScheduleEvent, "id">) => void;
    onDeleteEvent?: (id: string) => void;
  }) => (
    <section data-testid="planning-schedule-timeline">
      <span data-testid="planning-schedule-count">{events.length}</span>
      <span data-testid="planning-schedule-initial-date">{initialSelectedDate ?? "today"}</span>
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

vi.mock("@/features/automation/automationTargetPersistence", () => ({
  persistManualScheduleEvents: vi.fn(
    async (update: (events: ScheduleEvent[]) => ScheduleEvent[], fallback: ScheduleEvent[]) => ({
      events: update(fallback),
      updatedAt: Date.now(),
      accountBoundaryGeneration: "boundary-a",
      syncOutboxPersisted: true,
    })
  ),
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

function getTomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatDate(date);
}

describe("PlanningPage", () => {
  it("finds the latest completed focus session without sorting the full session history", () => {
    const source = readFileSync("src/pages/nav-v2/planning/PlanningPage.tsx", "utf8");

    expect(source).toContain("getLatestCompletedFocusSession");
    expect(source).not.toContain(".sort((a, b) => b.completedAt - a.completedAt)");
  });
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/planning?nav=v2");
    useUserDataStore.setState({
      scheduleEvents: [],
      habits: [],
      focusSessions: [],
      isLoading: false,
      _setters: null,
    });
    useUIStore.setState({ currentFocusMinutes: undefined });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders only a truthful loading shell while user data is hydrating", () => {
    useUserDataStore.setState({
      scheduleEvents: [manualEvent()],
      habits: [pendingHabit()],
      focusSessions: [
        {
          id: "loading-session",
          duration: 25,
          completedAt: Date.now(),
          date: getToday(),
          status: "completed",
        },
      ],
      isLoading: true,
    });

    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    const page = screen.getByTestId("planning-page");
    expect(screen.getByRole("status")).toHaveTextContent("Preparing planning...");
    expect(page).toHaveTextContent("Preparing planning...");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("planning-empty-schedule")).not.toBeInTheDocument();
    expect(screen.queryByTestId("planning-day-pulse")).not.toBeInTheDocument();
    expect(screen.queryByTestId("planning-action-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("planning-schedule-timeline")).not.toBeInTheDocument();
    expect(screen.queryByTestId("planning-focus-timer")).not.toBeInTheDocument();
  });

  it("refreshes time-derived Planning guidance on a bounded minute clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T09:45:00"));
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    useUserDataStore.setState({
      scheduleEvents: [
        {
          ...manualEvent(),
          date: "2026-07-29",
          startHour: 10,
          startMinute: 0,
          endHour: 10,
          endMinute: 30,
        },
      ],
    });
    useUIStore.setState({
      focusEndTime: null,
      focusIsRunning: false,
      focusIsBreak: false,
      focusLabel: "",
    });

    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    expect(screen.getByTestId("planning-action-panel")).toHaveTextContent(
      "Prepare for what is next.",
    );
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);

    act(() => {
      vi.setSystemTime(new Date("2026-07-29T10:00:00"));
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByTestId("planning-action-panel")).toHaveTextContent(
      "Stay with the current event.",
    );
  });

  it("recomputes wall-clock guidance when hydration finishes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T09:45:00"));
    useUserDataStore.setState({
      scheduleEvents: [
        {
          ...manualEvent(),
          date: "2026-07-29",
          startHour: 10,
          startMinute: 0,
          endHour: 10,
          endMinute: 30,
        },
      ],
      isLoading: true,
    });
    useUIStore.setState({
      focusEndTime: null,
      focusIsRunning: false,
      focusIsBreak: false,
      focusLabel: "",
    });

    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Preparing planning...");

    vi.setSystemTime(new Date("2026-07-29T10:05:00"));
    act(() => {
      useUserDataStore.setState({ isLoading: false });
    });

    expect(screen.getByTestId("planning-action-panel")).toHaveTextContent(
      "Stay with the current event.",
    );
  });

  it("refreshes time-derived guidance on focus and visible resume and cleans up listeners", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T09:45:00"));
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const removeWindowListenerSpy = vi.spyOn(window, "removeEventListener");
    const removeDocumentListenerSpy = vi.spyOn(document, "removeEventListener");
    const visibilityStateSpy = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible");

    useUserDataStore.setState({
      scheduleEvents: [
        {
          ...manualEvent(),
          date: "2026-07-29",
          startHour: 10,
          startMinute: 0,
          endHour: 10,
          endMinute: 30,
        },
      ],
    });
    useUIStore.setState({
      focusEndTime: null,
      focusIsRunning: false,
      focusIsBreak: false,
      focusLabel: "",
    });

    const { unmount } = render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    vi.setSystemTime(new Date("2026-07-29T10:05:00"));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(screen.getByTestId("planning-action-panel")).toHaveTextContent(
      "Stay with the current event.",
    );

    vi.setSystemTime(new Date("2026-07-29T10:31:00"));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByTestId("planning-action-panel")).toHaveTextContent(
      "Use this open space for focus.",
    );

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(removeWindowListenerSpy).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(removeDocumentListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    visibilityStateSpy.mockRestore();
  });

  it("keeps the empty-schedule action fully readable at narrow widths", () => {
    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    const action = screen.getByTestId("planning-empty-schedule");
    const label = screen.getByText("No events yet");

    expect(action).toHaveClass("min-w-0", "whitespace-normal");
    expect(label).not.toHaveClass("truncate");
    expect(label).toHaveClass("min-w-0", "break-words");
    expect(label.className).toContain("[hyphens:manual]");
    expect(label.className).toContain("[overflow-wrap:normal]");
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

  it("lets the hero copy reflow under large text and custom spacing", () => {
    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toContain("min-w-0");
    expect(heading.className).toContain("break-words");
    expect(heading.className).toContain("[hyphens:manual]");
    expect(heading.className).toContain("[overflow-wrap:normal]");
    expect(heading.className).toContain("text-xl");
    expect(heading.className).toContain("min-[420px]:text-3xl");
    expect(heading.nextElementSibling?.className).toContain("[overflow-wrap:normal]");
  });

  it("preserves whole words across controlled Planning copy", () => {
    for (const file of [
      "src/pages/nav-v2/planning/PlanningPage.tsx",
      "src/pages/nav-v2/planning/PlanningDayPulse.tsx",
      "src/pages/nav-v2/planning/PlanningModeRail.tsx",
      "src/pages/nav-v2/planning/PlanningBridgeActions.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("[overflow-wrap:anywhere]");
    }
  });

  it("renders an accessible internal mode rail", () => {
    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    const modeRail = screen.getByTestId("planning-mode-rail");
    expect(modeRail).toBeInTheDocument();
    expect(modeRail.className).toContain("grid-cols-1");
    expect(modeRail.className).toContain("min-[520px]:grid-cols-2");
    const modeButtons = ["today", "schedule", "focus", "review"].map((mode) =>
      screen.getByTestId(`planning-mode-${mode}`),
    );
    expect(modeButtons[0]).toHaveAttribute("aria-pressed", "true");
    for (const button of modeButtons) {
      expect(button.className).toContain("min-h-[48px]");
      expect(button.className).toContain("min-w-0");
      expect(button.className).toContain("sm:shrink-0");
      expect(button.querySelector("span")?.className).toContain("min-w-0");
      expect(button.querySelector("span")?.className).toContain("[hyphens:manual]");
      expect(button.querySelector("span")?.className).toContain("[overflow-wrap:normal]");
    }

    fireEvent.click(screen.getByTestId("planning-mode-focus"));

    expect(screen.getByTestId("planning-mode-focus")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("planning-mode-today")).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the schedule heading clear of the fixed phone drawer trigger", () => {
    const source = readFileSync(
      "src/pages/nav-v2/planning/PlanningPage.tsx",
      "utf8",
    );

    expect(source).toContain(
      "ps-[calc(var(--v2-phone-drawer-size)+var(--v2-phone-drawer-inset)+0.75rem)]",
    );
    expect(source).toContain("md:px-1");
  });

  it("moves mode changes into the real workspace instead of only changing the chip", async () => {
    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    expect(screen.getByTestId("planning-schedule-section")).toHaveAttribute(
      "data-active-planning-mode",
      "false",
    );

    fireEvent.click(screen.getByTestId("planning-mode-focus"));
    await waitFor(() =>
      expect(screen.getByTestId("planning-focus-section")).toHaveAttribute(
        "data-active-planning-mode",
        "true",
      ),
    );
    expect(screen.getByTestId("planning-schedule-section")).toHaveAttribute(
      "data-active-planning-mode",
      "false",
    );

    fireEvent.click(screen.getByTestId("planning-mode-schedule"));
    await waitFor(() =>
      expect(screen.getByTestId("planning-schedule-section")).toHaveAttribute(
        "data-active-planning-mode",
        "true",
      ),
    );
    expect(screen.getByTestId("planning-focus-section")).toHaveAttribute(
      "data-active-planning-mode",
      "false",
    );
  });

  it("uses instant programmatic scrolling when motion is reduced", () => {
    vi.spyOn(animationUtils, "shouldAnimate").mockReturnValue(false);
    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);
    const focusSection = screen.getByTestId("planning-focus-section");
    const scrollIntoView = vi.fn();
    focusSection.scrollIntoView = scrollIntoView;

    fireEvent.click(screen.getByTestId("planning-mode-focus"));

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "center",
    });
  });

  it("routes the primary Planning action to the schedule mode on an empty day", () => {
    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    fireEvent.click(screen.getByTestId("planning-primary-action"));

    expect(screen.getByTestId("planning-mode-schedule")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("planning-schedule-section")).toHaveAttribute(
      "data-active-planning-mode",
      "true",
    );
  });

  it("routes a focus primary action to the actual focus workspace", async () => {
    useUIStore.setState({
      focusIsRunning: true,
      focusEndTime: Date.now() + 1_000_000,
      focusIsBreak: false,
      focusLabel: "Deep work",
    });

    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    fireEvent.click(screen.getByTestId("planning-primary-action"));

    await waitFor(() =>
      expect(screen.getByTestId("planning-focus-section")).toHaveAttribute(
        "data-active-planning-mode",
        "true",
      ),
    );
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

    const pulseGrid = screen.getByTestId("planning-pulse-events").parentElement;
    const pulseLabel = screen.getByText("Events");
    const pulseValue = screen.getByTestId("planning-pulse-habits").querySelector("p");

    expect(pulseGrid).toHaveClass("grid-cols-1", "min-[520px]:grid-cols-2");
    expect(pulseLabel).not.toHaveClass("truncate");
    expect(pulseLabel).toHaveClass("min-w-0", "break-words");
    expect(pulseValue).not.toHaveClass("truncate");
    expect(pulseValue?.className).toContain("[hyphens:manual]");
    expect(pulseValue?.className).toContain("[overflow-wrap:normal]");

    expect(screen.getByTestId("planning-bridge-actions")).toHaveTextContent("Helpful next moves");
    expect(screen.getByTestId("planning-bridge-action-log_mood")).toHaveAttribute("href", expect.stringContaining("/orb"));
    expect(screen.getByTestId("planning-bridge-action-complete_habits")).toHaveAttribute("href", expect.stringContaining("/habits"));
    expect(screen.getByTestId("planning-bridge-action-reflect_in_diary")).toHaveAttribute("href", expect.stringContaining("/diary"));

    const bridgeLabel = screen.getByText("Log mood");
    expect(bridgeLabel).not.toHaveClass("truncate");
    expect(bridgeLabel).toHaveClass("break-words");
    expect(bridgeLabel.className).toContain("[hyphens:manual]");
    expect(bridgeLabel.className).toContain("[overflow-wrap:normal]");
  });

  it("surfaces schedule conflicts in the day pulse", () => {
    useUserDataStore.setState({
      scheduleEvents: [
        manualEvent(),
        {
          ...manualEvent(),
          id: "manual-2",
          title: "Overlap",
          startHour: 10,
          startMinute: 15,
          endHour: 10,
          endMinute: 45,
        },
      ],
    });

    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    expect(screen.getByTestId("planning-pulse-conflicts")).toHaveTextContent("Overlaps");
    expect(screen.getByTestId("planning-pulse-conflicts")).toHaveTextContent("1 conflict");
  });

  it("keeps the plan-tomorrow bridge anchored to tomorrow's Planning date", () => {
    const href = buildPlanningBridgeHref({ kind: "plan_tomorrow", targetPage: "planning" });

    expect(href).toContain("/planning");
    expect(href).toContain("nav=v2");
    expect(href).toContain("planningDate=tomorrow");
  });

  it("opens Planning on tomorrow when the bridge date is requested", async () => {
    window.history.pushState({}, "", "/planning?nav=v2&planningDate=tomorrow");

    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    expect(await screen.findByTestId("planning-schedule-initial-date")).toHaveTextContent(
      getTomorrow(),
    );
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
  it("publishes manual events only after the atomic schedule commit", async () => {
    useUserDataStore.setState({ scheduleEvents: [manualEvent()] });

    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "add manual event" }));
    await waitFor(() => expect(persistManualScheduleEvents).toHaveBeenCalled());
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
    expect(persistManualScheduleEvents).not.toHaveBeenCalled();
  });

  it("passes completed focus sessions and minute updates through the V1 focus path", () => {
    const onCompleteFocusSession = vi.fn();
    render(<PlanningPage onCompleteFocusSession={onCompleteFocusSession} />);

    fireEvent.click(screen.getByRole("button", { name: "minute update" }));
    expect(useUIStore.getState().currentFocusMinutes).toBe(7);

    fireEvent.click(screen.getByRole("button", { name: "complete focus" }));
    expect(onCompleteFocusSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "focus-1", duration: 25, status: "completed" }),
      undefined,
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
