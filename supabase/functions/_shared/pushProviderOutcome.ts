export type PushProviderAttempt =
  | "accepted"
  | "rejected"
  | "network-error";

export type PushDispatchResult =
  | { state: "no-targets" }
  | {
    state: "provider-unavailable";
    accepted: 0;
    attempted: number;
  }
  | {
    state: "provider-accepted";
    accepted: number;
    attempted: number;
  };

export function noPushTargets(): PushDispatchResult {
  return { state: "no-targets" };
}

export function providerUnavailable(attempted: number): PushDispatchResult {
  return {
    state: "provider-unavailable",
    accepted: 0,
    attempted,
  };
}

export function classifyPushProviderAttempts(
  attempts: readonly PushProviderAttempt[],
): PushDispatchResult {
  const accepted = attempts.filter((attempt) => attempt === "accepted").length;
  if (accepted === 0) return providerUnavailable(attempts.length);
  return {
    state: "provider-accepted",
    accepted,
    attempted: attempts.length,
  };
}

export function shouldReleasePushReservation(
  dispatch: PushDispatchResult,
): boolean {
  return (
    dispatch.state === "no-targets" ||
    dispatch.state === "provider-unavailable"
  );
}
