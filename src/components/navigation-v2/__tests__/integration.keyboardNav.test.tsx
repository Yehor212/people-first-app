/**
 * Phase 3-A.4c-ii-d-c Integration Test #2 — Ctrl+1..5 keyboard navigation.
 *
 * The orchestrator wires useKeyboardShortcuts → setActivePage for both
 * Ctrl+N and Cmd+N (Mac) because useKeyboardShortcuts treats metaKey as ctrlKey.
 * This test mounts the REAL hook + real keyboard plumbing, but mocks the pages
 * (as lightweight markers) + `useNavigationV2` isn't mocked — we let it run.
 *
 * Scope — what this test verifies:
 *  - Ctrl+1 activates Orb, Ctrl+2 Habits, Ctrl+3 Diary, Ctrl+4 Planning, Ctrl+5 Settings
 *  - metaKey equivalence (Cmd+1..5 on macOS) → same handlers
 *  - Shortcuts are SUPPRESSED when device tier is "phone" (useKeyboardShortcuts
 *    `enabled=false` branch)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { NavV2Orchestrator } from "../NavV2Orchestrator";

// Lightweight i18n mock
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
    },
    isRTL: false,
    language: "en",
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn(), selection: vi.fn() },
}));

vi.mock("@/lib/androidBackHandler", () => ({
  publishAndroidBackNavigationState: vi.fn().mockResolvedValue(undefined),
  registerModalCloseCallback: () => () => undefined,
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({ isFeatureVisible: () => false }),
}));

// morph() uses View Transitions API which jsdom doesn't support. Stub it to
// run the callback synchronously so setActivePage's state update lands.
vi.mock("@/lib/motion/morph", () => ({
  morph: (_name: string, run: () => void) => {
    run();
    return Promise.resolve();
  },
}));

vi.mock("../V2FocusMiniPlayer", () => ({
  V2FocusMiniPlayer: () => null,
}));
vi.mock("../V2MindfulMomentLayer", () => ({
  V2MindfulMomentLayer: () => null,
}));

// Page shells as markers so we can assert active-page transitions.
vi.mock("@/pages/nav-v2/OrbPage", () => ({
  OrbPage: () => <div data-testid="page-orb-marker">orb</div>,
}));
vi.mock("@/pages/nav-v2/HabitsPage", () => ({
  HabitsPage: () => <div data-testid="page-habits-marker">habits</div>,
}));
vi.mock("@/pages/nav-v2/DiaryPage", () => ({
  DiaryPage: () => <div data-testid="page-diary-marker">diary</div>,
}));
vi.mock("@/pages/nav-v2/planning/PlanningPage", () => ({
  PlanningPage: () => <div data-testid="page-planning-marker">planning</div>,
}));
vi.mock("@/pages/nav-v2/SettingsPage", () => ({
  SettingsPage: () => <div data-testid="page-settings-marker">settings</div>,
}));

vi.mock("../SidebarV2", () => ({
  SidebarV2: () => <nav data-testid="sidebar-v2">sidebar</nav>,
}));
vi.mock("../DrawerV2", () => ({
  DrawerV2: ({ open }: { open: boolean }) =>
    open ? <div data-testid="drawer-v2-open">drawer</div> : null,
}));

vi.mock("../V2FocusMiniPlayer", () => ({
  V2FocusMiniPlayer: () => null,
}));
vi.mock("../V2MindfulMomentLayer", () => ({
  V2MindfulMomentLayer: () => null,
}));

// Device-tier mock — controllable per test
const tierState = { tier: "desktop" as "phone" | "tablet" | "desktop" };
vi.mock("@/hooks/useDeviceTier", () => ({
  useDeviceTier: () => tierState,
}));

// Real hook + real shortcuts + real keyboard plumbing below — no mocks of them.

describe("Integration #2 — Ctrl+1..5 keyboard navigation", () => {
  beforeEach(() => {
    tierState.tier = "desktop";
    // Reset URL so useNavigationV2 defaults to orb
    window.history.replaceState({}, "", "/");
    try {
      window.localStorage.removeItem("zen-nav-v2-last-page");
    } catch {
      // ignore
    }
    cleanup();
  });

  function fireKey(key: string, modifier: "ctrl" | "meta" = "ctrl") {
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key,
          ctrlKey: modifier === "ctrl",
          metaKey: modifier === "meta",
          bubbles: true,
          cancelable: true,
        })
      );
    });
  }

  it("Ctrl+1 → Orb, Ctrl+2 → Habits, Ctrl+3 → Diary, Ctrl+4 → Planning, Ctrl+5 → Settings", async () => {
    const { container } = render(<NavV2Orchestrator />);
    const root = () => container.querySelector('[data-testid="nav-v2-orchestrator"]');

    // Starts on orb
    expect(root()?.getAttribute("data-active-page")).toBe("orb");

    fireKey("2");
    expect(root()?.getAttribute("data-active-page")).toBe("habits");
    expect(await screen.findByTestId("page-habits-marker")).toBeInTheDocument();

    fireKey("3");
    expect(root()?.getAttribute("data-active-page")).toBe("diary");
    expect(await screen.findByTestId("page-diary-marker")).toBeInTheDocument();

    fireKey("4");
    expect(root()?.getAttribute("data-active-page")).toBe("planning");
    expect(await screen.findByTestId("page-planning-marker")).toBeInTheDocument();

    fireKey("5");
    expect(root()?.getAttribute("data-active-page")).toBe("settings");
    expect(await screen.findByTestId("page-settings-marker")).toBeInTheDocument();

    fireKey("1");
    expect(root()?.getAttribute("data-active-page")).toBe("orb");
    expect(await screen.findByTestId("page-orb-marker")).toBeInTheDocument();
  });

  it("Cmd+1..5 (macOS meta) behaves identically", () => {
    const { container } = render(<NavV2Orchestrator />);
    const root = () => container.querySelector('[data-testid="nav-v2-orchestrator"]');

    fireKey("3", "meta");
    expect(root()?.getAttribute("data-active-page")).toBe("diary");

    fireKey("4", "meta");
    expect(root()?.getAttribute("data-active-page")).toBe("planning");

    fireKey("1", "meta");
    expect(root()?.getAttribute("data-active-page")).toBe("orb");
  });

  it("does NOT respond to Ctrl+N when device tier is 'phone'", () => {
    tierState.tier = "phone";
    const { container } = render(<NavV2Orchestrator />);
    const root = () => container.querySelector('[data-testid="nav-v2-orchestrator"]');

    fireKey("2");
    fireKey("3");
    expect(root()?.getAttribute("data-active-page")).toBe("orb");
  });

  it("does not consume Escape when no global navigation overlay is open", async () => {
    render(<NavV2Orchestrator />);
    const localEscapeHandler = vi.fn();
    document.addEventListener("keydown", localEscapeHandler);

    (await screen.findByTestId("page-orb-marker")).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(localEscapeHandler).toHaveBeenCalledOnce();
    document.removeEventListener("keydown", localEscapeHandler);
  });
});
