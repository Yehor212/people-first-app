import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { EntryThemeSwitcher } from "@/components/EntryThemeSwitcher";

const themeState = vi.hoisted((): {
  theme: "paper" | "ink" | "oled" | "auto";
  setTheme: ReturnType<typeof vi.fn>;
  setThemePreference: ReturnType<typeof vi.fn>;
} => ({
  theme: "auto",
  setTheme: vi.fn(),
  setThemePreference: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      appearance: "Appearance",
      themeDark: "Dark",
      themeLight: "Light",
      themeSystem: "System",
    },
  }),
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (selector: (state: typeof themeState) => unknown) => selector(themeState),
}));

vi.mock("@/lib/platform", () => ({
  isAndroid: true,
}));

vi.mock("@/components/ThemeToggle", () => ({
  setThemePreference: themeState.setThemePreference,
}));

describe("EntryThemeSwitcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    themeState.theme = "auto";
    themeState.setTheme.mockReset();
    themeState.setTheme.mockReturnValue({ ok: true, changed: true });
    document.documentElement.dataset.platform = "android";
    document.documentElement.removeAttribute("data-theme-swap-mode");
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme-swap-mode");
    delete document.documentElement.dataset.platform;
    vi.useRealTimers();
  });

  it("keeps complete theme labels readable at large text sizes", () => {
    render(<EntryThemeSwitcher />);

    const group = screen.getByRole("radiogroup", { name: "Appearance" });
    expect(group).toHaveClass("w-full", "max-w-[32rem]", "mx-auto");
    expect(group.className).toContain("auto-fit");
    expect(group.className).toContain("calc(6rem*var(--font-scale");
    expect(group).toHaveClass("max-[359px]:grid-cols-1");

    for (const label of ["Light", "Dark", "System"]) {
      const option = within(group).getByRole("radio", { name: label });
      expect(option).toHaveClass(
        "h-auto",
        "min-h-[48px]",
        "min-w-0",
        "whitespace-normal",
        "break-normal"
      );
      expect(option.className).toContain("[overflow-wrap:normal]");
      expect(option).not.toHaveClass("break-words");

      const optionLabel = within(option).getByText(label);
      expect(optionLabel).toHaveClass("min-w-0", "break-normal");
      expect(optionLabel.className).toContain("[overflow-wrap:normal]");
      expect(optionLabel).not.toHaveClass("break-words");
      expect(within(option).getByText(label)).not.toHaveClass("truncate");
    }
  });

  it("commits an Android entry theme change while native full-surface transitions are disabled", () => {
    themeState.setTheme.mockImplementationOnce(() => {
      expect(document.documentElement).toHaveAttribute(
        "data-theme-swap-mode",
        "entry-native-instant",
      );
      return { ok: true, changed: true };
    });
    render(<EntryThemeSwitcher />);

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

    expect(themeState.setTheme).toHaveBeenCalledWith("ink");
    expect(document.documentElement).toHaveAttribute(
      "data-theme-swap-mode",
      "entry-native-instant",
    );

    vi.advanceTimersByTime(140);
    expect(document.documentElement).not.toHaveAttribute("data-theme-swap-mode");
  });
});
