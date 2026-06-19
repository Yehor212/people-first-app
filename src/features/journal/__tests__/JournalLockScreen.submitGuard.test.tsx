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
      journalBiometricFailed: "Biometric unlock failed. Try again.",
      journalBiometricUnlock: "Unlock with biometrics",
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
});
