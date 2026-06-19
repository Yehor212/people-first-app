import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft, Download, Fingerprint, KeyRound, Lock, Shield } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useJournalSecurity } from "./useJournalSecurity";

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
  onClick,
}: {
  label: string;
  tone?: "default" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors",
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
  onBack,
  children,
}: {
  title: string;
  description: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        <span>Back</span>
      </button>

      <div className="mt-3">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <div className="mt-5">{children}</div>
    </section>
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

  const securityDescription = useMemo(() => {
    if (security.hasPassword) {
      return (
        ts.journalBiometricSubtitle ||
        "Protect your journal and choose how you unlock it."
      );
    }

    return (
      ts.journalLockHint ||
      "Protect your diary with a password so only you can open it."
    );
  }, [security.hasPassword, ts]);

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

    try {
      await security.setPassword(setupPassword);
      setSetupPassword("");
      setSetupConfirm("");
      onSectionChange("overview");
    } finally {
      setSetupSubmitting(false);
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

    try {
      const ok = await security.changePassword(currentPassword, nextPassword);
      if (!ok) {
        setChangeError(ts.journalPasswordOldWrong || "Current password is incorrect");
        return;
      }

      setCurrentPassword("");
      setNextPassword("");
      setChangeConfirm("");
      onSectionChange("overview");
    } finally {
      setChangeSubmitting(false);
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
          onBack={() => {
            setSetupError("");
            onSectionChange("overview");
          }}
        >
          <form className="space-y-4" onSubmit={handleSetupSubmit}>
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
              />
            </div>

            {setupError ? (
              <p className="text-sm text-destructive">{setupError}</p>
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
                onClick={() => {
                  setSetupError("");
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
          onBack={() => {
            setChangeError("");
            onSectionChange("overview");
          }}
        >
          <form className="space-y-4" onSubmit={handleChangeSubmit}>
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
              />
            </div>

            {changeError ? (
              <p className="text-sm text-destructive">{changeError}</p>
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
                onClick={() => {
                  setChangeError("");
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
                onClick={() => onSectionChange("password-change")}
              />
              <SettingsActionButton
                label={ts.journalPasswordRemove || "Remove Password Lock"}
                tone="danger"
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
              onCheckedChange={security.setBiometricEnabled}
              aria-label={ts.journalBiometricEnable || "Biometric Unlock"}
            />
          </div>
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
