import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/languages/en";
import { useUserDataStore } from "@/stores/userDataStore";
import { useUIStore } from "@/stores/uiStore";
import type { FocusSession, ScheduleEvent } from "@/types";
import type { UseFocusTimerOptions } from "@/types/focusTimerTypes";
import { PlanningPage } from "../planning/PlanningPage";

const harness = vi.hoisted(() => ({
  rtl: false,
  focus: null as (UseFocusTimerOptions & { isPrimaryCTA: boolean }) | null,
  scheduleMount: vi.fn(),
  persist: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: en, isRTL: harness.rtl, language: harness.rtl ? "ar" : "en" }),
}));

vi.mock("@/components/FocusTimer", () => ({
  FocusTimer: (props: UseFocusTimerOptions & { isPrimaryCTA: boolean }) => {
    harness.focus = props;
    return <div data-testid="focus-timer-probe" />;
  },
}));

vi.mock("@/components/ScheduleTimeline", () => ({
  ScheduleTimeline: () => {
    harness.scheduleMount();
    return <div data-testid="schedule-probe" />;
  },
}));

vi.mock("@/features/automation", () => ({ persistManualScheduleEvents: harness.persist }));

describe("Planning focus-only entry", () => {
  beforeEach(() => {
    harness.rtl = false;
    harness.focus = null;
    vi.clearAllMocks();
    useUserDataStore.setState({
      isLoading: false,
      habits: [],
      moods: [],
      focusSessions: [],
      scheduleEvents: [],
    });
    useUIStore.setState({ currentFocusMinutes: undefined });
    window.history.replaceState({}, "", "/planning?nav=v2");
  });

  afterEach(() => vi.restoreAllMocks());

  it("mounts only Focus and never mounts hidden Planning sections", async () => {
    render(<PlanningPage />);
    expect(await screen.findByTestId("focus-timer-probe")).toBeInTheDocument();
    expect(harness.focus?.isPrimaryCTA).toBe(true);
    expect(harness.scheduleMount).not.toHaveBeenCalled();
    for (const id of [
      "planning-day-pulse",
      "planning-action-panel",
      "planning-review-lane",
      "planning-mode-rail",
      "planning-schedule-section",
      "planning-bridge-actions",
      "planning-now-next-strip",
    ]) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: en.viewSchedule })).not.toBeInTheDocument();
  });

  it("does not start the hidden workspace clock or recompute on focus/resume", async () => {
    const interval = vi.spyOn(window, "setInterval");
    render(<PlanningPage />);
    await screen.findByTestId("focus-timer-probe");
    expect(interval.mock.calls.filter((call) => call[1] === 60_000)).toEqual([]);
    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(harness.scheduleMount).not.toHaveBeenCalled();
    expect(harness.persist).not.toHaveBeenCalled();
  });

  it("keeps existing records and obsolete date links inert", async () => {
    const event: ScheduleEvent = {
      id: "fixture-schedule",
      title: "Test event",
      date: "2026-09-10",
      startHour: 10,
      startMinute: 0,
      endHour: 11,
      endMinute: 0,
      color: "#22c55e",
      source: "manual",
      isEditable: true,
    };
    const session: FocusSession = {
      id: "fixture-focus",
      duration: 25,
      completedAt: 1,
      date: "2026-09-09",
      status: "completed",
    };
    useUserDataStore.setState({ scheduleEvents: [event], focusSessions: [session] });
    const before = useUserDataStore.getState();
    window.history.replaceState({}, "", "/planning?nav=v2&planningDate=2026-09-10");
    const { unmount } = render(<PlanningPage />);
    await screen.findByTestId("focus-timer-probe");
    expect(harness.focus?.sessions).toBe(before.focusSessions);
    unmount();
    const after = useUserDataStore.getState();
    for (const key of ["scheduleEvents", "focusSessions", "habits", "moods"] as const) {
      expect(after[key]).toBe(before[key]);
    }
    expect(harness.persist).not.toHaveBeenCalled();
  });

  it("passes exact completion boundary and minute updates through the existing Focus host", async () => {
    const complete = vi.fn().mockResolvedValue(undefined);
    render(<PlanningPage onCompleteFocusSession={complete} />);
    await screen.findByTestId("focus-timer-probe");
    const session: FocusSession = {
      id: "fixture-complete",
      duration: 15,
      completedAt: 1,
      date: "2026-09-09",
      status: "completed",
    };
    const boundary = { ownerUserId: null, accountBoundaryGeneration: "fixture-boundary" };
    await act(async () => harness.focus?.onCompleteSession(session, boundary));
    expect(complete).toHaveBeenCalledExactlyOnceWith(session, boundary);
    act(() => harness.focus?.onMinuteUpdate?.(7));
    expect(useUIStore.getState().currentFocusMinutes).toBe(7);
  });

  it("preserves completion rejection instead of claiming a successful save", async () => {
    const error = new Error("Fixture persistence unavailable");
    render(<PlanningPage onCompleteFocusSession={vi.fn().mockRejectedValue(error)} />);
    await screen.findByTestId("focus-timer-probe");
    const session: FocusSession = {
      id: "fixture-failure",
      duration: 15,
      completedAt: 1,
      date: "2026-09-09",
      status: "completed",
    };
    await expect(harness.focus?.onCompleteSession(session)).rejects.toBe(error);
  });

  it("keeps the truthful loading state and mounts Focus only after hydration", async () => {
    useUserDataStore.setState({ isLoading: true });
    render(<PlanningPage />);
    expect(screen.getByRole("status")).toHaveTextContent(en.navV2PlanningLoading);
    expect(screen.queryByTestId("focus-timer-probe")).not.toBeInTheDocument();
    act(() => useUserDataStore.setState({ isLoading: false }));
    await screen.findByTestId("focus-timer-probe");
    expect(harness.scheduleMount).not.toHaveBeenCalled();
  });

  it("retains an accessible RTL page, local dark scope and safe-area padding", async () => {
    harness.rtl = true;
    render(<PlanningPage />);
    await screen.findByTestId("focus-timer-probe");
    const main = screen.getByRole("main", { name: en.navV2Planning });
    expect(main).toHaveAttribute("dir", "rtl");
    expect(main).toHaveClass("dark", "v2-fullscreen-page");
    expect(main.className).toContain("var(--safe-top)");
    expect(main.className).toContain("var(--safe-bottom)");
    expect(screen.getByTestId("planning-focus-section")).toHaveAccessibleName(en.focus);
  });
});
