import type { HTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OfflineBanner } from "@/components/OfflineBanner";

const fetchMock = vi.fn();

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      offlineBannerTitle: "You are offline",
      offlineBannerPending: "changes waiting to sync",
      offlineBannerRetry: "Retry connection",
      offlineBannerDismiss: "Dismiss",
    },
  }),
}));

vi.mock("@/hooks/useOfflineQueue", () => ({
  useOfflineQueue: () => ({ pendingCount: 0 }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

const setNavigatorOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
};

describe("OfflineBanner", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setNavigatorOnline(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears a false offline state after a successful app asset probe", async () => {
    setNavigatorOnline(false);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    render(<OfflineBanner />);

    expect(screen.getByTestId("offline-banner")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("favicon.ico"),
      expect.objectContaining({ method: "HEAD", cache: "no-cache" })
    );
  });

  it("keeps retry clickable and hides the banner when the probe succeeds", async () => {
    setNavigatorOnline(false);
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

    render(<OfflineBanner />);

    expect(screen.getByTestId("offline-banner")).toBeInTheDocument();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    fireEvent.click(screen.getByRole("button", { name: "Retry connection" }));

    await waitFor(() => {
      expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
    });
  });
  it("bounds manual retry probes so stalled network checks cannot feel frozen", async () => {
    vi.useFakeTimers();
    setNavigatorOnline(false);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockImplementationOnce((_url, init?: RequestInit) => {
        const signal = init?.signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
      });

    render(<OfflineBanner />);

    expect(screen.getByTestId("offline-banner")).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry connection" }));

    const retrySignal = fetchMock.mock.calls.at(-1)?.[1]?.signal;
    expect(retrySignal).toBeInstanceOf(AbortSignal);
    expect(retrySignal?.aborted).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(retrySignal?.aborted).toBe(true);
    expect(screen.getByTestId("offline-banner")).toBeInTheDocument();
  });

});
