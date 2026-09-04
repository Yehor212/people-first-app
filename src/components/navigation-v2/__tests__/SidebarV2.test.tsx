import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SidebarV2 } from "../SidebarV2";

const languageMock = vi.hoisted(() => ({ isRTL: false }));
const backgroundMusicMock = vi.hoisted(() => ({
  enabled: false,
  state: "off",
  toggle: vi.fn(),
  retry: vi.fn(),
  handleMediaError: vi.fn(),
}));

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
      backgroundMusicTitle: "Evening music",
      backgroundMusicStateOff: "Off",
      backgroundMusicPlayAction: "Play evening music",
    },
    isRTL: languageMock.isRTL,
  }),
}));

vi.mock("../AppBackgroundMusicProvider", () => ({
  useAppBackgroundMusicControl: () => backgroundMusicMock,
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
      within(screen.getByTestId("sidebar-v2-brand-orb")).getByTestId("sidebar-v2-mini-orb")
    );
    expect(screen.getByRole("button", { name: "Orb" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Habits" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Diary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Planning" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-v2-classic-portal")).not.toBeInTheDocument();
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
      "page"
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

  it("gives sidebar destinations a modern pressable affordance contract", () => {
    render(<SidebarV2 {...defaultProps} activePage="settings" />);

    const settings = screen.getByRole("button", { name: "Settings" });
    const habits = screen.getByRole("button", { name: "Habits" });

    expect(settings).toHaveAttribute("data-nav-button", "sidebar");
    expect(settings.className).toContain("active:translate-y-[1px]");
    expect(settings.className).toContain("shadow-[");
    expect(habits).toHaveAttribute("data-nav-button", "sidebar");
    expect(habits.className).toContain("hover:-translate-y-0.5");
  });

  it("shows collapse toggle and calls onToggleCollapsed", () => {
    const onToggleCollapsed = vi.fn();
    render(<SidebarV2 {...defaultProps} onToggleCollapsed={onToggleCollapsed} />);
    const toggle = screen.getByTestId("sidebar-v2-collapse-toggle");
    expect(toggle).toHaveAttribute("aria-label", "Collapse sidebar");
    fireEvent.click(toggle);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("uses logical active rail and mirrors collapse chevrons in RTL", () => {
    languageMock.isRTL = true;
    render(<SidebarV2 {...defaultProps} activePage="settings" collapsed={false} />);

    const settings = screen.getByRole("button", { name: "Settings" });
    const rail = settings.querySelector("[aria-hidden='true']");
    expect(rail?.className).toContain("start-0");
    expect(rail?.className).not.toContain("left-0");
    expect(
      screen.getByTestId("sidebar-v2-collapse-toggle").querySelector("svg")?.className.baseVal
    ).toContain("lucide-chevrons-right");
    languageMock.isRTL = false;
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

  it("places the evening-music control above Settings in the footer", () => {
    render(<SidebarV2 {...defaultProps} />);

    const musicToggle = screen.getByTestId("background-music-toggle");
    const settings = screen.getByRole("button", { name: "Settings" });
    expect(musicToggle.compareDocumentPosition(settings)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(musicToggle).toHaveClass("min-h-[44px]");
  });

  it("keeps the collapsed music icon accessible without a visible tooltip", () => {
    render(<SidebarV2 {...defaultProps} collapsed />);

    const music = screen.getByTestId("background-music-toggle");
    expect(music).toHaveAccessibleName("Play evening music");
    expect(music).not.toHaveAttribute("title");
  });

  it("keeps fixed actions visible while destinations scroll in a short adaptive window", () => {
    render(<SidebarV2 {...defaultProps} />);

    const sidebar = screen.getByRole("navigation", { name: "Primary navigation" });
    const destinations = screen.getByTestId("sidebar-v2-destinations");
    const footer = screen.getByTestId("sidebar-v2-footer");

    expect(sidebar.className).toContain("overflow-y-hidden");
    expect(sidebar.className).toContain("overscroll-y-contain");
    expect(sidebar.className).toContain("overflow-x-hidden");
    expect(sidebar.className).toContain("zf-sidebar-adaptive-surface");
    expect(destinations.className).toContain("min-h-0");
    expect(destinations.className).toContain("flex-1");
    expect(destinations.className).toContain("overflow-y-auto");
    expect(footer.className).toContain("shrink-0");
    expect(footer).toContainElement(screen.getByRole("button", { name: "Settings" }));
    expect(footer).toContainElement(screen.getByTestId("sidebar-v2-collapse-toggle"));
  });
});
