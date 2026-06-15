import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthScreen } from "../AuthScreen";

const { handlers, providers, session } = vi.hoisted(() => {
  const providers = [
    {
      id: "google",
      supabaseProvider: "google",
      labelKey: "continueWithGoogle",
      loadingLabelKey: "authSigningInGoogle",
      nameKey: "authProviderGoogle",
      fallbackLabel: "Continue with Google",
      fallbackLoadingLabel: "Signing in with Google...",
      fallbackName: "Google",
      enabled: true,
      trustedDomains: ["accounts.google.com"],
    },
    {
      id: "facebook",
      supabaseProvider: "facebook",
      labelKey: "continueWithFacebook",
      loadingLabelKey: "authSigningInFacebook",
      nameKey: "authProviderFacebook",
      fallbackLabel: "Continue with Facebook",
      fallbackLoadingLabel: "Signing in with Facebook...",
      fallbackName: "Facebook",
      enabled: true,
      trustedDomains: ["facebook.com"],
    },
    {
      id: "telegram",
      supabaseProvider: "custom:telegram",
      labelKey: "continueWithTelegram",
      loadingLabelKey: "authSigningInTelegram",
      nameKey: "authProviderTelegram",
      fallbackLabel: "Continue with Telegram",
      fallbackLoadingLabel: "Signing in with Telegram...",
      fallbackName: "Telegram",
      enabled: true,
      trustedDomains: ["oauth.telegram.org"],
    },
  ];
  return {
    providers,
    handlers: {
      handleProviderSignIn: vi.fn(),
      handlePhoneStart: vi.fn(),
      handleSendOtp: vi.fn(),
      handleVerifyOtp: vi.fn(),
      handlePhoneBack: vi.fn(),
      exportDebugInfo: vi.fn(),
    },
    session: {
      isLoading: false,
      loadingProvider: null,
      phoneStep: "idle",
      phoneNumber: "",
      otpCode: "",
      error: null,
      debugInfo: null,
      setPhoneNumber: vi.fn(),
      setOtpCode: vi.fn(),
      setPhoneStep: vi.fn(),
      setError: vi.fn(),
    },
  };
});

const themeState = vi.hoisted(() => {
  const state: {
    theme: "paper" | "ink" | "oled" | "auto";
    appliedTheme: "paper" | "ink" | "oled";
  } = {
    theme: "paper",
    appliedTheme: "paper",
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
    t: {
      appearance: "Appearance",
      authWelcomeTitle: "Welcome to ZenFlow",
      authWelcomeSubtitle: "Sign in to sync your data across devices",
      authContinueWith: "Sign in to continue",
      authSigningInGoogle: "Signing in with Google...",
      authSigningInFacebook: "Signing in with Facebook...",
      authSigningInTelegram: "Signing in with Telegram...",
      continueWithGoogle: "Continue with Google",
      continueWithFacebook: "Continue with Facebook",
      continueWithTelegram: "Continue with Telegram",
      authNotConfiguredMessage: "Authentication not configured.",
      authExportDebugInfo: "Export debug info",
      authPrivacyNote: "Privacy note",
      legalAgreePrefix: "By continuing, you agree to",
      legalAnd: "and",
      privacyPolicy: "Privacy Policy",
      termsOfService: "Terms of Service",
      themeDark: "Dark",
      themeLight: "Light",
      themeSystem: "System",
      ariaBack: "Back",
      appName: "ZenFlow",
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
  zenMotion: {
    gentle: { duration: 0 },
  },
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {},
}));

vi.mock("@/lib/authProviders", () => ({
  getEnabledAuthScreenProviders: () => providers,
}));

vi.mock("../useAuthSession", () => ({
  useAuthSession: () => session,
}));

vi.mock("../useAuthHandlers", () => ({
  useAuthHandlers: () => handlers,
}));

describe("AuthScreen provider buttons", () => {
  beforeEach(() => {
    themeState.state.theme = "paper";
    themeState.state.appliedTheme = "paper";
    themeState.setTheme.mockClear();
    themeState.setThemePreference.mockClear();
    themeState.storageSetRaw.mockClear();
    handlers.handleProviderSignIn.mockClear();
  });

  it("renders enabled Facebook and Telegram buttons beside Google", () => {
    render(<AuthScreen onComplete={vi.fn()} />);

    expect(screen.getByTestId("auth-screen")).toHaveAttribute("data-entry-theme", "paper");
    expect(screen.getByTestId("zenflow-auth-logo-image")).toHaveAttribute(
      "src",
      expect.stringMatching(/icon-source\.svg$/)
    );
    expect(screen.getByTestId("zenflow-auth-logo-image")).toHaveAttribute("alt", "ZenFlow");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Facebook" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Telegram" })).toBeInTheDocument();
    expect(within(screen.getByTestId("auth-screen-panel")).queryByText("ZenFlow")).toBeNull();
    expect(screen.queryByText("Sign in to sync your data across devices")).toBeNull();
    expect(screen.queryByTestId("entry-gate-backdrop-star")).toBeNull();
    expect(screen.queryByTestId("entry-gate-backdrop-flow-mark")).toBeNull();
    expect(screen.getAllByTestId("entry-gate-backdrop-orb")).toHaveLength(7);
    expect(screen.getAllByTestId("entry-gate-backdrop-ripple")).toHaveLength(3);
    expect(screen.getAllByTestId("entry-gate-backdrop-ribbon")).toHaveLength(3);
    expect(screen.getByTestId("auth-privacy-copy")).toHaveClass("entry-gate-muted-copy");
    expect(screen.getByTestId("auth-legal-copy")).toHaveClass("entry-gate-muted-copy");
  });

  it("keeps provider buttons as safe button actions and delegates provider selection", () => {
    render(<AuthScreen onComplete={vi.fn()} />);

    const googleButton = screen.getByRole("button", { name: "Continue with Google" });
    expect(googleButton).toHaveAttribute("type", "button");

    fireEvent.click(googleButton);
    expect(handlers.handleProviderSignIn).toHaveBeenCalledWith("google");
  });

  it("keeps sign-in focused while preserving theme choice", () => {
    render(<AuthScreen onComplete={vi.fn()} />);

    const themeGroup = screen.getByRole("radiogroup", { name: "Appearance" });
    expect(within(themeGroup).getByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(within(themeGroup).getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "false"
    );

    fireEvent.click(within(themeGroup).getByRole("radio", { name: "Dark" }));
    expect(themeState.setTheme).toHaveBeenCalledWith("ink");
    expect(themeState.setThemePreference).toHaveBeenCalledWith("dark");
  });

  it("uses centered brand icons for social providers", () => {
    render(<AuthScreen onComplete={vi.fn()} />);

    const googleIcon = screen.getByTestId("auth-provider-icon-google");
    const facebookIcon = screen.getByTestId("auth-provider-icon-facebook");
    const telegramIcon = screen.getByTestId("auth-provider-icon-telegram");

    expect(googleIcon).toHaveClass("h-6", "w-6");
    expect(facebookIcon).toHaveClass("h-6", "w-6");
    expect(telegramIcon).toHaveClass("h-6", "w-6");
    expect(facebookIcon.querySelector('circle[fill="#1877F2"]')).toBeTruthy();
    expect(telegramIcon).toHaveAttribute("viewBox", "0 0 128 128");
    expect(
      telegramIcon.querySelector('circle[fill^="url(#auth-provider-telegram-gradient-"]')
    ).toBeTruthy();
    expect(telegramIcon.querySelector('stop[stop-color="#2AABEE"]')).toBeTruthy();
    expect(telegramIcon.querySelector('stop[stop-color="#229ED9"]')).toBeTruthy();
    expect(screen.getByTestId("auth-provider-content-google")).toHaveClass(
      "grid",
      "max-w-[22rem]",
      "grid-cols-[2rem_minmax(0,1fr)_2rem]"
    );
    expect(screen.getByTestId("auth-provider-content-facebook")).toHaveClass(
      "grid",
      "max-w-[22rem]",
      "grid-cols-[2rem_minmax(0,1fr)_2rem]"
    );
    expect(screen.getByTestId("auth-provider-content-telegram")).toHaveClass(
      "grid",
      "max-w-[22rem]",
      "grid-cols-[2rem_minmax(0,1fr)_2rem]"
    );
  });
});
