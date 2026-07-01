import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommandPalette from "../CommandPalette";
import { useAppStore } from "@/stores";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Orb: "Orb",
      navV2Habits: "Habits",
      navV2Diary: "Diary",
      navV2Planning: "Planning",
      navV2Settings: "Settings",
      navV2Search: "Search",
      navV2Theme: "Theme",
      mainNavigation: "Navigation",
      search: "Search",
      noResults: "No results found.",
      lightMode: "Light mode",
      darkMode: "Dark mode",
    },
    isRTL: false,
    language: "en",
  }),
}));

describe("CommandPalette V2 navigation", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.localStorage.clear();
    useAppStore.setState({ activeTab: "home" });
  });

  it("routes primary navigation through V2 pages instead of legacy app tabs", () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();

    render(<CommandPalette open onClose={onClose} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByText("Planning"));

    expect(onNavigate).toHaveBeenCalledWith("planning");
    expect(useAppStore.getState().activeTab).toBe("home");
    expect(onClose).toHaveBeenCalled();
  });
});
