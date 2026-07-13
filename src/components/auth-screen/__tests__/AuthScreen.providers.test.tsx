import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    {
      id: "apple",
      supabaseProvider: "apple",
      labelKey: "continueWithApple",
      loadingLabelKey: "authSigningIn",
      nameKey: "authProviderApple",
      fallbackLabel: "Continue with Apple",
      fallbackLoadingLabel: "Signing in...",
      fallbackName: "Apple",
      enabled: true,
      trustedDomains: ["appleid.apple.com"],
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
      error: null as string | null,
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
      state.appliedTheme = theme === "ink" || theme === "oled" ? theme : "paper";
    }),
    setThemePreference: vi.fn(),
    storageSetRaw: vi.fn(),
  };
});

const media = vi.hoisted(() => ({
  load: vi.fn(),
  play: vi.fn(() => Promise.resolve()),
  pause: vi.fn(),
}));

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

const appAudioSettingsState = vi.hoisted(() => ({
  snapshot: {
    muted: false,
    volume: 0.3,
    feedbackSoundsEnabled: true,
    canPlayFeedback: true,
  },
}));

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
      authSigningIn: "Signing in...",
      continueWithGoogle: "Continue with Google",
      continueWithFacebook: "Continue with Facebook",
      continueWithTelegram: "Continue with Telegram",
      continueWithApple: "Continue with Apple",
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
      authMeasuredBreathLabel: "Soft air",
      authMeasuredBreathPlay: "Play soft air",
      authMeasuredBreathPause: "Pause soft air",
      audioLoading: "Loading...",
      audioRetry: "Retry",
      settingsSoundSummaryOff: "Muted",
      settingsSoundAmbientOff: "Ambient sound is off in Sensory comfort.",
      soundOn: "On",
      soundOff: "Off",
      authRecoverLegacyChanges: "Recover changes with this account",
      authUseDifferentAccount: "Use a different account",
    },
  }),
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (
    selector: (state: typeof themeState.state & { setTheme: typeof themeState.setTheme }) => unknown
  ) =>
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
  safeLocalStorageGet: vi.fn((_key: string, fallback: unknown) => fallback),
  safeLocalStorageSet: vi.fn(() => true),
}));

vi.mock("@/lib/animationUtils", () => ({
  shouldAnimate: () => false,
  zenMotion: {
    gentle: { duration: 0 },
  },
}));

vi.mock("@/hooks/useAppAudioSettings", () => ({
  useAppAudioSettings: () => appAudioSettingsState.snapshot,
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
    session.error = null;
    media.play.mockClear();
    media.pause.mockClear();
    media.load.mockClear();
    appAudioSettingsState.snapshot = {
      muted: false,
      volume: 0.3,
      feedbackSoundsEnabled: true,
      canPlayFeedback: true,
    };
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: media.play,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: media.pause,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: media.load,
    });
  });

  it("renders enabled Facebook, Telegram, and Apple buttons beside Google", () => {
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
    expect(screen.getByRole("button", { name: "Continue with Apple" })).toBeInTheDocument();
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

  it("disables provider changes and exposes explicit legacy recovery actions", () => {
    session.error = "Older changes need an owner.";
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <AuthScreen
        onComplete={vi.fn()}
        suspendSessionCompletion
        recoveryAction={{
          confirmLabel: "Recover changes with this account",
          cancelLabel: "Use a different account",
          onConfirm,
          onCancel,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Recover changes with this account" }));
    fireEvent.click(screen.getByRole("button", { name: "Use a different account" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("keeps provider buttons as safe button actions and delegates provider selection", () => {
    render(<AuthScreen onComplete={vi.fn()} />);

    const googleButton = screen.getByRole("button", { name: "Continue with Google" });
    expect(googleButton).toHaveAttribute("type", "button");

    fireEvent.click(googleButton);
    expect(handlers.handleProviderSignIn).toHaveBeenCalledWith("google");

    fireEvent.click(screen.getByRole("button", { name: "Continue with Apple" }));
    expect(handlers.handleProviderSignIn).toHaveBeenCalledWith("apple");
  });

  it("offers the soft air track as user-started sign-in ambience", async () => {
    render(<AuthScreen onComplete={vi.fn()} />);

    const audio = screen.getByTestId("auth-measured-breath-audio");
    expect(audio).toHaveAttribute("src", expect.stringContaining("/sounds/soft-air-veil.mp3"));
    expect(audio).toHaveAttribute("preload", "none");
    expect(audio).toHaveAttribute("loop");
    expect(media.play).not.toHaveBeenCalled();

    const toggle = screen.getByTestId("auth-measured-breath-toggle");
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAccessibleName("Play soft air");

    fireEvent.click(toggle);
    expect(media.play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));

    fireEvent.click(toggle);
    expect(media.pause).toHaveBeenCalled();
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));
  });

  it("keeps soft air off until the browser confirms playback", async () => {
    const playback = createDeferred();
    media.play.mockReturnValueOnce(playback.promise);

    render(<AuthScreen onComplete={vi.fn()} />);

    const toggle = screen.getByTestId("auth-measured-breath-toggle");
    fireEvent.click(toggle);

    expect(media.play).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAccessibleName("Loading...");

    playback.resolve();
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
    expect(toggle).toHaveAccessibleName("Pause soft air");
  });

  it("keeps soft air retryable when the browser blocks the first play", async () => {
    media.play.mockRejectedValueOnce(new Error("Audio blocked"));
    media.play.mockResolvedValueOnce(undefined);

    render(<AuthScreen onComplete={vi.fn()} />);

    const toggle = screen.getByTestId("auth-measured-breath-toggle");
    fireEvent.click(toggle);

    await waitFor(() => expect(toggle).toHaveAccessibleName("Retry"));
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);

    expect(media.play).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
  });

  it("keeps soft air retryable when the media element reports an error", async () => {
    render(<AuthScreen onComplete={vi.fn()} />);

    const toggle = screen.getByTestId("auth-measured-breath-toggle");
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));

    fireEvent.error(screen.getByTestId("auth-measured-breath-audio"));

    await waitFor(() => expect(toggle).toHaveAccessibleName("Retry"));
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    media.load.mockClear();
    media.play.mockClear();

    fireEvent.click(toggle);

    expect(media.load).toHaveBeenCalledTimes(1);
    expect(media.play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
  });

  it("stops soft air on hidden and pagehide lifecycle events", async () => {
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
    try {
      render(<AuthScreen onComplete={vi.fn()} />);
      const toggle = screen.getByTestId("auth-measured-breath-toggle");

      fireEvent.click(toggle);
      await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
      media.pause.mockClear();

      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(media.pause).toHaveBeenCalled();
      await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));

      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      fireEvent.click(toggle);
      await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
      media.pause.mockClear();

      window.dispatchEvent(new Event("pagehide"));

      expect(media.pause).toHaveBeenCalled();
      await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));
    } finally {
      if (hiddenDescriptor) {
        Object.defineProperty(document, "hidden", hiddenDescriptor);
      } else {
        Reflect.deleteProperty(document, "hidden");
      }
    }
  });

  it("does not start soft air when app sound is muted", () => {
    appAudioSettingsState.snapshot = {
      muted: true,
      volume: 0.3,
      feedbackSoundsEnabled: true,
      canPlayFeedback: false,
    };

    render(<AuthScreen onComplete={vi.fn()} />);

    const toggle = screen.getByTestId("auth-measured-breath-toggle");
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAccessibleName("Muted");
    expect(toggle).toHaveTextContent("Muted");

    fireEvent.click(toggle);
    expect(media.play).not.toHaveBeenCalled();
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
    expect(themeState.setThemePreference).not.toHaveBeenCalled();
  });

  it("uses centered brand icons for social providers", () => {
    render(<AuthScreen onComplete={vi.fn()} />);

    const googleIcon = screen.getByTestId("auth-provider-icon-google");
    const facebookIcon = screen.getByTestId("auth-provider-icon-facebook");
    const telegramIcon = screen.getByTestId("auth-provider-icon-telegram");
    const appleIcon = screen.getByTestId("auth-provider-icon-apple");

    expect(googleIcon).toHaveClass("h-6", "w-6");
    expect(facebookIcon).toHaveClass("h-6", "w-6");
    expect(telegramIcon).toHaveClass("h-6", "w-6");
    expect(appleIcon).toHaveClass("h-6", "w-6");
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
    expect(screen.getByTestId("auth-provider-content-apple")).toHaveClass(
      "grid",
      "max-w-[22rem]",
      "grid-cols-[2rem_minmax(0,1fr)_2rem]"
    );
    for (const provider of ["google", "facebook", "telegram", "apple"]) {
      expect(screen.getByTestId(`auth-provider-icon-rail-${provider}`)).toHaveClass(
        "h-8",
        "w-8",
        "justify-self-center"
      );
    }
  });
});
