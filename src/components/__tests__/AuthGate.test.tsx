import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AuthGate,
  hasStoredCompletedInteractiveGates,
  isLocalDevBypassHost,
  shouldBypassDesktopInteractiveGates,
} from "@/components/AuthGate";
import {
  AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT,
  AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT,
  AUTH_IMPORTED_BACKUP_DECISION_SETTLED_ACK_EVENT,
  AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT,
  AUTH_IMPORTED_BACKUP_SAVE_CONTINUE_EVENT,
  createImportedBackupAccountClaimError,
} from "@/lib/authErrors";
import {
  markImportedBackupLocalOnlyAccess,
  markPendingLocalBackupAccountClaim,
  readPendingLocalBackupAccountClaim,
} from "@/storage/accountBoundaryRuntime";
import { SK } from "@/lib/storageKeys";

type MockAuthScreenProps = {
  onComplete: (userData: { name: string; email: string }) => void;
  webOAuthError?: string | null;
  onClearError?: () => void;
  suspendSessionCompletion?: boolean;
  recoveryAction?: {
    confirmLabel: string;
    cancelLabel: string;
    pending?: boolean;
    tone?: "error" | "choice";
    onConfirm: () => void;
    onCancel: () => void;
  };
};

const {
  splashScreenMock,
  authScreenMock,
  authScreenProps,
  appState,
  userState,
  reloadAppSafelyMock,
} = vi.hoisted(() => {
  const appState = {
    initializationState: {
      isInitializing: true,
      error: null as string | null,
      wasUpdated: false,
    },
    loadingFadeOut: false,
    authBypassFlag: false,
    setAuthBypassFlag: vi.fn(),
    isProcessingWebOAuth: false,
    webOAuthError: null as string | null,
    setWebOAuthError: vi.fn(),
    hasValidSession: false,
    setHasValidSession: vi.fn(),
    isAccountBoundaryInProgress: false,
    onboardingBypassFlag: false,
    setOnboardingBypassFlag: vi.fn(),
  };
  const authScreenProps: MockAuthScreenProps[] = [];
  const userState = {
    hasSelectedLanguage: true,
    setHasSelectedLanguage: vi.fn(),
    setUserName: vi.fn(),
    setUserNameCustom: vi.fn(),
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
    reloadAppSafelyMock: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("@/components/SplashScreen", () => ({
  SplashScreen: splashScreenMock,
}));

vi.mock("@/components/AuthScreen", () => ({
  AuthScreen: authScreenMock,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      initializationError: "Initialization Error",
      initializingApp: "Preparing your zen space...",
      tryAgain: "Try Again",
      updateRequiredRefreshFailed:
        "Your latest changes could not be confirmed as saved. Try again.",
      authImportedBackupAccountChoice:
        "ZenFlow will combine this backup with data already in {account}. The combined data will be kept on this device and saved to that account.",
      authAddImportedBackupToAccount: "Combine and save to {account}",
      authKeepImportedBackupOnDevice: "Keep only on this device and sign out",
      authImportedBackupActionFailed:
        "ZenFlow could not complete that choice. Nothing was saved online or signed out. Your backup is still on this device. Check your connection and choose again.",
      authImportedBackupDecisionSettled:
        "This backup choice was already completed in another ZenFlow window. The first choice was kept. Review the current account before continuing.",
      authImportedBackupRecoveryRequired:
        "ZenFlow cannot confirm this backup’s local recovery state. It will stay separate from your account. Continue without an account to restore local access.",
      authImportedBackupRecoveryTitle: "Choose how to recover this backup",
      authImportedBackupSaveFailed:
        "This backup is linked to {account}, but ZenFlow could not confirm the online save. The combined data is safe on this device. Retry now, or continue and ZenFlow will retry automatically.",
      retry: "Retry",
      continue: "Continue",
      storageError: "Storage error",
      storageErrorDesc: "There was a problem saving your data on this device.",
      authGateContinue: "Continue without account",
    },
  }),
}));

vi.mock("@/lib/versionCheck", () => ({
  reloadAppSafely: () => reloadAppSafelyMock(),
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
    appState.setOnboardingBypassFlag.mockReset();
    appState.setWebOAuthError.mockReset();
    userState.setHasSelectedLanguage.mockReset();
    userState.setUserName.mockReset();
    userState.setUserNameCustom.mockReset();
    userState.setGoogleAuthChecked.mockReset();
    userState.setOnboardingComplete.mockReset();
    userState.setNotificationPermissionChecked.mockReset();
    userState.setAuthGateChecked.mockReset();
    reloadAppSafelyMock.mockReset();
    reloadAppSafelyMock.mockResolvedValue(undefined);
    appState.initializationState = { isInitializing: true, error: null, wasUpdated: false };
    appState.loadingFadeOut = false;
    appState.authBypassFlag = false;
    appState.isProcessingWebOAuth = false;
    appState.webOAuthError = null;
    appState.hasValidSession = false;
    appState.isAccountBoundaryInProgress = false;
    appState.onboardingBypassFlag = false;
    userState.hasSelectedLanguage = true;
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

  it("keeps startup recovery retryable and exposes a localized alert when safe reload is blocked", async () => {
    appState.initializationState = {
      isInitializing: false,
      error: "IndexedDB unavailable",
      wasUpdated: false,
    };
    reloadAppSafelyMock.mockRejectedValueOnce(new Error("draft write failed"));

    render(
      <AuthGate isLoading={false}>
        <div>App</div>
      </AuthGate>
    );

    const retry = screen.getByRole("button", { name: "Try Again" });
    fireEvent.click(retry);

    expect(
      await screen.findByRole("alert", {
        name: "Your latest changes could not be confirmed as saved. Try again.",
      })
    ).toBeInTheDocument();
    await waitFor(() => expect(retry).toBeEnabled());
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

  it("does not require removed onboarding or notification gates for installed shell recovery", () => {
    localStorage.setItem("zenflow-language-selected", "true");
    localStorage.setItem("zenflow-google-auth-checked", "true");

    expect(hasStoredCompletedInteractiveGates()).toBe(true);
  });

  it("opens an installed web shell with completed local gates while startup recovery is still initializing", () => {
    appState.initializationState = { isInitializing: true, error: null, wasUpdated: false };
    setStandaloneDisplayMode(true);
    storeCompletedInteractiveGates();
    userState.hasSelectedLanguage = false;
    userState.authGateChecked = false;
    userState.googleAuthChecked = false;
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

  it("never renders previous-account children while an account boundary is in progress", () => {
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    appState.isAccountBoundaryInProgress = true;
    appState.hasValidSession = false;
    setStandaloneDisplayMode(true);
    storeCompletedInteractiveGates();

    render(
      <AuthGate isLoading={false} splashTheme="ink">
        <div>Private account A content</div>
      </AuthGate>
    );

    expect(screen.getByTestId("mock-splash")).toBeInTheDocument();
    expect(screen.queryByText("Private account A content")).not.toBeInTheDocument();
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

  it("keeps legacy pending work gated behind an explicit recovery choice", () => {
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    appState.hasValidSession = false;
    appState.webOAuthError = "account-switch-pending-writes";
    userState.authGateChecked = false;
    userState.googleAuthChecked = false;
    const dispatch = vi.spyOn(window, "dispatchEvent");

    render(
      <AuthGate isLoading={false} splashTheme="ink">
        <div>Private app</div>
      </AuthGate>
    );

    const props = authScreenProps.at(-1);
    expect(props?.suspendSessionCompletion).toBe(true);
    expect(props?.onClearError).toBeUndefined();
    expect(props?.recoveryAction?.confirmLabel).toBeTruthy();
    expect(props?.recoveryAction?.cancelLabel).toBeTruthy();
    props?.recoveryAction?.onConfirm();
    expect(
      dispatch.mock.calls.some(([event]) => event.type === "zenflow:recover-legacy-offline-queue")
    ).toBe(true);
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();
    dispatch.mockRestore();
  });

  it("keeps an imported backup gated until the signed-in account choice is explicit", () => {
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    appState.hasValidSession = false;
    appState.webOAuthError = createImportedBackupAccountClaimError("@zen_friend", "owner-123");
    userState.authGateChecked = false;
    userState.googleAuthChecked = false;
    const dispatch = vi.spyOn(window, "dispatchEvent");

    render(
      <AuthGate isLoading={false} splashTheme="ink">
        <div>Private app</div>
      </AuthGate>
    );

    const props = authScreenProps.at(-1);
    expect(props?.webOAuthError).toContain("@zen_friend");
    expect(props?.webOAuthError).toContain("combine this backup");
    expect(props?.suspendSessionCompletion).toBe(true);
    expect(props?.onClearError).toBeUndefined();
    expect(props?.recoveryAction?.confirmLabel).toBe("Combine and save to @zen_friend");
    expect(props?.recoveryAction?.cancelLabel).toBe("Keep only on this device and sign out");
    expect(props?.recoveryAction?.tone).toBe("choice");
    expect(props?.recoveryAction?.pending).toBe(false);
    props?.recoveryAction?.onConfirm();
    props?.recoveryAction?.onCancel();
    expect(
      dispatch.mock.calls.some(
        ([event]) => event.type === AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT
      )
    ).toBe(true);
    expect(
      dispatch.mock.calls.some(
        ([event]) => event.type === AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT
      )
    ).toBe(false);
    const confirmEvent = dispatch.mock.calls.find(
      ([event]) => event.type === AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT
    )?.[0] as CustomEvent<{ expectedOwnerUserId?: string; onSettled?: () => void }>;
    expect(confirmEvent.detail.expectedOwnerUserId).toBe("owner-123");
    confirmEvent.detail.onSettled?.();
    props?.recoveryAction?.onCancel();
    expect(
      dispatch.mock.calls.some(
        ([event]) => event.type === AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT
      )
    ).toBe(true);
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();
    dispatch.mockRestore();
  });

  it("does not let an installed PWA startup bypass a pending imported-backup choice", () => {
    storeCompletedInteractiveGates();
    setStandaloneDisplayMode(true);
    appState.initializationState = { isInitializing: true, error: null, wasUpdated: false };
    appState.hasValidSession = false;
    appState.webOAuthError = createImportedBackupAccountClaimError("@zen_friend", "owner-123");
    userState.authGateChecked = false;

    render(
      <AuthGate isLoading={true} splashTheme="ink">
        <div>Private app</div>
      </AuthGate>
    );

    expect(screen.getByTestId("mock-auth-screen")).toBeInTheDocument();
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();
  });

  it("keeps an installed PWA closed with an actionable recovery while a claim is reconstructed", () => {
    storeCompletedInteractiveGates();
    setStandaloneDisplayMode(true);
    expect(markPendingLocalBackupAccountClaim()).toBe(true);
    appState.initializationState = { isInitializing: true, error: null, wasUpdated: false };
    appState.webOAuthError = null;

    render(
      <AuthGate isLoading={true} splashTheme="ink">
        <div>Private app</div>
      </AuthGate>
    );

    expect(screen.getByText("Choose how to recover this backup")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue without account" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();
  });

  it("reopens the local-only app after a completed backup cancellation instead of looping on splash", () => {
    expect(markPendingLocalBackupAccountClaim()).toBe(true);
    expect(markImportedBackupLocalOnlyAccess()).toBe(true);
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    appState.hasValidSession = false;
    // Transient Zustand bypass resets on process restart; the durable
    // local-only decision must still reopen the retained backup.
    appState.authBypassFlag = false;
    userState.authGateChecked = true;
    appState.webOAuthError = null;

    render(
      <AuthGate isLoading={false} splashTheme="ink">
        <div>Private app</div>
      </AuthGate>
    );

    expect(screen.getByText("Private app")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-splash")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-auth-screen")).not.toBeInTheDocument();
  });

  it("reopens when another tab completes durable local-only recovery", () => {
    expect(markPendingLocalBackupAccountClaim()).toBe(true);
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    appState.hasValidSession = false;
    appState.authBypassFlag = false;
    userState.authGateChecked = true;
    appState.webOAuthError = null;

    render(
      <AuthGate isLoading={false} splashTheme="ink">
        <div>Private app</div>
      </AuthGate>
    );
    expect(screen.getByText("Choose how to recover this backup")).toBeInTheDocument();

    expect(markImportedBackupLocalOnlyAccess()).toBe(true);
    fireEvent(
      window,
      new StorageEvent("storage", {
        key: SK.IMPORTED_BACKUP_LOCAL_ONLY_ACCESS,
        newValue: localStorage.getItem(SK.IMPORTED_BACKUP_LOCAL_ONLY_ACCESS),
      })
    );

    expect(screen.getByText("Private app")).toBeInTheDocument();
    expect(screen.queryByText("Choose how to recover this backup")).not.toBeInTheDocument();
  });

  it("repairs a malformed imported-backup fence through an explicit local-only action", () => {
    localStorage.setItem(SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM, "not-json");
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    appState.hasValidSession = false;
    userState.authGateChecked = true;

    render(
      <AuthGate isLoading={false} splashTheme="ink">
        <div>Private app</div>
      </AuthGate>
    );

    expect(screen.getByText("Choose how to recover this backup")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveFocus();
    const recover = (event: Event) => {
      expect(markPendingLocalBackupAccountClaim()).toBe(true);
      expect(markImportedBackupLocalOnlyAccess()).toBe(true);
      (
        event as CustomEvent<{ onSettled?: (success: boolean) => void }>
      ).detail.onSettled?.(true);
    };
    window.addEventListener(AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT, recover, { once: true });
    fireEvent.click(screen.getByRole("button", { name: "Continue without account" }));

    expect(readPendingLocalBackupAccountClaim().status).toBe("pending");
    expect(screen.getByText("Private app")).toBeInTheDocument();
  });

  it("recovers after imported-backup marker storage becomes readable again", () => {
    const originalGetItem = Storage.prototype.getItem;
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(function (this: Storage, key: string) {
        if (key === SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM) {
          throw new DOMException("storage unavailable", "SecurityError");
        }
        return originalGetItem.call(this, key);
      });
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    appState.hasValidSession = false;
    userState.authGateChecked = true;

    render(
      <AuthGate isLoading={false} splashTheme="ink">
        <div>Private app</div>
      </AuthGate>
    );
    expect(screen.getByText("Choose how to recover this backup")).toBeInTheDocument();
    const recover = (event: Event) => {
      expect(markPendingLocalBackupAccountClaim()).toBe(true);
      expect(markImportedBackupLocalOnlyAccess()).toBe(true);
      (
        event as CustomEvent<{ onSettled?: (success: boolean) => void }>
      ).detail.onSettled?.(true);
    };
    window.addEventListener(AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT, recover, { once: true });

    getItem.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Continue without account" }));

    expect(readPendingLocalBackupAccountClaim().status).toBe("pending");
    expect(screen.getByText("Private app")).toBeInTheDocument();
  });

  it("explains when another window already completed the backup choice", () => {
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    appState.hasValidSession = false;
    appState.webOAuthError = "imported-backup-decision-already-settled";
    userState.authGateChecked = false;

    render(
      <AuthGate isLoading={false} splashTheme="ink">
        <div>Private app</div>
      </AuthGate>
    );

    expect(screen.getByText(/already completed in another ZenFlow window/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveFocus();
    const acknowledged = vi.fn();
    window.addEventListener(AUTH_IMPORTED_BACKUP_DECISION_SETTLED_ACK_EVENT, acknowledged, {
      once: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(acknowledged).toHaveBeenCalledTimes(1);
    expect(appState.setHasValidSession).not.toHaveBeenCalled();
    expect(appState.setAuthBypassFlag).not.toHaveBeenCalledWith(true);
    expect(userState.setAuthGateChecked).not.toHaveBeenCalledWith(true);
  });

  it("never bypasses a mandatory account decision in desktop mode", () => {
    expect(shouldBypassDesktopInteractiveGates(true, true)).toBe(false);
    expect(shouldBypassDesktopInteractiveGates(true, false)).toBe(true);
  });

  it("offers retry or continue after an account-bound backup save cannot be confirmed", () => {
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    appState.hasValidSession = false;
    appState.webOAuthError = createImportedBackupAccountClaimError(
      "@zen_friend",
      "owner-123",
      "save-failed"
    );
    userState.authGateChecked = false;
    const dispatch = vi.spyOn(window, "dispatchEvent");

    render(
      <AuthGate isLoading={false} splashTheme="ink">
        <div>Private app</div>
      </AuthGate>
    );

    const props = authScreenProps.at(-1);
    expect(props?.webOAuthError).toContain("could not confirm the online save");
    expect(props?.recoveryAction?.confirmLabel).toBe("Retry");
    expect(props?.recoveryAction?.cancelLabel).toBe("Continue");
    props?.recoveryAction?.onCancel();
    const continueEvent = dispatch.mock.calls.find(
      ([event]) => event.type === AUTH_IMPORTED_BACKUP_SAVE_CONTINUE_EVENT
    )?.[0] as CustomEvent<{ expectedOwnerUserId?: string }>;
    expect(continueEvent.detail.expectedOwnerUserId).toBe("owner-123");
    dispatch.mockRestore();
  });

  it("opens V2 directly after auth without changing feature or notification consent", async () => {
    appState.initializationState = { isInitializing: false, error: null, wasUpdated: false };
    appState.hasValidSession = true;
    userState.authGateChecked = true;
    userState.googleAuthChecked = true;
    userState.onboardingComplete = false;
    userState.notificationPermissionChecked = false;

    render(
      <AuthGate isLoading={false} splashTheme="ink">
        <div>App</div>
      </AuthGate>
    );

    expect(screen.getByText("App")).toBeInTheDocument();
    await waitFor(() => expect(userState.setOnboardingComplete).toHaveBeenCalledWith(true));
    expect(userState.setNotificationPermissionChecked).not.toHaveBeenCalled();
  });
});
