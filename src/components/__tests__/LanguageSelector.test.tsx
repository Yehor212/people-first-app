import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { LanguageSelector } from "@/components/LanguageSelector";

type TestLanguage = "en" | "uk" | "es" | "de" | "fr" | "ja" | "ar" | "he";

const languageState = vi.hoisted(
  (): {
    current: TestLanguage;
    pending: TestLanguage | null;
    error: TestLanguage | null;
    saveError: TestLanguage | null;
    setLanguage: ReturnType<typeof vi.fn>;
    retryLanguage: ReturnType<typeof vi.fn>;
  } => ({
    current: "en",
    pending: null,
    error: null,
    saveError: null,
    setLanguage: vi.fn(),
    retryLanguage: vi.fn(),
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
    pendingLanguage: languageState.pending,
    languageLoadError: languageState.error,
    languageSaveError: languageState.saveError,
    retryLanguage: languageState.retryLanguage,
    t: {
      autoDetectedLanguage: "Auto-detected",
      appName: "ZenFlow",
      continue: "Continue",
      language: "Language",
      languageApplying: "Applying language...",
      languageLoadFailed: "This language could not load. Check your connection and try again.",
      languageSaveFailed: "This language is active for now, but ZenFlow couldn't save your choice on this device. You can continue or try again.",
      appearance: "Appearance",
      selectLanguage: "Select language",
      themeDark: "Dark",
      themeLight: "Light",
      themeSystem: "System",
      tryAgain: "Try Again",
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
  const withoutMotionProps = <T extends Record<string, unknown>>(props: T) => {
    const {
      animate: _animate,
      initial: _initial,
      transition: _transition,
      variants: _variants,
      ...rest
    } = props;
    return rest;
  };

  return {
    motion: {
      button: React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
        function MotionButton({ children, ...props }, ref) {
          return (
            <button ref={ref} {...withoutMotionProps(props)}>
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
          <div ref={ref} {...withoutMotionProps(props)}>
            {children}
          </div>
        );
      }),
      span: React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(
        function MotionSpan({ children, ...props }, ref) {
          return (
            <span ref={ref} {...withoutMotionProps(props)}>
              {children}
            </span>
          );
        }
      ),
      section: React.forwardRef<HTMLElement, React.ComponentProps<"section">>(
        function MotionSection({ children, ...props }, ref) {
          return (
            <section ref={ref} {...withoutMotionProps(props)}>
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
    languageState.pending = null;
    languageState.error = null;
    languageState.saveError = null;
    languageState.setLanguage.mockClear();
    languageState.retryLanguage.mockClear();
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
    expect(languageGroup.className).toContain("auto-fit");
    expect(languageGroup.className).toContain("var(--font-scale");
    expect(within(languageGroup).getAllByRole("radio")).toHaveLength(8);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveClass("min-w-0", "whitespace-normal", "leading-tight", "text-2xl");
    expect(heading.className).toContain("overflow-wrap:normal");
    expect(heading).not.toHaveClass("break-words");
    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute("lang", "en");
    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute("dir", "ltr");
    expect(screen.getByRole("radio", { name: "العربية" })).toHaveAttribute("lang", "ar");
    expect(screen.getByRole("radio", { name: "العربية" })).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("radio", { name: "Українська" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.queryByText("Skip")).toBeNull();
    expect(screen.queryByText("Your journey to mindful living starts here")).toBeNull();
    expect(screen.queryByTestId("entry-gate-backdrop-star")).toBeNull();
    expect(screen.queryByTestId("entry-gate-backdrop-flow-mark")).toBeNull();
    expect(screen.getAllByTestId("entry-gate-backdrop-orb")).toHaveLength(7);
    expect(screen.getAllByTestId("entry-gate-backdrop-ripple")).toHaveLength(3);
    expect(screen.getAllByTestId("entry-gate-backdrop-ribbon")).toHaveLength(3);

    for (const option of within(languageGroup).getAllByRole("radio")) {
      expect(option).toHaveClass("h-auto", "min-w-0", "whitespace-normal", "break-words");
    }
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

  it("blocks continuation while applying a dictionary and offers retry after failure", () => {
    languageState.pending = "uk";
    const { rerender } = render(<LanguageSelector onComplete={vi.fn()} />);

    expect(screen.getByRole("radiogroup", { name: "Select language" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Applying language...");
    expect(screen.getByTestId("language-continue")).toBeDisabled();

    languageState.pending = null;
    languageState.error = "uk";
    rerender(<LanguageSelector onComplete={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This language could not load. Check your connection and try again.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(languageState.retryLanguage).toHaveBeenCalledOnce();
    expect(screen.getByTestId("language-continue")).toBeDisabled();
  });

  it("allows session-only continuation when the selected language cannot be saved", () => {
    languageState.current = "ar";
    languageState.saveError = "ar";
    const onComplete = vi.fn();
    render(<LanguageSelector onComplete={onComplete} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This language is active for now, but ZenFlow couldn't save your choice on this device. You can continue or try again.",
    );
    expect(screen.getByTestId("language-continue")).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(languageState.retryLanguage).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("language-continue"));
    expect(onComplete).toHaveBeenCalledOnce();
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
    expect(themeState.setThemePreference).not.toHaveBeenCalled();
  });
});
