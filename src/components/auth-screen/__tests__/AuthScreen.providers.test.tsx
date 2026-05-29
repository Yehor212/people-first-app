import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
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
      ariaBack: "Back",
    },
  }),
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
  it("renders enabled Facebook and Telegram buttons beside Google", () => {
    render(<AuthScreen onComplete={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Facebook" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Telegram" })).toBeInTheDocument();
  });
});
