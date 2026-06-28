import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
