/**
 * HabitsPage — orchestrator tests for the Phase 3-C scroll-linked layout.
 */
import { render, cleanup, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// ---- Module mocks ----------------------------------------------------------

vi.mock("@/hooks/useShouldAnimate", () => ({ useShouldAnimate: () => true }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Habits: "Habits",
      navV2HabitsHero: "Today's habits",
      navV2HabitsGarden: "Your garden",
      navV2HabitsMindMap: "Identity map",
      navV2HabitsAddCue: "When • Where • Cue",
      navV2HabitsEmpty: "Plant your first seed",
      navV2HabitsStartSmall: "Start with 3 habits — small steps win",
      navV2HabitsRecovery: "One missed day doesn't reset progress",
      navV2HabitsCreate: "Create habit",
      navV2HabitsScrollToGarden: "View garden",
      navV2HabitsScrollToMindMap: "View identity map",
      cancel: "Cancel",
    },
    language: "en",
  }),
}));

let mockHabits: unknown[] = [];
const setHabitsSpy = vi.fn();

vi.mock("@/stores", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/stores");
  return {
    ...actual,
    useUserDataStore: (selector?: (s: unknown) => unknown) => {
      const state = {
        habits: mockHabits,
        focusSessions: [],
        moods: [],
        canvasGoals: [],
        setHabits: setHabitsSpy,
      };
      return selector ? selector(state) : state;
    },
    useUIStore: (selector?: (s: unknown) => unknown) => {
      const state = { canvasMode: "idle" };
      return selector ? selector(state) : state;
    },
  };
});

vi.mock("@/hooks/useInnerWorld", () => ({
  useInnerWorld: () => ({ world: { plants: [], creatures: [], season: "spring" }, isLoading: false }),
}));

vi.mock("@/components/GardenCanvas", () => ({
  GardenCanvas: () => <div data-testid="mock-garden-canvas" />,
}));

vi.mock("@/components/canvas/MindMapCanvas", () => ({
  MindMapCanvas: () => <div data-testid="mock-mindmap-canvas" />,
}));

vi.mock("@/components/compact-habit-card/CompactHabitCard", () => ({
  CompactHabitCard: ({ habit }: { habit: { id: string; name: string } }) => (
    <li data-testid={`mock-habit-card-${habit.id}`}>{habit.name}</li>
  ),
}));

vi.mock("vaul", () => ({
  Drawer: {
    Root: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
      open ? <div data-testid="vaul-root">{children}</div> : null,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Overlay: () => <div data-testid="vaul-overlay" />,
    Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Title: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  },
}));

vi.mock("@/components/habit-creation-form/HabitCreationForm", () => ({
  HabitCreationForm: () => <div data-testid="mock-habit-creation-form" />,
}));

vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));

import { HabitsPage } from "../HabitsPage";

describe("HabitsPage (Phase 3-C)", () => {
  beforeEach(() => {
    mockHabits = [];
    setHabitsSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the orchestrator main landmark with the page testid", () => {
    render(<HabitsPage />);
    expect(screen.getByTestId("habits-page")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("aria-labelledby", "habits-page-heading");
  });

  it("renders all three section landmarks (Hero / Garden / MindMap)", () => {
    render(<HabitsPage />);
    expect(screen.getByTestId("habits-hero-zone")).toBeInTheDocument();
    expect(screen.getByTestId("habits-garden-zone")).toBeInTheDocument();
    expect(screen.getByTestId("habits-mindmap-zone")).toBeInTheDocument();
  });

  it("exposes a table-of-contents nav with both anchor links", () => {
    render(<HabitsPage />);
    const toc = screen.getByTestId("habits-page-toc");
    expect(toc).toBeInTheDocument();
    expect(toc.querySelectorAll("a")).toHaveLength(2);
  });

  it("renders the empty state when no habits exist", () => {
    mockHabits = [];
    render(<HabitsPage />);
    expect(screen.getByTestId("habits-hero-empty")).toBeInTheDocument();
  });

  it("renders the habit list when habits are present", () => {
    mockHabits = [
      { id: "h1", name: "Hydrate", isArchived: false, entries: {}, habitType: "boolean" },
    ];
    render(<HabitsPage />);
    expect(screen.getByTestId("habits-hero-list")).toBeInTheDocument();
    expect(screen.getByTestId("mock-habit-card-h1")).toBeInTheDocument();
  });

  it("does not render the create sheet when closed", () => {
    render(<HabitsPage />);
    expect(screen.queryByTestId("vaul-root")).not.toBeInTheDocument();
  });

  it("focuses the page heading after mount", () => {
    render(<HabitsPage />);
    const heading = screen.getByRole("heading", { level: 1, name: "Habits" });
    expect(heading).toBe(document.activeElement);
  });
});
