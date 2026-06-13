import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { LanguageSelector } from "@/components/LanguageSelector";

type TestLanguage = "en" | "uk" | "es" | "de" | "fr" | "ja" | "ar" | "he";

const languageState = vi.hoisted(
  (): {
    current: TestLanguage;
    setLanguage: ReturnType<typeof vi.fn>;
  } => ({
    current: "en",
    setLanguage: vi.fn(),
  })
);

const themeState = vi.hoisted(() => {
  const state: {
    theme: "paper" | "ink" | "oled" | "auto";
    appliedTheme: "paper" | "ink" | "oled";
  } = {
    theme: "ink",
    appliedTheme: "ink",
  };

  return {
    state,
    setTheme: vi.fn((theme: "paper" | "ink" | "oled" | "auto") => {
      state.theme = theme;
      state.appliedTheme =
        theme === "ink" || theme === "oled" ? theme : "paper";
    }),
    setThemePreference: vi.fn(),
    storageSetRaw: vi.fn(),
  };
});

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: languageState.current,
    setLanguage: languageState.setLanguage,
    t: {
      autoDetectedLanguage: "Auto-detected",
      appName: "ZenFlow",
      continue: "Continue",
      language: "Language",
      appearance: "Appearance",
      selectLanguage: "Select language",
      themeDark: "Dark",
      themeLight: "Light",
      themeSystem: "System",
      welcomeSubtitle: "Your journey to mindful living starts here",
      welcomeTitle: "Welcome to ZenFlow",
    },
  }),
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (selector: (state: typeof themeState.state & { setTheme: typeof themeState.setTheme }) => unknown) =>
    selector({
      ...themeState.state,
      setTheme: themeState.setTheme,
    }),
}));

vi.mock("@/components/ThemeToggle", () => ({
  setThemePreference: themeState.setThemePreference,
}));

vi.mock("@/lib/safeJson", () => ({
  storageSetRaw: themeState.storageSetRaw,
}));

vi.mock("@/lib/animationUtils", () => ({
  shouldAnimate: () => false,
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");

  return {
    motion: {
      button: React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
        function MotionButton({ children, ...props }, ref) {
          return (
            <button ref={ref} {...props}>
              {children}
            </button>
          );
        }
      ),
      div: React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function MotionDiv(
        { children, ...props },
        ref
      ) {
        return (
          <div ref={ref} {...props}>
            {children}
          </div>
        );
      }),
      span: React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(
        function MotionSpan({ children, ...props }, ref) {
          return (
            <span ref={ref} {...props}>
              {children}
            </span>
          );
        }
      ),
      section: React.forwardRef<HTMLElement, React.ComponentProps<"section">>(
        function MotionSection({ children, ...props }, ref) {
          return (
            <section ref={ref} {...props}>
              {children}
            </section>
          );
        }
      ),
    },
    useReducedMotion: () => true,
  };
});

describe("LanguageSelector", () => {
  beforeEach(() => {
    languageState.current = "en";
    languageState.setLanguage.mockClear();
    themeState.state.theme = "ink";
    themeState.state.appliedTheme = "ink";
    themeState.setTheme.mockClear();
    themeState.setThemePreference.mockClear();
    themeState.storageSetRaw.mockClear();
  });

  it("renders the redesigned first screen as an accessible language radio group", () => {
    render(<LanguageSelector onComplete={vi.fn()} />);

    expect(screen.getByTestId("zenflow-language-logo-image")).toHaveAttribute(
      "src",
      expect.stringMatching(/icon-source\.svg$/)
    );
    expect(screen.getByTestId("zenflow-language-logo-image")).toHaveAttribute(
      "alt",
      "ZenFlow"
    );
    expect(screen.getByTestId("language-selector-screen")).toHaveAttribute(
      "aria-labelledby",
      "language-selector-title"
    );
    expect(screen.getByTestId("language-selector-screen")).toHaveAttribute(
      "data-entry-theme",
      "ink"
    );
    const languageGroup = screen.getByRole("radiogroup", { name: "Select language" });
    expect(languageGroup).toBeInTheDocument();
    expect(within(languageGroup).getAllByRole("radio")).toHaveLength(8);
    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Українська" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.queryByText("Skip")).toBeNull();
    expect(screen.queryByText("Your journey to mindful living starts here")).toBeNull();
    expect(screen.queryByTestId("entry-gate-backdrop-star")).toBeNull();
    expect(screen.getAllByTestId("entry-gate-backdrop-flow-mark")).toHaveLength(2);
  });

  it("selects a language and completes without form submission side effects", () => {
    const onComplete = vi.fn();
    render(<LanguageSelector onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("radio", { name: "Українська" }));
    expect(languageState.setLanguage).toHaveBeenCalledWith("uk");

    const continueButton = screen.getByTestId("language-continue");
    expect(continueButton).toHaveAttribute("type", "button");

    fireEvent.click(continueButton);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("lets users choose light, dark, or system theme from the entry step", () => {
    render(<LanguageSelector onComplete={vi.fn()} />);

    const themeGroup = screen.getByRole("radiogroup", { name: "Appearance" });
    expect(within(themeGroup).getByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(within(themeGroup).getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(within(themeGroup).getByRole("radio", { name: "System" })).toHaveAttribute(
      "aria-checked",
      "false"
    );

    fireEvent.click(within(themeGroup).getByRole("radio", { name: "Light" }));
    expect(themeState.setTheme).toHaveBeenCalledWith("paper");
    expect(themeState.setThemePreference).toHaveBeenCalledWith("light");
  });
});
