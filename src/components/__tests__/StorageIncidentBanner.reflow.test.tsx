import { act, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      close: "Close",
      storageWarningTitle: "Saved information is temporarily unavailable",
      storageTimeoutCached:
        "Showing your last saved information while ZenFlow reconnects.",
      storageTimeoutUnavailable:
        "ZenFlow could not load your saved information yet. Close and reopen the app, then try again.",
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn() },
}));

vi.mock("@/lib/safeJson", () => ({
  storageCanWrite: () => true,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    replayBlockedCriticalActionsForActiveOwner: vi.fn(async () => 0),
  },
}));

import { StorageErrorBanner } from "@/components/StorageErrorBanner";

const TIMEOUT_SIGNAL = {
  code: "IDB_OPERATION_TIMEOUT",
  phase: "read",
  deadlineMs: 30_000,
  recoveryState: "unavailable",
} as const;

function dispatchTimeout(detail: unknown = TIMEOUT_SIGNAL): void {
  act(() => {
    window.dispatchEvent(
      new CustomEvent("zenflow:indexeddb-timeout", { detail }),
    );
  });
}

describe("StorageIncidentBanner entry reflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("places a low-priority timeout in the public entry flow with polite status semantics", () => {
    render(
      <>
        <div data-storage-incident-host data-testid="entry-storage-incident-host" />
        <StorageErrorBanner />
      </>,
    );

    dispatchTimeout();

    const host = screen.getByTestId("entry-storage-incident-host");
    const banner = within(host).getByTestId("storage-error-banner");
    expect(within(host).getByRole("status")).toHaveTextContent(
      "ZenFlow could not load your saved information yet.",
    );
    expect(banner.className).not.toContain("fixed");
    expect(banner.className).toContain("min-w-0");
  });

  it("keeps the dismiss target at least 48 by 48 CSS pixels", () => {
    render(<StorageErrorBanner />);
    dispatchTimeout();

    const close = screen.getByRole("button", { name: "Close" });
    expect(close.className).toContain("min-h-12");
    expect(close.className).toContain("min-w-12");
  });

  it("rejects the legacy free-form timeout message at the incident boundary", () => {
    render(<StorageErrorBanner />);

    dispatchTimeout({
      timeoutMs: 30_000,
      message: "IndexedDB operation timed out, using cached data",
    });

    expect(screen.queryByTestId("storage-error-banner")).not.toBeInTheDocument();
  });
});
