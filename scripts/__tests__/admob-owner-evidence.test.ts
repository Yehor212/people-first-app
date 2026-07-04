import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const checkerPath = join(process.cwd(), "scripts/check-admob-owner-evidence.cjs");
const sourcePolicyPath = join(process.cwd(), "scripts/admob-readiness-sources.cjs");
const templatePath = join(process.cwd(), "docs/release/google-play/ADMOB_OWNER_EVIDENCE_TEMPLATE.json");

const requiredCmpSourceUrls = [
  "https://support.google.com/admob/answer/10113207",
  "https://support.google.com/admob/answer/13554116",
  "https://support.google.com/admob/answer/16918505",
  "https://support.google.com/admob/answer/9999955",
  "https://developers.google.com/admob/android/privacy",
  "https://developers.google.com/admob/ios/privacy",
];

type OwnerEvidenceIssue = {
  code: string;
  itemId?: string;
  message: string;
};

type OwnerEvidenceReport = {
  ok: boolean;
  ownerReady: boolean;
  issues: OwnerEvidenceIssue[];
  items: Array<{ id: string; status: string }>;
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
  live_ad_playback_device: "Release-equivalent Android rewarded ad smoke completed after consent; video opened, reward callback granted reward only after completion, and revocation stopped new ad requests.",
  full_cross_platform_ad_units: "Full cross-platform ad units check showed Android, iOS, banner, and rewarded IDs are owner-controlled non-sample units from the same publisher family.",
};

const passFactsByItem: Record<string, Record<string, boolean>> = {
  admob_app_ads_txt_status: {
    verifyAppConfirmedDone: true,
    zenflowAppSelected: true,
  },
  admob_app_readiness: {
    ready: true,
    adServingEnabled: true,
    googlePlayLinked: true,
    activeAdUnits: true,
  },
  admob_policy_center: {
    policyCenterReviewed: true,
    noViolations: true,
    noBlockingIssues: true,
  },
  privacy_messages_cmp: {
    europeanRegulationsMessagePublished: true,
    googleCertifiedCmp: true,
    tcfV23: true,
    zenflowAppSelected: true,
    eeaUkSwitzerlandTargeting: true,
    privacyPolicyUrlMatched: true,
  },
  payments_tax_info: {
    taxNoActionRequired: true,
  },
  payments_identity_address: {
    identityNoActionRequiredOrVerified: true,
    addressNoActionRequiredOrVerified: true,
  },
  payments_payment_method: {
    paymentMethodEligible: true,
  },
  payments_holds: {
    noPaymentHold: true,
    noTaxHold: true,
    noIdentityHold: true,
    noComplianceHold: true,
    noSelfHold: true,
  },
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
  },
  full_cross_platform_ad_units: {
    androidOwnerControlledNonSample: true,
    iosOwnerControlledNonSample: true,
    bannerOwnerControlledNonSample: true,
    rewardedOwnerControlledNonSample: true,
    samePublisherFamily: true,
  },
};

function loadChecker() {
  return require(checkerPath) as {
    evaluateOwnerEvidence: (
      input: unknown,
      options?: { requirePass?: boolean; maxPassAgeDays?: number; now?: Date },
    ) => OwnerEvidenceReport;
    OWNER_EVIDENCE_ITEM_IDS: string[];
  };
}

function completeOwnerEvidence(checkedAt = "2026-07-04") {
  const checker = loadChecker();
  const requiredSourcesByItem: Record<string, string[]> = {
    privacy_messages_cmp: requiredCmpSourceUrls,
    play_console_ads_data_safety: [
      "https://support.google.com/googleplay/android-developer/answer/9859455",
      "https://developers.google.com/admob/android/privacy/play-data-disclosure",
    ],
  };
  return {
    schemaVersion: "zenflow-admob-owner-evidence/v1",
    packageName: "com.zenflow.app",
    evidenceDate: checkedAt,
    items: checker.OWNER_EVIDENCE_ITEM_IDS.map((id) => ({
      id,
      status: "PASS",
      checkedAt,
      evidence: passEvidenceByItem[id] || `Owner console showed a public-safe non-blocking status for ${id}.`,
      facts: passFactsByItem[id],
      sourceUrls: ["https://support.google.com/admob/answer/10564477", ...(requiredSourcesByItem[id] || [])],
    })),
  };
}

describe("AdMob owner evidence intake", () => {
  it("wires the owner evidence command into package scripts and release contracts", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const releaseContracts = packageJson.scripts["test:release-contracts"];

    expect(packageJson.scripts["google-play:admob:owner-evidence:check"]).toBe(
      "node scripts/check-admob-owner-evidence.cjs",
    );
    expect(releaseContracts).toContain("scripts/__tests__/admob-owner-evidence.test.ts");
  });

  it("keeps a public-safe owner evidence template in the release packet", () => {
    expect(existsSync(checkerPath)).toBe(true);
    expect(existsSync(templatePath)).toBe(true);

    const templateText = readFileSync(templatePath, "utf8");
    const gitignore = readFileSync(".gitignore", "utf8");
    expect(templateText).toContain("zenflow-admob-owner-evidence/v1");
    expect(templateText).toContain("output/private/admob-owner-evidence.json");
    expect(templateText).toContain("dataSafetyIncludesGoogleMobileAdsSdkData");
    expect(templateText).toContain("noPaymentHold");
    expect(templateText).toContain("rewardCallbackGrantedAfterCompletion");
    expect(gitignore).toContain("output/private/");
    expect(templateText).not.toMatch(/ca-app-pub-\d{16}[~/]\d+/);
    expect(templateText).not.toMatch(/\bpub-\d{16}\b/);
    expect(templateText).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  });

  it("defines the owner-only evidence rows that cannot be proven from public files alone", () => {
    const checker = loadChecker();

    expect(checker.OWNER_EVIDENCE_ITEM_IDS).toEqual([
      "admob_app_ads_txt_status",
      "admob_app_readiness",
      "admob_policy_center",
      "privacy_messages_cmp",
      "payments_tax_info",
      "payments_identity_address",
      "payments_payment_method",
      "payments_holds",
      "play_console_ads_data_safety",
      "live_ad_playback_device",
      "full_cross_platform_ad_units",
    ]);
  });

  it("accepts the template as an honest non-PASS owner handoff", () => {
    const checker = loadChecker();
    const template = JSON.parse(readFileSync(templatePath, "utf8"));
    const report = checker.evaluateOwnerEvidence(template);

    expect(report.ok).toBe(true);
    expect(report.ownerReady).toBe(false);
    expect(report.issues).toEqual([]);
    expect(report.items.some((item) => item.status !== "PASS")).toBe(true);
  });

  it("rejects raw AdMob, publisher, payment, or personal identifiers", () => {
    const checker = loadChecker();
    const report = checker.evaluateOwnerEvidence({
      ...completeOwnerEvidence(),
      items: [
        ...completeOwnerEvidence().items,
        {
          id: "privacy_messages_cmp",
          status: "PASS",
          checkedAt: "2026-07-04",
          evidence: "Raw ad unit ca-app-pub-1234567890123456/1234567890 was shown in the screenshot.",
          sourceUrls: ["https://support.google.com/admob/answer/10113207"],
        },
      ],
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "private_identifier_leak" }));
  });

  it("rejects owner evidence that describes private payment, tax, address, or identity details", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    evidence.items[0] = {
      ...evidence.items[0],
      evidence: "Identity document was uploaded and bank account status looks approved.",
    };

    const report = checker.evaluateOwnerEvidence(evidence);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "unsafe_private_evidence_detail", itemId: evidence.items[0].id }),
    );
  });

  it("rejects unknown top-level and item fields that could smuggle private data", () => {
    const checker = loadChecker();
    const evidence = {
      ...completeOwnerEvidence(),
      ownerEmail: "do-not-store@example.invalid",
    } as ReturnType<typeof completeOwnerEvidence> & { ownerEmail: string };
    evidence.items[0] = {
      ...evidence.items[0],
      extraBankField: "Example Bank",
      streetAddress: "123 Main Street",
    } as (typeof evidence.items)[number] & { extraBankField: string; streetAddress: string };

    const report = checker.evaluateOwnerEvidence(evidence);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "unknown_top_level_field" }));
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "unknown_item_field", itemId: "admob_app_ads_txt_status" }),
    );
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "sensitive_field_name" }));
  });

  it("rejects common tax, identity, address, and bank-like private formats", () => {
    const checker = loadChecker();
    const sensitiveExamples = [
      "Owner pasted SSN 123-45-6789 into evidence.",
      "Owner pasted TIN 12-3456789 into evidence.",
      "Owner pasted EIN 12-3456789 into evidence.",
      "Owner pasted W-9 completed status with private detail.",
      "Owner pasted W-8BEN completed status with private detail.",
      "Owner pasted street address 123 Main Street into evidence.",
      "Owner pasted account holder name recorded in payment settings.",
      "Owner pasted legal name John Doe into evidence.",
      "Owner pasted full name Jane Doe into evidence.",
      "Owner pasted personal name Jordan Example into evidence.",
      "Owner pasted owner name Casey Example into evidence.",
      "Owner pasted account name ZenFlow Owner into evidence.",
      "Owner pasted bank name recorded in payment settings.",
      "Owner pasted payment ID PAY-ABC-123 into evidence.",
      "Owner pasted payment identifier PAY-XYZ-999 into evidence.",
      "Owner pasted payout ID PAY-OUT-123 into evidence.",
      "Owner pasted routing number 1234 5678 9 into evidence.",
      "Owner pasted card number 4111 1111 1111 1111 into evidence.",
    ];

    for (const sensitiveEvidence of sensitiveExamples) {
      const evidence = completeOwnerEvidence();
      evidence.items[0] = { ...evidence.items[0], evidence: sensitiveEvidence };
      const report = checker.evaluateOwnerEvidence(evidence);

      expect(report.ok, sensitiveEvidence).toBe(false);
      expect(report.issues, sensitiveEvidence).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "unsafe_private_evidence_detail" })]),
      );
    }
  });

  it("rejects private text in allowed owner-level fields and official URL query or hash", () => {
    const checker = loadChecker();
    const evidenceWithPrivateInstructions = {
      ...completeOwnerEvidence(),
      instructions: "Owner pasted street address 123 Main Street into instructions.",
    };
    const privateInstructionsReport = checker.evaluateOwnerEvidence(evidenceWithPrivateInstructions);

    expect(privateInstructionsReport.ok).toBe(false);
    expect(privateInstructionsReport.issues).toContainEqual(expect.objectContaining({ code: "unsafe_private_evidence_detail" }));

    const evidenceWithPrivateUrl = completeOwnerEvidence();
    evidenceWithPrivateUrl.items[0] = {
      ...evidenceWithPrivateUrl.items[0],
      sourceUrls: ["https://support.google.com/admob/answer/10564477?address=123%20Main%20Street"],
    };
    const privateUrlReport = checker.evaluateOwnerEvidence(evidenceWithPrivateUrl);

    expect(privateUrlReport.ok).toBe(false);
    expect(privateUrlReport.issues).toContainEqual(
      expect.objectContaining({ code: "source_url_must_not_have_query_or_hash", itemId: "admob_app_ads_txt_status" }),
    );

    const evidenceWithPrivatePath = completeOwnerEvidence();
    evidenceWithPrivatePath.items[0] = {
      ...evidenceWithPrivatePath.items[0],
      sourceUrls: ["https://support.google.com/admob/answer/10564477/legal%20name%20Jane%20Example"],
    };
    const privatePathReport = checker.evaluateOwnerEvidence(evidenceWithPrivatePath);

    expect(privatePathReport.ok).toBe(false);
    expect(privatePathReport.issues).toContainEqual(
      expect.objectContaining({ code: "unapproved_source_url", itemId: "admob_app_ads_txt_status" }),
    );
  });

  it("rejects unknown owner evidence row ids", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    evidence.items.push({
      id: "random_console_status",
      status: "PASS",
      checkedAt: "2026-07-04",
      evidence: "Unknown row should not be accepted.",
      facts: {},
      sourceUrls: ["https://support.google.com/admob/answer/10564477"],
    });

    const report = checker.evaluateOwnerEvidence(evidence);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "unknown_owner_evidence_item", itemId: "random_console_status" }),
    );
  });

  it("requires row-specific official sources for CMP and Play Data safety owner proof", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    const report = checker.evaluateOwnerEvidence({
      ...evidence,
      items: evidence.items.map((item) =>
        item.id === "privacy_messages_cmp"
          ? { ...item, sourceUrls: ["https://developers.google.com/admob/android/privacy"] }
          : item,
      ),
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_required_source_url", itemId: "privacy_messages_cmp" }),
    );
  });

  it("requires the full official Google CMP source set for owner CMP proof", () => {
    const sourcePolicy = require(sourcePolicyPath) as {
      ADMOB_READINESS_APPROVED_SOURCE_URLS: Set<string>;
      ADMOB_READINESS_REQUIRED_SOURCE_URLS_BY_ITEM: Record<string, string[]>;
    };
    const template = JSON.parse(readFileSync(templatePath, "utf8")) as {
      items: Array<{ id: string; sourceUrls: string[] }>;
    };
    const cmpTemplate = template.items.find((item) => item.id === "privacy_messages_cmp");

    expect(sourcePolicy.ADMOB_READINESS_REQUIRED_SOURCE_URLS_BY_ITEM.privacy_messages_cmp).toEqual(
      requiredCmpSourceUrls,
    );
    for (const sourceUrl of requiredCmpSourceUrls) {
      expect(sourcePolicy.ADMOB_READINESS_APPROVED_SOURCE_URLS.has(sourceUrl)).toBe(true);
      expect(cmpTemplate?.sourceUrls).toContain(sourceUrl);
    }
  });

  it("rejects generic PASS evidence for owner-only rows that need concrete public-safe facts", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    evidence.items = evidence.items.map((item) =>
      item.id === "play_console_ads_data_safety"
        ? { ...item, evidence: "Owner console showed a non-blocking status." }
        : item,
    );

    const report = checker.evaluateOwnerEvidence(evidence);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_required_pass_evidence_fact", itemId: "play_console_ads_data_safety" }),
    );
  });

  it("rejects PASS owner evidence when required structured facts are missing", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    evidence.items = evidence.items.map((item) =>
      item.id === "play_console_ads_data_safety"
        ? { ...item, facts: undefined as unknown as Record<string, boolean> }
        : item,
    );

    const report = checker.evaluateOwnerEvidence(evidence);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_required_pass_facts", itemId: "play_console_ads_data_safety" }),
    );
  });

  it("rejects PASS owner evidence when a required structured fact is false", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    evidence.items = evidence.items.map((item) =>
      item.id === "payments_holds"
        ? { ...item, facts: { ...item.facts, noTaxHold: false } }
        : item,
    );

    const report = checker.evaluateOwnerEvidence(evidence);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "required_pass_fact_not_true", itemId: "payments_holds" }),
    );
  });

  it("rejects unknown or non-boolean structured facts", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    evidence.items = evidence.items.map((item) =>
      item.id === "play_console_ads_data_safety"
        ? {
            ...item,
            facts: {
              ...item.facts,
              privateScreenshotPath: true,
              adsDeclaredYes: "yes" as unknown as boolean,
            },
          }
        : item,
    );

    const report = checker.evaluateOwnerEvidence(evidence);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "unknown_fact_key", itemId: "play_console_ads_data_safety" }),
    );
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "invalid_fact_value", itemId: "play_console_ads_data_safety" }),
    );
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "sensitive_fact_name" }));
  });

  it("requires CMP PASS evidence to mention publication, European regulations, Google-certified CMP, TCF v2.3, and ZenFlow", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    evidence.items = evidence.items.map((item) =>
      item.id === "privacy_messages_cmp"
        ? { ...item, evidence: "AdMob Privacy & messaging was checked and looked fine." }
        : item,
    );

    const report = checker.evaluateOwnerEvidence(evidence);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_required_pass_evidence_fact", itemId: "privacy_messages_cmp" }),
    );
  });

  it("rejects contradictory PASS evidence for payment holds", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    evidence.items = evidence.items.map((item) =>
      item.id === "payments_holds"
        ? {
            ...item,
            evidence:
              "Payments page showed no payment hold, but tax hold present, identity hold present, compliance hold present, and self-hold present.",
          }
        : item,
    );

    const report = checker.evaluateOwnerEvidence(evidence);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "contradictory_pass_evidence", itemId: "payments_holds" }),
    );
  });

  it("rejects contradictory PASS evidence for Play Data safety", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    evidence.items = evidence.items.map((item) =>
      item.id === "play_console_ads_data_safety"
        ? {
            ...item,
            evidence:
              "Play Console App content showed Ads=Yes, Advertising ID=Yes, but Data safety omits Google Mobile Ads SDK data and privacy policy URL does not match.",
          }
        : item,
    );

    const report = checker.evaluateOwnerEvidence(evidence);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "contradictory_pass_evidence", itemId: "play_console_ads_data_safety" }),
    );
  });

  it("rejects Play Data safety PASS evidence that says Google Mobile Ads data is not included", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    evidence.items = evidence.items.map((item) =>
      item.id === "play_console_ads_data_safety"
        ? {
            ...item,
            evidence:
              "Play Console App content showed Ads=Yes, Advertising ID=Yes, Data safety includes no Google Mobile Ads SDK data, and privacy policy URL matches listing.",
          }
        : item,
    );

    const report = checker.evaluateOwnerEvidence(evidence);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "contradictory_pass_evidence", itemId: "play_console_ads_data_safety" }),
    );
  });

  it("rejects Play Data safety PASS evidence with qualified negation before Google Mobile Ads data", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    evidence.items = evidence.items.map((item) =>
      item.id === "play_console_ads_data_safety"
        ? {
            ...item,
            evidence:
              "Play Console App content showed Ads=Yes, Advertising ID=Yes, Data safety includes absolutely no Google Mobile Ads SDK data, and privacy policy URL matches listing.",
          }
        : item,
    );

    const report = checker.evaluateOwnerEvidence(evidence);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "contradictory_pass_evidence", itemId: "play_console_ads_data_safety" }),
    );
  });

  it("rejects Play Data safety PASS evidence that excludes Google Mobile Ads data through synonyms", () => {
    const checker = loadChecker();
    const badEvidenceTexts = [
      "Play Console App content showed Ads=Yes, Advertising ID=Yes, Data safety includes all disclosures except Google Mobile Ads SDK data, and privacy policy URL matches listing.",
      "Play Console App content showed Ads=Yes, Advertising ID=Yes, Data safety contains disclosures excluding Google Mobile Ads SDK data, and privacy policy URL matches listing.",
      "Play Console App content showed Ads=Yes, Advertising ID=Yes, Data safety covers disclosures that leave out Google Mobile Ads SDK data, and privacy policy URL matches listing.",
      "Play Console App content showed Ads=Yes, Advertising ID=Yes, Data safety contains disclosures that lack Google Mobile Ads SDK data, and privacy policy URL matches listing.",
    ];

    for (const badEvidence of badEvidenceTexts) {
      const evidence = completeOwnerEvidence();
      evidence.items = evidence.items.map((item) =>
        item.id === "play_console_ads_data_safety" ? { ...item, evidence: badEvidence } : item,
      );

      const report = checker.evaluateOwnerEvidence(evidence);

      expect(report.ok, badEvidence).toBe(false);
      expect(report.issues, badEvidence).toContainEqual(
        expect.objectContaining({ code: "contradictory_pass_evidence", itemId: "play_console_ads_data_safety" }),
      );
    }
  });

  it("rejects contradictory PASS evidence for live rewarded playback", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    evidence.items = evidence.items.map((item) =>
      item.id === "live_ad_playback_device"
        ? {
            ...item,
            evidence:
              "Release-equivalent Android rewarded ad smoke after consent: video did not open, reward callback never fired, and revocation stop check was not completed.",
          }
        : item,
    );

    const report = checker.evaluateOwnerEvidence(evidence);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "contradictory_pass_evidence", itemId: "live_ad_playback_device" }),
    );
  });

  it("requires both Play declaration and Google Mobile Ads data disclosure sources for Play Data safety", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    const report = checker.evaluateOwnerEvidence({
      ...evidence,
      items: evidence.items.map((item) =>
        item.id === "play_console_ads_data_safety"
          ? { ...item, sourceUrls: ["https://support.google.com/googleplay/android-developer/answer/9859455"] }
          : item,
      ),
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_required_source_url", itemId: "play_console_ads_data_safety" }),
    );
  });

  it("refuses live rewarded-ad PASS until consent, Play declaration, app-ads, readiness, and policy prerequisites are PASS", () => {
    const checker = loadChecker();
    const evidence = completeOwnerEvidence();
    const report = checker.evaluateOwnerEvidence({
      ...evidence,
      items: evidence.items.map((item) =>
        item.id === "privacy_messages_cmp"
          ? {
              ...item,
              status: "PARTIAL",
              evidence: "CMP is still being configured; live playback should remain blocked.",
            }
          : item,
      ),
    });

    expect(report.ok).toBe(false);
    expect(report.ownerReady).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "live_playback_prerequisite_not_pass", itemId: "live_ad_playback_device" }),
    );
  });

  it("requires every owner evidence row to be freshly PASS before owner readiness can pass", () => {
    const checker = loadChecker();
    const report = checker.evaluateOwnerEvidence(completeOwnerEvidence(), {
      requirePass: true,
      maxPassAgeDays: 14,
      now: new Date("2026-07-04T12:00:00.000Z"),
    });

    expect(report.ok).toBe(true);
    expect(report.ownerReady).toBe(true);
  });

  it("rejects stale PASS owner evidence in strict pass mode", () => {
    const checker = loadChecker();
    const report = checker.evaluateOwnerEvidence(completeOwnerEvidence("2026-06-01"), {
      requirePass: true,
      maxPassAgeDays: 14,
      now: new Date("2026-07-04T12:00:00.000Z"),
    });

    expect(report.ok).toBe(false);
    expect(report.ownerReady).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "stale_pass_evidence", itemId: "admob_app_ads_txt_status" }),
    );
  });

  it("prints template guidance when no private evidence file is provided", () => {
    const result = spawnSync(process.execPath, [checkerPath], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OWNER_EVIDENCE_TEMPLATE");
    expect(result.stdout).toContain("output/private/admob-owner-evidence.json");
  });

  it("fails strict owner pass mode when no private evidence file is supplied", () => {
    const result = spawnSync(process.execPath, [checkerPath, "--require-pass"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("UNVERIFIED");
    expect(result.stdout).toContain("--file output/private/admob-owner-evidence.json");
  });
});
