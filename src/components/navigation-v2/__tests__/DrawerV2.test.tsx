import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DrawerV2 } from "../DrawerV2";
import { useThemeStore } from "@/stores/themeStore";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Menu: "Menu",
      navV2CloseMenu: "Close menu",
      navV2Orb: "Orb",
      navV2Habits: "Habits",
      navV2Diary: "Diary",
      navV2Settings: "Settings",
      navV2PrimaryNav: "Primary navigation",
      navV2SecondaryNav: "Secondary navigation",
      switchToDark: "Switch to dark mode",
      switchToLight: "Switch to light mode",
      themeDark: "Dark",
      themeLight: "Light",
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
  MiniValenceOrb: () => <div data-testid="drawer-v2-mini-orb" />,
}));

describe("DrawerV2", () => {
  const baseProps = {
    open: true,
    activePage: "orb" as const,
    onClose: vi.fn(),
    onPageChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useThemeStore.setState({ theme: "paper", appliedTheme: "paper" });
    document.documentElement.removeAttribute("data-theme-swap");
    document.documentElement.removeAttribute("data-theme-swap-mode");
  });

  it("renders nothing when open=false", () => {
    render(<DrawerV2 {...baseProps} open={false} />);
    expect(screen.queryByTestId("drawer-v2")).not.toBeInTheDocument();
  });

  it("renders drawer dialog + backdrop when open=true", () => {
    render(<DrawerV2 {...baseProps} />);
    expect(screen.getByTestId("drawer-v2")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-v2-backdrop")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-v2")).toHaveAttribute("role", "dialog");
    expect(screen.getByTestId("drawer-v2")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("drawer-v2")).toHaveAttribute("id", "nav-v2-drawer");
    expect(screen.getByTestId("drawer-v2")).toHaveAttribute(
      "data-theme-region",
      "drawer-v2",
    );
    expect(screen.getAllByTestId("drawer-v2-mini-orb")).toHaveLength(2);
    expect(screen.getByTestId("drawer-v2-classic-portal-orb")).toContainElement(
      within(screen.getByTestId("drawer-v2-classic-portal-orb")).getByTestId(
        "drawer-v2-mini-orb",
      ),
    );
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<DrawerV2 {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("drawer-v2-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("makes the closing backdrop passive during the exit animation", () => {
    const { rerender } = render(<DrawerV2 {...baseProps} open={true} />);

    rerender(<DrawerV2 {...baseProps} open={false} />);

    const backdrop = screen.getByTestId("drawer-v2-backdrop");
    expect(backdrop.className).toContain("opacity-0");
    expect(backdrop.className).toContain("pointer-events-none");
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<DrawerV2 {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close menu"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders primary V2 destinations and marks the active page", () => {
    render(<DrawerV2 {...baseProps} activePage="diary" />);

    expect(screen.getByTestId("drawer-v2-primary-nav")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-v2-destination-orb")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-v2-destination-habits")).toBeInTheDocument();
    expect(screen.getByTestId("drawer-v2-destination-diary")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByTestId("drawer-v2-destination-diary")).toHaveAttribute(
      "data-active",
      "true"
    );
    expect(screen.getByTestId("drawer-v2-destination-orb")).toHaveAttribute(
      "data-active",
      "false"
    );
    expect(screen.getByTestId("drawer-v2-destination-settings")).toBeInTheDocument();
  });

  it("renders the reverse portal in the primary navigation area", () => {
    render(<DrawerV2 {...baseProps} />);

    const portal = screen.getByTestId("drawer-v2-classic-portal");
    expect(screen.getByTestId("drawer-v2-primary-nav")).toContainElement(portal);
    expect(portal).toHaveAttribute("aria-label", "Return to classic ZenFlow");
    expect(portal).toHaveAttribute("href", "/?navLayout=phone&dev=true");
  });

  it("uses the quiet command deck without jumpy press-stable motion", () => {
    render(<DrawerV2 {...baseProps} activePage="orb" />);

    expect(screen.getByTestId("drawer-v2-navigation-deck")).toBeInTheDocument();
    [
      "drawer-v2-destination-orb",
      "drawer-v2-destination-habits",
      "drawer-v2-destination-diary",
      "drawer-v2-destination-settings",
    ].forEach((testId) => {
      expect(screen.getByTestId(testId).className).not.toContain("press-stable");
    });
  });

  it("keeps Settings pinned in the bottom navigation area", () => {
    render(<DrawerV2 {...baseProps} activePage="settings" />);

    expect(screen.getByTestId("drawer-v2-bottom-nav")).toContainElement(
      screen.getByTestId("drawer-v2-destination-settings")
    );
    expect(screen.getByTestId("drawer-v2-destination-settings")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByTestId("drawer-v2-destination-settings")).toHaveAttribute(
      "data-active",
      "true"
    );
  });

  it("adds the desktop theme toggle to the mobile drawer bottom area", async () => {
    render(<DrawerV2 {...baseProps} />);

    const toggle = await screen.findByTestId("drawer-v2-theme-toggle");
    expect(screen.getByTestId("drawer-v2-bottom-nav")).toContainElement(toggle);
    expect(toggle).toHaveAttribute("aria-label", "Switch to dark mode");
    expect(toggle).toHaveClass("min-h-[44px]");

    fireEvent.click(toggle);

    expect(useThemeStore.getState().appliedTheme).toBe("ink");
  });

  it("uses semantic V2 theme tokens for the drawer shell", async () => {
    render(<DrawerV2 {...baseProps} />);

    const drawer = screen.getByTestId("drawer-v2");
    const settings = screen.getByTestId("drawer-v2-destination-settings");
    const themeToggle = await screen.findByTestId("drawer-v2-theme-toggle");

    expect(drawer.className).toContain("--nav-v2-drawer-start");
    expect(drawer.className).not.toContain("--cosmic-space");
    expect(settings.className).toContain("--nav-v2-item-surface");
    expect(themeToggle.className).toContain("--nav-v2-item-hover");
  });

  it("uses distinct non-orb visual roles for drawer destinations", () => {
    render(<DrawerV2 {...baseProps} activePage="habits" />);

    expect(screen.getByTestId("drawer-v2-destination-orb")).toHaveAttribute(
      "data-visual-role",
      "mind"
    );
    expect(screen.getByTestId("drawer-v2-destination-habits")).toHaveAttribute(
      "data-visual-role",
      "body"
    );
    expect(screen.getByTestId("drawer-v2-destination-diary")).toHaveAttribute(
      "data-visual-role",
      "diary"
    );
    expect(screen.getByTestId("drawer-v2-destination-settings")).toHaveAttribute(
      "data-visual-role",
      "settings"
    );
  });

  it("shows immediate destination feedback on touch down before route change", () => {
    const onPageChange = vi.fn();
    render(<DrawerV2 {...baseProps} onPageChange={onPageChange} />);

    const habitsDestination = screen.getByTestId("drawer-v2-destination-habits");
    expect(habitsDestination).toHaveAttribute("data-navigating", "false");

    fireEvent.pointerDown(habitsDestination, { pointerType: "touch" });

    expect(habitsDestination).toHaveAttribute("data-navigating", "true");
    expect(screen.getByTestId("drawer-v2-destination-habits-progress")).toBeInTheDocument();
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("navigates from the mobile drawer primary destinations", () => {
    const onPageChange = vi.fn();
    render(<DrawerV2 {...baseProps} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByTestId("drawer-v2-destination-habits"));

    expect(onPageChange).toHaveBeenCalledWith("habits");
  });

  it("does not render Search in the mobile drawer", () => {
    render(<DrawerV2 {...baseProps} />);

    expect(screen.queryByTestId("drawer-v2-action-command-palette")).not.toBeInTheDocument();
    expect(screen.queryByText("Search")).not.toBeInTheDocument();
  });

  it("closes on Escape key press", () => {
    const onClose = vi.fn();
    render(<DrawerV2 {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
