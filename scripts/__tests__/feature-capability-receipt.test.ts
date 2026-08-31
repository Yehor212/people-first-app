import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

type AdmissionStatus = "pass" | "fail" | "unverified";

type Admission = {
  technical: AdmissionStatus;
  accessibility: AdmissionStatus;
  performance: AdmissionStatus;
  visualRuntime: AdmissionStatus;
  artisticCraft: AdmissionStatus;
  userApproval: AdmissionStatus;
};

type ReleaseInput = {
  schemaVersion: 1;
  sourceCommit: string;
  requestedCapabilities: { journalSaveCeremony: boolean };
  killSwitches: { journalSaveCeremony: boolean };
  admission: Admission;
};

type Receipt = {
  schemaVersion: 1;
  sourceCommit: string;
  platform: "web-pages" | "android" | "ios" | "tauri";
  capabilities: { journalSaveCeremony: boolean };
  killSwitches: { journalSaveCeremony: boolean };
  admission: Admission;
};

type CheckerModule = {
  FEATURE_CAPABILITY_PLATFORMS: readonly Receipt["platform"][];
  evaluateFeatureCapabilityReleaseInput(input: unknown): {
    ok: boolean;
    journalSaveCeremony: boolean;
    issues: Array<{ code: string; path: string }>;
  };
  createFeatureCapabilityReceipt(input: unknown, platform: unknown): Receipt;
  createFeatureCapabilityReceiptSet(input: unknown, platforms: readonly unknown[]): Receipt[];
  validateFeatureCapabilityReceipt(
    receipt: unknown,
    expected: { sourceCommit: string; platform: Receipt["platform"] }
  ): Receipt;
  validateFeatureCapabilityReceiptSet(
    receipts: unknown,
    expected: { sourceCommit: string }
  ): Receipt[];
  serializeFeatureCapabilityReceipt(
    receipt: unknown,
    expected: { sourceCommit: string; platform: Receipt["platform"] }
  ): string;
};

const checker = require("../check-feature-capability-receipt.cjs") as CheckerModule;

const SOURCE_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const OTHER_COMMIT = "89abcdef0123456789abcdef0123456789abcdef";

const ALL_PASS_ADMISSION: Admission = {
  technical: "pass",
  accessibility: "pass",
  performance: "pass",
  visualRuntime: "pass",
  artisticCraft: "pass",
  userApproval: "pass",
};

function releaseInput(overrides: Partial<ReleaseInput> = {}): ReleaseInput {
  return {
    schemaVersion: 1,
    sourceCommit: SOURCE_COMMIT,
    requestedCapabilities: { journalSaveCeremony: false },
    killSwitches: { journalSaveCeremony: false },
    admission: { ...ALL_PASS_ADMISSION },
    ...overrides,
  };
}

function expectReceiptError(run: () => unknown, code: string) {
  try {
    run();
    throw new Error(`expected receipt error ${code}`);
  } catch (error) {
    expect(error).toMatchObject({
      name: "FeatureCapabilityReceiptError",
      code,
    });
  }
}

describe("build capability receipt", () => {
  it("uses the four explicit release targets in stable order", () => {
    expect(checker.FEATURE_CAPABILITY_PLATFORMS).toEqual(["web-pages", "android", "ios", "tauri"]);
  });

  it.each(["web-pages", "android", "ios", "tauri"] as const)(
    "generates a deterministic strict receipt for %s",
    (platform) => {
      const input = releaseInput();
      const first = checker.createFeatureCapabilityReceipt(input, platform);
      const second = checker.createFeatureCapabilityReceipt(input, platform);

      expect(first).toEqual(second);
      expect(first).toEqual({
        schemaVersion: 1,
        sourceCommit: SOURCE_COMMIT,
        platform,
        capabilities: { journalSaveCeremony: false },
        killSwitches: { journalSaveCeremony: false },
        admission: ALL_PASS_ADMISSION,
      });
      expect(Object.keys(first)).toEqual([
        "schemaVersion",
        "sourceCommit",
        "platform",
        "capabilities",
        "killSwitches",
        "admission",
      ]);
    }
  );

  it("does not promote self-attested pass strings in non-enabling schema v1", () => {
    const receipt = checker.createFeatureCapabilityReceipt(
      releaseInput({ requestedCapabilities: { journalSaveCeremony: true } }),
      "web-pages"
    );

    expect(receipt.capabilities.journalSaveCeremony).toBe(false);
    expect(
      checker.evaluateFeatureCapabilityReleaseInput(
        releaseInput({ requestedCapabilities: { journalSaveCeremony: true } })
      ).journalSaveCeremony
    ).toBe(false);
  });

  it.each([
    ["technical", "fail"],
    ["technical", "unverified"],
    ["accessibility", "fail"],
    ["accessibility", "unverified"],
    ["performance", "fail"],
    ["performance", "unverified"],
    ["visualRuntime", "fail"],
    ["visualRuntime", "unverified"],
    ["artisticCraft", "fail"],
    ["artisticCraft", "unverified"],
    ["userApproval", "fail"],
    ["userApproval", "unverified"],
  ] as const)("forces disabled when admission.%s is %s", (key, status) => {
    const receipt = checker.createFeatureCapabilityReceipt(
      releaseInput({
        requestedCapabilities: { journalSaveCeremony: true },
        admission: { ...ALL_PASS_ADMISSION, [key]: status },
      }),
      "android"
    );

    expect(receipt.capabilities.journalSaveCeremony).toBe(false);
  });

  it("gives the kill switch precedence over complete admission", () => {
    const receipt = checker.createFeatureCapabilityReceipt(
      releaseInput({
        requestedCapabilities: { journalSaveCeremony: true },
        killSwitches: { journalSaveCeremony: true },
      }),
      "ios"
    );

    expect(receipt.capabilities.journalSaveCeremony).toBe(false);
    expect(receipt.killSwitches.journalSaveCeremony).toBe(true);
  });

  it.each([
    ["missing input", undefined],
    [
      "string boolean",
      {
        ...releaseInput(),
        requestedCapabilities: { journalSaveCeremony: "true" },
      },
    ],
    [
      "unknown admission",
      {
        ...releaseInput(),
        admission: { ...ALL_PASS_ADMISSION, artisticCraft: "approved" },
      },
    ],
    [
      "conflicting capability fields",
      {
        ...releaseInput(),
        capabilities: { journalSaveCeremony: true },
      },
    ],
  ])("fails closed for %s", (_label, input) => {
    const report = checker.evaluateFeatureCapabilityReleaseInput(input);

    expect(report.ok).toBe(false);
    expect(report.journalSaveCeremony).toBe(false);
    expect(report.issues.length).toBeGreaterThan(0);
    expect(() => checker.createFeatureCapabilityReceipt(input, "web-pages")).toThrow();
  });

  it("never infers a target from the host or accepts an unknown target", () => {
    expectReceiptError(
      () => checker.createFeatureCapabilityReceipt(releaseInput(), undefined),
      "INVALID_PLATFORM"
    );
    expectReceiptError(
      () => checker.createFeatureCapabilityReceipt(releaseInput(), process.platform),
      "INVALID_PLATFORM"
    );
  });

  it("rejects malformed and mismatched exact-commit bindings", () => {
    const receipt = checker.createFeatureCapabilityReceipt(releaseInput(), "web-pages");

    expectReceiptError(
      () =>
        checker.createFeatureCapabilityReceipt(
          releaseInput({ sourceCommit: SOURCE_COMMIT.toUpperCase() }),
          "web-pages"
        ),
      "INVALID_RELEASE_INPUT"
    );
    expectReceiptError(
      () =>
        checker.validateFeatureCapabilityReceipt(receipt, {
          sourceCommit: OTHER_COMMIT,
          platform: "web-pages",
        }),
      "SOURCE_COMMIT_MISMATCH"
    );
    expectReceiptError(
      () =>
        checker.validateFeatureCapabilityReceipt(receipt, {
          sourceCommit: SOURCE_COMMIT,
          platform: "android",
        }),
      "PLATFORM_MISMATCH"
    );
  });

  it("rejects every enabled receipt under non-enabling schema v1", () => {
    const receipt = checker.createFeatureCapabilityReceipt(releaseInput(), "web-pages");

    expectReceiptError(
      () =>
        checker.validateFeatureCapabilityReceipt(
          {
            ...receipt,
            capabilities: { journalSaveCeremony: true },
          },
          { sourceCommit: SOURCE_COMMIT, platform: "web-pages" }
        ),
      "UNSUPPORTED_ENABLEMENT"
    );
  });

  it.each([
    ["root user identifier", (receipt: Receipt) => ({ ...receipt, userId: "PRIVATE_CANARY" })],
    [
      "nested journal content",
      (receipt: Receipt) => ({
        ...receipt,
        capabilities: {
          ...receipt.capabilities,
          journalContent: "PRIVATE_CANARY",
        },
      }),
    ],
    [
      "nested token",
      (receipt: Receipt) => ({
        ...receipt,
        admission: { ...receipt.admission, token: "PRIVATE_CANARY" },
      }),
    ],
    ["host path", (receipt: Receipt) => ({ ...receipt, absolutePath: "/PRIVATE_CANARY" })],
    ["free-form error", (receipt: Receipt) => ({ ...receipt, errorText: "PRIVATE_CANARY" })],
  ])("rejects forbidden receipt data: %s", (_label, mutate) => {
    const receipt = checker.createFeatureCapabilityReceipt(releaseInput(), "tauri");

    try {
      checker.validateFeatureCapabilityReceipt(mutate(receipt), {
        sourceCommit: SOURCE_COMMIT,
        platform: "tauri",
      });
      throw new Error("expected forbidden-field rejection");
    } catch (error) {
      expect(error).toMatchObject({
        name: "FeatureCapabilityReceiptError",
        code: "FORBIDDEN_FIELD",
      });
      expect(String(error)).not.toContain("PRIVATE_CANARY");
    }
  });

  it("generates and validates one deterministic parity set for all targets", () => {
    const input = releaseInput({
      requestedCapabilities: { journalSaveCeremony: true },
      admission: { ...ALL_PASS_ADMISSION, artisticCraft: "unverified" },
    });
    const receipts = checker.createFeatureCapabilityReceiptSet(
      input,
      checker.FEATURE_CAPABILITY_PLATFORMS
    );

    expect(receipts.map((receipt) => receipt.platform)).toEqual(
      checker.FEATURE_CAPABILITY_PLATFORMS
    );
    expect(receipts).toHaveLength(4);
    expect(receipts.every((receipt) => !receipt.capabilities.journalSaveCeremony)).toBe(true);
    expect(
      checker.validateFeatureCapabilityReceiptSet(receipts, {
        sourceCommit: SOURCE_COMMIT,
      })
    ).toEqual(receipts);
  });

  it("rejects missing, duplicate, and target-conflicting receipt sets", () => {
    const receipts = checker.createFeatureCapabilityReceiptSet(
      releaseInput(),
      checker.FEATURE_CAPABILITY_PLATFORMS
    );

    expectReceiptError(
      () =>
        checker.validateFeatureCapabilityReceiptSet(receipts.slice(0, 3), {
          sourceCommit: SOURCE_COMMIT,
        }),
      "TARGET_PARITY"
    );
    expectReceiptError(
      () =>
        checker.validateFeatureCapabilityReceiptSet([...receipts.slice(0, 3), { ...receipts[2] }], {
          sourceCommit: SOURCE_COMMIT,
        }),
      "TARGET_PARITY"
    );
    expectReceiptError(
      () =>
        checker.validateFeatureCapabilityReceiptSet(
          receipts.map((receipt) =>
            receipt.platform === "ios"
              ? {
                  ...receipt,
                  admission: { ...receipt.admission, performance: "fail" },
                }
              : receipt
          ),
          { sourceCommit: SOURCE_COMMIT }
        ),
      "RECEIPT_CONFLICT"
    );
  });

  it("serializes canonical JSON without time, host, path, or error metadata", () => {
    const receipt = checker.createFeatureCapabilityReceipt(releaseInput(), "web-pages");
    const serialized = checker.serializeFeatureCapabilityReceipt(receipt, {
      sourceCommit: SOURCE_COMMIT,
      platform: "web-pages",
    });

    expect(serialized).toBe(`${JSON.stringify(receipt, null, 2)}\n`);
    expect(serialized).not.toMatch(
      /timestamp|generatedAt|hostname|absolutePath|errorText|journalContent|userId|deviceId/
    );
  });
});
