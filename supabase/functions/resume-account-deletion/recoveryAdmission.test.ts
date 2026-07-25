import { describe, expect, it } from "vitest";

import {
  createRecoveryAdmissionRejectionResponse,
  parseRecoveryAdmission,
} from "./recoveryAdmission";

describe("account deletion recovery admission response", () => {
  it("accepts only the exact database admission row contract", () => {
    expect(parseRecoveryAdmission([{ state: "allowed", retry_after_seconds: 0 }])).toEqual({
      state: "allowed",
    });
    expect(parseRecoveryAdmission([{ state: "invalid", retry_after_seconds: 0 }])).toEqual({
      state: "invalid",
    });
    expect(parseRecoveryAdmission([{ state: "limited", retry_after_seconds: 7 }])).toEqual({
      state: "limited",
      retryAfterSeconds: 7,
    });

    for (const malformed of [
      null,
      [],
      [{ state: "allowed", retry_after_seconds: 1 }],
      [{ state: "limited", retry_after_seconds: "7" }],
      [{ state: "limited", retry_after_seconds: 0 }],
      [{ state: "limited", retry_after_seconds: 61 }],
      [{ state: "unknown", retry_after_seconds: 0 }],
      [{ state: "allowed", retry_after_seconds: 0, owner_id: "leak" }],
    ]) {
      expect(parseRecoveryAdmission(malformed)).toBeNull();
    }
  });

  it("keeps invalid capabilities at 404 and emits a bounded 429 Retry-After", async () => {
    const invalid = createRecoveryAdmissionRejectionResponse(null, {
      state: "invalid",
    });
    expect(invalid?.status).toBe(404);
    await expect(invalid?.json()).resolves.toEqual({
      error: "Deletion operation not found",
    });

    const limited = createRecoveryAdmissionRejectionResponse(null, {
      state: "limited",
      retryAfterSeconds: 7,
    });
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("Retry-After")).toBe("7");
    expect(limited?.headers.get("Cache-Control")).toBe("no-store");

    expect(createRecoveryAdmissionRejectionResponse(null, { state: "allowed" })).toBeNull();
  });
});
