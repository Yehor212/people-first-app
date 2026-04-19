/**
 * HabitMindMapZone — lazy boundary + Suspense fallback contract.
 */
import { render, cleanup, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: { navV2HabitsMindMap: "Identity map" },
    language: "en",
  }),
}));

vi.mock("@/stores", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/stores");
  return {
    ...actual,
    useUserDataStore: (selector?: (s: unknown) => unknown) => {
      const state = { moods: [], canvasGoals: [] };
      return selector ? selector(state) : state;
    },
    useUIStore: (selector?: (s: unknown) => unknown) => {
      const state = { canvasMode: "idle" };
      return selector ? selector(state) : state;
    },
  };
});

vi.mock("@/components/canvas/MindMapCanvas", () => ({
  MindMapCanvas: () => <div data-testid="mock-mindmap-canvas">canvas</div>,
}));

import { HabitMindMapZone } from "../HabitMindMapZone";

describe("HabitMindMapZone", () => {
  afterEach(() => cleanup());

  it("renders the section landmark with aria-labelledby", () => {
    render(<HabitMindMapZone />);
    const section = screen.getByTestId("habits-mindmap-zone");
    expect(section.tagName).toBe("SECTION");
    expect(section.getAttribute("aria-labelledby")).toBe("habits-mindmap-heading");
  });

  it("renders the i18n heading copy", () => {
    render(<HabitMindMapZone />);
    expect(screen.getByRole("heading", { level: 2, name: "Identity map" })).toBeInTheDocument();
  });

  it("renders the lazy MindMapCanvas after the suspense boundary resolves", async () => {
    render(<HabitMindMapZone />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-mindmap-canvas")).toBeInTheDocument();
    });
  });

  it("does not throw when there are no moods (latestMood is null)", () => {
    expect(() => render(<HabitMindMapZone />)).not.toThrow();
  });
});
