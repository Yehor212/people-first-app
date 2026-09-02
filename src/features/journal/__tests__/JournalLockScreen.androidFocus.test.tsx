import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JournalLockScreen } from "../JournalLockScreen";

vi.mock("@/lib/platform", () => ({ isAndroid: true }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      journalPasswordEnter: "Enter password",
      journalUnlock: "Unlock",
      journalLocked: "Diary Locked",
      journalLockHintLocalOnly: "Local lock guidance",
      journalPasswordForgot: "Can't open the lock?",
    },
  }),
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await import("react");
  const MotionDiv = ReactModule.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ));
  const MotionP = ReactModule.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
  >(({ children, ...props }, ref) => (
    <p ref={ref} {...props}>
      {children}
    </p>
  ));
  return { motion: { div: MotionDiv, p: MotionP } };
});

describe("JournalLockScreen Android focus ownership", () => {
  it("keeps the IME closed on initial route mount and focuses only after user intent", () => {
    render(
      <JournalLockScreen
        mode="unlock"
        cooldownRemaining={0}
        failedAttempts={0}
        onUnlock={vi.fn()}
        onSetPassword={vi.fn()}
      />,
    );

    const passwordInput = screen.getByLabelText("Enter password");

    expect(document.activeElement).not.toBe(passwordInput);

    passwordInput.focus();
    expect(document.activeElement).toBe(passwordInput);
  });
});
