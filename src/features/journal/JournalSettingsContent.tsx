import { forwardRef, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft, Clock3, Download, Fingerprint, KeyRound, Loader2, Lock, SearchCheck, Shield, Upload } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { safeLocalStorageGet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

import {
  LOCK_TIMEOUT_OPTIONS,
  setAutoLockMs,
  type useJournalSecurity,
} from "./useJournalSecurity";
import { JournalAmbienceSetting } from "./JournalAmbienceSetting";
import {
  flushJournalAiConsentRevocation,
  hasPendingJournalAiConsentRevocation,
  isJournalAiConsentGranted,
  revokeJournalAiConsent,
  subscribeJournalAiConsent,
} from "./journalAiConsent";

export type JournalSettingsSection =
  | "overview"
  | "password-setup"
  | "password-change";

type JournalSecurityState = ReturnType<typeof useJournalSecurity>;

function getStoredAutoLockMs(): number {
  const stored = safeLocalStorageGet<number | null>(SK.JOURNAL_LOCK_TIMEOUT, null);
  return LOCK_TIMEOUT_OPTIONS.some((option) => option.ms === stored) ? stored! : 300_000;
}

interface JournalSettingsContentProps {
  ts: Record<string, string>;
  security: JournalSecurityState;
  section: JournalSettingsSection;
  onSectionChange: (section: JournalSettingsSection) => void;
  privateMode: boolean;
  privateModeError?: string | null;
  onPrivateModeChange: (checked: boolean) => void;
  onOpenExport: () => void;
  onRequestImport?: () => void;
  importing?: boolean;
  importFeedback?: { type: "success" | "error"; message: string } | null;
  onRequestRemovePassword: () => void;
  onBusyChange?: (busy: boolean) => void;
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description: string;
  icon: typeof Lock;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const SettingsActionButton = forwardRef<HTMLButtonElement, {
  label: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  testId?: string;
  onClick: () => void;
}>(function SettingsActionButton({
  label,
  tone = "default",
  disabled = false,
  testId,
  onClick,
}, ref) {
  return (
    <button
      ref={ref}
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger"
          ? "border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15"
          : "border border-border/70 bg-background/80 text-foreground hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
});

function SettingsFormShell({
  title,
  description,
  backLabel,
  disabled = false,
  onBack,
  children,
}: {
  title: string;
  description: string;
  backLabel: string;
  disabled?: boolean;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        onClick={onBack}
        disabled={disabled}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        <span>{backLabel}</span>
      </button>

      <div className="mt-3">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function JournalPasswordManagerUsernameField() {
  return (
    <input
      type="text"
      name="username"
      autoComplete="username"
      value="zenflow-diary-lock"
      readOnly
      aria-hidden="true"
      tabIndex={-1}
      className="sr-only"
    />
  );
}

export function JournalSettingsContent({
  ts,
  security,
  section,
  onSectionChange,
  privateMode,
  privateModeError = null,
  onPrivateModeChange,
  onOpenExport,
  onRequestImport,
  importing = false,
  importFeedback = null,
  onRequestRemovePassword,
  onBusyChange,
}: JournalSettingsContentProps) {
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupSubmitting, setSetupSubmitting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [changeConfirm, setChangeConfirm] = useState("");
  const [changeError, setChangeError] = useState("");
  const [changeSubmitting, setChangeSubmitting] = useState(false);
  const [biometricSubmitting, setBiometricSubmitting] = useState(false);
  const [biometricError, setBiometricError] = useState("");
  const [removalRetrySubmitting, setRemovalRetrySubmitting] = useState(false);
  const [autoLockMs, setAutoLockMsState] = useState(getStoredAutoLockMs);
  const [autoLockError, setAutoLockError] = useState(false);
  const [aiConsentGranted, setAiConsentGranted] = useState(isJournalAiConsentGranted);
  const [aiConsentPending, setAiConsentPending] = useState(false);
  const [aiConsentBusy, setAiConsentBusy] = useState(false);
  const [aiConsentError, setAiConsentError] = useState(false);
  const isBusy =
    setupSubmitting ||
    changeSubmitting ||
    biometricSubmitting ||
    removalRetrySubmitting ||
    aiConsentBusy ||
    importing;
  const setupRequestSeqRef = useRef(0);
  const changeRequestSeqRef = useRef(0);
  const aiConsentRequestSeqRef = useRef(0);
  const setupErrorId = useId();
  const changeErrorId = useId();
  const biometricErrorId = useId();
  const autoLockErrorId = useId();
  const autoLockLabels = {
    0: ts.journalLockTimeoutImmediately,
    60_000: ts.journalLockTimeoutOneMinute,
    300_000: ts.journalLockTimeoutFiveMinutes,
    900_000: ts.journalLockTimeoutFifteenMinutes,
    1_800_000: ts.journalLockTimeoutThirtyMinutes,
  } satisfies Record<(typeof LOCK_TIMEOUT_OPTIONS)[number]["ms"], string>;

  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  useEffect(() => {
    let mounted = true;
    const refresh = async (requestSeq = aiConsentRequestSeqRef.current) => {
      const pending = await hasPendingJournalAiConsentRevocation();
      if (!mounted || aiConsentRequestSeqRef.current !== requestSeq) return;
      setAiConsentGranted(isJournalAiConsentGranted());
      setAiConsentPending(pending);
    };
    const unsubscribe = subscribeJournalAiConsent(() => {
      void refresh();
    });
    const startupRequestSeq = aiConsentRequestSeqRef.current;
    void flushJournalAiConsentRevocation().finally(() => refresh(startupRequestSeq));
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const clearSetupForm = () => {
    setupRequestSeqRef.current += 1;
    setSetupPassword("");
    setSetupConfirm("");
    setSetupError("");
    setSetupSubmitting(false);
  };

  const clearChangeForm = () => {
    changeRequestSeqRef.current += 1;
    setCurrentPassword("");
    setNextPassword("");
    setChangeConfirm("");
    setChangeError("");
    setChangeSubmitting(false);
  };

  useEffect(() => {
    if (section !== "password-setup") {
      setupRequestSeqRef.current += 1;
      setSetupPassword("");
      setSetupConfirm("");
      setSetupError("");
      setSetupSubmitting(false);
    }

    if (section !== "password-change") {
      changeRequestSeqRef.current += 1;
      setCurrentPassword("");
      setNextPassword("");
      setChangeConfirm("");
      setChangeError("");
      setChangeSubmitting(false);
    }
  }, [section]);

  const securityDescription = useMemo(() => {
    if (security.hasPassword) {
      if (!security.biometricAvailable) {
        return (
          ts.journalPasswordActiveHint ||
          "Diary lock is active. Change or remove it here."
        );
      }

      return (
        ts.journalBiometricSubtitle ||
        "Protect your journal and choose how you unlock it."
      );
    }

    return (
      ts.journalLockHint ||
      "Protect your diary with a password so only you can open it."
    );
  }, [security.biometricAvailable, security.hasPassword, ts]);

  const handleSetupSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (setupPassword.trim().length < 6) {
      setSetupError(ts.journalLockTooShort || "Minimum 6 characters");
      return;
    }

    if (setupPassword !== setupConfirm) {
      setSetupError(ts.journalPasswordMismatch || "Passwords do not match");
      return;
    }

    setSetupSubmitting(true);
    setSetupError("");
    const requestSeq = ++setupRequestSeqRef.current;
    const isCurrentRequest = () => setupRequestSeqRef.current === requestSeq;

    try {
      await security.setPassword(setupPassword);
      if (!isCurrentRequest()) return;
      setSetupPassword("");
      setSetupConfirm("");
      onSectionChange("overview");
    } catch {
      if (!isCurrentRequest()) return;
      setSetupError(ts.journalPasswordSetupFailed || "We could not turn on the diary lock. Try again.");
    } finally {
      if (isCurrentRequest()) setSetupSubmitting(false);
    }
  };

  const handleChangeSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!currentPassword.trim()) {
      setChangeError(ts.journalPasswordOldEnter || "Enter your current password");
      return;
    }

    if (nextPassword.trim().length < 6) {
      setChangeError(ts.journalLockTooShort || "Minimum 6 characters");
      return;
    }

    if (nextPassword !== changeConfirm) {
      setChangeError(ts.journalPasswordMismatch || "Passwords do not match");
      return;
    }

    setChangeSubmitting(true);
    setChangeError("");
    const requestSeq = ++changeRequestSeqRef.current;
    const isCurrentRequest = () => changeRequestSeqRef.current === requestSeq;

    try {
      const ok = await security.changePassword(currentPassword, nextPassword);
      if (!isCurrentRequest()) return;
      if (!ok) {
        setChangeError(ts.journalPasswordOldWrong || "Current password is incorrect");
        return;
      }

      setCurrentPassword("");
      setNextPassword("");
      setChangeConfirm("");
      onSectionChange("overview");
    } catch {
      if (!isCurrentRequest()) return;
      setChangeError(ts.journalPasswordChangeFailed || "We could not update the diary lock. Try again.");
    } finally {
      if (isCurrentRequest()) setChangeSubmitting(false);
    }
  };

  const handleBiometricEnabledChange = async (checked: boolean) => {
    if (biometricSubmitting) return;

    setBiometricSubmitting(true);
    setBiometricError("");
    try {
      const ok = await security.setBiometricEnabled(checked);
      if (!ok) {
        setBiometricError(
          ts.journalBiometricUpdateFailed || "Biometric unlock could not be updated. Try again.",
        );
      }
    } catch {
      setBiometricError(
        ts.journalBiometricUpdateFailed || "Biometric unlock could not be updated. Try again.",
      );
    } finally {
      setBiometricSubmitting(false);
    }
  };

  const handleRemovalCleanupRetry = async () => {
    if (removalRetrySubmitting) return;
    setRemovalRetrySubmitting(true);
    try {
      await security.retryPasswordRemovalCleanup();
    } finally {
      setRemovalRetrySubmitting(false);
    }
  };

  const handleRevokeAiConsent = async () => {
    if (aiConsentBusy) return;
    aiConsentRequestSeqRef.current += 1;
    setAiConsentBusy(true);
    setAiConsentError(false);
    setAiConsentGranted(false);
    try {
      const result = await revokeJournalAiConsent();
      const pending = result.status === "pending" || result.status === "owner-mismatch";
      setAiConsentPending(pending);
      setAiConsentError(
        result.status === "owner-unavailable" || result.status === "storage-error",
      );
    } catch {
      setAiConsentPending(true);
      setAiConsentError(true);
    } finally {
      setAiConsentBusy(false);
    }
  };

  if (section === "password-setup") {
    return (
      <div className="space-y-4">
        <SettingsFormShell
          title={ts.journalPasswordSetup || "Set Diary Password"}
          description={
            ts.journalLockHint ||
            "This password protects only your diary. Make it memorable."
          }
          backLabel={ts.journalBack || ts.back || "Back"}
          disabled={setupSubmitting}
          onBack={() => {
            clearSetupForm();
            onSectionChange("overview");
          }}
        >
          <form className="space-y-4" onSubmit={handleSetupSubmit}>
            <JournalPasswordManagerUsernameField />
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="journal-setup-password">
                {ts.journalPasswordEnter || "Enter password"}
              </label>
              <Input
                id="journal-setup-password"
                type="password"
                value={setupPassword}
                onChange={(event) => setSetupPassword(event.target.value)}
                autoComplete="new-password"
                disabled={setupSubmitting}
                aria-invalid={setupError ? true : undefined}
                aria-describedby={setupError ? setupErrorId : undefined}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="journal-setup-confirm">
                {ts.journalPasswordConfirm || "Confirm your password"}
              </label>
              <Input
                id="journal-setup-confirm"
                type="password"
                value={setupConfirm}
                onChange={(event) => setSetupConfirm(event.target.value)}
                autoComplete="new-password"
                disabled={setupSubmitting}
                aria-invalid={setupError ? true : undefined}
                aria-describedby={setupError ? setupErrorId : undefined}
              />
            </div>

            {setupError ? (
              <p id={setupErrorId} role="alert" className="text-sm text-destructive">{setupError}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={setupSubmitting}
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {ts.journalPasswordSetup || "Set Diary Password"}
              </button>
              <SettingsActionButton
                label={ts.cancel || "Cancel"}
                disabled={setupSubmitting}
                onClick={() => {
                  clearSetupForm();
                  onSectionChange("overview");
                }}
              />
            </div>
          </form>
        </SettingsFormShell>
      </div>
    );
  }

  if (section === "password-change") {
    return (
      <div className="space-y-4">
        <SettingsFormShell
          title={ts.journalPasswordChange || "Change Password"}
          description={
            ts.journalPasswordNewEnter ||
            "Update the password that protects your diary."
          }
          backLabel={ts.journalBack || ts.back || "Back"}
          disabled={changeSubmitting}
          onBack={() => {
            clearChangeForm();
            onSectionChange("overview");
          }}
        >
          <form className="space-y-4" onSubmit={handleChangeSubmit}>
            <JournalPasswordManagerUsernameField />
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="journal-current-password">
                {ts.journalPasswordOldEnter || "Enter your current password"}
              </label>
              <Input
                id="journal-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                disabled={changeSubmitting}
                aria-invalid={changeError ? true : undefined}
                aria-describedby={changeError ? changeErrorId : undefined}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="journal-next-password">
                {ts.journalPasswordNewEnter || "Enter your new password"}
              </label>
              <Input
                id="journal-next-password"
                type="password"
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
                autoComplete="new-password"
                disabled={changeSubmitting}
                aria-invalid={changeError ? true : undefined}
                aria-describedby={changeError ? changeErrorId : undefined}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="journal-change-confirm">
                {ts.journalPasswordConfirm || "Confirm your password"}
              </label>
              <Input
                id="journal-change-confirm"
                type="password"
                value={changeConfirm}
                onChange={(event) => setChangeConfirm(event.target.value)}
                autoComplete="new-password"
                disabled={changeSubmitting}
                aria-invalid={changeError ? true : undefined}
                aria-describedby={changeError ? changeErrorId : undefined}
              />
            </div>

            {changeError ? (
              <p id={changeErrorId} role="alert" className="text-sm text-destructive">{changeError}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={changeSubmitting}
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {ts.journalPasswordChangeConfirm || ts.journalPasswordChange || "Change Password"}
              </button>
              <SettingsActionButton
                label={ts.cancel || "Cancel"}
                disabled={changeSubmitting}
                onClick={() => {
                  clearChangeForm();
                  onSectionChange("overview");
                }}
              />
            </div>
          </form>
        </SettingsFormShell>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title={ts.journalSettings || "Diary Settings"}
        description={securityDescription}
        icon={Shield}
      >
        <div className="flex flex-wrap gap-2">
          {security.hasPassword ? (
            <>
              <SettingsActionButton
                label={ts.journalPasswordChange || "Change Password"}
                disabled={security.cloudProtectionPending || importing}
                onClick={() => onSectionChange("password-change")}
              />
              <SettingsActionButton
                label={
                  security.cloudProtectionPendingKind === "removal"
                    ? ts.journalPasswordRemovalResume || "Continue removing diary lock"
                    : ts.journalPasswordRemove || "Remove Password Lock"
                }
                tone="danger"
                disabled={
                  importing ||
                  (security.cloudProtectionPending &&
                    security.cloudProtectionPendingKind !== "removal")
                }
                onClick={onRequestRemovePassword}
              />
            </>
          ) : security.cloudProtectionPendingKind === "removal" ? (
            <SettingsActionButton
              label={
                removalRetrySubmitting
                  ? ts.journalProtectionRemovalRetryPending || "Trying again..."
                  : ts.journalProtectionRemovalRetry || "Retry online cleanup"
              }
              disabled={removalRetrySubmitting || importing}
              onClick={() => void handleRemovalCleanupRetry()}
            />
          ) : security.cloudProtectionPending ? null : (
            <SettingsActionButton
              label={ts.journalPasswordSetup || "Set Diary Password"}
              testId="journal-password-setup-action"
              disabled={importing}
              onClick={() => onSectionChange("password-setup")}
            />
          )}
        </div>
        {security.cloudProtectionPending ? (
          <p
            role="status"
            className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm leading-6 text-foreground"
          >
            {security.cloudProtectionPendingKind === "removal" && security.hasPassword
              ? ts.journalProtectionRemovalPreflightPending ||
                "The diary lock is still on. ZenFlow paused before changing your entries. Unlock the diary, stay online, and continue removal."
              : security.cloudProtectionPendingKind === "removal" || !security.hasPassword
                ? ts.journalProtectionRemovalCloudPending ||
                  "The diary lock is off on this device. ZenFlow is still finishing this change online; keep the app open and connect to the internet."
                : security.cloudProtectionPendingKind === "vault-sync"
                  ? ts.journalProtectionPasswordSyncPending ||
                    "Your new diary password works on this device. ZenFlow is still updating the encrypted key online; keep the app open and connect to the internet."
              : ts.journalProtectionCloudPending ||
                "Protected on this device. ZenFlow is still replacing an older online copy; keep the app open and connect to the internet."}
          </p>
        ) : null}
      </SectionCard>

      {security.hasPassword && security.biometricAvailable ? (
        <SectionCard
          title={ts.journalBiometricEnable || "Biometric Unlock"}
          description={
            ts.journalBiometricSubtitle || "Use fingerprint or face to unlock."
          }
          icon={Fingerprint}
        >
          <div className="flex min-h-[44px] items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                {ts.journalBiometricEnable || "Biometric Unlock"}
              </p>
              <p className="text-xs text-muted-foreground">
                {ts.journalBiometricSubtitle || "Use fingerprint or face to unlock"}
              </p>
            </div>
            <Switch
              checked={security.biometricEnabled}
              onCheckedChange={handleBiometricEnabledChange}
              disabled={biometricSubmitting || importing}
              aria-label={ts.journalBiometricEnable || "Biometric Unlock"}
              aria-describedby={biometricError ? biometricErrorId : undefined}
            />
          </div>
          {biometricError ? (
            <p id={biometricErrorId} role="alert" className="mt-3 text-sm text-destructive">
              {biometricError}
            </p>
          ) : null}
        </SectionCard>
      ) : null}

      {security.hasPassword ? (
        <SectionCard
          title={ts.journalLockTimeout || "Journal auto-lock"}
          description={
            ts.journalLockTimeoutDesc ||
            "Automatically lock the diary after a period of inactivity."
          }
          icon={Clock3}
        >
          <label className="sr-only" htmlFor="journal-auto-lock-timeout">
            {ts.journalLockTimeout || "Journal auto-lock"}
          </label>
          <select
            id="journal-auto-lock-timeout"
            value={autoLockMs}
            disabled={importing}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!setAutoLockMs(next)) {
                setAutoLockError(true);
                return;
              }
              setAutoLockError(false);
              setAutoLockMsState(next);
            }}
            aria-describedby={autoLockError ? autoLockErrorId : undefined}
            className="min-h-[44px] w-full rounded-2xl border border-border/70 bg-background/80 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {LOCK_TIMEOUT_OPTIONS.map((option) => (
              <option key={option.ms} value={option.ms}>
                {autoLockLabels[option.ms]}
              </option>
            ))}
          </select>
          {autoLockError ? (
            <p id={autoLockErrorId} role="alert" className="mt-3 text-sm text-destructive">
              {ts.settingsPreferenceSaveError ||
                "Could not save this change. Your previous setting is still active."}
            </p>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard
        title={ts.journalPrivateMode || "Conceal diary list"}
        description={
          ts.journalPrivateModeHint ||
          "Hides titles, previews, and list actions on this device until you turn it off. This is screen privacy, not password protection."
        }
        icon={KeyRound}
      >
        <div className="flex min-h-[44px] items-center justify-end">
          <Switch
            checked={privateMode}
            onCheckedChange={onPrivateModeChange}
            disabled={importing}
            aria-label={ts.journalPrivateMode || "Conceal diary list"}
          />
        </div>
        {privateModeError ? (
          <p role="alert" className="mt-3 text-sm leading-6 text-destructive">
            {privateModeError}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title={ts.journalAiSearchPrivacy || "Private search privacy"}
        description={
          ts.journalAiPrivacyConfirm ||
          "Private search runs inside your ZenFlow account and does not send journal text or queries to an external AI provider."
        }
        icon={SearchCheck}
      >
        {aiConsentGranted || aiConsentPending ? (
          <SettingsActionButton
            label={
              aiConsentBusy
                ? ts.journalAiRevoking || "Turning off private search..."
                : ts.journalAiRevoke || "Turn off private search and remove its permission"
            }
            tone="danger"
            disabled={aiConsentBusy || importing}
            onClick={() => void handleRevokeAiConsent()}
          />
        ) : (
          <p aria-live="polite" className="text-sm leading-6 text-muted-foreground">
            {ts.journalAiSearchOff ||
              "Private search is off. Standard text search stays on this device."}
          </p>
        )}
        {aiConsentPending ? (
          <p role="status" className="mt-3 text-sm leading-6 text-muted-foreground">
            {ts.journalAiRevokePending ||
              "Private search is off. Removing its permission will retry when you are online."}
          </p>
        ) : null}
        {aiConsentError ? (
          <p role="alert" className="mt-3 text-sm leading-6 text-destructive">
            {ts.journalAiConsentUnavailable ||
              "ZenFlow could not finish this privacy change. Private search remains off; try again after checking your connection and account."}
          </p>
        ) : null}
      </SectionCard>

      <JournalAmbienceSetting tx={ts} />

      {onRequestImport ? (
        <SectionCard
          title={ts.journalImport || "Import backup"}
          description={
            ts.journalImportHint ||
            "Restore entries from a ZenFlow JSON backup. Existing entries stay in place."
          }
          icon={Upload}
        >
          <button
            type="button"
            onClick={onRequestImport}
            disabled={importing}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              {importing
                ? ts.journalImporting || "Importing backup..."
                : ts.journalImport || "Import backup"}
            </span>
          </button>
          {importFeedback ? (
            <p
              role={importFeedback.type === "error" ? "alert" : "status"}
              aria-live={importFeedback.type === "error" ? "assertive" : "polite"}
              className={cn(
                "mt-3 rounded-2xl border px-4 py-3 text-sm leading-6",
                importFeedback.type === "error"
                  ? "border-destructive/20 bg-destructive/10 text-destructive"
                  : "border-primary/20 bg-primary/10 text-foreground",
              )}
            >
              {importFeedback.message}
            </p>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard
        title={ts.journalExport || "Export"}
        description={
          ts.journalExportFormat || "Choose a format to export your diary data."
        }
        icon={Download}
      >
        <div className="flex flex-wrap gap-2">
          <SettingsActionButton
            label={ts.journalExport || "Export Diary Data"}
            disabled={importing}
            onClick={onOpenExport}
          />
        </div>
      </SectionCard>
    </div>
  );
}
