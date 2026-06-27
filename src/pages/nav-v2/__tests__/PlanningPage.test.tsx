import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlanningPage } from "../planning/PlanningPage";
import type { FocusSession, ScheduleEvent } from "@/types";
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

  it("keeps an empty schedule usable", () => {
    render(<PlanningPage onCompleteFocusSession={vi.fn()} />);

    expect(screen.getByText("No events yet")).toBeInTheDocument();
    expect(screen.getByTestId("planning-schedule-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("planning-focus-timer")).toBeInTheDocument();
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
});
