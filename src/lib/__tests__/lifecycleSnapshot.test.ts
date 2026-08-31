import { beforeEach, describe, expect, it } from "vitest";

import {
  readLifecycleSnapshot,
  writeLifecycleSnapshot,
} from "../lifecycleSnapshot";
import { SK } from "../storageKeys";

describe("lifecycle snapshot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists only fixed-code lifecycle metadata, never queued payloads or identities", () => {
    const privateCanary = "T173_PRIVATE_QUEUE_CANARY";

    expect(
      writeLifecycleSnapshot({
        pendingActionCount: 3,
        phase: "before-unload",
        queueSnapshot: [{ payload: privateCanary, ownerUserId: privateCanary }],
      } as Parameters<typeof writeLifecycleSnapshot>[0]),
    ).toBe(true);

    const raw = localStorage.getItem(SK.LAST_STATE);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain(privateCanary);
    expect(JSON.parse(raw ?? "{}")).toEqual({
      version: 1,
      code: "ZF_LIFECYCLE_PENDING",
      phase: "before-unload",
      pendingActionCount: 3,
    });
    expect(JSON.stringify(JSON.parse(raw ?? "{}"))).not.toContain(privateCanary);
  });

  it("rejects and removes corrupt or partial retained markers", () => {
    const invalidMarkers = [
      "{partial",
      JSON.stringify({ version: 1, code: "ZF_LIFECYCLE_PENDING" }),
      JSON.stringify({
        version: 1,
        code: "ZF_LIFECYCLE_PENDING",
        phase: "before-unload",
        pendingActionCount: -1,
      }),
      JSON.stringify({
        version: 1,
        code: "PRIVATE_DYNAMIC_CODE",
        phase: "hidden",
        pendingActionCount: 1,
      }),
    ];

    for (const marker of invalidMarkers) {
      localStorage.setItem(SK.LAST_STATE, marker);
      expect(readLifecycleSnapshot()).toEqual({ status: "invalid-removed" });
      expect(localStorage.getItem(SK.LAST_STATE)).toBeNull();
    }
  });

  it("returns the validated count-only marker without inventing recovery success", () => {
    localStorage.setItem(
      SK.LAST_STATE,
      JSON.stringify({
        version: 1,
        code: "ZF_LIFECYCLE_PENDING",
        phase: "hidden",
        pendingActionCount: 2,
      }),
    );

    expect(readLifecycleSnapshot()).toEqual({
      status: "valid",
      marker: {
        version: 1,
        code: "ZF_LIFECYCLE_PENDING",
        phase: "hidden",
        pendingActionCount: 2,
      },
    });
  });
});
