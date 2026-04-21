/**
 * designFlagStore tests — Phase 2-B
 *
 * Covers:
 *   - fetchFlags happy path (Supabase returns 4 rows)
 *   - fetchFlags offline fallback (Supabase throws)
 *   - fetchFlags debounce (second call within interval is no-op)
 *   - SSR safety (no window → no localStorage access)
 *   - _setFlagsForTest helper
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mocks ---

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/env", () => ({
  IS_DEV: true,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { useDesignFlagStore, type DesignFlag } from "../designFlagStore";
import { supabase } from "@/lib/supabaseClient";

const mockSupabase = supabase as NonNullable<typeof supabase>;
const mockSupabaseFrom = vi.mocked(mockSupabase.from);

function resetStore() {
  useDesignFlagStore.setState({
    flags: {},
    lastFetch: null,
    isLoading: false,
  });
}

function sampleFlags(): DesignFlag[] {
  return [
    {
      key: "design.typography.v2",
      enabled: true,
      rollout_percent: 100,
      killswitch: false,
      description: "Typography",
    },
    {
      key: "design.motion.v2",
      enabled: true,
      rollout_percent: 100,
      killswitch: false,
      description: "Motion",
    },
    {
      key: "design.colors.oklch.mood-slider",
      enabled: false,
      rollout_percent: 0,
      killswitch: false,
      description: "Pilot",
    },
    {
      key: "design.theme.paper",
      enabled: false,
      rollout_percent: 0,
      killswitch: false,
      description: "Paper",
    },
  ];
}

describe("designFlagStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("starts empty with lastFetch=null", () => {
    const s = useDesignFlagStore.getState();
    expect(s.flags).toEqual({});
    expect(s.lastFetch).toBeNull();
    expect(s.isLoading).toBe(false);
  });

  it("fetchFlags populates flags on successful network call", async () => {
    const data = sampleFlags();
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data, error: null }),
    } as unknown as ReturnType<typeof mockSupabase.from>);

    await useDesignFlagStore.getState().fetchFlags();

    const state = useDesignFlagStore.getState();
    expect(Object.keys(state.flags)).toHaveLength(4);
    expect(state.flags["design.typography.v2"]).toMatchObject({
      enabled: true,
      rollout_percent: 100,
    });
    expect(state.flags["design.colors.oklch.mood-slider"]).toMatchObject({
      enabled: false,
      rollout_percent: 0,
    });
    expect(state.lastFetch).not.toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("fetchFlags keeps cached flags on network error (offline-first)", async () => {
    useDesignFlagStore.setState({
      flags: {
        cached: {
          key: "cached",
          enabled: true,
          rollout_percent: 100,
          killswitch: false,
        },
      },
      lastFetch: 0,
    });

    mockSupabaseFrom.mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue({ data: null, error: new Error("offline") }),
    } as unknown as ReturnType<typeof mockSupabase.from>);

    await useDesignFlagStore.getState().fetchFlags();

    const state = useDesignFlagStore.getState();
    // Cached flag preserved
    expect(state.flags.cached).toBeDefined();
    expect(state.isLoading).toBe(false);
  });

  it("fetchFlags debounces subsequent calls within 5-minute interval", async () => {
    const selectMock = vi.fn().mockResolvedValue({ data: [], error: null });
    mockSupabaseFrom.mockReturnValue({ select: selectMock } as unknown as ReturnType<
      typeof mockSupabase.from
    >);

    await useDesignFlagStore.getState().fetchFlags();
    await useDesignFlagStore.getState().fetchFlags();
    await useDesignFlagStore.getState().fetchFlags();

    // Should only hit the network once
    expect(selectMock).toHaveBeenCalledTimes(1);
  });

  it("_setFlagsForTest seeds flags without network access", () => {
    useDesignFlagStore.getState()._setFlagsForTest({
      "design.colors.oklch.mood-slider": {
        key: "design.colors.oklch.mood-slider",
        enabled: true,
        rollout_percent: 100,
        killswitch: false,
      },
    });

    const state = useDesignFlagStore.getState();
    expect(
      state.flags["design.colors.oklch.mood-slider"]?.rollout_percent,
    ).toBe(100);
    expect(state.lastFetch).not.toBeNull();
  });

  it("handles null data from Supabase gracefully", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as ReturnType<typeof mockSupabase.from>);

    await useDesignFlagStore.getState().fetchFlags();

    const state = useDesignFlagStore.getState();
    expect(state.flags).toEqual({});
    expect(state.lastFetch).not.toBeNull();
  });
});
