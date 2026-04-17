import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SidebarV2 } from "../SidebarV2";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Orb: "Orb",
      navV2Habits: "Habits",
      navV2Diary: "Diary",
      navV2Settings: "Settings",
      navV2PrimaryNav: "Primary navigation",
      navV2CollapseSidebar: "Collapse sidebar",
      navV2ExpandSidebar: "Expand sidebar",
      habits: "Habits",
      diary: "Diary",
      settings: "Settings",
      skipToContent: "Skip to main content",
    },
    isRTL: false,
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn(), selection: vi.fn() },
}));

describe("SidebarV2", () => {
  const defaultProps = {
    activePage: "orb" as const,
    onPageChange: vi.fn(),
    collapsed: false,
    onToggleCollapsed: vi.fn(),
  };

  it("renders the 4 primary navigation items", () => {
    render(<SidebarV2 {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Orb" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Habits" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Diary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("marks the active page with aria-current=page", () => {
    render(<SidebarV2 {...defaultProps} activePage="diary" />);
    const diary = screen.getByRole("button", { name: "Diary" });
    expect(diary).toHaveAttribute("aria-current", "page");
    const orb = screen.getByRole("button", { name: "Orb" });
    expect(orb).not.toHaveAttribute("aria-current");
  });

  it("calls onPageChange with the clicked page", () => {
    const onPageChange = vi.fn();
    render(<SidebarV2 {...defaultProps} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Habits" }));
    expect(onPageChange).toHaveBeenCalledWith("habits");
  });

  it("shows collapse toggle and calls onToggleCollapsed", () => {
    const onToggleCollapsed = vi.fn();
    render(<SidebarV2 {...defaultProps} onToggleCollapsed={onToggleCollapsed} />);
    const toggle = screen.getByTestId("sidebar-v2-collapse-toggle");
    expect(toggle).toHaveAttribute("aria-label", "Collapse sidebar");
    fireEvent.click(toggle);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("hides labels in collapsed (rail) mode and swaps toggle aria-label", () => {
    render(<SidebarV2 {...defaultProps} collapsed={true} />);
    // Labels are still in DOM via aria-label, but not as visible text spans.
    // A cleaner check: the rail should set width to 72px via class.
    const sidebar = screen.getByTestId("sidebar-v2");
    expect(sidebar.className).toMatch(/w-\[72px\]/);
    const toggle = screen.getByTestId("sidebar-v2-collapse-toggle");
    expect(toggle).toHaveAttribute("aria-label", "Expand sidebar");
  });

  it("renders skip-to-content link anchored to #main-content-v2", () => {
    render(<SidebarV2 {...defaultProps} />);
    const skip = screen.getByText("Skip to main content");
    expect(skip.getAttribute("href")).toBe("#main-content-v2");
  });
});
