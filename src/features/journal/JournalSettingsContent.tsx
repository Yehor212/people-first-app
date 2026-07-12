import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft, Download, Fingerprint, KeyRound, Lock, Shield } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { useJournalSecurity } from "./useJournalSecurity";

export type JournalSettingsSection =
  | "overview"
  | "password-setup"
  | "password-change";

type JournalSecurityState = ReturnType<typeof useJournalSecurity>;

interface JournalSettingsContentProps {
  ts: Record<string, string>;
  security: JournalSecurityState;
  section: JournalSettingsSection;
  onSectionChange: (section: JournalSettingsSection) => void;
  privateMode: boolean;
  onPrivateModeChange: (checked: boolean) => void;
  onOpenExport: () => void;
  onRequestRemovePassword: () => void;
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

function SettingsActionButton({
  label,
  tone = "default",
  disabled = false,
  onClick,
}: {
  label: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
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
}

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
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
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
  onPrivateModeChange,
  onOpenExport,
  onRequestRemovePassword,
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
  const setupRequestSeqRef = useRef(0);
  const changeRequestSeqRef = useRef(0);
  const setupErrorId = useId();
  const changeErrorId = useId();
  const biometricErrorId = useId();

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
                disabled={security.cloudProtectionPending}
                onClick={() => onSectionChange("password-change")}
              />
              <SettingsActionButton
                label={ts.journalPasswordRemove || "Remove Password Lock"}
                tone="danger"
                disabled={security.cloudProtectionPending}
                onClick={onRequestRemovePassword}
              />
            </>
          ) : (
            <SettingsActionButton
              label={ts.journalPasswordSetup || "Set Diary Password"}
              onClick={() => onSectionChange("password-setup")}
            />
          )}
        </div>
        {security.cloudProtectionPending ? (
          <p
            role="status"
            className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm leading-6 text-foreground"
          >
            {ts.journalProtectionCloudPending ||
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
              disabled={biometricSubmitting}
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

      <SectionCard
        title={ts.journalPrivateMode || "Hide previews"}
        description={
          ts.journalPrivateModeHint || "Show only titles in the diary list."
        }
        icon={KeyRound}
      >
        <div className="flex min-h-[44px] items-center justify-end">
          <Switch
            checked={privateMode}
            onCheckedChange={onPrivateModeChange}
            aria-label={ts.journalPrivateMode || "Hide previews"}
          />
        </div>
      </SectionCard>

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
            onClick={onOpenExport}
          />
        </div>
      </SectionCard>
    </div>
  );
}
