import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { AuthGate } from "@/components/AuthGate";
import { markPendingLocalBackupAccountClaim } from "@/storage/accountBoundaryRuntime";

const { appState, userState, splashScreenMock } = vi.hoisted(() => {
  const appState = {
    initializationState: { isInitializing: false, error: null, wasUpdated: false },
    loadingFadeOut: false,
    authBypassFlag: false,
    setAuthBypassFlag: vi.fn(),
    isProcessingWebOAuth: false,
    webOAuthError: null,
    setWebOAuthError: vi.fn(),
    hasValidSession: false,
    onboardingBypassFlag: false,
    setOnboardingBypassFlag: vi.fn(),
  };
  const userState = {
    hasSelectedLanguage: false,
    setHasSelectedLanguage: vi.fn(),
    setUserName: vi.fn(),
    setUserNameCustom: vi.fn(),
    onboardingComplete: false,
    setOnboardingComplete: vi.fn(),
    notificationPermissionChecked: false,
    setNotificationPermissionChecked: vi.fn(),
    authGateChecked: false,
    setAuthGateChecked: vi.fn(),
  };

  return {
    appState,
    userState,
    splashScreenMock: vi.fn(({ subtitle }: { subtitle: string }) => (
      <div data-testid="mock-splash">{subtitle}</div>
    )),
  };
});

vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  IS_DESKTOP_RUNTIME: true,
}));

vi.mock("@/components/SplashScreen", () => ({
  SplashScreen: splashScreenMock,
}));

vi.mock("@/components/LanguageSelector", () => ({
  LanguageSelector: () => <div data-testid="mock-language-selector" />,
}));

vi.mock("@/components/AuthScreen", () => ({
  AuthScreen: () => <div data-testid="mock-auth-screen" />,
}));

vi.mock("@/components/PremiumLoader", () => ({
  PremiumLoader: () => <div data-testid="mock-premium-loader" />,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      initializingApp: "Preparing your zen space...",
    },
  }),
}));

vi.mock("@/stores", () => ({
  useAppStore: (selector: (state: typeof appState) => unknown) => selector(appState),
  useUserDataStore: (selector: (state: typeof userState) => unknown) => selector(userState),
}));

describe("AuthGate desktop runtime loading contract", () => {
  beforeEach(() => {
    localStorage.clear();
    splashScreenMock.mockClear();
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    appState.loadingFadeOut = false;
  });

  it("keeps the desktop shell closed while a durable imported-backup claim is reconstructed", () => {
    expect(markPendingLocalBackupAccountClaim()).toBe(true);

    render(
      <AuthGate isLoading splashTheme="ink">
        <div>Desktop App</div>
      </AuthGate>
    );

    expect(screen.getByText("Choose how to recover this backup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue without account" })).toBeInTheDocument();
    expect(screen.queryByText("Desktop App")).not.toBeInTheDocument();
  });

  it("does not keep the installed desktop shell on the branded splash while local data is still hydrating", () => {
    render(
      <AuthGate isLoading splashTheme="ink">
        <div>Desktop App</div>
      </AuthGate>
    );

    expect(screen.getByText("Desktop App")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-splash")).not.toBeInTheDocument();
  });

  it("keeps the core initialization splash before the desktop shell is ready", () => {
    appState.initializationState = { isInitializing: true, error: null, wasUpdated: false };

    render(
      <AuthGate isLoading={false} splashTheme="ink">
        <div>Desktop App</div>
      </AuthGate>
    );

    expect(screen.getByTestId("mock-splash")).toHaveTextContent("Preparing your zen space...");
    expect(screen.queryByText("Desktop App")).not.toBeInTheDocument();
  });
});
