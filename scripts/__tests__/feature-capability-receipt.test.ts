import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MODULE_PATH = path.resolve("scripts/feature-capability-build.cjs");
const moduleExists = existsSync(MODULE_PATH);
const require = createRequire(import.meta.url);
const capabilityModule = moduleExists
  ? (require(MODULE_PATH) as {
      createFeatureCapabilityReceipt: (input: unknown) => Record<string, unknown>;
      parseFeatureCapabilityPolicy: (input: unknown) => Record<string, unknown>;
      serializeFeatureCapabilityReceipt: (receipt: unknown) => string;
      validateFeatureCapabilityReceipt: (
        receipt: unknown,
        expectations?: { expectedSourceCommit?: string; expectedPlatform?: string },
      ) => true;
      validateFeatureCapabilityReceiptSet: (
        receipts: unknown[],
        expectations?: { expectedSourceCommit?: string },
      ) => true;
    })
  : null;

const SOURCE_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const PLATFORMS = ["web-pages", "android", "ios", "tauri"] as const;
const ADMISSION = {
  technical: "unverified",
  accessibility: "unverified",
  performance: "unverified",
  visualRuntime: "unverified",
  artisticCraft: "unverified",
  userApproval: "unverified",
} as const;

function policy(
  overrides: {
    requested?: boolean;
    killSwitch?: boolean;
    admission?: Record<string, string>;
  } = {},
) {
  return {
    schemaVersion: 1,
    capabilities: {
      journalSaveCeremony: {
        requested: overrides.requested ?? false,
        killSwitch: overrides.killSwitch ?? true,
        admission: overrides.admission ?? ADMISSION,
      },
    },
  };
}

function createReceipt(platform: (typeof PLATFORMS)[number], inputPolicy = policy()) {
  if (!capabilityModule) throw new Error("feature capability module is unavailable");
  return capabilityModule.createFeatureCapabilityReceipt({
    sourceCommit: SOURCE_COMMIT,
    platform,
    policy: inputPolicy,
  });
}

describe("feature capability receipt schema v1", () => {
  it("has a production implementation before behavioral controls run", () => {
    expect(
      moduleExists,
      "T051 RED: scripts/feature-capability-build.cjs must implement the receipt contract",
    ).toBe(true);
  });

  it.skipIf(!moduleExists)("serializes deterministically with exact privacy-safe keys", () => {
    const receipt = createReceipt("web-pages");
    const serialized = capabilityModule!.serializeFeatureCapabilityReceipt(receipt);

    expect(serialized).toBe(
      `${JSON.stringify(
        {
          schemaVersion: 1,
          sourceCommit: SOURCE_COMMIT,
          platform: "web-pages",
          capabilities: { journalSaveCeremony: false },
          killSwitches: { journalSaveCeremony: true },
          admission: ADMISSION,
        },
        null,
        2,
      )}\n`,
    );
    expect(capabilityModule!.serializeFeatureCapabilityReceipt(receipt)).toBe(serialized);
    expect(serialized).not.toMatch(
      /timestamp|account|userId|deviceId|journal(?:Content|Count)|token|secret|hostname|absolutePath|error/i,
    );
  });

  it.skipIf(!moduleExists)(
    "keeps schema v1 disabled even when requested and every admission row says pass",
    () => {
      const allPass = Object.fromEntries(Object.keys(ADMISSION).map((key) => [key, "pass"]));
      const receipt = createReceipt(
        "web-pages",
        policy({ requested: true, killSwitch: false, admission: allPass }),
      );

      expect(receipt).toMatchObject({
        capabilities: { journalSaveCeremony: false },
        killSwitches: { journalSaveCeremony: false },
        admission: allPass,
      });
    },
  );

  it.skipIf(!moduleExists)("gives the kill switch precedence", () => {
    const allPass = Object.fromEntries(Object.keys(ADMISSION).map((key) => [key, "pass"]));
    const receipt = createReceipt(
      "android",
      policy({ requested: true, killSwitch: true, admission: allPass }),
    );

    expect(receipt).toMatchObject({
      capabilities: { journalSaveCeremony: false },
      killSwitches: { journalSaveCeremony: true },
    });
  });

  it.skipIf(!moduleExists)("rejects malformed, missing, conflicting, and unknown policy input", () => {
    const invalidPolicies = [
      null,
      {},
      { ...policy(), schemaVersion: 2 },
      { ...policy(), unexpected: true },
      {
        ...policy(),
        capabilities: {
          journalSaveCeremony: {
            ...policy().capabilities.journalSaveCeremony,
            requested: "true",
          },
        },
      },
      {
        ...policy(),
        capabilities: {
          journalSaveCeremony: {
            ...policy().capabilities.journalSaveCeremony,
            admission: { ...ADMISSION, userApproval: "approved" },
          },
        },
      },
    ];

    for (const invalid of invalidPolicies) {
      expect(() => capabilityModule!.parseFeatureCapabilityPolicy(invalid)).toThrow(
        /FEATURE CAPABILITY:/,
      );
    }
  });

  it.skipIf(!moduleExists)("validates the exact lowercase commit and explicit target", () => {
    const receipt = createReceipt("ios");

    expect(
      capabilityModule!.validateFeatureCapabilityReceipt(receipt, {
        expectedSourceCommit: SOURCE_COMMIT,
        expectedPlatform: "ios",
      }),
    ).toBe(true);
    expect(() =>
      capabilityModule!.validateFeatureCapabilityReceipt(receipt, {
        expectedSourceCommit: "f".repeat(40),
      }),
    ).toThrow(/FEATURE CAPABILITY:/);
    expect(() =>
      capabilityModule!.validateFeatureCapabilityReceipt(receipt, {
        expectedPlatform: "android",
      }),
    ).toThrow(/FEATURE CAPABILITY:/);
    expect(() =>
      capabilityModule!.createFeatureCapabilityReceipt({
        sourceCommit: SOURCE_COMMIT.toUpperCase(),
        platform: "ios",
        policy: policy(),
      }),
    ).toThrow(/FEATURE CAPABILITY:/);
  });

  it.skipIf(!moduleExists)("rejects unknown and privacy-sensitive receipt fields", () => {
    const receipt = createReceipt("tauri");

    for (const extra of [
      { timestamp: "2026-08-04T00:00:00.000Z" },
      { userId: "account-a" },
      { hostname: "developer-machine" },
      { error: "free-form diagnostics" },
    ]) {
      expect(() =>
        capabilityModule!.validateFeatureCapabilityReceipt({ ...receipt, ...extra }),
      ).toThrow(/FEATURE CAPABILITY:/);
    }
  });

  it.skipIf(!moduleExists)("requires a consistent four-target release set", () => {
    const receipts = PLATFORMS.map((platform) => createReceipt(platform));

    expect(
      capabilityModule!.validateFeatureCapabilityReceiptSet(receipts, {
        expectedSourceCommit: SOURCE_COMMIT,
      }),
    ).toBe(true);
    expect(() => capabilityModule!.validateFeatureCapabilityReceiptSet(receipts.slice(0, 3))).toThrow(
      /FEATURE CAPABILITY:/,
    );
    expect(() =>
      capabilityModule!.validateFeatureCapabilityReceiptSet([
        ...receipts.slice(0, 3),
        { ...receipts[3], sourceCommit: "f".repeat(40) },
      ]),
    ).toThrow(/FEATURE CAPABILITY:/);
  });

  it.skipIf(!moduleExists)("rejects an enabled schema-v1 receipt as a negative control", () => {
    const receipt = createReceipt("web-pages");

    expect(() =>
      capabilityModule!.validateFeatureCapabilityReceipt({
        ...receipt,
        capabilities: { journalSaveCeremony: true },
      }),
    ).toThrow(/FEATURE CAPABILITY:/);
  });
});
