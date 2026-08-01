import { beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/components/ThemeToggle", () => ({
  setThemePreference: themeState.setThemePreference,
}));

describe("EntryThemeSwitcher", () => {
  beforeEach(() => {
    themeState.theme = "auto";
    themeState.setTheme.mockClear();
  });

  it("keeps complete theme labels readable at large text sizes", () => {
    render(<EntryThemeSwitcher />);

    const group = screen.getByRole("radiogroup", { name: "Appearance" });
    expect(group).toHaveClass("w-full", "max-w-[32rem]", "mx-auto");
    expect(group.className).toContain("auto-fit");
    expect(group.className).toContain("var(--font-scale");

    for (const label of ["Light", "Dark", "System"]) {
      const option = within(group).getByRole("radio", { name: label });
      expect(option).toHaveClass(
        "h-auto",
        "min-h-[44px]",
        "min-w-0",
        "whitespace-normal",
        "break-words"
      );
      expect(within(option).getByText(label)).toHaveClass("min-w-0", "break-words");
      expect(within(option).getByText(label)).not.toHaveClass("truncate");
    }
  });

  it("uses one tab stop and selects themes with radio-group navigation keys", () => {
    render(<EntryThemeSwitcher />);

    const group = screen.getByRole("radiogroup", { name: "Appearance" });
    const light = within(group).getByRole("radio", { name: "Light" });
    const dark = within(group).getByRole("radio", { name: "Dark" });
    const system = within(group).getByRole("radio", { name: "System" });

    expect(light).toHaveAttribute("tabindex", "-1");
    expect(dark).toHaveAttribute("tabindex", "-1");
    expect(system).toHaveAttribute("tabindex", "0");

    system.focus();
    fireEvent.keyDown(system, { key: "ArrowRight" });
    expect(themeState.setTheme).toHaveBeenLastCalledWith("paper");
    expect(light).toHaveFocus();

    fireEvent.keyDown(light, { key: "End" });
    expect(themeState.setTheme).toHaveBeenLastCalledWith("auto");
    expect(system).toHaveFocus();

    fireEvent.keyDown(system, { key: "ArrowUp" });
    expect(themeState.setTheme).toHaveBeenLastCalledWith("ink");
    expect(dark).toHaveFocus();
  });

  it("keeps the group keyboard reachable when the persisted theme is OLED", () => {
    themeState.theme = "oled";
    render(<EntryThemeSwitcher />);

    const group = screen.getByRole("radiogroup", { name: "Appearance" });
    const light = within(group).getByRole("radio", { name: "Light" });
    const dark = within(group).getByRole("radio", { name: "Dark" });
    const system = within(group).getByRole("radio", { name: "System" });

    expect(light).toHaveAttribute("tabindex", "-1");
    expect(dark).toHaveAttribute("tabindex", "-1");
    expect(system).toHaveAttribute("tabindex", "0");
    expect(within(group).getAllByRole("radio", { checked: false })).toHaveLength(3);

    system.focus();
    fireEvent.keyDown(system, { key: "ArrowRight" });
    expect(themeState.setTheme).toHaveBeenLastCalledWith("paper");
    expect(light).toHaveFocus();
  });
});
