import type { HTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OfflineBanner } from "@/components/OfflineBanner";

const fetchMock = vi.fn();
const offlineQueueMock = vi.hoisted(() => ({
  pendingCount: 0,
  processQueue: vi.fn<
    (options?: {
      verifiedConnectivity: {
        source: "same-origin-app-asset";
        signal: AbortSignal;
      };
    }) => Promise<void>
  >(async () => undefined),
}));
const motionPreferenceMock = vi.hoisted(() => ({ reduce: false }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      offlineBannerTitle: "You are offline",
      offlineBannerPending: "{count} changes waiting to save online",
      offlineBannerPending_one: "{count} change waiting to save online",
      offlineBannerRetry: "Retry connection",
      offlineBannerDismiss: "Dismiss",
      offlineBannerStorageLimit:
        "This change wasn’t saved. ZenFlow has reached the storage limit available to it.",
    },
  }),
}));

vi.mock("@/hooks/useOfflineQueue", () => ({
  useOfflineQueue: () => ({
    pendingCount: offlineQueueMock.pendingCount,
    processQueue: offlineQueueMock.processQueue,
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock("framer-motion", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  function AnimatePresenceMock({ children }: { children: ReactNode }) {
    const [presentChild, setPresentChild] = React.useState(children);

    React.useEffect(() => {
      if (children) {
        setPresentChild(children);
        return;
      }

      const exitTimer = window.setTimeout(() => setPresentChild(null), 200);
      return () => window.clearTimeout(exitTimer);
    }, [children]);

    return <div data-testid="animate-presence">{children || presentChild}</div>;
  }

  type MotionDivProps = HTMLAttributes<HTMLDivElement> & {
    initial?: unknown;
    animate?: unknown;
    exit?: unknown;
    transition?: unknown;
  };

  return {
    AnimatePresence: AnimatePresenceMock,
    useReducedMotion: () => motionPreferenceMock.reduce,
    motion: {
      div: ({
        children,
        initial,
        animate,
        exit,
        transition: _transition,
        ...props
      }: MotionDivProps) => (
        <div
          {...props}
          data-motion-initial={JSON.stringify(initial)}
          data-motion-animate={JSON.stringify(animate)}
          data-motion-exit={JSON.stringify(exit)}
        >
          {children}
        </div>
      ),
    },
  };
});

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
    offlineQueueMock.pendingCount = 0;
    offlineQueueMock.processQueue.mockReset();
    offlineQueueMock.processQueue.mockResolvedValue(undefined);
    motionPreferenceMock.reduce = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears a false offline state after a successful app asset probe", async () => {
    setNavigatorOnline(false);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    render(<OfflineBanner />);

    const banner = screen.getByTestId("offline-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveClass(
      "max-h-[var(--app-viewport-height)]",
      "ps-[max(1rem,var(--safe-inline-start))]",
      "pe-[max(1rem,var(--safe-inline-end))]",
    );
    expect(banner).not.toHaveClass("max-h-[100dvh]", "px-4");
    expect(banner).toHaveStyle({
      paddingTop: "calc(var(--safe-top) + 0.5rem)",
    });

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

  it("processes real pending work before a successful retry hides the banner", async () => {
    setNavigatorOnline(false);
    offlineQueueMock.pendingCount = 2;
    let releaseQueue!: () => void;
    offlineQueueMock.processQueue.mockImplementationOnce(
      () => new Promise<void>((resolve) => { releaseQueue = resolve; }),
    );
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<OfflineBanner />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Retry connection" }));

    await waitFor(() => {
      expect(offlineQueueMock.processQueue).toHaveBeenCalledTimes(1);
    });
    const retry = screen.getByRole("button", { name: "Retry connection" });
    expect(retry).toBeDisabled();
    expect(retry).toHaveAttribute("aria-busy", "true");
    expect(retry.querySelector("svg")).toHaveClass("motion-safe:animate-spin");
    expect(offlineQueueMock.processQueue).toHaveBeenCalledWith({
      verifiedConnectivity: {
        source: "same-origin-app-asset",
        signal: expect.any(AbortSignal),
      },
    });

    releaseQueue();
    await waitFor(() => {
      expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
    });
  });

  it("does not let an aborted stale probe restore offline state after an online event", async () => {
    setNavigatorOnline(false);
    fetchMock.mockImplementation((_url, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    render(<OfflineBanner />);
    expect(screen.getByTestId("offline-banner")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate retries while the current connectivity check is running", async () => {
    setNavigatorOnline(false);
    let resolveRetry: ((response: Response) => void) | undefined;
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => { resolveRetry = resolve; }),
      )
      .mockImplementation(() => new Promise(() => undefined));

    render(<OfflineBanner />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const retry = screen.getByRole("button", { name: "Retry connection" });
    fireEvent.click(retry);
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveRetry?.(new Response(null, { status: 204 }));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a storage-limit warning visible when connectivity returns", () => {
    render(<OfflineBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:offline-data-dropped", {
          detail: { reason: "storage-limit" },
        }),
      );
    });
    expect(screen.getByRole("alert")).toHaveTextContent("This change wasn’t saved");

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("This change wasn’t saved");
  });

  it("does not present a connection retry as recovery for an unsaved storage-limit change", () => {
    setNavigatorOnline(false);
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    render(<OfflineBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:offline-data-dropped", {
          detail: { reason: "storage-limit" },
        }),
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent("This change wasn’t saved");
    expect(
      screen.queryByRole("button", { name: "Retry connection" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
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

  it("uses bounded storage-limit copy and reappears after another failed write", async () => {
    render(<OfflineBanner />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:offline-data-dropped", {
          detail: { reason: "storage-limit" },
        })
      );
    });

    const warning = screen.getByText(
      "This change wasn’t saved. ZenFlow has reached the storage limit available to it."
    );
    const iconAndMessage = warning.closest(".flex-1")?.parentElement;
    const warningIcon = iconAndMessage?.querySelector("svg");
    expect(warning).not.toHaveClass("truncate");
    expect(warning).toHaveClass("whitespace-normal", "break-words");
    expect(warning.className).toContain("[hyphens:manual]");
    expect(warning.className).not.toContain("[hyphens:auto]");
    expect(warning.className).toContain("[overflow-wrap:break-word]");
    expect(warning.className).not.toContain("[overflow-wrap:anywhere]");
    expect(iconAndMessage).toHaveClass(
      "grid",
      "grid-cols-1",
      "items-start",
      "sm:grid-cols-[auto_minmax(0,1fr)]",
    );
    expect(warningIcon).toHaveClass("mt-0.5");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => {
      expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:offline-data-dropped", {
          detail: { reason: "storage-limit" },
        })
      );
    });

    expect(screen.getByTestId("offline-banner")).toBeInTheDocument();
  });

  it("keeps an opaque urgent surface mounted until its exit completes", () => {
    vi.useFakeTimers();
    setNavigatorOnline(false);
    fetchMock.mockImplementation(() => new Promise(() => undefined));

    render(<OfflineBanner />);

    const banner = screen.getByTestId("offline-banner");
    expect(banner).toHaveAttribute("data-motion-initial", JSON.stringify({ y: -100 }));
    expect(banner).toHaveAttribute("data-motion-animate", JSON.stringify({ y: 0 }));
    expect(banner).toHaveAttribute("data-motion-exit", JSON.stringify({ y: -100 }));
    expect(banner.getAttribute("data-motion-initial")).not.toContain("opacity");
    expect(banner.getAttribute("data-motion-animate")).not.toContain("opacity");
    expect(banner.getAttribute("data-motion-exit")).not.toContain("opacity");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.getByTestId("animate-presence")).toBeInTheDocument();
    expect(screen.getByTestId("offline-banner")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
  });

  it("keeps essential warning content onscreen when reduced motion is requested", () => {
    setNavigatorOnline(false);
    motionPreferenceMock.reduce = true;
    fetchMock.mockImplementation(() => new Promise(() => undefined));

    render(<OfflineBanner />);

    const banner = screen.getByTestId("offline-banner");
    expect(banner).toHaveAttribute("data-motion-initial", "false");
    expect(banner).toHaveAttribute("data-motion-animate", JSON.stringify({ y: 0 }));
    expect(banner).toHaveAttribute("data-motion-exit", JSON.stringify({ y: 0 }));
  });

  it("uses token-based foregrounds that preserve normal-text contrast for both warning tones", () => {
    setNavigatorOnline(false);
    fetchMock.mockImplementation(() => new Promise(() => undefined));

    const { unmount } = render(<OfflineBanner />);
    const offline = screen.getByTestId("offline-banner");
    expect(offline).toHaveClass(
      "bg-[hsl(var(--zf-warning))]",
      "text-[hsl(var(--zf-night-0))]",
    );
    expect(offline).not.toHaveClass("text-white");
    unmount();

    setNavigatorOnline(true);
    render(<OfflineBanner />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:offline-data-dropped", {
          detail: { reason: "storage-limit" },
        }),
      );
    });

    const storageLimit = screen.getByTestId("offline-banner");
    expect(storageLimit).toHaveClass("bg-destructive", "text-destructive-foreground");
    expect(storageLimit).not.toHaveClass("text-white");
  });

  it("announces routine status politely and reserves alert interruption for data loss", () => {
    setNavigatorOnline(false);
    fetchMock.mockImplementation(() => new Promise(() => undefined));

    const { unmount } = render(<OfflineBanner />);
    const status = screen.getByRole("status");
    const retry = screen.getByRole("button", { name: "Retry connection" });
    const dismiss = screen.getByRole("button", { name: "Dismiss" });

    expect(status).toHaveTextContent("You are offline");
    expect(status).not.toContainElement(retry);
    expect(status).not.toContainElement(dismiss);
    expect(screen.getByTestId("offline-banner")).not.toHaveAttribute("aria-live");
    unmount();

    setNavigatorOnline(true);
    render(<OfflineBanner />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:offline-data-dropped", {
          detail: { reason: "storage-limit" },
        }),
      );
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This change wasn’t saved");
    expect(alert).not.toContainElement(screen.getByRole("button", { name: "Dismiss" }));
  });

  it("stacks actions below the message on narrow large-text layouts", () => {
    setNavigatorOnline(false);
    fetchMock.mockImplementation(() => new Promise(() => undefined));

    render(<OfflineBanner />);

    const banner = screen.getByTestId("offline-banner");
    const layout = banner.firstElementChild;
    const status = screen.getByRole("status");
    const actions = screen.getByRole("button", { name: "Dismiss" }).parentElement;

    expect(layout).toHaveClass(
      "grid",
      "grid-cols-1",
      "sm:grid-cols-[minmax(0,1fr)_auto]",
    );
    expect(status.parentElement).toHaveClass("min-w-0");
    expect(actions).toHaveClass("justify-self-end", "min-w-0", "max-w-full");
  });

  it("renders pending work as one complete localized count message", () => {
    setNavigatorOnline(false);
    offlineQueueMock.pendingCount = 2;
    fetchMock.mockImplementation(() => new Promise(() => undefined));

    render(<OfflineBanner />);

    expect(screen.getByText("2 changes waiting to save online")).toBeInTheDocument();
    expect(screen.queryByText(/^2 \{count\}/)).not.toBeInTheDocument();
  });

  it("withholds banner actions while an active modal owns interaction", async () => {
    setNavigatorOnline(false);
    fetchMock.mockImplementation(() => new Promise(() => undefined));

    const modal = document.createElement("div");
    modal.setAttribute("role", "alertdialog");
    modal.setAttribute("aria-modal", "true");
    document.body.style.pointerEvents = "none";
    document.body.append(modal);

    try {
      render(<OfflineBanner />);

      expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();

      modal.remove();

      await waitFor(() => {
        expect(screen.getByTestId("offline-banner")).toHaveClass("z-[54]");
      });

      act(() => {
        document.body.append(modal);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.queryByTestId("animate-presence")).not.toBeInTheDocument();
      expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();

      act(() => {
        modal.remove();
      });
      await waitFor(() => {
        expect(screen.getByTestId("offline-banner")).toBeInTheDocument();
      });
    } finally {
      modal.remove();
      document.body.style.pointerEvents = "";
    }
  });

  it("releases modal suppression when a mounted aria-modal becomes display-none", async () => {
    setNavigatorOnline(false);
    fetchMock.mockImplementation(() => new Promise(() => undefined));

    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    document.body.append(modal);

    try {
      render(<OfflineBanner />);
      expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();

      act(() => {
        modal.style.display = "none";
      });

      await waitFor(() => {
        expect(screen.getByTestId("offline-banner")).toBeInTheDocument();
      });
    } finally {
      modal.remove();
    }
  });

});
