import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

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
  it("keeps complete theme labels readable at large text sizes", () => {
    render(<EntryThemeSwitcher />);

    const group = screen.getByRole("radiogroup", { name: "Appearance" });
    expect(group).toHaveClass("entry-theme-switcher", "w-full", "min-w-0", "max-w-[32rem]", "mx-auto");
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
      expect(within(option).getByText(label)).toHaveClass("entry-theme-switcher-label", "min-w-0", "break-words");
      expect(within(option).getByText(label)).not.toHaveClass("truncate");
    }
  });
});
