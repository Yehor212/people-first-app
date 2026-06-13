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
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Facebook" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Telegram" })).toBeInTheDocument();
    expect(within(screen.getByTestId("auth-screen-panel")).queryByText("ZenFlow")).toBeNull();
  });

  it("keeps provider buttons as safe button actions and delegates provider selection", () => {
    render(<AuthScreen onComplete={vi.fn()} />);

    const googleButton = screen.getByRole("button", { name: "Continue with Google" });
    expect(googleButton).toHaveAttribute("type", "button");

    fireEvent.click(googleButton);
    expect(handlers.handleProviderSignIn).toHaveBeenCalledWith("google");
  });

  it("keeps sign-in focused without unrelated theme controls", () => {
    render(<AuthScreen onComplete={vi.fn()} />);

    expect(screen.queryByRole("radio", { name: "Light" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Dark" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "System" })).toBeNull();
    expect(themeState.setTheme).not.toHaveBeenCalled();
    expect(themeState.setThemePreference).not.toHaveBeenCalled();
  });
});
