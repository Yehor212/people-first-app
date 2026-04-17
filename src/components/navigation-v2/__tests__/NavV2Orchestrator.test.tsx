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
  SidebarV2: () => <nav data-testid="sidebar-v2">sidebar</nav>,
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

  it("does NOT render MobileNavV2 bottom tabs (Phase 3-A.1 correction)", () => {
    render(<NavV2Orchestrator />);

    // MobileNavV2 mock throws if instantiated — absence proves removal
    expect(screen.queryByTestId("mobile-nav-v2")).not.toBeInTheDocument();
  });

  it("drawer trigger has 44×44 touch target + accessible label (WCAG 2.5.5 + 2.5.7)", () => {
    render(<NavV2Orchestrator />);
    const trigger = screen.getByTestId("nav-v2-open-drawer");

    // Tailwind h-11 w-11 = 44px
    expect(trigger.className).toMatch(/h-11/);
    expect(trigger.className).toMatch(/w-11/);

    // ARIA: drawer control semantics
    expect(trigger).toHaveAttribute("aria-label", "Open menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", "nav-v2-drawer");
  });

  it("drawer trigger is always positioned at top-left (not gesture-only)", () => {
    render(<NavV2Orchestrator />);
    const trigger = screen.getByTestId("nav-v2-open-drawer");

    // Fixed positioning top-left with safe-area top inset
    expect(trigger.className).toMatch(/fixed/);
    expect(trigger.className).toMatch(/start-3/);
    expect(trigger.className).toMatch(/safe-area-inset-top/);
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
});
