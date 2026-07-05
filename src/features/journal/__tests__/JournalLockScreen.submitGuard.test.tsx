import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JournalLockScreen } from "../JournalLockScreen";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      journalPasswordEnter: "Enter password",
      journalUnlock: "Unlock",
      journalLocked: "Diary Locked",
      journalPasswordWrong: "Wrong password",
      journalPasswordCooldown: "Too many attempts. Wait",
      journalBiometricFailed: "Biometric unlock failed. Try again.",
      journalBiometricUnlock: "Unlock with biometrics",
      journalLockHintLocalOnly:
        "This password encrypts your diary on this device. Keep it somewhere safe; ZenFlow cannot reveal or recover it.",
      journalPasswordForgot: "Can't open the lock?",
    },
  }),
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  const MotionDiv = ReactModule.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>,
  );
  const MotionP = ReactModule.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ children, ...props }, ref) => <p ref={ref} {...props}>{children}</p>,
  );
  return {
    motion: { div: MotionDiv, p: MotionP },
  };
});

describe("JournalLockScreen submit guard", () => {
  it("serializes unlock submits while password verification is pending", async () => {
    let resolveUnlock!: (value: boolean) => void;
    const onUnlock = vi.fn(
      () => new Promise<boolean>((resolve) => {
        resolveUnlock = resolve;
      }),
    );

    render(
      <JournalLockScreen
        mode="unlock"
        cooldownRemaining={0}
        failedAttempts={0}
        onUnlock={onUnlock}
        onSetPassword={vi.fn()}
      />,
    );

    const passwordInput = screen.getByPlaceholderText("Enter password");
    fireEvent.change(passwordInput, {
      target: { value: "wrong password" },
    });
    const unlockButton = screen.getByRole("button", { name: "Unlock" });

    fireEvent.click(unlockButton);
    fireEvent.click(unlockButton);

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(unlockButton).toBeDisabled();

    resolveUnlock(false);

    await waitFor(() => expect(screen.getByText("Wrong password")).toBeInTheDocument());
    expect(passwordInput).not.toBeDisabled();
    expect(unlockButton).toBeDisabled();
  });

  it("shows feedback when biometric unlock does not succeed", async () => {
    const onBiometricUnlock = vi.fn().mockResolvedValue(false);

    render(
      <JournalLockScreen
        mode="unlock"
        cooldownRemaining={0}
        failedAttempts={0}
        onUnlock={vi.fn()}
        onSetPassword={vi.fn()}
        onBiometricUnlock={onBiometricUnlock}
        biometricAvailable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unlock with biometrics" }));

    await waitFor(() => expect(onBiometricUnlock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Biometric unlock failed. Try again.")).toBeInTheDocument();
  });

  it("shows local-only recovery guidance without starting email reset when email lock removal is unavailable", () => {
    const onForgotPassword = vi.fn();

    render(
      <JournalLockScreen
        mode="unlock"
        cooldownRemaining={0}
        failedAttempts={0}
        onUnlock={vi.fn()}
        onSetPassword={vi.fn()}
        onForgotPassword={onForgotPassword}
        emailLockRemovalAvailable={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Can't open the lock?" })).not.toBeInTheDocument();
    expect(screen.getByText(/email lock removal is available in the web or mobile app/i)).toBeInTheDocument();
    expect(onForgotPassword).not.toHaveBeenCalled();
  });

  it("gives password managers a stable hidden username without exposing account data", () => {
    const { container } = render(
      <JournalLockScreen
        mode="unlock"
        cooldownRemaining={0}
        failedAttempts={0}
        onUnlock={vi.fn()}
        onSetPassword={vi.fn()}
      />,
    );

    const usernameInput = container.querySelector<HTMLInputElement>('input[autocomplete="username"]');
    const passwordInput = screen.getByPlaceholderText("Enter password");

    expect(usernameInput).toBeTruthy();
    expect(usernameInput).toHaveValue("zenflow-diary-lock");
    expect(usernameInput).toHaveAttribute("type", "text");
    expect(usernameInput).toHaveAttribute("readonly");
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
  });

  it("labels the password field and announces lockout cooldowns", () => {
    render(
      <JournalLockScreen
        mode="unlock"
        cooldownRemaining={7}
        failedAttempts={3}
        onUnlock={vi.fn()}
        onSetPassword={vi.fn()}
      />,
    );

    const passwordInput = screen.getByLabelText("Enter password");

    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
    expect(passwordInput).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("lock-password-cooldown"),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Too many attempts. Wait 7s");
  });

  it("uses email-aware setup copy when email lock removal is available", () => {
    render(
      <JournalLockScreen
        mode="setup"
        cooldownRemaining={0}
        failedAttempts={0}
        onUnlock={vi.fn()}
        onSetPassword={vi.fn()}
        emailLockRemovalAvailable
      />,
    );

    expect(screen.getByText(/verified email can remove the lock/i)).toBeInTheDocument();
    expect(screen.queryByText(/cannot reveal or recover/i)).not.toBeInTheDocument();
  });
  it("uses recovery-safe setup copy when email lock removal is unavailable", () => {
    render(
      <JournalLockScreen
        mode="setup"
        cooldownRemaining={0}
        failedAttempts={0}
        onUnlock={vi.fn()}
        onSetPassword={vi.fn()}
        emailLockRemovalAvailable={false}
      />,
    );

    expect(screen.getByText(/cannot reveal or recover/i)).toBeInTheDocument();
  });
});
