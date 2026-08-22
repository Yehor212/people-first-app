import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NavV2Orchestrator } from "../NavV2Orchestrator";
import { readFileSync } from "node:fs";
import { useUIStore, useUserDataStore } from "@/stores";

const { mockIsFeatureVisible } = vi.hoisted(() => ({
  mockIsFeatureVisible: vi.fn<(feature: string) => boolean>(),
}));

// --- Mocks ---

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Orb: "Orb",
      navV2Habits: "Habits",
      navV2Diary: "Diary",
      navV2Planning: "Planning",
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

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({ isFeatureVisible: mockIsFeatureVisible }),
}));

vi.mock("@/components/FeatureUnlock", () => ({
  FeatureUnlock: ({ feature, onClose }: { feature: string; onClose: () => void }) => (
    <section aria-label="Feature unlocked" role="dialog">
      <span>{feature}</span>
      <button type="button" onClick={onClose}>
        Dismiss unlock
      </button>
    </section>
  ),
}));

vi.mock("@/components/ChallengeModal", () => ({
  ChallengeModal: ({
    open,
    onOpenChange,
    habit,
    initialInvite,
    username,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    habit?: { id: string };
    initialInvite?: { code: string };
    username?: string;
  }) =>
    open ? (
      <section aria-label="Friend challenges" role="dialog">
        <span>{username}</span>
        <span>{habit?.id}</span>
        <span>{initialInvite?.code}</span>
        <button type="button" onClick={() => onOpenChange(false)}>
          Close challenge
        </button>
      </section>
    ) : null,
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
  publishAndroidBackNavigationState: vi.fn().mockResolvedValue(undefined),
  registerModalCloseCallback: () => () => undefined,
}));

vi.mock("@/lib/motion/morph", () => ({
  morph: vi.fn(async (_name: string, fn: () => void | Promise<void>) => {
    await fn();
  }),
}));

import { morph } from "@/lib/motion/morph";

vi.mock("../V2FocusMiniPlayer", () => ({
  V2FocusMiniPlayer: () => null,
}));
vi.mock("../V2MindfulMomentLayer", () => ({
  V2MindfulMomentLayer: () => null,
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
vi.mock("@/pages/nav-v2/planning/PlanningPage", () => ({
  PlanningPage: () => <div data-testid="planning-page">planning</div>,
}));
vi.mock("@/pages/nav-v2/SettingsPage", () => ({
  SettingsPage: () => <div data-testid="settings-page">settings</div>,
}));

// Mock SidebarV2 + DrawerV2 so we assert their presence, not their internals
vi.mock("../SidebarV2", () => ({
  SidebarV2: ({
    collapsed,
    forceVisible,
    onPageChange,
  }: {
    collapsed?: boolean;
    forceVisible?: boolean;
    onPageChange: (page: "habits" | "planning") => void;
  }) => (
    <nav
      data-testid="sidebar-v2"
      data-collapsed={collapsed ? "true" : "false"}
      data-force-visible={forceVisible ? "true" : "false"}
    >
      sidebar
      <button type="button" onClick={() => onPageChange("habits")}>
        Habits
      </button>
      <button type="button" onClick={() => onPageChange("planning")}>
        Planning
      </button>
    </nav>
  ),
}));
vi.mock("../DrawerV2", () => ({
  DrawerV2: ({
    open,
    onClose,
    onPageChange,
  }: {
    open: boolean;
    onClose: () => void;
    onPageChange: (page: "habits" | "planning") => void;
  }) =>
    open ? (
      <div id="nav-v2-drawer" data-testid="drawer-v2-open">
        drawer open
        <button type="button" onClick={onClose} autoFocus>
          Close menu
        </button>
        <button type="button" onClick={() => onPageChange("habits")}>
          Habits
        </button>
        <button type="button" onClick={() => onPageChange("planning")}>
          Planning
        </button>
      </div>
    ) : null,
}));

vi.mock("../V2FocusMiniPlayer", () => ({
  V2FocusMiniPlayer: () => null,
}));
vi.mock("../V2MindfulMomentLayer", () => ({
  V2MindfulMomentLayer: () => null,
}));

// Critical: we want to prove MobileNavV2 is NEVER rendered.
// Fail loudly if the orchestrator accidentally imports it again.
vi.mock("../MobileNavV2", () => ({
  MobileNavV2: () => {
    throw new Error("MobileNavV2 must NOT be rendered — Phase 3-A.1 removed bottom tabs.");
  },
}));

describe("NavV2Orchestrator (desktop sidebar, phone drawer)", () => {
  beforeEach(() => {
    // Reset URL between tests so useNavigationV2 starts on /orb
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    vi.mocked(morph).mockClear();
    mockIsFeatureVisible.mockReturnValue(true);
    useUIStore.setState({
      featureToUnlock: null,
      showChallengeModal: false,
      challengeInvite: undefined,
      challengeHabit: undefined,
    });
    useUserDataStore.setState({ userName: "Friend" });
  });

  it("shows one V2 progression dialog at a time and clears a closed challenge invitation", async () => {
    useUserDataStore.setState({ userName: "Avery" });
    useUIStore.setState({
      featureToUnlock: "challenges",
      showChallengeModal: true,
      challengeInvite: {
        code: "ZEN-FOCUS",
        habitName: "Focus",
        habitIcon: "target",
        duration: 7,
      },
      challengeHabit: { id: "habit-focus" } as never,
    });

    render(<NavV2Orchestrator />);

    expect(screen.getByRole("dialog", { name: "Feature unlocked" })).toHaveTextContent(
      "challenges"
    );
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByRole("dialog", { name: "Friend challenges" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss unlock" }));

    expect(useUIStore.getState().featureToUnlock).toBeNull();
    const challenge = await screen.findByRole("dialog", { name: "Friend challenges" });
    expect(screen.queryByRole("dialog", { name: "Feature unlocked" })).not.toBeInTheDocument();
    expect(challenge).toHaveTextContent("Avery");
    expect(challenge).toHaveTextContent("habit-focus");
    expect(challenge).toHaveTextContent("ZEN-FOCUS");

    fireEvent.click(screen.getByRole("button", { name: "Close challenge" }));

    expect(screen.queryByRole("dialog", { name: "Friend challenges" })).not.toBeInTheDocument();
    expect(useUIStore.getState().challengeInvite).toBeUndefined();
    expect(useUIStore.getState().challengeHabit).toBeUndefined();
  });

  it("keeps V2 challenge progression hidden when challenges are disabled", () => {
    mockIsFeatureVisible.mockImplementation((feature) => feature !== "challenges");
    useUIStore.setState({ showChallengeModal: true });

    render(<NavV2Orchestrator />);

    expect(screen.queryByRole("dialog", { name: "Friend challenges" })).not.toBeInTheDocument();
  });

  it("does not mount the desktop sidebar on phone layout", () => {
    render(<NavV2Orchestrator />);

    // Phone layout must not pay the desktop/sidebar runtime cost. The drawer
    // still opens on demand, but hidden sidebar mini-orbs must not mount.
    expect(screen.queryByTestId("sidebar-v2")).not.toBeInTheDocument();

    // Drawer trigger visible on mobile — has `md:hidden` class but present in DOM
    const trigger = screen.getByTestId("nav-v2-open-drawer");
    expect(trigger).toBeInTheDocument();
    expect(trigger.className).toContain("md:hidden");
  });

  it("recognizes the GitHub Pages base path as a valid V2 route", () => {
    window.history.replaceState({}, "", "/people-first-app/orb?nav=v2&navLayout=phone&dev=true");

    render(<NavV2Orchestrator />);

    expect(screen.getByTestId("nav-v2-orchestrator")).toHaveAttribute("data-active-page", "orb");
    expect(screen.queryByText("Route not found")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-v2-open-drawer").className).toContain("md:hidden");
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

  it("skips full-page morph when a phone-width browser uses the compact web rail", async () => {
    window.history.replaceState({}, "", "/?nav=v2&dev=true");

    render(<NavV2Orchestrator />);

    fireEvent.click(screen.getByRole("button", { name: "Habits" }));

    const pending = screen.getByTestId("nav-v2-route-pending");
    expect(pending).toHaveTextContent("Habits");
    expect(pending).not.toHaveAttribute("aria-label");
    await waitFor(() =>
      expect(screen.getByTestId("nav-v2-orchestrator")).toHaveAttribute(
        "data-active-page",
        "habits"
      )
    );
    await waitFor(() =>
      expect(screen.queryByTestId("nav-v2-route-pending")).not.toBeInTheDocument()
    );
    expect(morph).not.toHaveBeenCalled();
  });

  it("navigates to the Planning page from the V2 shell", async () => {
    window.history.replaceState({}, "", "/?nav=v2&dev=true");

    render(<NavV2Orchestrator />);

    fireEvent.click(screen.getByRole("button", { name: "Planning" }));

    expect(screen.getByTestId("nav-v2-route-pending")).toHaveTextContent("Planning");
    await waitFor(() =>
      expect(screen.getByTestId("nav-v2-orchestrator")).toHaveAttribute(
        "data-active-page",
        "planning"
      )
    );
    expect(await screen.findByTestId("planning-page")).toBeInTheDocument();
  });

  it("skips full-page morph and defers route mount when phone drawer navigation changes page", async () => {
    render(<NavV2Orchestrator />);

    fireEvent.click(screen.getByTestId("nav-v2-open-drawer"));
    fireEvent.click(screen.getByRole("button", { name: "Habits" }));

    expect(screen.getByTestId("nav-v2-orchestrator")).toHaveAttribute("data-active-page", "orb");
    expect(screen.getByTestId("nav-v2-route-pending")).toHaveTextContent("Habits");
    expect(morph).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.getByTestId("nav-v2-orchestrator")).toHaveAttribute(
        "data-active-page",
        "habits"
      )
    );
    expect(screen.getByTestId("nav-v2-orchestrator")).toHaveAttribute("data-active-page", "habits");
    await waitFor(() =>
      expect(screen.queryByTestId("nav-v2-route-pending")).not.toBeInTheDocument()
    );
    expect(morph).not.toHaveBeenCalled();
  });

  it("does NOT render MobileNavV2 bottom tabs (Phase 3-A.1 correction)", () => {
    render(<NavV2Orchestrator />);

    // MobileNavV2 mock throws if instantiated — absence proves removal
    expect(screen.queryByTestId("mobile-nav-v2")).not.toBeInTheDocument();
  });

  it("drawer trigger has a top-left 48px Android-safe target and accessible label", () => {
    render(<NavV2Orchestrator />);
    const trigger = screen.getByTestId("nav-v2-open-drawer");

    // Fixed CSS-pixel geometry preserves the target when the root text size changes.
    expect(trigger.className).toContain("h-[var(--v2-phone-drawer-size)]");
    expect(trigger.className).toContain("w-[var(--v2-phone-drawer-size)]");
    expect(trigger.className).toMatch(/rounded-full/);

    // ARIA: drawer control semantics
    expect(trigger).toHaveAttribute("aria-label", "Open menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-controls", "nav-v2-drawer");
    expect(document.getElementById("nav-v2-drawer")).toBeInTheDocument();
  });

  it("restores keyboard focus to the phone menu trigger after the drawer closes", async () => {
    render(<NavV2Orchestrator />);
    const trigger = screen.getByTestId("nav-v2-open-drawer");

    trigger.focus();
    fireEvent.click(trigger);
    const close = screen.getByRole("button", { name: "Close menu" });
    expect(close).toHaveFocus();
    fireEvent.click(close);

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("keeps the menu glyph when Settings is the active phone page", () => {
    window.history.replaceState({}, "", "/settings?nav=v2&navLayout=phone");

    render(<NavV2Orchestrator />);

    const trigger = screen.getByTestId("nav-v2-open-drawer");
    expect(trigger.querySelector(".lucide-menu")).toBeInTheDocument();
    expect(trigger.querySelector(".lucide-chevron-left")).not.toBeInTheDocument();
  });

  it("drawer trigger is fixed at the safe logical start edge", () => {
    render(<NavV2Orchestrator />);
    const trigger = screen.getByTestId("nav-v2-open-drawer");

    // The trigger remains fixed while respecting notches in both LTR and RTL.
    expect(trigger.className).toMatch(/fixed/);
    expect(trigger.className).toContain(
      "start-[calc(var(--safe-inline-start)_+_var(--v2-phone-drawer-inset))]"
    );
    expect(trigger.className).not.toContain("start-3");
    expect(trigger.className).toContain(
      "top-[calc(var(--safe-top)+var(--v2-phone-drawer-inset))]"
    );
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

  it("uses a visible V2 page loading fallback instead of a blank route boundary", () => {
    const source = readFileSync("src/components/navigation-v2/NavV2Orchestrator.tsx", "utf8");

    expect(source).toContain("NavV2RouteFallback");
    expect(source).not.toContain("<Suspense fallback={null}>{pageNode}</Suspense>");
  });

  it("opens the phone drawer before scheduling route preloads", () => {
    const source = readFileSync("src/components/navigation-v2/NavV2Orchestrator.tsx", "utf8");
    const start = source.indexOf("const handleOpenDrawer = useCallback");
    const end = source.indexOf("const handlePrimaryPageChange", start);
    const body = source.slice(start, end);

    const openIndex = body.indexOf("openDrawer();");
    const settingsPreloadIndex = body.indexOf('preloadNavV2Route("settings");');
    const scheduleIndex = body.indexOf("scheduleNavV2RoutePreload(activePage)");

    expect(openIndex).toBeGreaterThan(-1);
    expect(settingsPreloadIndex).toBeGreaterThan(openIndex);
    expect(scheduleIndex).toBeGreaterThan(openIndex);
    expect(scheduleIndex).toBeGreaterThan(settingsPreloadIndex);
    expect(body).not.toContain("preloadNavV2Route(page)");
  });
});
