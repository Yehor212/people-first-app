import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Accordion } from "@/components/ui/accordion";
import { AccountSection } from "../AccountSection";

const { accountAuth, accountSync, deleteAccount } = vi.hoisted(() => ({
  accountAuth: {
    authStatus: null,
    setAuthStatus: vi.fn(),
    sessionUser: null,
    sessionUserId: "telegram-user",
    sessionAccountLabel: "@zenflow_user",
    sessionDisplayName: "Zenflow User",
    linkedProviderIds: ["telegram"],
    enabledProviders: [
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
    ],
    hasSession: true,
    signingInProvider: null,
    linkingProvider: null,
    isSigningIn: false,
    isSigningOut: false,
    handleProvider: vi.fn(),
    handleLinkProvider: vi.fn(),
    handleSignOut: vi.fn(),
  },
  accountSync: {
    cloudSyncEnabled: true,
    isSyncing: false,
    weeklyDigestEnabled: false,
    setWeeklyDigestEnabled: vi.fn(),
    weeklyDigestLoading: false,
    weeklyDigestTouchedRef: { current: false },
    handleSync: vi.fn(),
    handleCloudSyncToggle: vi.fn(),
    handleWeeklyDigestToggle: vi.fn(),
  },
  deleteAccount: {
    showDeleteConfirm: false,
    setShowDeleteConfirm: vi.fn(),
    deleteConfirmInput: "",
    setDeleteConfirmInput: vi.fn(),
    isDeletingAccount: false,
    deleteStatus: null,
    handleDeleteAccount: vi.fn(),
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      settingsGroupAccount: "Account",
      accountDescription: "Sign in to sync progress across devices.",
      signedInAs: "Signed in as",
      authLinkedProviders: "Connected sign-in methods",
      authConnectMoreProviders: "Connect another sign-in method.",
      authConnectProvider: "Connect {provider}",
      authLinkingProvider: "Connecting {provider}...",
      authProviderGoogle: "Google",
      authProviderFacebook: "Facebook",
      authProviderTelegram: "Telegram",
      settingsCloudSyncTitle: "Cloud Sync",
      settingsCloudSyncDescription: "Sync your data across devices.",
      settingsCloudSyncEnabled: "Automatic sync is active",
      weeklyDigestTitle: "Weekly Progress Report",
      weeklyDigestDescription: "Receive a weekly summary.",
      syncNow: "Sync Now",
      signOut: "Sign Out",
      deleteAccount: "Delete Account",
      deleteAccountLink: "Learn about account deletion",
    },
  }),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {},
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: vi.fn(),
}));

vi.mock("@/hooks/useScrollLock", () => ({
  useScrollLock: vi.fn(),
}));

vi.mock("../useAccountAuth", () => ({
  useAccountAuth: () => accountAuth,
}));

vi.mock("../useAccountSync", () => ({
  useAccountSync: () => accountSync,
}));

vi.mock("../useDeleteAccount", () => ({
  useDeleteAccount: () => deleteAccount,
}));

describe("AccountSection auth state", () => {
  it("treats a Telegram user without email as signed in", () => {
    render(
      <Accordion type="single" defaultValue="account">
        <AccountSection userName="Friend" onNameChange={vi.fn()} onResetData={vi.fn()} />
      </Accordion>,
    );

    expect(screen.getByText("@zenflow_user")).toBeInTheDocument();
    expect(screen.getByText("Connected sign-in methods")).toBeInTheDocument();
    expect(screen.getByText("Telegram")).toBeInTheDocument();
    expect(screen.getByTestId("account-automatic-sync-card")).toHaveTextContent("Cloud Sync");
    expect(screen.getByTestId("account-automatic-sync-card")).toHaveTextContent(
      "Automatic sync is active",
    );
    expect(screen.queryByRole("button", { name: "Sync Now" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
  });

  it("disables sign out while account deletion is in progress", () => {
    deleteAccount.isDeletingAccount = true;
    try {
      render(
        <Accordion type="single" defaultValue="account">
          <AccountSection userName="Friend" onNameChange={vi.fn()} onResetData={vi.fn()} />
        </Accordion>,
      );

      expect(screen.getByRole("button", { name: "Sign Out" })).toBeDisabled();
    } finally {
      deleteAccount.isDeletingAccount = false;
    }
  });
});
