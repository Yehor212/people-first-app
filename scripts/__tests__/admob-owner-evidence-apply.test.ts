import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const applyScript = join(process.cwd(), "scripts/apply-admob-owner-evidence.cjs");
const ownerCheckerPath = join(process.cwd(), "scripts/check-admob-owner-evidence.cjs");
const externalCheckerPath = join(process.cwd(), "scripts/check-admob-external-readiness.cjs");
const baseLedgerPath = join(process.cwd(), "docs/release/google-play/ADMOB_EXTERNAL_READINESS.json");

type OwnerEvidenceItem = {
  id: string;
  status: string;
  checkedAt: string;
  evidence: string;
  facts?: Record<string, boolean>;
  sourceUrls: string[];
};

const sourceByItem: Record<string, string[]> = {
  admob_app_ads_txt_status: ["https://support.google.com/admob/answer/14538460"],
  admob_app_readiness: ["https://support.google.com/admob/answer/10564477"],
  admob_policy_center: ["https://support.google.com/admob/answer/10448801"],
  privacy_messages_cmp: [
    "https://support.google.com/admob/answer/10113207",
    "https://support.google.com/admob/answer/13554116",
    "https://support.google.com/admob/answer/16918505",
    "https://support.google.com/admob/answer/9999955",
    "https://developers.google.com/admob/android/privacy",
    "https://developers.google.com/admob/ios/privacy",
  ],
  payments_tax_info: ["https://support.google.com/admob/answer/2772513"],
  payments_identity_address: ["https://support.google.com/admob/answer/13030080"],
  payments_payment_method: ["https://support.google.com/admob/answer/12835021"],
  payments_holds: ["https://support.google.com/admob/answer/11601831"],
  play_console_ads_data_safety: [
    "https://support.google.com/googleplay/android-developer/answer/9859455",
    "https://developers.google.com/admob/android/privacy/play-data-disclosure",
  ],
  live_ad_playback_device: [
    "https://support.google.com/admob/answer/7313578",
    "https://admob.google.com/home/resources/best-practices-for-in-app-rewarded-video-ads/",
  ],
  full_cross_platform_ad_units: ["https://support.google.com/admob/answer/7356431"],
};

const passEvidenceByItem: Record<string, string> = {
  admob_app_ads_txt_status: "AdMob Verify app page showed ZenFlow confirmed with Done status.",
  admob_app_readiness: "AdMob apps list showed ZenFlow Ready, ad serving enabled, Google Play linked, and active ad units.",
  admob_policy_center: "AdMob Policy Center showed no violations and no blocking issues.",
  privacy_messages_cmp: "AdMob Privacy & messaging European regulations message for ZenFlow was published through a Google-certified CMP using TCF v2.3.",
  payments_tax_info: "Payments tax information showed no action required for tax setup.",
  payments_identity_address: "Payments verification showed identity and address no action required.",
  payments_payment_method: "Payments settings showed payment method eligible for payouts.",
  payments_holds: "Payments page showed no payment hold, no tax hold, no identity hold, no compliance hold, and no self-hold.",
  play_console_ads_data_safety: "Play Console App content showed Ads=Yes, Advertising ID=Yes, Data safety includes Google Mobile Ads SDK data, and privacy policy URL matches listing.",
  live_ad_playback_device: "Release-equivalent Android rewarded ad smoke completed after consent; video opened, reward callback granted reward only after completion, revocation stopped new ad requests, and no prompt appeared in mood logging, active focus, focus reflection, journal editor, or bad/terrible mood states.",
  full_cross_platform_ad_units: "Full cross-platform ad units check showed Android, iOS, banner, and rewarded IDs are owner-controlled non-sample units from the same publisher family.",
};

const passFactsByItem: Record<string, Record<string, boolean>> = {
  admob_app_ads_txt_status: { verifyAppConfirmedDone: true, zenflowAppSelected: true },
  admob_app_readiness: { ready: true, adServingEnabled: true, googlePlayLinked: true, activeAdUnits: true },
  admob_policy_center: { policyCenterReviewed: true, noViolations: true, noBlockingIssues: true },
  privacy_messages_cmp: {
    europeanRegulationsMessagePublished: true,
    googleCertifiedCmp: true,
    tcfV23: true,
    zenflowAppSelected: true,
    eeaUkSwitzerlandTargeting: true,
    privacyPolicyUrlMatched: true,
  },
  payments_tax_info: { taxNoActionRequired: true },
  payments_identity_address: { identityNoActionRequiredOrVerified: true, addressNoActionRequiredOrVerified: true },
  payments_payment_method: { paymentMethodEligible: true },
  payments_holds: { noPaymentHold: true, noTaxHold: true, noIdentityHold: true, noComplianceHold: true, noSelfHold: true },
  play_console_ads_data_safety: {
    adsDeclaredYes: true,
    advertisingIdDeclaredYes: true,
    dataSafetyIncludesGoogleMobileAdsSdkData: true,
    googleMobileAdsSdkDataDisclosureReviewed: true,
    privacyPolicyUrlMatchesListing: true,
  },
  live_ad_playback_device: {
    releaseEquivalentAndroid: true,
    consentPathCompleted: true,
    rewardedVideoOpened: true,
    dismissWithoutRewardChecked: true,
    rewardCallbackGrantedAfterCompletion: true,
    revocationStopsNewAdRequests: true,
    noMoodCheckInPromptOrRequest: true,
    noActiveFocusPromptOrRequest: true,
    noFocusReflectionPromptOrRequest: true,
    noJournalEditorPromptOrRequest: true,
    noBadOrTerribleMoodPromptOrRequest: true,
  },
  full_cross_platform_ad_units: {
    androidOwnerControlledNonSample: true,
    iosOwnerControlledNonSample: true,
    bannerOwnerControlledNonSample: true,
    rewardedOwnerControlledNonSample: true,
    samePublisherFamily: true,
  },
};

function loadOwnerIds(): string[] {
  return (require(ownerCheckerPath) as { OWNER_EVIDENCE_ITEM_IDS: string[] }).OWNER_EVIDENCE_ITEM_IDS;
}

function buildOwnerEvidence(statusById: Record<string, string> = {}, checkedAt = "2026-07-04") {
  return {
    schemaVersion: "zenflow-admob-owner-evidence/v1",
    packageName: "com.zenflow.app",
    evidenceDate: checkedAt,
    items: loadOwnerIds().map((id): OwnerEvidenceItem => ({
      id,
      status: statusById[id] || "UNVERIFIED",
      checkedAt,
      evidence: statusById[id] === "PASS"
        ? passEvidenceByItem[id]
        : `Owner console public-safe status summary for ${id}.`,
      facts: passFactsByItem[id],
      sourceUrls: sourceByItem[id] || ["https://support.google.com/admob/answer/10564477"],
    })),
  };
}

function tempFixture() {
  const fixtureRoot = join(process.cwd(), "output", "private");
  mkdirSync(fixtureRoot, { recursive: true });
  const dir = mkdtempSync(join(fixtureRoot, "zenflow-admob-owner-apply-"));
  const ledgerFile = join(dir, "ADMOB_EXTERNAL_READINESS.json");
  const evidenceFile = join(dir, "admob-owner-evidence.json");
  writeFileSync(ledgerFile, readFileSync(baseLedgerPath, "utf8"));
  return { dir, ledgerFile, evidenceFile };
}

function runApply(args: string[]) {
  return spawnSync(process.execPath, [applyScript, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function loadApplyScript() {
  return require(applyScript) as {
    applyOwnerEvidenceToLedger: (ledger: unknown, ownerEvidence: unknown, updatedAt: string) => {
      updatedAt: string;
      items: Array<{ id: string; status: string; checkedAt?: string; ownerAction?: string }>;
    };
    writeCanonicalLedger: (
      ledger: unknown,
      options?: {
        fsApi?: {
          writeFileSync: (...args: unknown[]) => void;
          readFileSync: (...args: unknown[]) => string;
          renameSync: (...args: unknown[]) => void;
          existsSync: (...args: unknown[]) => boolean;
          rmSync: (...args: unknown[]) => void;
        };
        getCwd?: () => string;
        chdir?: (target: string) => void;
      },
    ) => void;
  };
}

describe("AdMob owner evidence apply workflow", () => {
  it("is wired into package scripts and release contracts", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.scripts["google-play:admob:owner-evidence:apply"]).toBe(
      "node scripts/apply-admob-owner-evidence.cjs",
    );
    expect(packageJson.scripts["test:release-contracts"]).toContain(
      "scripts/__tests__/admob-owner-evidence-apply.test.ts",
    );
  });

  it("dry-runs without mutating the tracked external ledger", () => {
    const { ledgerFile, evidenceFile } = tempFixture();
    const before = readFileSync(ledgerFile, "utf8");
    writeFileSync(evidenceFile, JSON.stringify(buildOwnerEvidence({ admob_app_ads_txt_status: "PASS" }), null, 2));

    const result = runApply(["--file", evidenceFile, "--ledger", ledgerFile, "--date", "2026-07-04"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("DRY-RUN");
    expect(readFileSync(ledgerFile, "utf8")).toBe(before);
  });

  it("computes only owner-owned row changes and preserves public rows plus ownerAction text", () => {
    const { ledgerFile, evidenceFile } = tempFixture();
    const beforeText = readFileSync(ledgerFile, "utf8");
    const before = JSON.parse(readFileSync(ledgerFile, "utf8"));
    const ownerEvidence = buildOwnerEvidence({
      admob_app_ads_txt_status: "PASS",
      privacy_messages_cmp: "PARTIAL",
    });
    writeFileSync(evidenceFile, JSON.stringify(ownerEvidence, null, 2));

    const after = loadApplyScript().applyOwnerEvidenceToLedger(before, ownerEvidence, "2026-07-04");

    expect(after.updatedAt).toBe("2026-07-04");
    expect(after.items.find((item: { id: string }) => item.id === "public_app_ads_root")).toEqual(
      before.items.find((item: { id: string }) => item.id === "public_app_ads_root"),
    );
    const beforeAppAds = before.items.find((item: { id: string }) => item.id === "admob_app_ads_txt_status");
    const afterAppAds = after.items.find((item: { id: string }) => item.id === "admob_app_ads_txt_status");
    if (!beforeAppAds || !afterAppAds) throw new Error("admob_app_ads_txt_status fixture row is missing");
    expect(afterAppAds.status).toBe("PASS");
    expect(afterAppAds.checkedAt).toBe("2026-07-04");
    expect(afterAppAds.ownerAction).toBe(beforeAppAds.ownerAction);
    expect(afterAppAds).not.toHaveProperty("facts");
    expect(readFileSync(ledgerFile, "utf8")).toBe(beforeText);
  });

  it("refuses write mode for non-canonical ledger overrides", () => {
    const { ledgerFile, evidenceFile } = tempFixture();
    const before = readFileSync(ledgerFile, "utf8");
    writeFileSync(evidenceFile, JSON.stringify(buildOwnerEvidence({ admob_app_ads_txt_status: "PASS" }), null, 2));

    const result = runApply(["--file", evidenceFile, "--ledger", ledgerFile, "--date", "2026-07-04", "--write"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("canonical ADMOB_EXTERNAL_READINESS.json");
    expect(readFileSync(ledgerFile, "utf8")).toBe(before);
  });

  it("refuses invalid or private owner evidence and leaves the ledger unchanged", () => {
    const { ledgerFile, evidenceFile } = tempFixture();
    const before = readFileSync(ledgerFile, "utf8");
    const evidence = buildOwnerEvidence({ admob_app_ads_txt_status: "PASS" });
    evidence.items[0].evidence = "Owner pasted legal name Jane Example into evidence.";
    writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));

    const result = runApply(["--file", evidenceFile, "--ledger", ledgerFile, "--write"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("UNVERIFIED");
    expect(readFileSync(ledgerFile, "utf8")).toBe(before);
  });

  it("refuses stale PASS owner evidence before writing", () => {
    const { ledgerFile, evidenceFile } = tempFixture();
    const evidence = buildOwnerEvidence({ admob_app_ads_txt_status: "PASS" }, "2026-06-01");
    writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));

    const result = runApply([
      "--file",
      evidenceFile,
      "--ledger",
      ledgerFile,
      "--date",
      "2026-07-04",
      "--write",
    ]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("stale_pass_evidence");
  });

  it("refuses stale PASS owner evidence when --date is omitted", () => {
    const { ledgerFile, evidenceFile } = tempFixture();
    const evidence = buildOwnerEvidence({ admob_app_ads_txt_status: "PASS" }, "2000-01-01");
    writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));

    const result = runApply(["--file", evidenceFile, "--ledger", ledgerFile]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("stale_pass_evidence");
  });

  it("does not replace the canonical ledger until a temp write and readback validation succeed", () => {
    const canonicalLedgerPath = "docs/release/google-play/ADMOB_EXTERNAL_READINESS.json";
    const tempLedgerPath = "docs/release/google-play/.ADMOB_EXTERNAL_READINESS.json.tmp";
    const fakeFiles: Record<string, string> = {
      [canonicalLedgerPath]: "existing-ledger",
    };
    const fakeFs = {
      writeFileSync: (file: unknown) => {
        if (file === tempLedgerPath) throw new Error("simulated disk write failure");
      },
      readFileSync: (file: unknown) => fakeFiles[String(file)] || "",
      renameSync: (from: unknown, to: unknown) => {
        fakeFiles[String(to)] = fakeFiles[String(from)];
        delete fakeFiles[String(from)];
      },
      existsSync: (file: unknown) => Object.prototype.hasOwnProperty.call(fakeFiles, String(file)),
      rmSync: (file: unknown) => {
        delete fakeFiles[String(file)];
      },
    };

    expect(() =>
      loadApplyScript().writeCanonicalLedger(buildOwnerEvidence(), {
        fsApi: fakeFs,
        getCwd: () => process.cwd(),
        chdir: () => undefined,
      }),
    ).toThrow("simulated disk write failure");
    expect(fakeFiles[canonicalLedgerPath]).toBe("existing-ledger");
  });

  it("refuses live rewarded playback PASS when owner prerequisites are not PASS and leaves the ledger unchanged", () => {
    const { ledgerFile, evidenceFile } = tempFixture();
    const before = readFileSync(ledgerFile, "utf8");
    const evidence = buildOwnerEvidence({ live_ad_playback_device: "PASS" }, "2026-07-04");
    writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));

    const result = runApply(["--file", evidenceFile, "--ledger", ledgerFile, "--date", "2026-07-04", "--write"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("live_playback_prerequisite_not_pass");
    expect(readFileSync(ledgerFile, "utf8")).toBe(before);
  });

  it("refuses full cross-platform monetization PASS unless the strict full AdMob ID gate passes", () => {
    const { ledgerFile, evidenceFile } = tempFixture();
    const before = readFileSync(ledgerFile, "utf8");
    const evidence = buildOwnerEvidence({ full_cross_platform_ad_units: "PASS" }, "2026-07-04");
    writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));

    const result = runApply(["--file", evidenceFile, "--ledger", ledgerFile, "--date", "2026-07-04", "--write"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("full_cross_platform_gate_not_pass");
    expect(readFileSync(ledgerFile, "utf8")).toBe(before);
  });

  it("exports a final ledger that still passes the external readiness validator", () => {
    const { ledgerFile, evidenceFile } = tempFixture();
    const ownerEvidence = buildOwnerEvidence({ admob_app_ads_txt_status: "PASS" });
    writeFileSync(evidenceFile, JSON.stringify(ownerEvidence, null, 2));

    const result = runApply(["--file", evidenceFile, "--ledger", ledgerFile, "--date", "2026-07-04"]);
    const finalLedger = loadApplyScript().applyOwnerEvidenceToLedger(
      JSON.parse(readFileSync(ledgerFile, "utf8")),
      ownerEvidence,
      "2026-07-04",
    );
    const external = require(externalCheckerPath) as {
      evaluateExternalReadiness: (input: unknown) => { ok: boolean; issues: Array<{ code: string }> };
    };
    const report = external.evaluateExternalReadiness(finalLedger);

    expect(result.status).toBe(0);
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });
});
