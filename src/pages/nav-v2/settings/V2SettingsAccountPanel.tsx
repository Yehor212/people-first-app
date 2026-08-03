import { useCallback, useEffect, useRef, useState } from "react";
import { Cloud, Download, Loader2, RefreshCw, Trash2, UserRound } from "lucide-react";
import { AuthProviderButton } from "@/components/auth/AuthProviderButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { getAuthProviderConfig, type SocialAuthProviderConfig } from "@/lib/authProviders";
import { useDeleteAccount } from "@/components/settings/account-section/useDeleteAccount";
import { useDataExport } from "@/components/settings/data-section/useDataExport";
import {
  ActionButton,
  PanelFrame,
  SettingsButtonGrid,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsInset,
  SettingsStatus,
} from "./components/V2SettingsControlPrimitives";
import { V2SettingsAccountDeletion } from "./V2SettingsAccountDeletion";
import type { AccountAuthController, AccountViewState } from "./useSettingsOverviewModules";
import type { V2SettingsControls } from "./types";

function getProviderName(tx: Record<string, string>, provider: SocialAuthProviderConfig) {
  return tx[provider.nameKey] || provider.fallbackName;
}
export function AccountPanel({
  controls,
  auth,
  accountViewState,
}: {
  controls: V2SettingsControls;
  auth: AccountAuthController;
  accountViewState: AccountViewState;
}) {
  const { language, t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const del = useDeleteAccount({
    t: tx,
    activeUserId: auth.sessionUserId,
  });
  const [signOutExportStatus, setSignOutExportStatus] = useState<string | null>(null);
  const [showDiscardSignOutConfirm, setShowDiscardSignOutConfirm] = useState(false);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteConfirmationRef = useRef<HTMLDivElement>(null);
  const shouldRestoreDeleteFocusRef = useRef(false);
  const discardTriggerRef = useRef<HTMLButtonElement>(null);
  const discardConfirmationRef = useRef<HTMLDivElement>(null);
  const shouldRestoreDiscardFocusRef = useRef(false);
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
  const linkedProviderLabels = auth.linkedProviderIds.map((providerId) =>
    getProviderName(tx, getAuthProviderConfig(providerId))
  );
  const closeDeleteConfirm = useCallback(() => {
    if (!closeDeleteConfirmation()) return false;
    shouldRestoreDeleteFocusRef.current = true;
    return true;
  }, [closeDeleteConfirmation]);

  useBackHandler(showDeleteConfirm, () => {
    closeDeleteConfirm();
  });

  const closeDiscardConfirmation = useCallback(() => {
    shouldRestoreDiscardFocusRef.current = true;
    setShowDiscardSignOutConfirm(false);
  }, []);

  useBackHandler(showDiscardSignOutConfirm, closeDiscardConfirmation);

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
    if (!showDeleteConfirm && !showDiscardSignOutConfirm) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (showDeleteConfirm) closeDeleteConfirm();
        else closeDiscardConfirmation();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [closeDeleteConfirm, closeDiscardConfirmation, showDeleteConfirm, showDiscardSignOutConfirm]);

  useEffect(() => {
    if (!showDiscardSignOutConfirm) return;
    shouldRestoreDiscardFocusRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      discardConfirmationRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showDiscardSignOutConfirm]);

  useEffect(() => {
    if (showDiscardSignOutConfirm || !shouldRestoreDiscardFocusRef.current) return;
    shouldRestoreDiscardFocusRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      discardTriggerRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showDiscardSignOutConfirm]);

  useEffect(() => {
    if (!auth.signOutBlockReason) {
      shouldRestoreDiscardFocusRef.current = false;
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
      {!auth.signOutBlockReason && (accountViewState === "unavailable" ? (
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
          <SettingsInset presentation="flat-row">
            <p className="min-w-0 text-sm text-muted-foreground">
              {tx.signedInAs || "Signed in as"}{" "}
              <bdi
                dir="auto"
                data-testid="settings-v2-session-account-label"
                className="min-w-0 max-w-full break-words font-semibold text-foreground [overflow-wrap:anywhere]"
              >
                {auth.sessionAccountLabel || auth.sessionDisplayName}
              </bdi>
            </p>
          </SettingsInset>

          {linkedProviderLabels.length > 0 && (
            <SettingsInset presentation="flat-row">
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

          <V2SettingsAccountDeletion
            controller={del}
            language={language}
            tx={tx}
            triggerRef={deleteTriggerRef}
            confirmationRef={deleteConfirmationRef}
            onClose={closeDeleteConfirm}
          />
        </>
      ) : (
        <div className="space-y-3">
          <SettingsInset presentation="flat-row">
            <p className="min-w-0 whitespace-normal break-words text-sm font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word]">
              {tx.settingsAccountSignedOut || "You’re not signed in"}
            </p>
            <p className="mt-1 min-w-0 whitespace-normal break-words text-xs leading-relaxed text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
              {tx.settingsAccountDataOnDevice ||
                "You can use ZenFlow without an account. Sign in to save new changes online and use them on your other devices."}
            </p>
          </SettingsInset>
          {!auth.signOutBlockReason &&
            auth.enabledProviders.map((provider) => (
              <AuthProviderButton
                key={provider.id}
                provider={provider}
                label={tx[provider.labelKey] || provider.fallbackLabel}
                loadingLabel={tx[provider.loadingLabelKey] || provider.fallbackLoadingLabel}
                isLoading={auth.signingInProvider === provider.id}
                disabled={auth.isSigningIn || auth.isSigningOut}
                onClick={() => {
                  void auth.handleProvider(provider.id);
                }}
                surface="subtle"
              />
            ))}
        </div>
      ))}

      {auth.signOutBlockReason && (
        <SettingsInset tone="danger" testId="settings-v2-sign-out-recovery">
          <div role="status" aria-live="polite" aria-atomic="true">
            <SettingsFieldHeader
              tone="danger"
              title={tx.authSignOutRecoveryTitle || "Finish signing out"}
              description={auth.authStatus || tx.authSignOutFailed || "Sign-out did not complete."}
            />
          </div>

          {auth.signOutBlockReason === "pending-changes" && showDiscardSignOutConfirm ? (
            <div
              ref={discardConfirmationRef}
              tabIndex={-1}
              role="group"
              aria-label={tx.authDiscardSignOutConfirm || "Discard unsaved changes and sign out?"}
              data-testid="settings-v2-discard-sign-out-confirmation"
              className="min-w-0 space-y-2.5 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
            >
              <SettingsFieldHeader
                tone="danger"
                title={tx.authDiscardSignOutConfirm || "Discard unsaved changes and sign out?"}
                description={
                  tx.authDiscardSignOutWarning ||
                  "Changes waiting to be saved online will be permanently removed from this device."
                }
              />
              <SettingsButtonGrid columns="confirm">
                <SettingsInlineButton
                  onClick={closeDiscardConfirmation}
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
            </div>
          ) : (
            <SettingsButtonGrid
              columns={auth.signOutBlockReason === "pending-changes" ? "three" : "two"}
            >
              <SettingsInlineButton
                icon={RefreshCw}
                onClick={() => {
                  void auth.handleAccountCleanupRetry();
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
                    buttonRef={discardTriggerRef}
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

      <div>
        <SettingsStatus>{auth.signOutBlockReason ? null : auth.authStatus}</SettingsStatus>
        <SettingsStatus>{del.deleteStatus}</SettingsStatus>
      </div>
    </PanelFrame>
  );
}
