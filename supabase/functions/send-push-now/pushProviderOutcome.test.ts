import { describe, expect, it } from "vitest";

import {
  classifyPushProviderAttempts,
  noPushTargets,
  providerUnavailable,
  shouldReleasePushReservation,
} from "../_shared/pushProviderOutcome";

describe("push provider outcome", () => {
  it("keeps zero eligible targets distinct from provider unavailability", () => {
    expect(noPushTargets()).toEqual({ state: "no-targets" });
    expect(providerUnavailable(0)).toEqual({
      state: "provider-unavailable",
      accepted: 0,
      attempted: 0,
    });
  });

  it("treats a batch with no FCM acceptance as provider unavailable", () => {
    expect(
      classifyPushProviderAttempts(["rejected", "network-error"]),
    ).toEqual({
      state: "provider-unavailable",
      accepted: 0,
      attempted: 2,
    });
  });

  it("retains the accepted count when at least one FCM request is accepted", () => {
    const dispatch = classifyPushProviderAttempts([
      "rejected",
      "accepted",
      "accepted",
    ]);
    expect(dispatch).toEqual({
      state: "provider-accepted",
      accepted: 2,
      attempted: 3,
    });
    expect(shouldReleasePushReservation(dispatch)).toBe(false);
  });

  it("releases a scheduled reservation only when no provider accepted it", () => {
    expect(shouldReleasePushReservation(noPushTargets())).toBe(true);
    expect(shouldReleasePushReservation(providerUnavailable(2))).toBe(true);
  });
});
