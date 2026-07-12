import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      close: "Close",
      storageWarningTitle: "Storage warning",
      storageWarningMessage: "Data may not be saved.",
      sessionTimeoutPendingChanges:
        "ZenFlow kept you signed in because some changes are still waiting to save. It will try again soon.",
      sessionTimeoutCleanupFailed:
        "ZenFlow kept you signed in because this device could not be cleaned up safely. It will try again soon.",
      settingsCloudSyncTitle: "Online backup",
      syncCriticalBlocked:
        "An important online save could not finish. Your change is still on this device. Try again when connected.",
      retry: "Retry",
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/safeJson", () => ({
  storageCanWrite: () => true,
}));

const queueMocks = vi.hoisted(() => ({
  replayBlockedCriticalActionsForActiveOwner: vi.fn(async () => 0),
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: queueMocks,
}));

import { StorageErrorBanner } from "@/components/StorageErrorBanner";

describe("StorageErrorBanner push revocation feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueMocks.replayBlockedCriticalActionsForActiveOwner.mockResolvedValue(0);
  });

  it("asks the durable queue to replay blocked retries after its listener mounts", async () => {
    render(<StorageErrorBanner />);

    await waitFor(() => {
      expect(queueMocks.replayBlockedCriticalActionsForActiveOwner).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a user-visible retry action when push revocation is incomplete", () => {
    const retry = vi.fn();
    render(<StorageErrorBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:push-revocation-incomplete", {
          detail: {
            message: "Push notifications could not be fully disconnected.",
            retryLabel: "Retry",
            retry,
          },
        }),
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Push notifications could not be fully disconnected.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed native reminder update visible with a retry action", () => {
    const retry = vi.fn();
    render(<StorageErrorBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:reminder-reconcile-failed", {
          detail: {
            message: "ZenFlow could not update reminders. The previous schedule may still be active.",
            retryLabel: "Retry",
            retry,
          },
        }),
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "ZenFlow could not update reminders. The previous schedule may still be active.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("explains when idle sign-out is delayed to protect pending changes", () => {
    render(<StorageErrorBanner />);
    const retry = vi.fn();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:session-timeout-blocked", {
          detail: { reason: "pending-changes", retry },
        }),
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "ZenFlow kept you signed in because some changes are still waiting to save. It will try again soon.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("keeps interrupted account cleanup visible with a real retry action", () => {
    render(<StorageErrorBanner />);
    const retry = vi.fn();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:account-cleanup-blocked", {
          detail: { retry },
        }),
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "ZenFlow could not finish secure sign-out. Try again.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("offers a retry when an important queued save exhausts automatic attempts", () => {
    const retry = vi.fn();
    render(<StorageErrorBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:offline-queue-critical-blocked", {
          detail: { retry },
        }),
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "An important online save could not finish.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
