import { useCallback, useEffect, useRef, useState } from "react";
import { Cloud, Download, Loader2, RefreshCw, Trash2, UserRound } from "lucide-react";
import { AuthProviderButton } from "@/components/auth/AuthProviderButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { getAuthProviderConfig, type SocialAuthProviderConfig } from "@/lib/authProviders";
import { BASE_URL } from "@/lib/env";
import { supabase } from "@/lib/supabaseClient";
import { useAccountAuth } from "@/components/settings/account-section/useAccountAuth";
import { useDeleteAccount } from "@/components/settings/account-section/useDeleteAccount";
import { useDataExport } from "@/components/settings/data-section/useDataExport";
import {
  ActionButton,
  PanelFrame,
  SettingsButtonGrid,
  SettingsExternalLink,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsInset,
  SettingsStatus,
  SettingsTextInput,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";

function getProviderName(tx: Record<string, string>, provider: SocialAuthProviderConfig) {
  return tx[provider.nameKey] || provider.fallbackName;
}

export function AccountPanel({
  controls,
  accountSessionState,
}: {
  controls: V2SettingsControls;
  accountSessionState: boolean | null;
}) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const auth = useAccountAuth({ onNameChange: controls.onNameChange, t: tx });
  const del = useDeleteAccount({
    onResetData: controls.onResetData,
    t: tx,
    activeUserId: auth.sessionUserId,
  });
  const [signOutExportStatus, setSignOutExportStatus] = useState<string | null>(null);
  const [showDiscardSignOutConfirm, setShowDiscardSignOutConfirm] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteConfirmationRef = useRef<HTMLDivElement>(null);
  const shouldRestoreDeleteFocusRef = useRef(false);
  const recoveryExport = useDataExport({
    setDataStatus: setSignOutExportStatus,
    t: tx,
    moods: controls.moods ?? [],
    habits: controls.habits,
    focusSessions: controls.focusSessions ?? [],
    gratitudeEntries: controls.gratitudeEntries ?? [],
    userName: controls.userName,
  });
  const { closeDeleteConfirmation, showDeleteConfirm } = del;
  const deleteAccountHref = `${BASE_URL}delete-account.html`;
  const linkedProviderLabels = auth.linkedProviderIds.map((providerId) =>
    getProviderName(tx, getAuthProviderConfig(providerId))
  );
  const accountViewState = !supabase
    ? "unavailable"
    : auth.hasSession
      ? "signed-in"
      : auth.sessionCheckState === "error"
        ? "error"
        : auth.sessionCheckState === "signed-out" && accountSessionState === false
          ? "signed-out"
          : auth.sessionCheckState === "signed-out" && accountSessionState === true
          ? "error"
          : "checking";

  const closeDeleteConfirm = useCallback(() => {
    if (!closeDeleteConfirmation()) return false;
    shouldRestoreDeleteFocusRef.current = true;
    return true;
  }, [closeDeleteConfirmation]);

  useBackHandler(showDeleteConfirm, () => {
    closeDeleteConfirm();
  });

  useEffect(() => {
    if (!showDeleteConfirm) return;
    const frame = window.requestAnimationFrame(() => {
      const confirmation = deleteConfirmationRef.current;
      confirmation?.scrollIntoView?.({ block: "start", inline: "nearest" });
      confirmation?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showDeleteConfirm]);

  useEffect(() => {
    if (showDeleteConfirm || !shouldRestoreDeleteFocusRef.current) return;
    shouldRestoreDeleteFocusRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      deleteTriggerRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showDeleteConfirm]);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeDeleteConfirm();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [closeDeleteConfirm, showDeleteConfirm]);

  useEffect(() => {
    if (!auth.signOutBlockReason) {
      setShowDiscardSignOutConfirm(false);
      setSignOutExportStatus(null);
    }
  }, [auth.signOutBlockReason]);

  return (
    <PanelFrame
      icon={Cloud}
      title={tx.settingsAccountBackupTitle || "Account & backup"}
      description={
        tx.settingsAccountBackupDescription ||
        "Your account is connected. If ZenFlow can’t save an update online, your changes stay on this device."
      }
      testId="settings-v2-panel-account"
      showHeader={false}
    >
      {accountViewState === "unavailable" ? (
        <SettingsInset>
          <SettingsStatus>
            {tx.settingsAccountBackupUnavailable || "Backup isn’t available in this version"}
          </SettingsStatus>
          <p className="text-xs text-muted-foreground">
            {tx.settingsAccountBackupUnavailableDescription || "Your data stays on this device."}
          </p>
        </SettingsInset>
      ) : accountViewState === "checking" ? (
        <SettingsInset testId="settings-v2-account-checking">
          <p role="status" aria-live="polite" className="text-sm font-semibold text-foreground">
            {tx.settingsAccountBackupChecking || "Checking your account…"}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {tx.settingsAccountBackupCheckingDescription ||
              "Your data stays on this device while ZenFlow checks your account."}
          </p>
        </SettingsInset>
      ) : accountViewState === "error" ? (
        <SettingsInset testId="settings-v2-account-check-error">
          <p role="status" aria-live="polite" className="text-sm font-semibold text-foreground">
            {tx.settingsAccountCheckFailed || "We couldn’t check your account"}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {tx.settingsAccountCheckFailedDescription ||
              "Your data stays on this device. Check your connection and try again."}
          </p>
          <SettingsInlineButton
            icon={RefreshCw}
            onClick={() => {
              void auth.refreshSession();
            }}
          >
            {tx.retry || "Retry"}
          </SettingsInlineButton>
        </SettingsInset>
      ) : accountViewState === "signed-in" ? (
        <>
          <SettingsInset>
            <p className="text-sm text-muted-foreground">
              {tx.signedInAs || "Signed in as"}{" "}
              <span className="font-semibold text-foreground">
                {auth.sessionAccountLabel || auth.sessionDisplayName}
              </span>
            </p>
          </SettingsInset>

          {linkedProviderLabels.length > 0 && (
            <SettingsInset>
              <SettingsFieldHeader title={tx.authLinkedProviders || "Connected sign-in methods"} />
              <div className="mb-3 flex flex-wrap gap-2">
                {linkedProviderLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-[hsl(var(--border)/0.55)] bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </SettingsInset>
          )}

          <ActionButton
            icon={auth.isSigningOut ? Loader2 : UserRound}
            onClick={() => {
              void auth.handleSignOut();
            }}
            disabled={auth.isSigningOut || del.isDeletingAccount}
            isLoading={auth.isSigningOut}
          >
            {auth.isSigningOut ? tx.signingOut || "Signing out..." : tx.signOut || "Sign out"}
          </ActionButton>

          {auth.signOutBlockReason && (
            <SettingsInset tone="danger" testId="settings-v2-sign-out-recovery">
              <SettingsFieldHeader
                tone="danger"
                title={tx.authSignOutRecoveryTitle || "Finish signing out"}
                description={auth.authStatus || tx.authSignOutFailed || "Sign-out did not complete."}
              />

              {auth.signOutBlockReason === "pending-changes" && showDiscardSignOutConfirm ? (
                <>
                  <SettingsFieldHeader
                    tone="danger"
                    title={
                      tx.authDiscardSignOutConfirm ||
                      "Discard unsaved changes and sign out?"
                    }
                    description={
                      tx.authDiscardSignOutWarning ||
                      "Changes waiting to be saved online will be permanently removed from this device."
                    }
                  />
                  <SettingsButtonGrid columns="confirm">
                    <SettingsInlineButton
                      onClick={() => setShowDiscardSignOutConfirm(false)}
                      disabled={auth.isSigningOut}
                    >
                      {tx.cancel}
                    </SettingsInlineButton>
                    <SettingsInlineButton
                      icon={Trash2}
                      variant="danger"
                      onClick={() => {
                        void auth.handleDiscardPendingAndSignOut();
                      }}
                      disabled={auth.isSigningOut}
                      isLoading={auth.isSigningOut}
                    >
                      {tx.authDiscardAndSignOut || "Discard changes and sign out"}
                    </SettingsInlineButton>
                  </SettingsButtonGrid>
                </>
              ) : (
                <SettingsButtonGrid
                  columns={auth.signOutBlockReason === "pending-changes" ? "three" : "two"}
                >
                  <SettingsInlineButton
                    icon={RefreshCw}
                    onClick={() => {
                      void auth.handleSignOut();
                    }}
                    disabled={auth.isSigningOut}
                    isLoading={auth.isSigningOut}
                  >
                    {tx.retry || "Retry"}
                  </SettingsInlineButton>
                  {auth.signOutBlockReason === "pending-changes" && (
                    <>
                      <SettingsInlineButton
                        icon={Download}
                        onClick={() => {
                          void recoveryExport.handleExport();
                        }}
                        disabled={recoveryExport.isExporting || auth.isSigningOut}
                        isLoading={recoveryExport.isExporting}
                      >
                        {tx.exportData || "Export data"}
                      </SettingsInlineButton>
                      <SettingsInlineButton
                        icon={Trash2}
                        variant="danger"
                        onClick={() => setShowDiscardSignOutConfirm(true)}
                        disabled={auth.isSigningOut}
                      >
                        {tx.authDiscardAndSignOut || "Discard changes and sign out"}
                      </SettingsInlineButton>
                    </>
                  )}
                </SettingsButtonGrid>
              )}

              <SettingsStatus tone="danger">{signOutExportStatus}</SettingsStatus>
            </SettingsInset>
          )}

          {!showDeleteConfirm ? (
            <ActionButton
              buttonRef={deleteTriggerRef}
              icon={Trash2}
              variant="danger"
              onClick={() => {
                del.openDeleteConfirmation();
              }}
            >
              {tx.deleteAccount || "Delete account"}
            </ActionButton>
          ) : (
            <SettingsInset
              className="scroll-mt-[calc(var(--safe-top)+4rem)]"
              containerRef={deleteConfirmationRef}
              tone="danger"
              testId="settings-v2-delete-confirmation"
              tabIndex={-1}
              role="group"
              ariaLabel={tx.deleteAccountConfirm || "Delete your account?"}
            >
              <SettingsFieldHeader
                tone="danger"
                title={tx.deleteAccountConfirm || "Delete your account?"}
                description={tx.deleteAccountWarning || "This action cannot be undone."}
              />
              <SettingsFieldHeader
                htmlFor="settings-v2-delete-confirm"
                tone="danger"
                title={tx.deleteAccountTypeConfirm || "Type DELETE to confirm:"}
              />
              <SettingsTextInput
                id="settings-v2-delete-confirm"
                value={del.deleteConfirmInput}
                onChange={del.setDeleteConfirmInput}
                autoComplete="off"
                disabled={del.isDeletingAccount}
                tone="danger"
              />
              <SettingsButtonGrid columns="confirm">
                <SettingsInlineButton
                  onClick={closeDeleteConfirm}
                  disabled={del.isDeletingAccount}
                >
                  {tx.cancel}
                </SettingsInlineButton>
                <SettingsInlineButton
                  icon={del.isDeletingAccount ? Loader2 : undefined}
                  isLoading={del.isDeletingAccount}
                  onClick={() => {
                    void del.handleDeleteAccount();
                  }}
                  disabled={
                    !del.deleteConfirmMatches ||
                    del.isDeletingAccount
                  }
                  variant="danger"
                >
                  {del.isDeletingAccount ? tx.deleting || "Deleting..." : tx.delete || "Delete"}
                </SettingsInlineButton>
              </SettingsButtonGrid>
            </SettingsInset>
          )}

          <SettingsExternalLink href={deleteAccountHref}>
            {tx.deleteAccountLink || "Learn about account deletion"}
          </SettingsExternalLink>
        </>
      ) : (
        <div className="space-y-3">
          <SettingsInset>
            <p className="text-sm font-semibold text-foreground">
              {tx.settingsAccountSignedOut || "You’re not signed in"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx.settingsAccountDataOnDevice ||
                "Your data stays on this device. Sign in to back it up and use it on your other devices."}
            </p>
          </SettingsInset>
          {auth.enabledProviders.map((provider) => (
            <AuthProviderButton
              key={provider.id}
              provider={provider}
              label={tx[provider.labelKey] || provider.fallbackLabel}
              loadingLabel={tx[provider.loadingLabelKey] || provider.fallbackLoadingLabel}
              isLoading={auth.signingInProvider === provider.id}
              disabled={auth.isSigningIn}
              onClick={() => {
                void auth.handleProvider(provider.id);
              }}
              surface="subtle"
            />
          ))}
        </div>
      )}

      <div>
        <SettingsStatus>{auth.signOutBlockReason ? null : auth.authStatus}</SettingsStatus>
        <SettingsStatus>{del.deleteStatus}</SettingsStatus>
      </div>
    </PanelFrame>
  );
}
