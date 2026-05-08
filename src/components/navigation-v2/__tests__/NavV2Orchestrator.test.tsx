import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavV2Orchestrator } from "../NavV2Orchestrator";

// --- Mocks ---

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Orb: "Orb",
      navV2Habits: "Habits",
      navV2Diary: "Diary",
      navV2Settings: "Settings",
      navV2OpenMenu: "Open menu",
      navV2CloseMenu: "Close menu",
      navV2Menu: "Menu",
      navV2PrimaryNav: "Primary navigation",
      navV2Search: "Search",
      navV2Theme: "Theme",
      navV2Archive: "Archive",
      navV2Account: "Account",
      habits: "Habits",
      diary: "Diary",
      settings: "Settings",
      somLogFeeling: "Log how you feel",
      goodMorning: "Good morning",
      goodAfternoon: "Good afternoon",
      goodEvening: "Good evening",
      pageNotFound: "Page not found",
      notFoundKicker: "Route not found",
      notFoundBody: "This link is outdated or this screen no longer exists.",
      notFoundRequestedPath: "Requested path",
      notFoundBack: "Back",
      notFoundHint: "Use Home to return to your ZenFlow space.",
      goHome: "Go Home",
    },
    isRTL: false,
    language: "en",
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn(), selection: vi.fn() },
}));

vi.mock("@/hooks/useDeviceTier", () => ({
  useDeviceTier: () => ({ tier: "phone" }),
}));

vi.mock("@/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("@/lib/androidBackHandler", () => ({
  registerModalCloseCallback: () => () => undefined,
}));

// Mock page shells as lightweight markers
vi.mock("@/pages/nav-v2/OrbPage", () => ({
  OrbPage: () => <div data-testid="orb-page">orb</div>,
}));
vi.mock("@/pages/nav-v2/HabitsPage", () => ({
  HabitsPage: () => <div data-testid="habits-page">habits</div>,
}));
vi.mock("@/pages/nav-v2/DiaryPage", () => ({
  DiaryPage: () => <div data-testid="diary-page">diary</div>,
}));
vi.mock("@/pages/nav-v2/SettingsPage", () => ({
  SettingsPage: () => <div data-testid="settings-page">settings</div>,
}));

// Mock SidebarV2 + DrawerV2 so we assert their presence, not their internals
vi.mock("../SidebarV2", () => ({
  SidebarV2: ({
    collapsed,
    forceVisible,
  }: {
    collapsed?: boolean;
    forceVisible?: boolean;
  }) => (
    <nav
      data-testid="sidebar-v2"
      data-collapsed={collapsed ? "true" : "false"}
      data-force-visible={forceVisible ? "true" : "false"}
    >
      sidebar
    </nav>
  ),
}));
vi.mock("../DrawerV2", () => ({
  DrawerV2: ({ open }: { open: boolean }) =>
    open ? <div data-testid="drawer-v2-open">drawer open</div> : null,
}));

// Critical: we want to prove MobileNavV2 is NEVER rendered.
// Fail loudly if the orchestrator accidentally imports it again.
vi.mock("../MobileNavV2", () => ({
  MobileNavV2: () => {
    throw new Error(
      "MobileNavV2 must NOT be rendered — Phase 3-A.1 removed bottom tabs.",
    );
  },
}));

describe("NavV2Orchestrator (Phase 3-A.1 sidebar-only)", () => {
  beforeEach(() => {
    // Reset URL between tests so useNavigationV2 starts on /orb
    window.history.replaceState({}, "", "/");
  });

  it("renders the sidebar on desktop and the drawer trigger on mobile", () => {
    render(<NavV2Orchestrator />);

    // Sidebar always rendered (CSS hides it on mobile)
    expect(screen.getByTestId("sidebar-v2")).toBeInTheDocument();

    // Drawer trigger visible on mobile — has `md:hidden` class but present in DOM
    const trigger = screen.getByTestId("nav-v2-open-drawer");
    expect(trigger).toBeInTheDocument();
    expect(trigger.className).toContain("md:hidden");
  });

  it("uses web navigation for the dev-only V2 preview even on a phone-width browser", () => {
    window.history.replaceState({}, "", "/?nav=v2&dev=true");

    render(<NavV2Orchestrator />);

    const root = screen.getByTestId("nav-v2-orchestrator");
    expect(root).toHaveAttribute("data-nav-layout", "web");
    expect(root).toHaveAttribute("data-nav-rail", "compact");
    expect(screen.getByTestId("sidebar-v2")).toHaveAttribute("data-force-visible", "true");
    expect(screen.getByTestId("sidebar-v2")).toHaveAttribute("data-collapsed", "true");

    const trigger = screen.getByTestId("nav-v2-open-drawer");
    expect(trigger.className).toContain("hidden");
    expect(trigger.className).not.toContain("md:hidden");
  });

  it("does NOT render MobileNavV2 bottom tabs (Phase 3-A.1 correction)", () => {
    render(<NavV2Orchestrator />);

    // MobileNavV2 mock throws if instantiated — absence proves removal
    expect(screen.queryByTestId("mobile-nav-v2")).not.toBeInTheDocument();
  });

  it("drawer trigger has a top-left 48px menu button + accessible label (WCAG 2.5.5 + 2.5.7)", () => {
    render(<NavV2Orchestrator />);
    const trigger = screen.getByTestId("nav-v2-open-drawer");

    // Tailwind h-12/w-12 = 48px, preserving a full phone touch target.
    expect(trigger.className).toMatch(/h-12/);
    expect(trigger.className).toMatch(/w-12/);
    expect(trigger.className).toMatch(/rounded-full/);

    // ARIA: drawer control semantics
    expect(trigger).toHaveAttribute("aria-label", "Open menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", "nav-v2-drawer");
  });

  it("drawer trigger is fixed in the safe top-left corner and does not reserve content width", () => {
    render(<NavV2Orchestrator />);
    const trigger = screen.getByTestId("nav-v2-open-drawer");

    // Fixed edge positioning keeps page headers/content full-width.
    expect(trigger.className).toMatch(/fixed/);
    expect(trigger.className).toContain("start-4");
    expect(trigger.className).toContain("top-[calc(env(safe-area-inset-top)+0.75rem)]");
    expect(trigger.className).not.toContain("top-1/2");
    expect(trigger.className).not.toContain("rounded-e-full");
  });

  it("renders the OrbPage by default (activePage='orb')", () => {
    render(<NavV2Orchestrator />);
    expect(screen.getByTestId("orb-page")).toBeInTheDocument();
    expect(screen.queryByTestId("habits-page")).not.toBeInTheDocument();
  });

  it("orchestrator container exposes data-active-page for debugging", () => {
    render(<NavV2Orchestrator />);
    const container = screen.getByTestId("nav-v2-orchestrator");
    expect(container).toHaveAttribute("data-active-page", "orb");
  });

  it("renders the Not Found page for an unknown V2 route", () => {
    window.history.replaceState({}, "", "/missing-v2-page?nav=v2");

    render(<NavV2Orchestrator />);

    expect(screen.getByTestId("not-found-page")).toBeInTheDocument();
    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(screen.getByText("/missing-v2-page")).toBeInTheDocument();
    expect(screen.queryByTestId("orb-page")).not.toBeInTheDocument();
  });
});
