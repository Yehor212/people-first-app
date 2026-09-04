import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ThemeToggleV2 } from "../ThemeToggleV2";
import { useThemeStore } from "@/stores/themeStore";

const rootCss = readFileSync("src/index.css", "utf8");

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      switchToDark: "Switch to dark mode",
      switchToLight: "Switch to light mode",
      themeLight: "Light",
      themeDark: "Dark",
      settingsPreferenceSaveError:
        "Could not save this change. Your previous setting is still active.",
    },
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn().mockResolvedValue(undefined) },
}));

async function finishThemeTransition(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  });
  const veil = document.querySelector<HTMLElement>("[data-theme-transition-veil]");
  expect(veil).toHaveAttribute("data-theme-transition-phase", "enter");
  const enterEnd = new Event("transitionend", { bubbles: true });
  Object.defineProperty(enterEnd, "propertyName", { value: "opacity" });
  veil!.dispatchEvent(enterEnd);
  await act(async () => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  });
  const releaseEnd = new Event("transitionend", { bubbles: true });
  Object.defineProperty(releaseEnd, "propertyName", { value: "opacity" });
  veil!.dispatchEvent(releaseEnd);
}

describe("ThemeToggleV2", () => {
  beforeEach(() => {
    document.documentElement.dir = "ltr";
    document.documentElement.style.setProperty("--background", "165 22% 96%");
    useThemeStore.setState({ theme: "paper", appliedTheme: "paper" });
    document.querySelectorAll("[data-theme-transition-veil]").forEach((node) => node.remove());
    document.documentElement.removeAttribute("data-theme-swap");
    document.documentElement.removeAttribute("data-theme-swap-mode");
    document.querySelectorAll(".theme-swap-instant").forEach((node) => {
      node.classList.remove("theme-swap-instant");
    });
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
    expect(thumb.style.insetInlineStart).toBe("5px");
    expect(thumb.className).toContain("translate-x-0");
    expect(thumb.className).not.toContain("left-");
    expect(thumb.className).toContain("rounded-[6px]");
  });

  it("uses the V2 dark switch colors and thumb position when in ink", () => {
    useThemeStore.setState({ theme: "ink", appliedTheme: "ink" });
    render(<ThemeToggleV2 />);
    const track = screen.getByTestId("sidebar-v2-theme-toggle-track");
    const thumb = screen.getByTestId("sidebar-v2-theme-toggle-thumb");
    expect(track.className).toContain("--nav-v2-item-surface");
    expect(track.className).not.toContain("theme-toggle-v1");
    expect(thumb).toHaveClass("ltr:translate-x-[20px]", "rtl:-translate-x-[20px]");
    expect(thumb.className).not.toContain("left-");
    expect(thumb.className).toContain("--settings-v2-accent");
  });

  it("moves the active thumb toward logical end in RTL", () => {
    document.documentElement.dir = "rtl";
    useThemeStore.setState({ theme: "ink", appliedTheme: "ink" });

    render(<ThemeToggleV2 />);
    const thumb = screen.getByTestId("sidebar-v2-theme-toggle-thumb");

    expect(thumb.style.insetInlineStart).toBe("5px");
    expect(thumb).toHaveClass("ltr:translate-x-[20px]", "rtl:-translate-x-[20px]");
    expect(thumb.className).not.toContain("left-");
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

  it("requests paper → ink immediately and applies it at fade-through midpoint", async () => {
    render(<ThemeToggleV2 />);
    const btn = screen.getByTestId("sidebar-v2-theme-toggle");
    expect(useThemeStore.getState().appliedTheme).toBe("paper");
    fireEvent.click(btn);
    expect(useThemeStore.getState().theme).toBe("ink");
    expect(useThemeStore.getState().appliedTheme).toBe("paper");
    await finishThemeTransition();
    expect(useThemeStore.getState().appliedTheme).toBe("ink");
  });

  it("toggles ink → paper through the same midpoint", async () => {
    useThemeStore.setState({ theme: "ink", appliedTheme: "ink" });
    render(<ThemeToggleV2 />);
    fireEvent.click(screen.getByTestId("sidebar-v2-theme-toggle"));
    expect(useThemeStore.getState().theme).toBe("paper");
    expect(useThemeStore.getState().appliedTheme).toBe("ink");
    await finishThemeTransition();
    expect(useThemeStore.getState().appliedTheme).toBe("paper");
  });

  it("lets a second tap cancel a pending dark request before midpoint", () => {
    render(<ThemeToggleV2 />);
    const toggle = screen.getByTestId("sidebar-v2-theme-toggle");

    fireEvent.click(toggle);
    expect(useThemeStore.getState()).toMatchObject({ theme: "ink", appliedTheme: "paper" });

    fireEvent.click(toggle);
    expect(useThemeStore.getState()).toMatchObject({ theme: "paper", appliedTheme: "paper" });
    expect(document.querySelector("[data-theme-transition-veil]")).not.toBeInTheDocument();
  });

  it("uses the bounded fade-through even when root View Transitions are available", async () => {
    const startViewTransition = vi.fn(() => ({
      ready: Promise.resolve(),
      finished: Promise.resolve(),
    }));
    Object.defineProperty(document, "startViewTransition", {
      value: startViewTransition,
      configurable: true,
    });

    render(<ThemeToggleV2 />);
    fireEvent.click(screen.getByTestId("sidebar-v2-theme-toggle"));

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(useThemeStore.getState().appliedTheme).toBe("paper");
    expect(document.querySelector("[data-theme-transition-veil]")).toBeInTheDocument();
    await finishThemeTransition();
    expect(useThemeStore.getState().appliedTheme).toBe("ink");
    expect(document.documentElement).not.toHaveAttribute("data-theme-swap");
    expect(document.querySelector("[data-theme-transition-veil]")).not.toBeInTheDocument();
  });

  it("keeps only the live drawer-specific theme-swap CSS", () => {
    expect(rootCss).not.toContain('html[data-theme-swap="active"]');
    expect(rootCss).not.toContain("data-theme-swap-mode");
    expect(rootCss).toContain(".theme-swap-instant");
    expect(rootCss).toContain(".theme-transition-veil");
  });

  it("keeps the previous theme and explains a persistence failure", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("blocked", "QuotaExceededError");
    });
    render(<ThemeToggleV2 />);

    fireEvent.click(screen.getByTestId("sidebar-v2-theme-toggle"));

    expect(useThemeStore.getState().appliedTheme).toBe("paper");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not save this change. Your previous setting is still active.",
    );
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

  it("keeps the visible setting label aligned with its accessible name in paper mode", () => {
    useThemeStore.setState({ theme: "paper", appliedTheme: "paper" });
    render(<ThemeToggleV2 />);
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-v2-theme-toggle")).toHaveAccessibleName(
      "Dark",
    );
  });

  it("keeps the same setting label when ink is active", () => {
    useThemeStore.setState({ theme: "ink", appliedTheme: "ink" });
    render(<ThemeToggleV2 />);
    expect(screen.getByText("Dark")).toBeInTheDocument();
  });

  it("skips the root view transition inside modal drawers while retaining fade-through", async () => {
    const startViewTransition = vi.fn(() => ({
      ready: Promise.resolve(),
      finished: Promise.resolve(),
    }));
    Object.defineProperty(document, "startViewTransition", {
      value: startViewTransition,
      configurable: true,
    });

    render(
      <div role="dialog" aria-modal="true" data-testid="test-dialog">
        <ThemeToggleV2 testId="drawer-v2-theme-toggle" />
      </div>,
    );

    fireEvent.click(screen.getByTestId("drawer-v2-theme-toggle"));

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(useThemeStore.getState().appliedTheme).toBe("paper");
    await finishThemeTransition();
    expect(useThemeStore.getState().appliedTheme).toBe("ink");
    expect(document.documentElement).not.toHaveAttribute("data-theme-swap");
    expect(document.documentElement).not.toHaveAttribute("data-theme-swap-mode");
    expect(screen.getByTestId("test-dialog")).toHaveClass("theme-swap-instant");
  });
});
