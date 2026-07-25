import { memo, type Ref } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { BASE_URL } from "@/lib/env";
import {
  ActionButton,
  SettingsButtonGrid,
  SettingsExternalLink,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsInset,
  SettingsTextInput,
} from "./components/V2SettingsControlPrimitives";

const DELETE_ACCOUNT_DISCLOSURE_LOCALES = new Set(["en", "uk", "es", "de", "fr", "ja", "ar", "he"]);

interface AccountDeletionController {
  showDeleteConfirm: boolean;
  deleteConfirmInput: string;
  setDeleteConfirmInput: (value: string) => void;
  deleteConfirmMatches: boolean;
  isDeletingAccount: boolean;
  openDeleteConfirmation: () => boolean;
  handleDeleteAccount: () => Promise<void>;
}

interface V2SettingsAccountDeletionProps {
  controller: AccountDeletionController;
  language: string;
  tx: Record<string, string>;
  triggerRef: Ref<HTMLButtonElement>;
  confirmationRef: Ref<HTMLDivElement>;
  onClose: () => boolean;
}

function getDeleteAccountDisclosureLocale(language: string): string {
  return DELETE_ACCOUNT_DISCLOSURE_LOCALES.has(language) ? language : "en";
}

export const V2SettingsAccountDeletion = memo(function V2SettingsAccountDeletion({
  controller,
  language,
  tx,
  triggerRef,
  confirmationRef,
  onClose,
}: V2SettingsAccountDeletionProps) {
  const deleteAccountHref = `${BASE_URL}delete-account.html?lang=${encodeURIComponent(
    getDeleteAccountDisclosureLocale(language)
  )}`;

  if (!controller.showDeleteConfirm) {
    return (
      <>
        <ActionButton
          buttonRef={triggerRef}
          icon={Trash2}
          variant="danger"
          onClick={() => {
            controller.openDeleteConfirmation();
          }}
        >
          {tx.deleteAccount || "Delete account"}
        </ActionButton>
        <div id="settings-v2-delete-details">
          <SettingsExternalLink href={deleteAccountHref}>
            {tx.deleteAccountLink || "Learn about account deletion"}
          </SettingsExternalLink>
        </div>
      </>
    );
  }

  return (
    <SettingsInset
      className="scroll-mt-[calc(var(--safe-top)+4rem)]"
      containerRef={confirmationRef}
      tone="danger"
      testId="settings-v2-delete-confirmation"
      tabIndex={-1}
      role="group"
      ariaLabelledBy="settings-v2-delete-title"
      ariaDescribedBy="settings-v2-delete-warning settings-v2-delete-details"
    >
      <div className="mb-2.5">
        <h3
          id="settings-v2-delete-title"
          className="min-w-0 break-words text-sm font-semibold text-destructive [hyphens:manual] [overflow-wrap:break-word]"
        >
          {tx.deleteAccountConfirm || "Delete your account?"}
        </h3>
        <p
          id="settings-v2-delete-warning"
          className="mt-1 break-words text-xs leading-relaxed text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]"
        >
          {tx.deleteAccountWarning ||
            "Deleting your account removes your ZenFlow sign-in, data saved with that account, and this account’s data from this device. This can’t be undone. Feedback you sent is stored separately and isn’t deleted automatically."}
        </p>
      </div>
      <div id="settings-v2-delete-details">
        <SettingsExternalLink href={deleteAccountHref}>
          {tx.deleteAccountLink || "Learn about account deletion"}
        </SettingsExternalLink>
      </div>
      <SettingsFieldHeader
        htmlFor="settings-v2-delete-confirm"
        tone="danger"
        title={tx.deleteAccountTypeConfirm || "Type DELETE to confirm:"}
      />
      <SettingsTextInput
        id="settings-v2-delete-confirm"
        value={controller.deleteConfirmInput}
        onChange={controller.setDeleteConfirmInput}
        autoComplete="off"
        disabled={controller.isDeletingAccount}
        tone="danger"
        ariaDescribedBy="settings-v2-delete-warning settings-v2-delete-details"
      />
      <SettingsButtonGrid columns="confirm">
        <SettingsInlineButton onClick={onClose} disabled={controller.isDeletingAccount}>
          {tx.cancel}
        </SettingsInlineButton>
        <SettingsInlineButton
          icon={controller.isDeletingAccount ? Loader2 : undefined}
          isLoading={controller.isDeletingAccount}
          onClick={() => {
            void controller.handleDeleteAccount();
          }}
          disabled={!controller.deleteConfirmMatches || controller.isDeletingAccount}
          variant="danger"
        >
          {controller.isDeletingAccount ? tx.deleting || "Deleting..." : tx.delete || "Delete"}
        </SettingsInlineButton>
      </SettingsButtonGrid>
    </SettingsInset>
  );
});
