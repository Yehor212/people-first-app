import { useEffect } from "react";
import { Cloud, Loader2, Mail, Trash2, UserRound } from "lucide-react";
import { AuthProviderButton } from "@/components/auth/AuthProviderButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useScrollLock } from "@/hooks/useScrollLock";
import { getAuthProviderConfig, type SocialAuthProviderConfig } from "@/lib/authProviders";
import { BASE_URL } from "@/lib/env";
import { supabase } from "@/lib/supabaseClient";
import { useAccountAuth } from "@/components/settings/account-section/useAccountAuth";
import { useAccountSync } from "@/components/settings/account-section/useAccountSync";
import { useDeleteAccount } from "@/components/settings/account-section/useDeleteAccount";
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
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";

function getProviderName(tx: Record<string, string>, provider: SocialAuthProviderConfig) {
  return tx[provider.nameKey] || provider.fallbackName;
}

function formatProviderText(
  tx: Record<string, string>,
  template: string | undefined,
  provider: SocialAuthProviderConfig
) {
  return (template || "Connect {provider}").replace("{provider}", getProviderName(tx, provider));
}

export function AccountPanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const auth = useAccountAuth({ onNameChange: controls.onNameChange, t: tx });
  const sync = useAccountSync({
    sessionUserId: auth.sessionUserId,
    setAuthStatus: auth.setAuthStatus,
    t: tx,
  });
  const del = useDeleteAccount({ onResetData: controls.onResetData, t: tx });
  const { setShowDeleteConfirm, showDeleteConfirm } = del;
  const deleteAccountHref = `${BASE_URL}delete-account.html`;
  const linkedProviderLabels = auth.linkedProviderIds.map((providerId) =>
    getProviderName(tx, getAuthProviderConfig(providerId))
  );
  const linkableProviders = auth.enabledProviders.filter(
    (provider) => !auth.linkedProviderIds.includes(provider.id)
  );

  useBackHandler(showDeleteConfirm, () => setShowDeleteConfirm(false));
  useScrollLock(showDeleteConfirm);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowDeleteConfirm(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setShowDeleteConfirm, showDeleteConfirm]);

  return (
    <PanelFrame
      icon={Cloud}
      title={tx.settingsCloudSyncTitle || tx.settingsGroupAccount || tx.account || "Account"}
      description={tx.settingsCloudSyncDescription || "Signed-in data stays synced automatically."}
      testId="settings-v2-panel-account"
      showHeader={false}
    >
      {!supabase ? (
        <SettingsInset>
          <SettingsStatus>{tx.cloudSyncDisabled || "Cloud sync is not available."}</SettingsStatus>
        </SettingsInset>
      ) : auth.hasSession ? (
        <>
          <SettingsInset>
            <p className="text-sm text-muted-foreground">
              {tx.signedInAs || "Signed in as"}{" "}
              <span className="font-semibold text-foreground">
                {auth.sessionAccountLabel || auth.sessionDisplayName}
              </span>
            </p>
          </SettingsInset>

          <SettingsInset>
            <SettingsFieldHeader
              icon={Mail}
              title={tx.weeklyDigestTitle || "Weekly Progress Report"}
            />
            <ToggleRow
              icon={Mail}
              title={tx.weeklyDigestTitle || "Weekly Progress Report"}
              description={
                tx.weeklyDigestDescription ||
                "Receive a weekly summary of your habits, focus time, and mood trends."
              }
              checked={sync.weeklyDigestEnabled}
              disabled={sync.weeklyDigestLoading}
              onCheckedChange={(checked) => {
                sync.weeklyDigestTouchedRef.current = true;
                sync.setWeeklyDigestEnabled(checked);
                void sync.handleWeeklyDigestToggle(checked);
              }}
              testId="settings-v2-weekly-digest"
            />
          </SettingsInset>

          <SettingsInset>
            <SettingsFieldHeader title={tx.authLinkedProviders || "Connected sign-in methods"} />
            {linkedProviderLabels.length > 0 && (
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
            )}
            <div className="space-y-2">
              {linkableProviders.map((provider) => {
                const isLinking = auth.linkingProvider === provider.id;
                return (
                  <AuthProviderButton
                    key={provider.id}
                    provider={provider}
                    label={formatProviderText(tx, tx.authConnectProvider, provider)}
                    loadingLabel={formatProviderText(tx, tx.authLinkingProvider, provider)}
                    isLoading={isLinking}
                    disabled={auth.linkingProvider !== null}
                    onClick={() => {
                      void auth.handleLinkProvider(provider.id);
                    }}
                    surface="subtle"
                  />
                );
              })}
            </div>
          </SettingsInset>

          <ActionButton
            icon={auth.isSigningOut ? Loader2 : UserRound}
            onClick={() => {
              void auth.handleSignOut();
            }}
            disabled={auth.isSigningOut}
          >
            {auth.isSigningOut ? tx.signingOut || "Signing out..." : tx.signOut || "Sign out"}
          </ActionButton>

          {!showDeleteConfirm ? (
            <ActionButton
              icon={Trash2}
              variant="danger"
              onClick={() => {
                del.setShowDeleteConfirm(true);
                del.setDeleteConfirmInput("");
              }}
            >
              {tx.deleteAccount || "Delete account"}
            </ActionButton>
          ) : (
            <SettingsInset tone="danger">
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
                tone="danger"
              />
              <SettingsButtonGrid columns="confirm">
                <SettingsInlineButton
                  onClick={() => {
                    del.setShowDeleteConfirm(false);
                    del.setDeleteConfirmInput("");
                  }}
                >
                  {tx.cancel}
                </SettingsInlineButton>
                <SettingsInlineButton
                  onClick={() => {
                    void del.handleDeleteAccount();
                  }}
                  disabled={
                    del.deleteConfirmInput !== (tx.deleteConfirmWord || "DELETE") ||
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
              {tx.sessionExpiredSettings || "Sign in to sync automatically."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx.localDataSafe || "Your local data is safe."}
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

      <div role="status" aria-live="polite">
        <SettingsStatus>{auth.authStatus}</SettingsStatus>
        <SettingsStatus>{del.deleteStatus}</SettingsStatus>
      </div>
    </PanelFrame>
  );
}
