import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NavV2Orchestrator } from "../NavV2Orchestrator";
import { readFileSync } from "node:fs";
import { useUIStore, useUserDataStore } from "@/stores";

const {
  mockDeviceTierState,
  mockIsFeatureVisible,
  mockRegisterModalCloseCallback,
  mockScheduleIdle,
  scheduledIdleCallbacks,
} = vi.hoisted(() => {
  const deviceTierState: {
    isCompactHeight: boolean;
    tier: "phone" | "tablet" | "laptop" | "desktop";
  } = {
    isCompactHeight: false,
    tier: "phone",
  };

  return {
    mockDeviceTierState: deviceTierState,
    mockIsFeatureVisible: vi.fn<(feature: string) => boolean>(),
    mockRegisterModalCloseCallback: vi.fn(() => () => undefined),
    mockScheduleIdle: vi.fn(
      (_callback: () => void) => ({ cancel: vi.fn() }),
    ),
    scheduledIdleCallbacks: [] as Array<() => void>,
  };
});

// --- Mocks ---

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Orb: "Orb",
      navV2Habits: "Habits",
      navV2Diary: "Diary",
      navV2Planning: "Planning",
      navV2Settings: "Settings",
      connectedRecordsHistory: "View history and undo",
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
    onOpenFriends,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    habit?: { id: string };
    initialInvite?: { code: string };
    username?: string;
    onOpenFriends?: () => void;
  }) =>
    open ? (
      <section aria-label="Friend challenges" role="dialog">
        <span>{username}</span>
        <span>{habit?.id}</span>
        <span>{initialInvite?.code}</span>
        <button type="button" onClick={onOpenFriends}>
          Open friends
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          Close challenge
        </button>
      </section>
    ) : null,
}));

vi.mock("@/components/FriendsPanel", () => ({
  FriendsPanel: ({
    onClose,
    onOpenChallenges,
    userName,
  }: {
    onClose: () => void;
    onOpenChallenges?: () => void;
    userName?: string;
  }) => (
    <section aria-label="Friends" role="dialog">
      <span>{userName}</span>
      <button type="button" onClick={onOpenChallenges}>
        Back to challenges
      </button>
      <button type="button" onClick={onClose}>
        Close friends
      </button>
    </section>
  ),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn(), selection: vi.fn() },
}));

vi.mock("@/hooks/useDeviceTier", () => ({
  useDeviceTier: () => mockDeviceTierState,
}));

vi.mock("@/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock("@/lib/androidBackHandler", () => ({
  publishAndroidBackNavigationState: vi.fn().mockResolvedValue(undefined),
  registerModalCloseCallback: mockRegisterModalCloseCallback,
}));

vi.mock("@/lib/scheduleIdle", () => ({
  scheduleIdle: mockScheduleIdle.mockImplementation((callback: () => void) => {
    scheduledIdleCallbacks.push(callback);
    return { cancel: vi.fn() };
  }),
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

vi.mock("@/features/automation/AutomationHistorySheet", () => ({
  AutomationHistorySheet: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open ? (
      <section role="dialog" aria-label="Connected-record history">
        <button type="button" onClick={onClose}>
          Close history
        </button>
      </section>
    ) : null,
}));

// Mock SidebarV2 + DrawerV2 so we assert their presence, not their internals
vi.mock("../SidebarV2", () => ({
  SidebarV2: ({
    collapsed,
    collapseLocked,
    forceVisible,
    onPageChange,
    onOpenConnectedHistory,
  }: {
    collapsed?: boolean;
    collapseLocked?: boolean;
    forceVisible?: boolean;
    onPageChange: (page: "habits" | "planning") => void;
    onOpenConnectedHistory?: () => void;
  }) => (
    <nav
      data-testid="sidebar-v2"
      data-collapsed={collapsed ? "true" : "false"}
      data-collapse-locked={collapseLocked ? "true" : "false"}
      data-force-visible={forceVisible ? "true" : "false"}
    >
      sidebar
      <button type="button" onClick={() => onPageChange("habits")}>
        Habits
      </button>
      <button type="button" onClick={() => onPageChange("planning")}>
        Planning
      </button>
      {onOpenConnectedHistory ? (
        <button type="button" onClick={onOpenConnectedHistory}>
          View history and undo
        </button>
      ) : null}
    </nav>
  ),
}));
vi.mock("../DrawerV2", () => ({
  DrawerV2: ({
    open,
    onClose,
    onPageChange,
    onOpenConnectedHistory,
  }: {
    open: boolean;
    onClose: () => void;
    onPageChange: (page: "habits" | "planning") => void;
    onOpenConnectedHistory?: () => void;
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
        {onOpenConnectedHistory ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenConnectedHistory();
            }}
          >
            View history and undo
          </button>
        ) : null}
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
    mockRegisterModalCloseCallback.mockClear();
    mockScheduleIdle.mockClear();
    scheduledIdleCallbacks.length = 0;
    mockIsFeatureVisible.mockReturnValue(true);
    mockDeviceTierState.tier = "phone";
    mockDeviceTierState.isCompactHeight = false;
    useUIStore.setState({
      featureToUnlock: null,
      showChallengeModal: false,
      showFriendsPanel: false,
      challengeInvite: undefined,
      challengeHabit: undefined,
    });
    useUserDataStore.setState({ userName: "Friend" });
  });

  it("registers primary Android Back below every overlay owner", async () => {
    window.history.replaceState({}, "", "/habits?nav=v2&navLayout=phone");

    render(<NavV2Orchestrator />);

    await waitFor(() => {
      expect(mockRegisterModalCloseCallback).toHaveBeenCalledWith(
        expect.any(Function),
        { layer: "navigation" },
      );
    });
  });

  it("shows one V2 progression dialog at a time and clears a closed challenge invitation", async () => {
    useUserDataStore.setState({ userName: "Avery" });
    useUIStore.setState({
      featureToUnlock: "challenges",
      showChallengeModal: true,
      challengeInvite: {
        code: "ZEN-FOCUS",
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

  it("links the Android Habits social hub between Challenges and Friends without a sixth tab", async () => {
    useUserDataStore.setState({ userName: "Avery" });
    useUIStore.setState({ showChallengeModal: true, showFriendsPanel: false });

    render(<NavV2Orchestrator />);

    const challenges = await screen.findByRole("dialog", { name: "Friend challenges" });
    expect(challenges).toHaveTextContent("Avery");

    fireEvent.click(screen.getByRole("button", { name: "Open friends" }));

    expect(screen.queryByRole("dialog", { name: "Friend challenges" })).not.toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "Friends" })).toHaveTextContent("Avery");

    fireEvent.click(screen.getByRole("button", { name: "Back to challenges" }));

    expect(screen.queryByRole("dialog", { name: "Friends" })).not.toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "Friend challenges" })).toBeInTheDocument();
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

  it("keeps connected history closed until the mobile navigation action is requested", () => {
    render(<NavV2Orchestrator />);

    expect(
      screen.queryByRole("dialog", { name: "Connected-record history" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("nav-v2-open-drawer"));
    fireEvent.click(screen.getByRole("button", { name: "View history and undo" }));

    expect(screen.queryByTestId("drawer-v2-open")).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Connected-record history" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close history" }));
    expect(
      screen.queryByRole("dialog", { name: "Connected-record history" })
    ).not.toBeInTheDocument();
  });

  it("opens the same connected-history owner from the desktop sidebar", () => {
    window.history.replaceState({}, "", "/?nav=v2&dev=true");
    render(<NavV2Orchestrator />);

    fireEvent.click(screen.getByRole("button", { name: "View history and undo" }));

    expect(
      screen.getByRole("dialog", { name: "Connected-record history" })
    ).toBeInTheDocument();
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

  it("uses the phone drawer for an Android medium-width compact-height window", () => {
    mockDeviceTierState.tier = "tablet";
    mockDeviceTierState.isCompactHeight = true;
    window.history.replaceState({}, "", "/planning?nav=v2&navLayout=phone");

    render(<NavV2Orchestrator />);

    const root = screen.getByTestId("nav-v2-orchestrator");
    expect(root).toHaveAttribute("data-nav-layout", "phone");
    expect(root).not.toHaveClass("md:ps-64");
    expect(root).not.toHaveClass("md:ps-[72px]");
    expect(screen.queryByTestId("sidebar-v2")).not.toBeInTheDocument();
    expect(screen.getByTestId("nav-v2-open-drawer")).toHaveClass("flex");
    expect(screen.getByTestId("nav-v2-open-drawer")).not.toHaveClass("md:hidden");
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

  it("gives the phone menu trigger dark-surface tokens on Planning", () => {
    window.history.replaceState({}, "", "/planning?nav=v2&navLayout=phone");

    render(<NavV2Orchestrator />);

    expect(screen.getByTestId("nav-v2-open-drawer")).toHaveClass("dark");
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

  it("opens the phone drawer before preloading the user-visible Settings destination", () => {
    const source = readFileSync("src/components/navigation-v2/NavV2Orchestrator.tsx", "utf8");
    const start = source.indexOf("const handleOpenDrawer = useCallback");
    const end = source.indexOf("const handlePrimaryPageChange", start);
    const body = source.slice(start, end);

    const openIndex = body.indexOf("openDrawer();");
    const settingsPreloadIndex = body.indexOf('preloadNavV2Route("settings");');

    expect(openIndex).toBeGreaterThan(-1);
    expect(settingsPreloadIndex).toBeGreaterThan(openIndex);
    expect(body).not.toContain("scheduleNavV2RoutePreload(activePage)");
    expect(body).not.toContain("preloadNavV2Route(page)");
  });

  it("keeps hidden route preloads behind the stable-startup quiet window", () => {
    render(<NavV2Orchestrator />);

    expect(mockScheduleIdle).toHaveBeenCalledTimes(1);
    expect(mockScheduleIdle).toHaveBeenNthCalledWith(1, expect.any(Function), 2_500, 4_000);

    act(() => scheduledIdleCallbacks.shift()?.());

    expect(mockScheduleIdle).toHaveBeenCalledTimes(2);
    expect(mockScheduleIdle).toHaveBeenNthCalledWith(2, expect.any(Function), 2_500, 750);
  });
});
