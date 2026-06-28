import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AuthGate,
  isLocalDevBypassHost,
  shouldBypassDesktopInteractiveGates,
} from "@/components/AuthGate";

type MockAuthScreenProps = {
  onComplete: (userData: { name: string; email: string }) => void;
  webOAuthError?: string | null;
  onClearError?: () => void;
};

const { splashScreenMock, authScreenMock, authScreenProps, appState, userState } = vi.hoisted(
  () => {
    const appState = {
      initializationState: { isInitializing: true, error: null, wasUpdated: false },
      loadingFadeOut: false,
      authBypassFlag: false,
      setAuthBypassFlag: vi.fn(),
      isProcessingWebOAuth: false,
      webOAuthError: null,
      setWebOAuthError: vi.fn(),
      hasValidSession: false,
      tutorialBypassFlag: false,
      setTutorialBypassFlag: vi.fn(),
      onboardingBypassFlag: false,
      setOnboardingBypassFlag: vi.fn(),
    };
    const authScreenProps: MockAuthScreenProps[] = [];
    const userState = {
      hasSelectedLanguage: true,
      setHasSelectedLanguage: vi.fn(),
      setUserName: vi.fn(),
      setUserNameCustom: vi.fn(),
      tutorialComplete: true,
      setTutorialComplete: vi.fn(),
      onboardingComplete: true,
      setOnboardingComplete: vi.fn(),
      notificationPermissionChecked: true,
      setNotificationPermissionChecked: vi.fn(),
      authGateChecked: true,
      setAuthGateChecked: vi.fn(),
      googleAuthChecked: true,
      setGoogleAuthChecked: vi.fn(),
    };

    return {
      appState,
      userState,
      authScreenProps,
      authScreenMock: vi.fn((props: MockAuthScreenProps) => {
        authScreenProps.push(props);

        return <div data-testid="mock-auth-screen" />;
      }),
      splashScreenMock: vi.fn(
        ({ subtitle, theme, instant }: { subtitle: string; theme?: string; instant?: boolean }) => (
          <div
            data-testid="mock-splash"
            data-splash-theme-prop={theme}
            data-splash-instant-prop={instant ? "true" : "false"}
          >
            {subtitle}
          </div>
        )
      ),
    };
  }
);

vi.mock("@/components/SplashScreen", () => ({
  SplashScreen: splashScreenMock,
}));

vi.mock("@/components/AuthScreen", () => ({
  AuthScreen: authScreenMock,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      initializingApp: "Preparing your zen space...",
    },
  }),
}));


const setStandaloneDisplayMode = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)" ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const storeCompletedInteractiveGates = () => {
  localStorage.setItem("zenflow-language-selected", "true");
  localStorage.setItem("zenflow-google-auth-checked", "true");
  localStorage.setItem("zenflow-tutorial-complete", "true");
  localStorage.setItem("zenflow-onboarding-complete", "true");
  localStorage.setItem("zenflow-notification-permission-checked", "true");
};

vi.mock("@/stores", () => {
  return {
    useAppStore: (selector: (state: typeof appState) => unknown) => selector(appState),
    useUserDataStore: (selector: (state: typeof userState) => unknown) => selector(userState),
  };
});

describe("AuthGate", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/people-first-app/");
    localStorage.clear();
    setStandaloneDisplayMode(false);
    splashScreenMock.mockClear();
    authScreenMock.mockClear();
    authScreenProps.length = 0;
    appState.setAuthBypassFlag.mockReset();
    appState.setTutorialBypassFlag.mockReset();
    appState.setOnboardingBypassFlag.mockReset();
    appState.setWebOAuthError.mockReset();
    userState.setHasSelectedLanguage.mockReset();
    userState.setUserName.mockReset();
    userState.setUserNameCustom.mockReset();
    userState.setGoogleAuthChecked.mockReset();
    userState.setTutorialComplete.mockReset();
    userState.setOnboardingComplete.mockReset();
    userState.setNotificationPermissionChecked.mockReset();
    userState.setAuthGateChecked.mockReset();
    appState.initializationState = { isInitializing: true, error: null, wasUpdated: false };
    appState.loadingFadeOut = false;
    appState.authBypassFlag = false;
    appState.isProcessingWebOAuth = false;
    appState.webOAuthError = null;
    appState.hasValidSession = false;
    appState.tutorialBypassFlag = false;
    appState.onboardingBypassFlag = false;
    userState.hasSelectedLanguage = true;
    userState.tutorialComplete = true;
    userState.onboardingComplete = true;
    userState.notificationPermissionChecked = true;
    userState.authGateChecked = true;
    userState.googleAuthChecked = true;
  });

  it("passes the splash theme override to SplashScreen during initialization", () => {
    render(
      <AuthGate isLoading={false} splashTheme="ink">
        <div>App</div>
      </AuthGate>
    );

    expect(screen.getByTestId("mock-splash")).toHaveAttribute("data-splash-theme-prop", "ink");
    expect(screen.getByText("Preparing your zen space...")).toBeInTheDocument();
  });

  it("uses the full branded splash for V2 data loading when a splash theme is provided", () => {
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };

    render(
      <AuthGate isLoading splashTheme="oled">
        <div>App</div>
      </AuthGate>
    );

    expect(screen.getByTestId("mock-splash")).toHaveAttribute("data-splash-theme-prop", "oled");
    expect(screen.getByTestId("mock-splash")).toHaveAttribute("data-splash-instant-prop", "true");
  });

  it("allows the local preview dev bypass only on loopback hosts", () => {
    expect(isLocalDevBypassHost("localhost")).toBe(true);
    expect(isLocalDevBypassHost("127.0.0.1")).toBe(true);
    expect(isLocalDevBypassHost("::1")).toBe(true);
    expect(isLocalDevBypassHost("yehor212.github.io")).toBe(false);
  });

  it("marks desktop runtime as shell-first so the installed app can open V2 immediately", () => {
    expect(shouldBypassDesktopInteractiveGates(true)).toBe(true);
    expect(shouldBypassDesktopInteractiveGates(false)).toBe(false);
  });


  it("opens an installed web shell with completed local gates while IndexedDB is still hydrating", () => {
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    setStandaloneDisplayMode(true);
    storeCompletedInteractiveGates();
    userState.hasSelectedLanguage = false;
    userState.authGateChecked = false;
    userState.googleAuthChecked = false;
    userState.tutorialComplete = false;
    userState.onboardingComplete = false;
    userState.notificationPermissionChecked = false;

    render(
      <AuthGate isLoading splashTheme="ink">
        <div>App</div>
      </AuthGate>
    );

    expect(screen.getByText("App")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-splash")).not.toBeInTheDocument();
  });

  it("keeps an installed web shell on the loading splash when local gates are incomplete", () => {
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    setStandaloneDisplayMode(true);
    localStorage.setItem("zenflow-language-selected", "true");

    render(
      <AuthGate isLoading splashTheme="ink">
        <div>App</div>
      </AuthGate>
    );

    expect(screen.getByTestId("mock-splash")).toBeInTheDocument();
    expect(screen.queryByText("App")).not.toBeInTheDocument();
  });

  it("renders children immediately when dev bypass query is present", () => {
    window.history.pushState({}, "", "/people-first-app/diary?nav=v2&dev=true");

    render(
      <AuthGate isLoading={false} splashTheme="ink">
        <div>App</div>
      </AuthGate>
    );

    expect(screen.getByText("App")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-splash")).not.toBeInTheDocument();
  });

  it("completes the auth gate for non-Google social providers", () => {
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    appState.hasValidSession = false;
    userState.authGateChecked = false;
    userState.googleAuthChecked = false;
    appState.setAuthBypassFlag.mockImplementation((value: boolean) => {
      appState.authBypassFlag = value;
    });
    userState.setAuthGateChecked.mockImplementation((value: boolean) => {
      userState.authGateChecked = value;
      userState.googleAuthChecked = value;
    });

    const renderGate = () => (
      <AuthGate isLoading={false} splashTheme="ink">
        <div>App</div>
      </AuthGate>
    );
    const { rerender } = render(renderGate());

    expect(screen.getByTestId("mock-auth-screen")).toBeInTheDocument();

    authScreenProps[0]?.onComplete({ name: "Telegram User", email: "" });
    rerender(renderGate());

    expect(appState.setAuthBypassFlag).toHaveBeenCalledWith(true);
    expect(userState.setUserName).toHaveBeenCalledWith("Telegram User");
    expect(userState.setUserNameCustom).toHaveBeenCalledWith(false);
    expect(userState.setAuthGateChecked).toHaveBeenCalledWith(true);
    expect(screen.getByText("App")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-auth-screen")).not.toBeInTheDocument();
  });
});
