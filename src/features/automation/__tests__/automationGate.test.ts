import { describe, expect, it } from "vitest";
import { resolveAutomationServiceGate } from "../automationGate";

const NOW = 10_000;
const freshOn = {
  schemaVersion: 1,
  enabled: true,
  fetchedAt: NOW - 100,
  expiresAt: NOW + 900,
} as const;

describe("automation service gate", () => {
  it("fails closed when the control is missing, invalid, or stale", () => {
    expect(
      resolveAutomationServiceGate({
        now: NOW,
        fetchState: "success",
        control: null,
        emergencyDisabled: false,
      }),
    ).toEqual({ allowed: false, code: "SERVICE_CONTROL_MISSING" });
    expect(
      resolveAutomationServiceGate({
        now: NOW,
        fetchState: "success",
        control: { ...freshOn, fetchedAt: NOW + 1 },
        emergencyDisabled: false,
      }),
    ).toEqual({ allowed: false, code: "SERVICE_CONTROL_INVALID" });
    expect(
      resolveAutomationServiceGate({
        now: NOW,
        fetchState: "success",
        control: { ...freshOn, expiresAt: NOW - 1 },
        emergencyDisabled: false,
      }),
    ).toEqual({ allowed: false, code: "SERVICE_CONTROL_STALE" });
  });

  it("does not reuse cached ON after an offline or failed refresh", () => {
    expect(
      resolveAutomationServiceGate({
        now: NOW,
        fetchState: "offline",
        control: freshOn,
        emergencyDisabled: false,
      }),
    ).toEqual({ allowed: false, code: "SERVICE_REFRESH_UNAVAILABLE" });
    expect(
      resolveAutomationServiceGate({
        now: NOW,
        fetchState: "error",
        control: freshOn,
        emergencyDisabled: false,
      }),
    ).toEqual({ allowed: false, code: "SERVICE_REFRESH_UNAVAILABLE" });
  });

  it("gives an emergency kill switch precedence over fresh ON", () => {
    expect(
      resolveAutomationServiceGate({
        now: NOW,
        fetchState: "success",
        control: freshOn,
        emergencyDisabled: true,
      }),
    ).toEqual({ allowed: false, code: "SERVICE_KILL_SWITCH" });
  });

  it("allows only a fresh successful ON response", () => {
    expect(
      resolveAutomationServiceGate({
        now: NOW,
        fetchState: "success",
        control: { ...freshOn, enabled: false },
        emergencyDisabled: false,
      }),
    ).toEqual({ allowed: false, code: "SERVICE_DISABLED" });
    expect(
      resolveAutomationServiceGate({
        now: NOW,
        fetchState: "success",
        control: freshOn,
        emergencyDisabled: false,
      }),
    ).toEqual({ allowed: true, code: "SERVICE_ENABLED" });
  });
});
