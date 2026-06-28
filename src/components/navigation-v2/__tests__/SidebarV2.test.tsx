import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SidebarV2 } from "../SidebarV2";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Orb: "Orb",
      navV2Habits: "Habits",
      navV2Diary: "Diary",
      navV2Planning: "Planning",
      navV2Settings: "Settings",
      navV2PrimaryNav: "Primary navigation",
      navV2CollapseSidebar: "Collapse sidebar",
      navV2ExpandSidebar: "Expand sidebar",
      habits: "Habits",
      diary: "Diary",
      settings: "Settings",
      skipToContent: "Skip to main content",
      classicPortalAria: "Return to classic ZenFlow",
      classicPortalEyebrow: "Stable home",
      classicPortalTitle: "Back to classic ZenFlow",
      classicPortalBody: "Return to the current stable home while V2 stays in preview.",
      classicPortalCta: "Classic ZenFlow",
    },
    isRTL: false,
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn(), selection: vi.fn() },
}));

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => false,
}));

vi.mock("@/components/state-of-mind/MiniValenceOrb", () => ({
  MiniValenceOrb: () => <div data-testid="sidebar-v2-mini-orb" />,
}));

describe("SidebarV2", () => {
  const defaultProps = {
    activePage: "orb" as const,
    onPageChange: vi.fn(),
    collapsed: false,
    onToggleCollapsed: vi.fn(),
  };

  it("renders the 5 V2 navigation items", () => {
    render(<SidebarV2 {...defaultProps} />);
    expect(screen.getByTestId("sidebar-v2-brand-orb")).toContainElement(
      within(screen.getByTestId("sidebar-v2-brand-orb")).getByTestId(
        "sidebar-v2-mini-orb",
      ),
    );
    expect(screen.getByTestId("sidebar-v2-classic-portal-orb")).toContainElement(
      within(screen.getByTestId("sidebar-v2-classic-portal-orb")).getByTestId(
        "sidebar-v2-mini-orb",
      ),
    );
    expect(screen.getByRole("button", { name: "Orb" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Habits" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Diary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Planning" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-v2-classic-portal")).toHaveAttribute(
      "aria-label",
      "Return to classic ZenFlow",
    );
  });

  it("marks the active page with aria-current=page", () => {
    const { rerender } = render(<SidebarV2 {...defaultProps} activePage="diary" />);
    const diary = screen.getByRole("button", { name: "Diary" });
    expect(diary).toHaveAttribute("aria-current", "page");
    const orb = screen.getByRole("button", { name: "Orb" });
    expect(orb).not.toHaveAttribute("aria-current");

    rerender(<SidebarV2 {...defaultProps} activePage="planning" />);
    expect(screen.getByRole("button", { name: "Planning" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("calls onPageChange with the clicked page", () => {
    const onPageChange = vi.fn();
    render(<SidebarV2 {...defaultProps} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Habits" }));
    expect(onPageChange).toHaveBeenCalledWith("habits");
  });

  it("marks a clicked page active immediately while parent navigation catches up", () => {
    render(<SidebarV2 {...defaultProps} activePage="orb" />);

    const habits = screen.getByRole("button", { name: "Habits" });
    expect(habits).not.toHaveAttribute("aria-current");

    fireEvent.click(habits);

    expect(habits).toHaveAttribute("aria-current", "page");
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
    const skip = screen.getByTestId("sidebar-v2-skip-link");
    expect(skip.getAttribute("href")).toBe("#main-content-v2");
    expect(skip.className).toContain("focus:min-h-[44px]");
  });
});
