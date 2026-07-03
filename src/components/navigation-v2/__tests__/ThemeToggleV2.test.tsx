import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeToggleV2 } from "../ThemeToggleV2";
import { useThemeStore } from "@/stores/themeStore";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      switchToDark: "Switch to dark mode",
      switchToLight: "Switch to light mode",
      themeLight: "Light",
      themeDark: "Dark",
    },
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn() },
}));

describe("ThemeToggleV2", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "paper", appliedTheme: "paper" });
    document.documentElement.removeAttribute("data-theme-swap");
    document.documentElement.removeAttribute("data-theme-swap-mode");
    Object.defineProperty(document, "startViewTransition", {
      value: undefined,
      configurable: true,
    });
  });

  it("renders with 44px min touch target (Law 9 a11y)", () => {
    render(<ThemeToggleV2 />);
    const btn = screen.getByTestId("sidebar-v2-theme-toggle");
    expect(btn.className).toContain("min-h-[44px]");
  });

  it("uses the V2 tactile switch geometry and theme tokens", () => {
    render(<ThemeToggleV2 />);
    const track = screen.getByTestId("sidebar-v2-theme-toggle-track");
    const thumb = screen.getByTestId("sidebar-v2-theme-toggle-thumb");
    expect(track.className).toContain("w-[52px] h-[36px]");
    expect(track.className).toContain("rounded-[8px]");
    expect(track.className).toContain("--settings-v2-shell");
    expect(track.className).not.toContain("theme-toggle-v1");
    expect(thumb.className).toContain("top-[5px] h-[26px] w-[22px]");
    expect(thumb.className).toContain("left-[5px]");
    expect(thumb.className).toContain("rounded-[6px]");
  });

  it("uses the V2 dark switch colors and thumb position when in ink", () => {
    useThemeStore.setState({ theme: "ink", appliedTheme: "ink" });
    render(<ThemeToggleV2 />);
    const track = screen.getByTestId("sidebar-v2-theme-toggle-track");
    const thumb = screen.getByTestId("sidebar-v2-theme-toggle-thumb");
    expect(track.className).toContain("--nav-v2-item-surface");
    expect(track.className).not.toContain("theme-toggle-v1");
    expect(thumb.className).toContain("left-[25px]");
    expect(thumb.className).toContain("--settings-v2-accent");
  });

  it("uses a stable pressed-state label when theme is paper", () => {
    useThemeStore.setState({ theme: "paper", appliedTheme: "paper" });
    render(<ThemeToggleV2 />);
    const btn = screen.getByTestId("sidebar-v2-theme-toggle");
    expect(btn).toHaveAttribute("aria-label", "Dark");
    expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the same pressed-state label when theme is ink", () => {
    useThemeStore.setState({ theme: "ink", appliedTheme: "ink" });
    render(<ThemeToggleV2 />);
    const btn = screen.getByTestId("sidebar-v2-theme-toggle");
    expect(btn).toHaveAttribute("aria-label", "Dark");
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles paper → ink on click (fallback path without view transitions)", () => {
    render(<ThemeToggleV2 />);
    const btn = screen.getByTestId("sidebar-v2-theme-toggle");
    expect(useThemeStore.getState().appliedTheme).toBe("paper");
    fireEvent.click(btn);
    expect(useThemeStore.getState().appliedTheme).toBe("ink");
  });

  it("toggles ink → paper on click", () => {
    useThemeStore.setState({ theme: "ink", appliedTheme: "ink" });
    render(<ThemeToggleV2 />);
    fireEvent.click(screen.getByTestId("sidebar-v2-theme-toggle"));
    expect(useThemeStore.getState().appliedTheme).toBe("paper");
  });

  it("hides label when collapsed (icon-only sidebar rail)", () => {
    render(<ThemeToggleV2 collapsed />);
    expect(screen.queryByText("Dark")).not.toBeInTheDocument();
    expect(screen.queryByText("Light")).not.toBeInTheDocument();
    // aria-label still present for screen readers
    expect(screen.getByTestId("sidebar-v2-theme-toggle")).toHaveAttribute(
      "aria-label",
    );
  });

  it("shows 'Light' label when paper is active", () => {
    useThemeStore.setState({ theme: "paper", appliedTheme: "paper" });
    render(<ThemeToggleV2 />);
    expect(screen.getByText("Light")).toBeInTheDocument();
  });

  it("shows 'Dark' label when ink is active", () => {
    useThemeStore.setState({ theme: "ink", appliedTheme: "ink" });
    render(<ThemeToggleV2 />);
    expect(screen.getByText("Dark")).toBeInTheDocument();
  });

  it("skips the root view transition inside modal drawers", () => {
    const startViewTransition = vi.fn(() => ({
      ready: Promise.resolve(),
      finished: Promise.resolve(),
    }));
    Object.defineProperty(document, "startViewTransition", {
      value: startViewTransition,
      configurable: true,
    });

    render(
      <div role="dialog" aria-modal="true">
        <ThemeToggleV2 testId="drawer-v2-theme-toggle" />
      </div>,
    );

    fireEvent.click(screen.getByTestId("drawer-v2-theme-toggle"));

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(useThemeStore.getState().appliedTheme).toBe("ink");
    expect(document.documentElement).not.toHaveAttribute("data-theme-swap");
    expect(document.documentElement).toHaveAttribute(
      "data-theme-swap-mode",
      "drawer-instant",
    );
  });
});
