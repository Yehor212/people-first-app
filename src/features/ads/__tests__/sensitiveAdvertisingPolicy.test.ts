import { describe, expect, it, vi } from "vitest";

import {
  evaluateSensitiveAdvertisingAttempt,
  evaluateSensitiveAdvertisingPolicy,
} from "@/features/ads/sensitiveAdvertisingPolicy";
import { SENSITIVE_ADVERTISING_SCENARIOS } from "@/features/ads/sensitiveAdvertisingInventory";
import {
  selectAnyModalOpen,
  useUIStore,
  type ModalName,
} from "@/stores/uiStore";

const LIFECYCLES = ["direct", "navigation", "back", "reload", "overlay"] as const;
const ROUTE_SURFACES = ["orb", "habits", "diary", "planning", "settings"] as const;
const PRIVATE_OVERLAY_STATES = SENSITIVE_ADVERTISING_SCENARIOS.filter(
  ({ surface }) => surface === "overlay",
).map(({ id }) => id);
const STORE_MODAL_STATES: readonly ModalName[] = [
  "showWeeklyReport",
  "showWidgetSettings",
  "showChallenges",
  "showChallengeModal",
  "showTimeHelper",
  "showTasksPanel",
  "showAddEvent",
  "showQuestsPanel",
  "showFriendsPanel",
  "showWelcomeOverlay",
  "showWelcomeBack",
  "showMindfulMoment",
];

const EXPECTED_DENIED_CAPABILITIES = {
  prompt: false,
  copy: false,
  import: false,
  controller: false,
  initialize: false,
  request: false,
  show: false,
};

type AdvertisingCapability = keyof typeof EXPECTED_DENIED_CAPABILITIES;

function assertPolicyDeniesEveryCapability(
  stateId: string,
  capabilities: Record<AdvertisingCapability, boolean>,
  violations: string[],
): void {
  for (const capability of Object.keys(capabilities) as AdvertisingCapability[]) {
    if (capabilities[capability] !== false) violations.push(`${stateId}/${capability}`);
  }
}

const EXPECTED_DENIED_PRIVATE_DATA_SINKS = {
  adPayload: false,
  telemetry: false,
  receipt: false,
};

describe("T177 sensitive advertising deny map", () => {
  it("denies every inventoried state across direct, navigation, Back, reload, and overlay lifecycles", () => {
    const violations: string[] = [];
    let evaluated = 0;
    let capabilityAttempts = 0;

    for (const { id: stateId, surface } of SENSITIVE_ADVERTISING_SCENARIOS) {
      for (const lifecycle of LIFECYCLES) {
        evaluated += 1;
        const decision = evaluateSensitiveAdvertisingPolicy({ surface, lifecycle, stateId });
        assertPolicyDeniesEveryCapability(
          `${stateId}/${lifecycle}`,
          decision.capabilities,
          violations,
        );
        if (
          decision.decision !== "deny" ||
          decision.allowed !== false ||
          JSON.stringify(decision.privateDataSinks) !==
            JSON.stringify(EXPECTED_DENIED_PRIVATE_DATA_SINKS)
        ) {
          violations.push(`${stateId}/${lifecycle}`);
        }
        for (const capability of Object.keys(EXPECTED_DENIED_CAPABILITIES) as AdvertisingCapability[]) {
          capabilityAttempts += 1;
          const attempt = evaluateSensitiveAdvertisingAttempt(
            { surface, lifecycle, stateId },
            capability,
          );
          if (!attempt.blocked || !attempt.violationDetected) {
            violations.push(`${stateId}/${lifecycle}/${capability}`);
          }
        }
      }
    }

    expect(evaluated).toBe(315);
    expect(capabilityAttempts).toBe(2_205);
    expect(violations).toEqual([]);
  });

  it("keeps every current route denied when any private overlay is forged open", () => {
    const violations: string[] = [];
    let evaluated = 0;
    let capabilityAttempts = 0;

    for (const surface of ROUTE_SURFACES) {
      for (const overlayState of PRIVATE_OVERLAY_STATES) {
        for (const lifecycle of ["navigation", "back", "reload", "overlay"] as const) {
          evaluated += 1;
          const decision = evaluateSensitiveAdvertisingPolicy({
            surface,
            lifecycle,
            stateId: `${surface}.route-shell+${overlayState}`,
            privateOverlayOpen: true,
          });
          assertPolicyDeniesEveryCapability(
            `${surface}/${overlayState}/${lifecycle}`,
            decision.capabilities,
            violations,
          );
          if (
            decision.decision !== "deny" ||
            decision.surface !== "overlay" ||
            decision.lifecycle !== "overlay" ||
            decision.reason !== "private_overlay"
          ) {
            violations.push(`${surface}/${overlayState}/${lifecycle}`);
          }
          for (const capability of Object.keys(EXPECTED_DENIED_CAPABILITIES) as AdvertisingCapability[]) {
            capabilityAttempts += 1;
            const attempt = evaluateSensitiveAdvertisingAttempt(
              {
                surface,
                lifecycle,
                stateId: `${surface}.route-shell+${overlayState}`,
                privateOverlayOpen: true,
              },
              capability,
            );
            if (!attempt.blocked || !attempt.violationDetected) {
              violations.push(`${surface}/${overlayState}/${lifecycle}/${capability}`);
            }
          }
        }
      }
    }

    expect(evaluated).toBe(240);
    expect(capabilityAttempts).toBe(1_680);
    expect(violations).toEqual([]);
  });

  it("classifies every canonical UI-store modal as a private overlay", () => {
    for (const modalName of STORE_MODAL_STATES) {
      useUIStore.getState().closeAllModals();
      useUIStore.getState().openModal(modalName);

      const privateOverlayOpen = selectAnyModalOpen(useUIStore.getState());
      const decision = evaluateSensitiveAdvertisingPolicy({
        surface: "planning",
        lifecycle: "navigation",
        stateId: `planning.route-shell+${modalName}`,
        privateOverlayOpen,
      });

      expect(privateOverlayOpen, modalName).toBe(true);
      expect(decision.reason, modalName).toBe("private_overlay");
      expect(decision.lifecycle, modalName).toBe("overlay");
    }
    useUIStore.getState().closeAllModals();
  });

  it("fails closed for malformed or future route and lifecycle values", () => {
    const decision = evaluateSensitiveAdvertisingPolicy({
      surface: "future-unapproved-surface",
      lifecycle: "future-lifecycle",
      stateId: "future.unapproved",
    });

    expect(decision).toEqual({
      decision: "deny",
      allowed: false,
      reason: "unknown_fail_closed",
      surface: "unknown",
      lifecycle: "direct",
      capabilities: EXPECTED_DENIED_CAPABILITIES,
      privateDataSinks: EXPECTED_DENIED_PRIVATE_DATA_SINKS,
    });
  });

  it("does not copy a private canary to a decision, telemetry, network, storage, or receipt sink", () => {
    const privateCanary = "T177_PRIVATE_CANARY_DO_NOT_EXPORT";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    const originalBeacon = Object.getOwnPropertyDescriptor(navigator, "sendBeacon");
    const beaconSpy = vi.fn(() => false);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: beaconSpy,
    });

    const decision = evaluateSensitiveAdvertisingPolicy({
      surface: "diary",
      lifecycle: "overlay",
      stateId: "diary.entry-editor",
      privateOverlayOpen: true,
      privatePayload: privateCanary,
    } as Parameters<typeof evaluateSensitiveAdvertisingPolicy>[0] & {
      privatePayload: string;
    });

    expect(JSON.stringify(decision)).not.toContain(privateCanary);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    storageSpy.mockRestore();
    if (originalBeacon) Object.defineProperty(navigator, "sendBeacon", originalBeacon);
    else Reflect.deleteProperty(navigator, "sendBeacon");
  });
});
