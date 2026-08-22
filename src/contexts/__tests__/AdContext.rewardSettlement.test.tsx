import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ATTEMPT_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  order: [] as string[],
  beginRewardedAdAttempt: vi.fn(),
  settleRewardedAdAttempt: vi.fn(),
  showRewardedAd: vi.fn(),
  triggerDataRefresh: vi.fn(),
}));

vi.mock("@/features/ads/rewardedAttemptLedger", () => ({
  beginRewardedAdAttempt: mocks.beginRewardedAdAttempt,
  settleRewardedAdAttempt: mocks.settleRewardedAdAttempt,
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  triggerDataRefresh: mocks.triggerDataRefresh,
}));

vi.mock("@/lib/adController", () => ({
  isRewardedAdsSupported: vi.fn(() => true),
  initializeAds: vi.fn(async () => true),
  canShowRewardedAd: vi.fn(() => ({ allowed: true })),
  showRewardedAd: mocks.showRewardedAd,
  getRemainingRewardedAds: vi.fn(() => 4),
  getAdState: vi.fn(() => ({
    initialized: true,
    sdkAvailable: true,
    canRequestAds: true,
    privacyOptionsRequired: false,
    rewardedReady: false,
    sessionAdCount: 0,
    lastAdTime: 0,
    lastDismissTime: 0,
  })),
  showAdPrivacyOptions: vi.fn(async () => ({
    opened: false,
    canRequestAds: true,
    privacyOptionsRequired: false,
  })),
  refreshAdPrivacyOptionsStatus: vi.fn(async () => ({
    canRequestAds: true,
    privacyOptionsRequired: false,
  })),
  refreshRewardedAdsServiceGate: vi.fn(async () => true),
  disableAds: vi.fn(),
}));

vi.mock("@/lib/adConfig", () => ({
  AD_REWARDS: {
    rewardedVideoTreats: 20,
    rewardedVideoXp: 25,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn() },
}));

import { AdProvider, useAds } from "@/contexts/AdContext";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AdProvider adConsent premiumStatus="free">
      {children}
    </AdProvider>
  );
}

describe("AdContext durable reward settlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.order.length = 0;
    mocks.beginRewardedAdAttempt.mockImplementation(async () => {
      mocks.order.push("begin");
      return { status: "created", attemptId: ATTEMPT_ID, ownerUserId: OWNER_ID };
    });
    mocks.showRewardedAd.mockImplementation(async () => {
      mocks.order.push("show");
      return { success: true, rewarded: true };
    });
    mocks.settleRewardedAdAttempt.mockImplementation(async () => {
      mocks.order.push("settle");
      return { status: "earned", amount: 20 };
    });
    mocks.triggerDataRefresh.mockImplementation(async () => {
      mocks.order.push("refresh");
    });
  });

  it("persists before show, binds SSV custom data and resolves only after durable settlement", async () => {
    const { result } = renderHook(() => useAds(), { wrapper });
    await waitFor(() => expect(result.current.adsAvailable).toBe(true));

    let earned = false;
    await act(async () => {
      earned = await result.current.watchRewardedAd("optional_rewards");
    });

    expect(earned).toBe(true);
    expect(mocks.order).toEqual(["begin", "show", "settle", "refresh"]);
    expect(mocks.showRewardedAd).toHaveBeenCalledWith({
      moodSignal: null,
      premiumStatus: "free",
      zone: "optional_rewards",
      ssvCustomData: ATTEMPT_ID,
    });
    expect(mocks.settleRewardedAdAttempt).toHaveBeenCalledWith({
      attemptId: ATTEMPT_ID,
      expectedOwnerUserId: OWNER_ID,
      outcome: "earned",
    });
  });

  it("settles a dismiss without refreshing the wallet", async () => {
    mocks.showRewardedAd.mockResolvedValue({
      success: false,
      rewarded: false,
      error: "dismissed_or_failed",
    });
    mocks.settleRewardedAdAttempt.mockResolvedValue({ status: "dismissed" });
    const { result } = renderHook(() => useAds(), { wrapper });
    await waitFor(() => expect(result.current.adsAvailable).toBe(true));

    await expect(result.current.watchRewardedAd("optional_rewards")).resolves.toBe(false);

    expect(mocks.settleRewardedAdAttempt).toHaveBeenCalledWith({
      attemptId: ATTEMPT_ID,
      expectedOwnerUserId: OWNER_ID,
      outcome: "dismissed",
    });
    expect(mocks.triggerDataRefresh).not.toHaveBeenCalled();
  });

  it("does not request inventory when another durable attempt is active", async () => {
    mocks.beginRewardedAdAttempt.mockResolvedValue({
      status: "blocked",
      reason: "attempt_in_progress",
    });
    const { result } = renderHook(() => useAds(), { wrapper });
    await waitFor(() => expect(result.current.adsAvailable).toBe(true));

    await expect(result.current.watchRewardedAd("optional_rewards")).resolves.toBe(false);

    expect(mocks.showRewardedAd).not.toHaveBeenCalled();
    expect(mocks.settleRewardedAdAttempt).not.toHaveBeenCalled();
  });
});
