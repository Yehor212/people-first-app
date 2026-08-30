import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    showHabitsBanner: vi.fn((onHeightChange: (height: number) => void) => {
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
  const bannerHeight = (ads as typeof ads & { bannerHeight?: number }).bannerHeight;

  return (
    <>
      <output data-testid="placement-api">{typeof placementSetter}</output>
      <output data-testid="banner-height">{String(bannerHeight)}</output>
      <button type="button" onClick={() => placementSetter?.(true)}>
        enter habits
      </button>
      <button type="button" onClick={() => placementSetter?.(false)}>
        open sheet
      </button>
    </>
  );
}

describe("AdContext Android banner placement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 360,
    });
  });

  it("shows the Habits banner on request and clears its reserved height for an overlay", async () => {
    render(
      <AdProvider adConsent isPremium={false} currentMood="okay">
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

  it("requests a fresh adaptive banner after an Android viewport-width change", async () => {
    render(
      <AdProvider adConsent isPremium={false} currentMood="okay">
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
});
