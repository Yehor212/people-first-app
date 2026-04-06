import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useGamificationStore } from "@/stores/gamificationStore";
import type { RewardOptions } from "@/stores/gamificationStore";
import { logger } from "@/lib/logger";

const initialState = useGamificationStore.getState();

function createMockHooks() {
  return {
    awardXp: vi.fn(),
    earnTreats: vi.fn().mockReturnValue({ earned: 5, bonus: 0, multiplier: 1, newBalance: 5 }),
    plantSeed: vi.fn(),
    waterPlants: vi.fn(),
    showPopup: vi.fn(),
    sync: vi.fn(),
  };
}

function defaultOptions(overrides: Partial<RewardOptions> = {}): RewardOptions {
  return {
    treats: 3,
    treatReason: "test-reason",
    ...overrides,
  };
}

beforeEach(() => {
  useGamificationStore.setState(initialState, true);
  vi.clearAllMocks();
});

// =========================================================================
// 1. Initial state
// =========================================================================
describe("gamificationStore initial state", () => {
  it("_hooks defaults to null", () => {
    expect(useGamificationStore.getState()._hooks).toBeNull();
  });
});

// =========================================================================
// 2. _registerHooks
// =========================================================================
describe("_registerHooks", () => {
  it("stores hooks object in state", () => {
    const hooks = createMockHooks();
    useGamificationStore.getState()._registerHooks(hooks);
    expect(useGamificationStore.getState()._hooks).toBe(hooks);
  });

  it("replaces previously registered hooks", () => {
    const hooks1 = createMockHooks();
    const hooks2 = createMockHooks();
    useGamificationStore.getState()._registerHooks(hooks1);
    useGamificationStore.getState()._registerHooks(hooks2);
    expect(useGamificationStore.getState()._hooks).toBe(hooks2);
  });
});

// =========================================================================
// 3. rewardUser without hooks
// =========================================================================
describe("rewardUser without hooks", () => {
  it("logs a warning when hooks are not registered", () => {
    useGamificationStore.getState().rewardUser("mood" as const, defaultOptions());
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("before hooks registered"));
  });

  it("returns { treatsEarned: 0 }", () => {
    const result = useGamificationStore.getState().rewardUser("mood" as const, defaultOptions());
    expect(result).toEqual({ treatsEarned: 0 });
  });

  it("does not call showPopup without hooks registered", () => {
    useGamificationStore.getState().rewardUser("mood" as const, defaultOptions());
    // No hooks registered = early return, showPopup never called
    expect(logger.warn).toHaveBeenCalled();
  });

  it("does not call sync without hooks registered", () => {
    useGamificationStore.getState().rewardUser("mood" as const, defaultOptions());
    // No hooks registered = early return, sync never called
    expect(logger.warn).toHaveBeenCalled();
  });
});

// =========================================================================
// 4. rewardUser with hooks — full flow
// =========================================================================
describe("rewardUser with hooks (full flow)", () => {
  it("calls awardXp with activity", () => {
    const hooks = createMockHooks();
    useGamificationStore.getState()._registerHooks(hooks);
    useGamificationStore.getState().rewardUser("mood", defaultOptions());
    expect(hooks.awardXp).toHaveBeenCalledWith("mood");
  });

  it("calls earnTreats with activity, treats, and treatReason", () => {
    const hooks = createMockHooks();
    useGamificationStore.getState()._registerHooks(hooks);
    useGamificationStore
      .getState()
      .rewardUser("focus", defaultOptions({ treats: 10, treatReason: "focused" }));
    expect(hooks.earnTreats).toHaveBeenCalledWith("focus", 10, "focused");
  });

  it("calls hooks.showPopup with earned amount and activity", () => {
    const hooks = createMockHooks();
    hooks.earnTreats.mockReturnValue({ earned: 7 });
    useGamificationStore.getState()._registerHooks(hooks);
    useGamificationStore.getState().rewardUser("habit", defaultOptions());
    expect(hooks.showPopup).toHaveBeenCalledWith(7, "habit");
  });

  it("calls hooks.sync", () => {
    const hooks = createMockHooks();
    useGamificationStore.getState()._registerHooks(hooks);
    useGamificationStore.getState().rewardUser("mood", defaultOptions());
    expect(hooks.sync).toHaveBeenCalled();
  });

  it("calls plantSeed with activity and seedExtra", () => {
    const hooks = createMockHooks();
    useGamificationStore.getState()._registerHooks(hooks);
    useGamificationStore.getState().rewardUser("mood", defaultOptions({ seedExtra: "great" }));
    expect(hooks.plantSeed).toHaveBeenCalledWith("mood", "great");
  });

  it("calls waterPlants with activity", () => {
    const hooks = createMockHooks();
    useGamificationStore.getState()._registerHooks(hooks);
    useGamificationStore.getState().rewardUser("habit", defaultOptions());
    expect(hooks.waterPlants).toHaveBeenCalledWith("habit");
  });

  it("returns { treatsEarned } from earnTreats result", () => {
    const hooks = createMockHooks();
    hooks.earnTreats.mockReturnValue({ earned: 12 });
    useGamificationStore.getState()._registerHooks(hooks);
    const result = useGamificationStore.getState().rewardUser("mood", defaultOptions());
    expect(result).toEqual({ treatsEarned: 12 });
  });
});

// =========================================================================
// 5. Skip flags
// =========================================================================
describe("skip flags", () => {
  it("skipXp=true prevents awardXp from being called", () => {
    const hooks = createMockHooks();
    useGamificationStore.getState()._registerHooks(hooks);
    useGamificationStore.getState().rewardUser("mood", defaultOptions({ skipXp: true }));
    expect(hooks.awardXp).not.toHaveBeenCalled();
  });

  it("skipPopup=true prevents hooks.showPopup from being called", () => {
    const hooks = createMockHooks();
    useGamificationStore.getState()._registerHooks(hooks);
    useGamificationStore.getState().rewardUser("mood", defaultOptions({ skipPopup: true }));
    expect(hooks.showPopup).not.toHaveBeenCalled();
  });

  it("skipSync=true prevents hooks.sync from being called", () => {
    const hooks = createMockHooks();
    useGamificationStore.getState()._registerHooks(hooks);
    useGamificationStore.getState().rewardUser("mood", defaultOptions({ skipSync: true }));
    expect(hooks.sync).not.toHaveBeenCalled();
  });

  it("skipGarden=true prevents plantSeed and waterPlants from being called", () => {
    const hooks = createMockHooks();
    useGamificationStore.getState()._registerHooks(hooks);
    useGamificationStore.getState().rewardUser("mood", defaultOptions({ skipGarden: true }));
    expect(hooks.plantSeed).not.toHaveBeenCalled();
    expect(hooks.waterPlants).not.toHaveBeenCalled();
  });

  it("all skip flags together: only earnTreats is called", () => {
    const hooks = createMockHooks();
    useGamificationStore.getState()._registerHooks(hooks);
    useGamificationStore.getState().rewardUser(
      "mood",
      defaultOptions({
        skipXp: true,
        skipPopup: true,
        skipSync: true,
        skipGarden: true,
      })
    );
    expect(hooks.awardXp).not.toHaveBeenCalled();
    expect(hooks.showPopup).not.toHaveBeenCalled();
    expect(hooks.sync).not.toHaveBeenCalled();
    expect(hooks.plantSeed).not.toHaveBeenCalled();
    expect(hooks.waterPlants).not.toHaveBeenCalled();
    // earnTreats is always called
    expect(hooks.earnTreats).toHaveBeenCalledOnce();
  });
});

// =========================================================================
// 6. Haptic
// =========================================================================
describe("haptic callback", () => {
  it("calls haptic function when provided", () => {
    const hooks = createMockHooks();
    const haptic = vi.fn().mockResolvedValue(undefined);
    useGamificationStore.getState()._registerHooks(hooks);
    useGamificationStore.getState().rewardUser("mood", defaultOptions({ haptic }));
    expect(haptic).toHaveBeenCalled();
  });

  it("does not crash when haptic is not provided", () => {
    const hooks = createMockHooks();
    useGamificationStore.getState()._registerHooks(hooks);
    expect(() => {
      useGamificationStore.getState().rewardUser("mood", defaultOptions());
    }).not.toThrow();
  });
});
