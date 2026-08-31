import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeatureAvailabilityDialog } from "../FeatureAvailabilityDialog";
import { RemovePasswordConfirmDialog } from "@/features/journal";
import type { FeatureAvailability } from "@/lib/featureAvailability";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      close: "Close",
      featureUnavailableTitle: "Feature temporarily unavailable",
      featureUnavailableChecking:
        "ZenFlow is checking your saved diary progress. Keep this screen open and try again in a moment.",
      featureUnavailableProgress:
        "ZenFlow could not check your saved diary progress on this device. Reload the app and try again. Nothing was deleted.",
      featureUnavailableDisabled:
        "This feature is turned off for this profile. Enable it in feature settings and try again.",
      featureUnavailableUnlock:
        "This feature is not available for this profile yet. Your existing data is unchanged.",
    },
  }),
}));

const backHandlerMock = vi.hoisted(() => ({
  handler: null as null | (() => void),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: (_isOpen: boolean, handler: () => void) => {
    backHandlerMock.handler = handler;
  },
}));

const availability = (
  reason: FeatureAvailability["reason"],
  disclosure: FeatureAvailability["disclosure"] = "user-safe-reason",
): FeatureAvailability => ({
  manifestVersion: 1,
  key: "challenges",
  visible: false,
  state: "temporarily-unavailable",
  reason,
  source: "local-truth",
  disclosure,
});

const removalTranslations = {
  cancel: "Cancel",
  journalPasswordRemove: "Remove Password Lock",
  journalPasswordRemoveConfirm:
    "Are you sure? Your diary will be accessible without a password.",
  journalLockRemoveFailed:
    "Unlock your diary first, then try removing the lock again.",
  journalLockRemoveUnexpected:
    "The lock could not be removed. Nothing changed. Try again.",
  journalLockRemoveRevisionMismatch:
    "Your diary changed while it was being checked. Reload it, unlock it, and try again. Nothing was changed.",
  journalLockRemovePartialBoth:
    "Diary protection is off on this device. Cleanup for biometric unlock and your other signed-in devices is still pending. Keep the app open, stay signed in, and try again when online.",
  journalPasswordRemovePending: "Removing lock...",
  done: "Done",
};

describe("FeatureAvailabilityDialog", () => {
  it("shows an actionable loading state and a 48px dismissal target", () => {
    const onClose = vi.fn();
    render(
      <FeatureAvailabilityDialog
        availability={availability("journal-count-loading")}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Feature temporarily unavailable" }),
    ).toHaveTextContent(
      "ZenFlow is checking your saved diary progress. Keep this screen open and try again in a moment.",
    );
    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toHaveFocus();
    expect(closeButton).toHaveClass("min-h-[48px]");
    expect(closeButton.previousElementSibling?.parentElement?.previousElementSibling).toHaveClass(
      "bg-[hsl(var(--nav-v2-backdrop)/0.40)]",
      "backdrop-blur-sm",
      "[-webkit-backdrop-filter:blur(4px)]",
    );
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes only the active dialog from Escape or Android Back and restores its opener", () => {
    const opener = document.createElement("button");
    opener.textContent = "Open unavailable feature";
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const { unmount } = render(
      <FeatureAvailabilityDialog
        availability={availability("journal-count-loading")}
        onClose={onClose}
      />,
    );

    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);

    backHandlerMock.handler?.();
    expect(onClose).toHaveBeenCalledTimes(2);

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("dismisses only the topmost availability dialog when two layers are mounted", () => {
    const closeParent = vi.fn();
    const closeTop = vi.fn();
    render(
      <>
        <FeatureAvailabilityDialog
          availability={availability("journal-count-loading")}
          onClose={closeParent}
        />
        <FeatureAvailabilityDialog
          availability={availability("journal-count-unavailable")}
          onClose={closeTop}
        />
      </>,
    );

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );

    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeParent).not.toHaveBeenCalled();
  });

  it("keeps the real password-removal dialog open when availability is the top layer", () => {
    const closeRemoval = vi.fn();
    const closeAvailability = vi.fn();
    render(
      <>
        <RemovePasswordConfirmDialog
          ts={removalTranslations}
          onClose={closeRemoval}
          onConfirm={vi.fn().mockResolvedValue({ status: "removed" })}
        />
        <FeatureAvailabilityDialog
          availability={availability("journal-count-unavailable")}
          onClose={closeAvailability}
        />
      </>,
    );

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );

    expect(closeAvailability).toHaveBeenCalledTimes(1);
    expect(closeRemoval).not.toHaveBeenCalled();
  });

  it("shows a truthful recovery action when local progress cannot be checked", () => {
    render(
      <FeatureAvailabilityDialog
        availability={availability("journal-count-unavailable")}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Reload the app and try again. Nothing was deleted.",
    );
  });

  it("does not disclose a silent release-policy decision", () => {
    const { container } = render(
      <FeatureAvailabilityDialog
        availability={{
          ...availability("security-proof-missing", "silent"),
          state: "blocked",
          source: "release-policy",
        }}
        onClose={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
