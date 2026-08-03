import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      close: "Close",
      storageWarningTitle: "Storage warning",
      storageWarningMessage: "Data may not be saved.",
      sessionTimeoutDelayedTitle: "Automatic sign-out delayed",
      sessionTimeoutPendingChanges:
        "Automatic sign-out was delayed because some changes are still waiting to save. ZenFlow will try again soon.",
      sessionTimeoutCleanupFailed:
        "ZenFlow kept you signed in because automatic sign-out could not finish safely. It will try again soon.",
      authSignOutRecoveryTitle: "Finish signing out",
      settingsCloudSyncTitle: "Online backup",
      syncCriticalBlocked:
        "An important online save could not finish. Your change is still on this device. Try again when connected.",
      settingsPostCommitDeferred:
        "This setting was saved, but another change on this device could not finish saving.",
      settingsPostCommitRefresh:
        "This setting was saved, but the screen may not show the latest value yet.",
      refresh: "Refresh",
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
      "Automatic sign-out was delayed because some changes are still waiting to save. ZenFlow will try again soon.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Automatic sign-out delayed");
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
    expect(screen.getByRole("alert")).toHaveTextContent("Finish signing out");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Automatic sign-out delayed");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("keeps account cleanup recovery visible and coalesces retry while it is running", async () => {
    let resolveRetry!: () => void;
    const retryPromise = new Promise<void>((resolve) => {
      resolveRetry = resolve;
    });
    const retry = vi.fn(() => retryPromise);
    render(<StorageErrorBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:account-cleanup-blocked", {
          detail: { retry },
        })
      );
    });

    const retryButton = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);

    expect(retry).toHaveBeenCalledTimes(1);
    expect(retryButton).toBeDisabled();
    expect(retryButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Finish signing out");

    await act(async () => {
      resolveRetry();
      await retryPromise;
    });
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("keeps account cleanup recovery visible when its retry rejects", async () => {
    const retry = vi.fn(() => Promise.reject(new Error("cleanup still blocked")));
    render(<StorageErrorBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:account-cleanup-blocked", {
          detail: { retry },
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Finish signing out"),
    );
    expect(screen.getByRole("button", { name: "Retry" })).not.toBeDisabled();
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

  it("shows a non-retryable incident for a failed deferred write without exposing details", () => {
    render(<StorageErrorBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:settings-post-commit-incident", {
          detail: { issueKinds: ["deferred-write-replay"] },
        }),
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This setting was saved, but another change on this device could not finish saving.",
    );
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
  });

  it("offers only the supplied refresh recovery for a refresh-only incident", () => {
    const retry = vi.fn();
    render(<StorageErrorBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:settings-post-commit-incident", {
          detail: { issueKinds: ["mounted-refresh"], retry },
        }),
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This setting was saved, but the screen may not show the latest value yet.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows a later independent storage failure after the current warning is dismissed", async () => {
    render(<StorageErrorBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:storage-error", {
          detail: { type: "write_failed", message: "The first write failed." },
        }),
      );
    });
    expect(screen.getByRole("alert")).toHaveTextContent("The first write failed.");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByTestId("storage-error-banner")).not.toBeInTheDocument();
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:storage-error", {
          detail: { type: "write_failed", message: "A later write also failed." },
        }),
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent("A later write also failed.");
  });

  it("does not let an ordinary storage event erase an unresolved sign-out recovery", async () => {
    const retry = vi.fn();
    render(<StorageErrorBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:session-timeout-blocked", {
          detail: { reason: "pending-changes", retry },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("zenflow:storage-error", {
          detail: { type: "read_failed", message: "A background read also failed." },
        }),
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Automatic sign-out delayed");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).not.toHaveTextContent("A background read also failed.");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("A background read also failed.")
    );
  });

  it("preempts an ordinary storage event with critical recovery and resumes it afterward", async () => {
    const retry = vi.fn();
    render(<StorageErrorBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:storage-error", {
          detail: { type: "write_failed", message: "A settings write failed." },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("zenflow:account-cleanup-blocked", {
          detail: { retry },
        }),
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Finish signing out");
    expect(screen.getByRole("alert")).not.toHaveTextContent("A settings write failed.");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("A settings write failed.")
    );
  });

  it("reflows long recovery text above its actions on narrow large-text layouts", () => {
    const retry = vi.fn();
    const message =
      "ZenFlow kept you signed in because several important changes are still waiting to save safely on this device.";
    render(<StorageErrorBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:push-revocation-incomplete", {
          detail: { message, retryLabel: "Try the safe recovery again", retry },
        }),
      );
    });

    const banner = screen.getByTestId("storage-error-banner");
    const alert = screen.getByRole("alert");
    const surface = banner.firstElementChild;
    const prose = screen.getByText(message);
    const retryButton = screen.getByRole("button", {
      name: "Try the safe recovery again",
    });
    const actions = retryButton.parentElement;

    expect(banner).toHaveClass(
      "start-[max(0.5rem,var(--safe-inline-start))]",
      "end-[max(0.5rem,var(--safe-inline-end))]",
      "max-h-[calc(var(--app-viewport-height)-6rem-var(--safe-bottom))]",
      "overflow-y-auto",
      "overscroll-contain",
    );
    expect(banner).not.toHaveClass("left-2", "right-2", "max-h-[calc(100dvh-6rem)]");
    expect(alert).not.toHaveAttribute("aria-live");
    expect(alert.querySelector("button")).toBeNull();
    expect(surface).toHaveClass(
      "grid",
      "grid-cols-1",
      "sm:grid-cols-[auto_minmax(0,1fr)]",
      "p-2",
      "min-[420px]:p-4",
      "bg-[hsl(var(--zf-warning))]",
      "text-[hsl(var(--zf-night-0))]",
    );
    expect(surface).not.toHaveClass("bg-amber-500/95", "text-white");
    expect(prose).toHaveClass("whitespace-normal", "break-words", "[hyphens:manual]");
    expect(prose.className).toContain("[overflow-wrap:break-word]");
    expect(actions).toHaveClass(
      "grid",
      "grid-cols-1",
      "sm:col-span-2",
      "sm:grid-cols-[minmax(0,1fr)_auto]",
    );
    expect(retryButton).toHaveClass(
      "w-full",
      "min-w-0",
      "max-w-full",
      "whitespace-normal",
      "[hyphens:manual]",
    );
    expect(retryButton.className).toContain("[overflow-wrap:break-word]");
    expect(retryButton.className).not.toContain("[overflow-wrap:anywhere]");
  });

  it("defers the recovery alert while a modal owns the interaction boundary", async () => {
    const modal = document.createElement("div");
    modal.setAttribute("role", "alertdialog");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);
    render(<StorageErrorBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:push-revocation-incomplete", {
          detail: { message: "Recovery is waiting.", retryLabel: "Retry", retry: vi.fn() },
        }),
      );
    });

    expect(screen.queryByTestId("storage-error-banner")).not.toBeInTheDocument();

    act(() => modal.remove());
    await waitFor(() => {
      expect(screen.getByTestId("storage-error-banner")).toBeInTheDocument();
    });
  });
});
