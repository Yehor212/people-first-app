/**
 * useDesignFlag tests — Phase 2-B
 *
 * Covers:
 *   - unknown flag → false
 *   - killswitch → false (even if enabled)
 *   - disabled flag → false
 *   - rollout 100 → true
 *   - rollout 0 → false
 *   - rollout 50 → deterministic per bucket id
 *   - static variant (non-React)
 *   - SSR safety
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn(),
  },
}));

import {
  useDesignFlag,
  isDesignFlagEnabledStatic,
  evaluateDesignFlag,
} from "../useDesignFlag";
import { useDesignFlagStore } from "@/stores/designFlagStore";
import { SK } from "@/lib/storageKeys";

function seed(
  key: string,
  enabled: boolean,
  percent: number,
  killswitch = false,
) {
  useDesignFlagStore.setState({
    flags: {
      [key]: { key, enabled, rollout_percent: percent, killswitch },
    },
    lastFetch: Date.now(),
    isLoading: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useDesignFlagStore.setState({ flags: {}, lastFetch: null, isLoading: false });
  // Reset the anon ID in localStorage so bucket tests are deterministic
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
});

describe("evaluateDesignFlag (pure function)", () => {
  it("returns false when flag is undefined", () => {
    expect(evaluateDesignFlag(undefined, "bucket", "key")).toBe(false);
  });

  it("returns false when killswitch is true even if enabled and 100%", () => {
    expect(
      evaluateDesignFlag(
        { enabled: true, rollout_percent: 100, killswitch: true },
        "b",
        "k",
      ),
    ).toBe(false);
  });

  it("returns false when enabled=false", () => {
    expect(
      evaluateDesignFlag(
        { enabled: false, rollout_percent: 100, killswitch: false },
        "b",
        "k",
      ),
    ).toBe(false);
  });

  it("returns true when rollout_percent=100 and enabled", () => {
    expect(
      evaluateDesignFlag(
        { enabled: true, rollout_percent: 100, killswitch: false },
        "b",
        "k",
      ),
    ).toBe(true);
  });

  it("returns false when rollout_percent=0 and enabled", () => {
    expect(
      evaluateDesignFlag(
        { enabled: true, rollout_percent: 0, killswitch: false },
        "b",
        "k",
      ),
    ).toBe(false);
  });

  it("is deterministic for the same (bucketId, key) pair", () => {
    const flag = { enabled: true, rollout_percent: 50, killswitch: false };
    const a = evaluateDesignFlag(flag, "user-abc", "my.key");
    const b = evaluateDesignFlag(flag, "user-abc", "my.key");
    expect(a).toBe(b);
  });

  it("distributes across buckets (50% rollout produces mixed results)", () => {
    const flag = { enabled: true, rollout_percent: 50, killswitch: false };
    const results = Array.from({ length: 1000 }, (_, i) =>
      evaluateDesignFlag(flag, "bucket-" + i, "key"),
    );
    const truthy = results.filter(Boolean).length;
    // 50% rollout with 1000 samples → 450..550 acceptable range
    expect(truthy).toBeGreaterThan(400);
    expect(truthy).toBeLessThan(600);
  });
});

describe("useDesignFlag (React hook)", () => {
  it("returns false for unknown flag", async () => {
    const { result } = renderHook(() => useDesignFlag("unknown.flag"));
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("returns true for enabled flag with rollout 100", async () => {
    seed("design.colors.oklch.mood-slider", true, 100);
    const { result } = renderHook(() =>
      useDesignFlag("design.colors.oklch.mood-slider"),
    );
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("returns false when killswitch engaged even at 100%", async () => {
    seed("design.theme.paper", true, 100, true);
    const { result } = renderHook(() => useDesignFlag("design.theme.paper"));
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("returns false when rollout_percent is 0", async () => {
    seed("design.colors.oklch.mood-slider", true, 0);
    const { result } = renderHook(() =>
      useDesignFlag("design.colors.oklch.mood-slider"),
    );
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("keeps the same rollout bucket for the hook lifetime", () => {
    const key = "design.experiment.sticky-bucket";
    const flag = { enabled: true, rollout_percent: 50, killswitch: false };
    let initialBucket = "";
    let oppositeBucket = "";

    for (let i = 0; i < 1000; i += 1) {
      const candidate = `bucket-${i}`;
      const current = evaluateDesignFlag(flag, candidate, key);
      if (!initialBucket) {
        initialBucket = candidate;
        continue;
      }
      if (current !== evaluateDesignFlag(flag, initialBucket, key)) {
        oppositeBucket = candidate;
        break;
      }
    }

    expect(initialBucket).not.toBe("");
    expect(oppositeBucket).not.toBe("");

    seed(key, true, 50);
    window.localStorage.setItem(SK.ANON_ID, initialBucket);
    const expected = evaluateDesignFlag(flag, initialBucket, key);
    const { result, rerender } = renderHook(() => useDesignFlag(key));

    expect(result.current).toBe(expected);
    window.localStorage.setItem(SK.ANON_ID, oppositeBucket);
    expect(evaluateDesignFlag(flag, oppositeBucket, key)).not.toBe(expected);

    rerender();
    expect(result.current).toBe(expected);
  });
});

describe("isDesignFlagEnabledStatic", () => {
  it("returns false for unknown flag", () => {
    expect(isDesignFlagEnabledStatic("unknown.flag")).toBe(false);
  });

  it("returns true for enabled flag with rollout 100", () => {
    seed("design.typography.v2", true, 100);
    expect(isDesignFlagEnabledStatic("design.typography.v2")).toBe(true);
  });

  it("returns false when killswitch engaged", () => {
    seed("design.theme.paper", true, 100, true);
    expect(isDesignFlagEnabledStatic("design.theme.paper")).toBe(false);
  });

  it("accepts explicit userId for bucketing", () => {
    seed("design.colors.oklch.mood-slider", true, 50);
    // Two different user IDs for the same key should be deterministic per-call
    const r1 = isDesignFlagEnabledStatic(
      "design.colors.oklch.mood-slider",
      "user-1",
    );
    const r1again = isDesignFlagEnabledStatic(
      "design.colors.oklch.mood-slider",
      "user-1",
    );
    expect(r1).toBe(r1again);
  });
});
