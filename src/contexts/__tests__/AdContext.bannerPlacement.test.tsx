import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdProvider, useAds } from "@/contexts/AdContext";

const bannerController = vi.hoisted(() => {
  const state = {
    initialized: true,
    sdkAvailable: true,
    canRequestAds: true,
    privacyOptionsRequired: false,
  };
  return {
    state,
    disableAds: vi.fn(),
    hideHabitsBanner: vi.fn(() => Promise.resolve()),
    initializeAds: vi.fn(() => Promise.resolve(true)),
    removeHabitsBanner: vi.fn(() => Promise.resolve()),
    showHabitsBanner: vi.fn((
      onHeightChange: (height: number) => void,
    ): Promise<{ shown: boolean; error?: string }> => {
      onHeightChange(50);
      return Promise.resolve({ shown: true });
    }),
  };
});

vi.mock("@/lib/adController", () => ({
  initializeAds: bannerController.initializeAds,
  getAdState: vi.fn(() => bannerController.state),
  showAdPrivacyOptions: vi.fn(() =>
    Promise.resolve({ opened: true, canRequestAds: true, privacyOptionsRequired: false }),
  ),
  refreshAdPrivacyOptionsStatus: vi.fn(() =>
    Promise.resolve({ canRequestAds: false, privacyOptionsRequired: false }),
  ),
  disableAds: bannerController.disableAds,
  isBannerAdsSupported: vi.fn(() => true),
  showHabitsBanner: bannerController.showHabitsBanner,
  hideHabitsBanner: bannerController.hideHabitsBanner,
  removeHabitsBanner: bannerController.removeHabitsBanner,
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn() },
}));

function BannerProbe() {
  const ads = useAds();
  const placementSetter = (
    ads as typeof ads & { setHabitsBannerActive?: (active: boolean) => void }
  ).setHabitsBannerActive;
  const overlaySetter = (
    ads as typeof ads & { setGlobalAdOverlayOpen?: (open: boolean) => void }
  ).setGlobalAdOverlayOpen;
  const bannerHeight = (ads as typeof ads & { bannerHeight?: number }).bannerHeight;
  const suppressionFailed = (
    ads as typeof ads & { protectedSurfaceSuppressionFailed?: boolean }
  ).protectedSurfaceSuppressionFailed;
  const prepareProtectedAdSurface = ads.prepareProtectedAdSurface;
  const [protectedSurfaceOpen, setProtectedSurfaceOpen] = useState(false);

  return (
    <>
      <output data-testid="placement-api">{typeof placementSetter}</output>
      <output data-testid="banner-height">{String(bannerHeight)}</output>
      <output data-testid="suppression-failed">{String(suppressionFailed)}</output>
      <output data-testid="protected-surface">{String(protectedSurfaceOpen)}</output>
      <button type="button" onClick={() => placementSetter?.(true)}>
        enter habits
      </button>
      <button type="button" onClick={() => placementSetter?.(false)}>
        open sheet
      </button>
      <button type="button" onClick={() => overlaySetter?.(true)}>
        open global overlay
      </button>
      <button
        type="button"
        onClick={() => {
          void prepareProtectedAdSurface().then((acknowledged) => {
            if (!acknowledged) return;
            placementSetter?.(false);
            setProtectedSurfaceOpen(true);
          });
        }}
      >
        open protected after native ack
      </button>
    </>
  );
}

describe("AdContext Android banner placement", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 360,
    });
  });

  it("shows the Habits banner on request and clears its reserved height for an overlay", async () => {
    render(
      <AdProvider adConsent adAgeEligibility="adult" adEntitlement="free" emotionProtectedToday={false}>
        <BannerProbe />
      </AdProvider>,
    );

    expect(screen.getByTestId("placement-api")).toHaveTextContent("function");
    fireEvent.click(screen.getByRole("button", { name: "enter habits" }));

    await waitFor(() => {
      expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("banner-height")).toHaveTextContent("50");
    });

    fireEvent.click(screen.getByRole("button", { name: "open sheet" }));
    await waitFor(() => {
      expect(bannerController.hideHabitsBanner).toHaveBeenCalled();
      expect(screen.getByTestId("banner-height")).toHaveTextContent("0");
    });
  });

  it("does not expose protected UI until native banner suppression resolves", async () => {
    let acknowledgeSuppression: (() => void) | undefined;
    bannerController.hideHabitsBanner.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        acknowledgeSuppression = resolve;
      }),
    );

    render(
      <AdProvider adConsent adAgeEligibility="adult" adEntitlement="free" emotionProtectedToday={false}>
        <BannerProbe />
      </AdProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "open protected after native ack" }));
    expect(screen.getByTestId("protected-surface")).toHaveTextContent("false");
    expect(bannerController.hideHabitsBanner).toHaveBeenCalled();

    await act(async () => {
      acknowledgeSuppression?.();
      await Promise.resolve();
    });
    expect(screen.getByTestId("protected-surface")).toHaveTextContent("true");
  });

  it("reports a recoverable failure and keeps protected UI closed without native acknowledgement", async () => {
    render(
      <AdProvider adConsent adAgeEligibility="adult" adEntitlement="free" emotionProtectedToday={false}>
        <BannerProbe />
      </AdProvider>,
    );

    await waitFor(() => expect(bannerController.hideHabitsBanner).toHaveBeenCalled());
    bannerController.hideHabitsBanner.mockRejectedValueOnce(new Error("native suppression failed"));

    fireEvent.click(screen.getByRole("button", { name: "open protected after native ack" }));

    await waitFor(() => {
      expect(screen.getByTestId("suppression-failed")).toHaveTextContent("true");
    });
    expect(screen.getByTestId("protected-surface")).toHaveTextContent("false");
  });

  it("does not recover a disappearing banner during the protected-surface handshake", async () => {
    let reportNativeHeight: ((height: number) => void) | undefined;
    bannerController.showHabitsBanner.mockImplementationOnce(
      (onHeightChange: (height: number) => void) => {
        reportNativeHeight = onHeightChange;
        onHeightChange(50);
        return Promise.resolve({ shown: true });
      },
    );
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    render(
      <AdProvider adConsent adAgeEligibility="adult" adEntitlement="free" emotionProtectedToday={false}>
        <BannerProbe />
      </AdProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "enter habits" }));
    await waitFor(() => expect(screen.getByTestId("banner-height")).toHaveTextContent("50"));
    bannerController.hideHabitsBanner.mockImplementationOnce(() => {
      reportNativeHeight?.(0);
      return Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "open protected after native ack" }));
    await waitFor(() => expect(screen.getByTestId("protected-surface")).toHaveTextContent("true"));

    expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("banner-height")).toHaveTextContent("0");
  });

  it("requests a fresh adaptive banner after an Android viewport-width change", async () => {
    render(
      <AdProvider adConsent adAgeEligibility="adult" adEntitlement="free" emotionProtectedToday={false}>
        <BannerProbe />
      </AdProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "enter habits" }));
    await waitFor(() => expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(1));

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 800,
    });
    fireEvent(window, new Event("resize"));

    await waitFor(() => expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(2));
  });

  it("waits for the Android viewport width to settle before one adaptive rebuild", async () => {
    render(
      <AdProvider adConsent adAgeEligibility="adult" adEntitlement="free" emotionProtectedToday={false}>
        <BannerProbe />
      </AdProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "enter habits" }));
    await waitFor(() => expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
    fireEvent(window, new Event("resize"));
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 720 });
    fireEvent(window, new Event("resize"));

    expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(1);
    expect(bannerController.hideHabitsBanner).toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(499);
    });
    expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("retries a transient placement race while the Habits surface remains eligible", async () => {
    bannerController.showHabitsBanner
      .mockResolvedValueOnce({ shown: false, error: "placement_changed" })
      .mockImplementationOnce((onHeightChange: (height: number) => void) => {
        onHeightChange(50);
        return Promise.resolve({ shown: true });
      });

    render(
      <AdProvider adConsent adAgeEligibility="adult" adEntitlement="free" emotionProtectedToday={false}>
        <BannerProbe />
      </AdProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "enter habits" }));

    await waitFor(() => {
      expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("banner-height")).toHaveTextContent("50");
    });
  });

  it("recovers once when active native geometry disappears after reservation", async () => {
    let reportNativeHeight: ((height: number) => void) | undefined;
    bannerController.showHabitsBanner
      .mockImplementationOnce((onHeightChange: (height: number) => void) => {
        reportNativeHeight = onHeightChange;
        onHeightChange(64);
        return Promise.resolve({ shown: true });
      })
      .mockImplementationOnce((onHeightChange: (height: number) => void) => {
        onHeightChange(64);
        return Promise.resolve({ shown: true });
      });

    render(
      <AdProvider adConsent adAgeEligibility="adult" adEntitlement="free" emotionProtectedToday={false}>
        <BannerProbe />
      </AdProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "enter habits" }));
    await waitFor(() => expect(screen.getByTestId("banner-height")).toHaveTextContent("64"));

    act(() => reportNativeHeight?.(0));

    await waitFor(() => {
      expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("banner-height")).toHaveTextContent("64");
    });
  });

  it("retries when native show succeeds without ever publishing reserved geometry", async () => {
    vi.useFakeTimers();
    bannerController.showHabitsBanner
      .mockResolvedValueOnce({ shown: true })
      .mockImplementationOnce((onHeightChange: (height: number) => void) => {
        onHeightChange(50);
        return Promise.resolve({ shown: true });
      });

    render(
      <AdProvider adConsent adAgeEligibility="adult" adEntitlement="free" emotionProtectedToday={false}>
        <BannerProbe />
      </AdProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "enter habits" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(12_020);
      await Promise.resolve();
    });

    expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("banner-height")).toHaveTextContent("50");
    vi.useRealTimers();
  });

  it("hides the native banner while a shell-level overlay is open", async () => {
    render(
      <AdProvider adConsent adAgeEligibility="adult" adEntitlement="free" emotionProtectedToday={false}>
        <BannerProbe />
      </AdProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "enter habits" }));
    await waitFor(() => expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "open global overlay" }));
    await waitFor(() => {
      expect(bannerController.hideHabitsBanner).toHaveBeenCalled();
      expect(screen.getByTestId("banner-height")).toHaveTextContent("0");
    });
  });

  it("hides the native banner while the Android keyboard reduces the visual viewport", async () => {
    const visualViewport = new EventTarget() as EventTarget & { height: number; width: number };
    visualViewport.height = 800;
    visualViewport.width = 360;
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: visualViewport });

    render(
      <AdProvider adConsent adAgeEligibility="adult" adEntitlement="free" emotionProtectedToday={false}>
        <BannerProbe />
      </AdProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "enter habits" }));
    await waitFor(() => expect(bannerController.showHabitsBanner).toHaveBeenCalledTimes(1));

    const hideCallsBeforeIme = bannerController.hideHabitsBanner.mock.calls.length;
    visualViewport.height = 480;
    visualViewport.dispatchEvent(new Event("resize"));
    await waitFor(() => {
      expect(bannerController.hideHabitsBanner.mock.calls.length).toBeGreaterThan(hideCallsBeforeIme);
      expect(screen.getByTestId("banner-height")).toHaveTextContent("0");
    });
  });
});
