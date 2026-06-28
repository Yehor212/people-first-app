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
  it("keeps theme options shrink-safe on narrow Android entry screens", () => {
    render(<EntryThemeSwitcher />);

    const group = screen.getByRole("radiogroup", { name: "Appearance" });
    expect(group).toHaveClass("w-full", "max-w-[32rem]", "mx-auto");

    for (const label of ["Light", "Dark", "System"]) {
      const option = within(group).getByRole("radio", { name: label });
      expect(option).toHaveClass("min-w-0", "px-1.5", "text-xs", "sm:text-sm");
      expect(within(option).getByText(label)).toHaveClass("min-w-0", "truncate");
    }
  });
});
