import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthProviderConfig } from "@/lib/authProviders";
import { defaultReminderSettings } from "@/lib/reminders";
import type { V2SettingsControls } from "../types";
import type { AccountAuthController, AccountViewState } from "../useSettingsOverviewModules";

const backHandlerHarness = vi.hoisted(() => {
  const callbacks: Array<() => boolean> = [];
  const register = vi.fn((callback: () => boolean) => {
    callbacks.push(callback);
    return () => {
      const index = callbacks.lastIndexOf(callback);
      if (index >= 0) callbacks.splice(index, 1);
    };
  });
  return { callbacks, register };
});

const deleteAccountHarness = vi.hoisted(() => ({
  showDeleteConfirm: false,
  deleteStatus: null as string | null,
  deleteConfirmInput: "",
  setDeleteConfirmInput: vi.fn(),
  deleteConfirmMatches: false,
  isDeletingAccount: false,
  openDeleteConfirmation: vi.fn(() => true),
  closeDeleteConfirmation: vi.fn(() => true),
  handleDeleteAccount: vi.fn(async () => undefined),
}));

const dataExportHarness = vi.hoisted(() => ({
  isExporting: false,
  handleExport: vi.fn(async () => undefined),
}));

vi.mock("@/lib/androidBackHandler", () => ({
  registerModalCloseCallback: backHandlerHarness.register,
}));

vi.mock("@/components/settings/account-section/useDeleteAccount", () => ({
  useDeleteAccount: () => deleteAccountHarness,
}));

vi.mock("@/components/settings/data-section/useDataExport", () => ({
  useDataExport: () => dataExportHarness,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      authDiscardAndSignOut: "Discard changes and sign out",
      authDiscardSignOutConfirm: "Discard unsaved changes and sign out?",
      authDiscardSignOutWarning:
        "Changes waiting to be saved online will be permanently removed from this device.",
      authProviderApple: "Apple",
      authProviderGoogle: "Google",
      authSignOutRecoveryTitle: "Finish signing out",
      authSigningIn: "Signing in...",
      authSigningInGoogle: "Signing in with Google...",
      cancel: "Cancel",
      continueWithApple: "Continue with Apple",
      continueWithGoogle: "Continue with Google",
      delete: "Delete",
      deleteAccount: "Delete account",
      deleteAccountLink: "Learn about account deletion",
      exportData: "Export data",
      profile: "Profile",
      retry: "Retry",
      saveName: "Save name",
      settingsAccountBackupChecking: "Checking your account…",
      settingsAccountBackupCheckingDescription:
        "Your data stays on this device while ZenFlow checks your account.",
      settingsAccountBackupDescription: "Account description",
      settingsAccountBackupTitle: "Account & backup",
      settingsAccountBackupUnavailable: "Backup isn’t available in this version",
      settingsAccountBackupUnavailableDescription: "Your data stays on this device.",
      settingsAccountCheckFailed: "We couldn’t check your account",
      settingsAccountCheckFailedDescription:
        "Your data stays on this device. Check your connection and try again.",
      settingsAccountDataOnDevice:
        "You can use ZenFlow without an account. Sign in to save new changes online and use them on your other devices.",
      settingsAccountSignedOut: "You’re not signed in",
      signOut: "Sign out",
      signedInAs: "Signed in as",
      signingOut: "Signing out...",
      yourName: "Your name",
    },
  }),
}));

import { AccountPanel } from "../V2SettingsAccountPanel";
import { V2SettingsControlDeck } from "../V2SettingsControlDeck";

function createControls(): V2SettingsControls {
  return {
    userName: "Avery",
    userNameCustom: true,
    onNameChange: vi.fn(),
    onResetData: vi.fn(),
    reminders: defaultReminderSettings,
    onRemindersChange: vi.fn(),
    habits: [],
    moods: [],
    focusSessions: [],
    gratitudeEntries: [],
    privacy: {
      noTracking: false,
      analytics: false,
      consentShown: true,
      adConsent: false,
      pushNotifications: false,
    },
    onPrivacyChange: vi.fn(),
  };
}

function createAuth(
  overrides: Partial<AccountAuthController> = {}
): AccountAuthController {
  return {
    authStatus: null,
    sessionUserId: "account-a",
    sessionAccountLabel: "avery@example.com",
    sessionDisplayName: "Avery",
    linkedProviderIds: [],
    enabledProviders: [getAuthProviderConfig("google")],
    hasSession: true,
    sessionCheckState: "signed-in",
    refreshSession: vi.fn(async () => undefined),
    signingInProvider: null,
    isSigningIn: false,
    isSigningOut: false,
    signOutBlockReason: null,
    handleProvider: vi.fn(async () => undefined),
    handleSignOut: vi.fn(async () => undefined),
    handleAccountCleanupRetry: vi.fn(async () => undefined),
    handleDiscardPendingAndSignOut: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as AccountAuthController;
}

function renderAccount(accountViewState: AccountViewState, auth: AccountAuthController) {
  return render(
    <AccountPanel controls={createControls()} auth={auth} accountViewState={accountViewState} />
  );
}

function accountButtonNames(): string[] {
  return within(screen.getByTestId("settings-v2-panel-account"))
    .queryAllByRole("button")
    .map((button) => button.getAttribute("aria-label") || button.textContent?.trim() || "");
}

function openBusyDiscardConfirmation() {
  const auth = createAuth({
    authStatus: "Changes are still waiting to be saved online.",
    signOutBlockReason: "pending-changes",
  });
  const view = renderAccount("signed-in", auth);

  fireEvent.click(
    screen.getByRole("button", { name: "Discard changes and sign out" })
  );
  expect(
    screen.getByTestId("settings-v2-discard-sign-out-confirmation")
  ).toBeInTheDocument();

  auth.isSigningOut = true;
  view.rerender(
    <AccountPanel controls={createControls()} auth={auth} accountViewState="signed-in" />
  );
  return auth;
}

describe("V2 Settings account state matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    backHandlerHarness.callbacks.length = 0;
    deleteAccountHarness.showDeleteConfirm = false;
    deleteAccountHarness.deleteStatus = null;
    deleteAccountHarness.deleteConfirmInput = "";
    deleteAccountHarness.deleteConfirmMatches = false;
    deleteAccountHarness.isDeletingAccount = false;
  });

  afterEach(() => {
    cleanup();
    backHandlerHarness.callbacks.length = 0;
  });

  it.each([
    ["unavailable", []],
    ["checking", []],
    ["error", ["Retry"]],
    ["signed-out", ["Continue with Google"]],
    ["signed-in", ["Sign out", "Delete account"]],
  ] as const)("allowlists only the %s account actions", (accountViewState, expectedActions) => {
    const signedIn = accountViewState === "signed-in";
    const signedOut = accountViewState === "signed-out";
    const auth = createAuth({
      hasSession: signedIn,
      sessionCheckState: signedIn
        ? "signed-in"
        : signedOut
          ? "signed-out"
          : accountViewState === "checking"
            ? "checking"
            : accountViewState === "error"
              ? "error"
              : "signed-out",
    });

    renderAccount(accountViewState, auth);

    expect(accountButtonNames()).toEqual(expectedActions);
  });

  it("fails closed when a stale signed-in identity reaches an error state", () => {
    const staleLabel = "stale-owner@example.invalid";
    const auth = createAuth({
      hasSession: true,
      sessionCheckState: "signed-in",
      sessionAccountLabel: staleLabel,
    });

    renderAccount("error", auth);

    expect(screen.queryByText(staleLabel)).not.toBeInTheDocument();
    expect(accountButtonNames()).toEqual(["Retry"]);
  });

  it("keeps every provider action disabled while one provider is busy", () => {
    const auth = createAuth({
      hasSession: false,
      sessionCheckState: "signed-out",
      enabledProviders: [
        getAuthProviderConfig("google"),
        getAuthProviderConfig("apple"),
      ],
      isSigningIn: true,
      signingInProvider: "google",
    });

    renderAccount("signed-out", auth);

    expect(
      screen.getByRole("button", { name: "Signing in with Google..." })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue with Apple" })).toBeDisabled();
  });

  it("keeps a long mixed-direction account label isolated and available", () => {
    const accountLabel =
      "حساب سارة — @Avery_2026, https://example.test/a?b=1 — ABC-123 — avery.very.long.identifier@example.invalid";
    renderAccount(
      "signed-in",
      createAuth({ sessionAccountLabel: accountLabel })
    );

    const identity = screen.getByTestId("settings-v2-session-account-label");
    expect(identity.tagName).toBe("BDI");
    expect(identity).toHaveAttribute("dir", "auto");
    expect(identity).toHaveTextContent(accountLabel);
    expect(identity).not.toHaveClass("truncate");
    expect(identity.className).toContain("[overflow-wrap:anywhere]");
  });

  it("blocks profile editing while sign-out recovery owns the account surface", () => {
    render(
      <V2SettingsControlDeck
        controls={createControls()}
        selectedSectionId="account"
        accountAuth={createAuth({
          authStatus: "This device still needs cleanup.",
          signOutBlockReason: "cleanup-failed",
        })}
        accountViewState="signed-out"
      />
    );

    const profileName = screen.getByRole("textbox", { name: "Your name" });
    expect(profileName).toBeDisabled();
    expect(profileName).toHaveAccessibleDescription("Finish signing out");
    expect(screen.getByTestId("settings-v2-profile-save")).toBeDisabled();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("blocks profile editing during an ordinary in-progress sign-out", () => {
    render(
      <V2SettingsControlDeck
        controls={createControls()}
        selectedSectionId="account"
        accountAuth={createAuth({
          isSigningOut: true,
          signOutBlockReason: null,
        })}
        accountViewState="signed-in"
      />
    );

    const profileName = screen.getByRole("textbox", { name: "Your name" });
    expect(profileName).toBeDisabled();
    expect(profileName).toHaveAccessibleDescription("Finish signing out");
    expect(screen.getByTestId("settings-v2-profile-save")).toBeDisabled();
  });

  it("does not dismiss an in-progress discard confirmation on Escape", () => {
    openBusyDiscardConfirmation();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.getByTestId("settings-v2-discard-sign-out-confirmation")
    ).toBeInTheDocument();
  });

  it("names the in-progress destructive action and exposes its busy state", () => {
    openBusyDiscardConfirmation();

    const signingOut = screen.getByRole("button", { name: "Signing out..." });
    expect(signingOut).toBeDisabled();
    expect(signingOut).toHaveAttribute("aria-busy", "true");
  });

  it("does not dismiss an in-progress discard confirmation on Android Back", () => {
    openBusyDiscardConfirmation();
    const activeBackHandler = backHandlerHarness.callbacks.at(-1);
    expect(activeBackHandler).toEqual(expect.any(Function));

    act(() => {
      activeBackHandler?.();
    });

    expect(
      screen.getByTestId("settings-v2-discard-sign-out-confirmation")
    ).toBeInTheDocument();
  });
});
