import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JournalSettingsContent } from "../JournalSettingsContent";
import type { useJournalSecurity } from "../useJournalSecurity";

type JournalSecurityState = ReturnType<typeof useJournalSecurity>;

const ts = {
  cancel: "Cancel",
  journalBack: "Back",
  journalPasswordChange: "Change Password",
  journalPasswordChangeConfirm: "Change Password",
  journalPasswordChangeFailed: "We could not update the diary lock. Try again.",
  journalPasswordConfirm: "Confirm your password",
  journalPasswordEnter: "Enter password",
  journalPasswordMismatch: "Passwords do not match",
  journalPasswordNewEnter: "Enter your new password",
  journalPasswordActiveHint: "Diary lock is active. Change or remove it here.",
  journalPasswordOldEnter: "Enter your current password",
  journalPasswordSetup: "Set Diary Password",
  journalPasswordSetupFailed: "We could not turn on the diary lock. Try again.",
  journalPasswordOldWrong: "Current password is incorrect",
  journalBiometricEnable: "Biometric Unlock",
  journalBiometricSubtitle: "Use fingerprint or face to unlock",
  journalBiometricUpdateFailed: "Biometric unlock could not be updated. Try again.",
  journalLockHint: "Protect your diary with a password so only you can open it.",
  journalLockTooShort: "Minimum 6 characters",
  journalSettings: "Diary Settings",
  journalProtectionRemovalCloudPending:
    "The diary lock is off on this device. ZenFlow is still finishing this change online; keep the app open and connect to the internet.",
  journalProtectionRemovalPreflightPending:
    "The diary lock is still on. ZenFlow paused before changing your entries. Unlock the diary, stay online, and continue removal.",
  journalPasswordRemovalResume: "Continue removing diary lock",
  journalProtectionRemovalRetry: "Retry online cleanup",
  journalProtectionRemovalRetryPending: "Trying again...",
  journalImport: "Import backup",
  journalImportHint: "Restore entries from a ZenFlow JSON backup. Existing entries stay in place.",
  journalImporting: "Importing backup...",
};

function makeSecurity(overrides: Partial<JournalSecurityState> = {}): JournalSecurityState {
  return {
    biometricAvailable: false,
    biometricEnabled: false,
    cloudProtectionPending: false,
    cloudProtectionPendingKind: null,
    changePassword: vi.fn().mockResolvedValue(true),
    cooldownRemaining: 0,
    failedAttempts: 0,
    hasPassword: false,
    isLocked: false,
    isUnlocked: true,
    loading: false,
    loadError: false,
    lock: vi.fn(),
    removePassword: vi.fn(),
    retryPasswordRemovalCleanup: vi.fn().mockResolvedValue("pending"),
    setBiometricEnabled: vi.fn(),
    setPassword: vi.fn().mockResolvedValue(undefined),
    touch: vi.fn(),
    retryLoad: vi.fn().mockResolvedValue(undefined),
    unlock: vi.fn(),
    unlockWithBiometric: vi.fn(),
    vaultKey: null,
    ...overrides,
  };
}

describe("JournalSettingsContent password error handling", () => {
  it("offers the same accessible import action and progress feedback on every settings surface", () => {
    const onRequestImport = vi.fn();
    const { rerender } = render(
      <JournalSettingsContent
        ts={ts}
        security={makeSecurity()}
        section="overview"
        onSectionChange={vi.fn()}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestImport={onRequestImport}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Import backup" }));
    expect(onRequestImport).toHaveBeenCalledOnce();
    expect(screen.getByText("Restore entries from a ZenFlow JSON backup. Existing entries stay in place.")).toBeInTheDocument();

    rerender(
      <JournalSettingsContent
        ts={ts}
        security={makeSecurity()}
        section="overview"
        onSectionChange={vi.fn()}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestImport={onRequestImport}
        importing
        importFeedback={{ type: "success", message: "Imported: 2 entries" }}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Importing backup..." })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Imported: 2 entries");
  });

  it("adds a stable password-manager username to setup and change forms without account data", () => {
    const setup = render(
      <JournalSettingsContent
        ts={ts}
        security={makeSecurity()}
        section="password-setup"
        onSectionChange={vi.fn()}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    const setupUsername = setup.container.querySelector<HTMLInputElement>('input[autocomplete="username"]');
    expect(setupUsername).toBeTruthy();
    expect(setupUsername).toHaveValue("zenflow-diary-lock");
    expect(screen.getByLabelText("Enter password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Confirm your password")).toHaveAttribute("autocomplete", "new-password");

    setup.unmount();

    const change = render(
      <JournalSettingsContent
        ts={ts}
        security={makeSecurity({ hasPassword: true })}
        section="password-change"
        onSectionChange={vi.fn()}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    const changeUsername = change.container.querySelector<HTMLInputElement>('input[autocomplete="username"]');
    expect(changeUsername).toBeTruthy();
    expect(changeUsername).toHaveValue("zenflow-diary-lock");
    expect(screen.getByLabelText("Enter your current password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText("Enter your new password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Confirm your password")).toHaveAttribute("autocomplete", "new-password");
  });

  it("keeps password setup open and shows feedback when setup fails", async () => {
    const onSectionChange = vi.fn();
    const security = makeSecurity({
      setPassword: vi.fn().mockRejectedValue(new Error("indexeddb unavailable")),
    });

    render(
      <JournalSettingsContent
        ts={ts}
        security={security}
        section="password-setup"
        onSectionChange={onSectionChange}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Enter password"), {
      target: { value: "strong-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm your password"), {
      target: { value: "strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set Diary Password" }));

    expect(await screen.findByText("We could not turn on the diary lock. Try again.")).toBeInTheDocument();
    expect(onSectionChange).not.toHaveBeenCalledWith("overview");
  });

  it("keeps password change open and shows feedback when change fails unexpectedly", async () => {
    const onSectionChange = vi.fn();
    const security = makeSecurity({
      hasPassword: true,
      changePassword: vi.fn().mockRejectedValue(new Error("crypto failed")),
    });

    render(
      <JournalSettingsContent
        ts={ts}
        security={security}
        section="password-change"
        onSectionChange={onSectionChange}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Enter your current password"), {
      target: { value: "old-password" },
    });
    fireEvent.change(screen.getByLabelText("Enter your new password"), {
      target: { value: "new-strong-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm your password"), {
      target: { value: "new-strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change Password" }));

    expect(await screen.findByText("We could not update the diary lock. Try again.")).toBeInTheDocument();
    expect(onSectionChange).not.toHaveBeenCalledWith("overview");
  });

  it("shows feedback when biometric toggle enrollment does not complete", async () => {
    const security = makeSecurity({
      biometricAvailable: true,
      hasPassword: true,
      setBiometricEnabled: vi.fn().mockResolvedValue(false),
    });

    render(
      <JournalSettingsContent
        ts={ts}
        security={security}
        section="overview"
        onSectionChange={vi.fn()}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Biometric Unlock" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Biometric unlock could not be updated. Try again.",
    );
  });

  it("does not describe biometric unlock when biometric controls are unavailable", () => {
    const security = makeSecurity({
      biometricAvailable: false,
      hasPassword: true,
    });

    render(
      <JournalSettingsContent
        ts={ts}
        security={security}
        section="overview"
        onSectionChange={vi.fn()}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    expect(screen.getByText("Diary lock is active. Change or remove it here.")).toBeInTheDocument();
    expect(screen.queryByText("Use fingerprint or face to unlock")).not.toBeInTheDocument();
  });

  it("does not claim local protection and retries cleanup after removal is pending", async () => {
    const retryPasswordRemovalCleanup = vi.fn().mockResolvedValue("pending");
    render(
      <JournalSettingsContent
        ts={ts}
        security={makeSecurity({
          hasPassword: false,
          cloudProtectionPending: true,
          cloudProtectionPendingKind: "removal",
          retryPasswordRemovalCleanup,
        })}
        section="overview"
        onSectionChange={vi.fn()}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "The diary lock is off on this device. ZenFlow is still finishing this change online",
    );
    expect(screen.queryByRole("button", { name: "Set Diary Password" })).not.toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Retry online cleanup" });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    await act(async () => undefined);
    expect(retryPasswordRemovalCleanup).toHaveBeenCalledOnce();
  });

  it("keeps the owner recovery action reachable while protected removal is pending", () => {
    const onRequestRemovePassword = vi.fn();
    render(
      <JournalSettingsContent
        ts={ts}
        security={makeSecurity({
          hasPassword: true,
          cloudProtectionPending: true,
          cloudProtectionPendingKind: "removal",
        })}
        section="overview"
        onSectionChange={vi.fn()}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={onRequestRemovePassword}
      />,
    );

    const resume = screen.getByRole("button", {
      name: "Continue removing diary lock",
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "The diary lock is still on. ZenFlow paused before changing your entries.",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "The diary lock is off on this device",
    );
    expect(resume).toBeEnabled();
    fireEvent.click(resume);
    expect(onRequestRemovePassword).toHaveBeenCalledOnce();
  });

  it("clears password setup secrets when leaving the setup form", () => {
    const onSectionChange = vi.fn();

    const { rerender } = render(
      <JournalSettingsContent
        ts={ts}
        security={makeSecurity()}
        section="password-setup"
        onSectionChange={onSectionChange}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Enter password"), {
      target: { value: "strong-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm your password"), {
      target: { value: "strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSectionChange).toHaveBeenCalledWith("overview");

    rerender(
      <JournalSettingsContent
        ts={ts}
        security={makeSecurity()}
        section="password-setup"
        onSectionChange={onSectionChange}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Enter password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm your password")).toHaveValue("");
  });

  it("ignores late password setup failures after the user leaves the form", async () => {
    const onSectionChange = vi.fn();
    let rejectSetup!: (reason?: unknown) => void;
    const security = makeSecurity({
      setPassword: vi.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectSetup = reject;
          }),
      ),
    });

    const { rerender } = render(
      <JournalSettingsContent
        ts={ts}
        security={security}
        section="password-setup"
        onSectionChange={onSectionChange}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Enter password"), {
      target: { value: "strong-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm your password"), {
      target: { value: "strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set Diary Password" }));

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    rerender(
      <JournalSettingsContent
        ts={ts}
        security={security}
        section="overview"
        onSectionChange={onSectionChange}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );
    rejectSetup(new Error("late failure"));

    expect(onSectionChange).not.toHaveBeenCalledWith("overview");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(
      <JournalSettingsContent
        ts={ts}
        security={security}
        section="password-setup"
        onSectionChange={onSectionChange}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Enter password")).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears password change secrets when leaving the change form", () => {
    const onSectionChange = vi.fn();

    const { rerender } = render(
      <JournalSettingsContent
        ts={ts}
        security={makeSecurity({ hasPassword: true })}
        section="password-change"
        onSectionChange={onSectionChange}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Enter your current password"), {
      target: { value: "old-password" },
    });
    fireEvent.change(screen.getByLabelText("Enter your new password"), {
      target: { value: "new-strong-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm your password"), {
      target: { value: "new-strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSectionChange).toHaveBeenCalledWith("overview");

    rerender(
      <JournalSettingsContent
        ts={ts}
        security={makeSecurity({ hasPassword: true })}
        section="password-change"
        onSectionChange={onSectionChange}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Enter your current password")).toHaveValue("");
    expect(screen.getByLabelText("Enter your new password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm your password")).toHaveValue("");
  });

  it("ignores late password change failures after the user leaves the form", async () => {
    const onSectionChange = vi.fn();
    let rejectChange!: (reason?: unknown) => void;
    const security = makeSecurity({
      hasPassword: true,
      changePassword: vi.fn(
        () =>
          new Promise<boolean>((_resolve, reject) => {
            rejectChange = reject;
          }),
      ),
    });

    const { rerender } = render(
      <JournalSettingsContent
        ts={ts}
        security={security}
        section="password-change"
        onSectionChange={onSectionChange}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Enter your current password"), {
      target: { value: "old-password" },
    });
    fireEvent.change(screen.getByLabelText("Enter your new password"), {
      target: { value: "new-strong-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm your password"), {
      target: { value: "new-strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change Password" }));

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    rerender(
      <JournalSettingsContent
        ts={ts}
        security={security}
        section="overview"
        onSectionChange={onSectionChange}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    await act(async () => {
      rejectChange(new Error("late failure"));
      await Promise.resolve();
    });

    expect(onSectionChange).not.toHaveBeenCalledWith("overview");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(
      <JournalSettingsContent
        ts={ts}
        security={security}
        section="password-change"
        onSectionChange={onSectionChange}
        privateMode={false}
        onPrivateModeChange={vi.fn()}
        onOpenExport={vi.fn()}
        onRequestRemovePassword={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Enter your current password")).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
