import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted<{
  result: { data: unknown; error: unknown };
}>(() => ({
  result: { data: null, error: null },
}));

const maybeSingle = vi.hoisted(() => vi.fn(async () => state.result));
const eq = vi.hoisted(() => vi.fn(() => ({ maybeSingle })));
const select = vi.hoisted(() => vi.fn(() => ({ eq })));
const from = vi.hoisted(() => vi.fn(() => ({ select })));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from },
}));

import { resolveFreshAutomationServiceGate } from "../automationServiceControl";

describe("fresh connected-record service control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    state.result = { data: null, error: null };
  });

  it("fails closed when offline, missing, malformed or rejected", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    await expect(resolveFreshAutomationServiceGate()).resolves.toEqual({
      allowed: false,
      code: "SERVICE_REFRESH_UNAVAILABLE",
    });
    expect(from).not.toHaveBeenCalled();

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    await expect(resolveFreshAutomationServiceGate()).resolves.toEqual({
      allowed: false,
      code: "SERVICE_CONTROL_MISSING",
    });

    state.result = { data: null, error: { message: "network" } };
    await expect(resolveFreshAutomationServiceGate()).resolves.toEqual({
      allowed: false,
      code: "SERVICE_REFRESH_UNAVAILABLE",
    });

    state.result = { data: { enabled: true, rollout_percent: 100 }, error: null };
    await expect(resolveFreshAutomationServiceGate()).resolves.toEqual({
      allowed: false,
      code: "SERVICE_CONTROL_INVALID",
    });
  });

  it("requires full rollout and gives the server kill switch precedence", async () => {
    state.result = {
      data: { enabled: true, rollout_percent: 50, killswitch: false },
      error: null,
    };
    await expect(resolveFreshAutomationServiceGate()).resolves.toEqual({
      allowed: false,
      code: "SERVICE_DISABLED",
    });

    state.result = {
      data: { enabled: true, rollout_percent: 100, killswitch: true },
      error: null,
    };
    await expect(resolveFreshAutomationServiceGate()).resolves.toEqual({
      allowed: false,
      code: "SERVICE_KILL_SWITCH",
    });

    state.result = {
      data: { enabled: true, rollout_percent: 100, killswitch: false },
      error: null,
    };
    await expect(resolveFreshAutomationServiceGate()).resolves.toEqual({
      allowed: true,
      code: "SERVICE_ENABLED",
    });
    expect(eq).toHaveBeenCalledWith("key", "automation.connected-records.v1");
  });
});
