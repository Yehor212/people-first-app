import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const checkerPath = join(process.cwd(), "scripts/check-admob-external-readiness.cjs");
const sourcePolicyPath = join(process.cwd(), "scripts/admob-readiness-sources.cjs");
const ledgerPath = join(process.cwd(), "docs/release/google-play/ADMOB_EXTERNAL_READINESS.json");

type ExternalReadinessIssue = {
  code: string;
  itemId?: string;
  message: string;
};

type ExternalReadinessReport = {
  ok: boolean;
  passReady: boolean;
  fullCrossPlatformReady?: boolean;
  issues: ExternalReadinessIssue[];
  items: Array<{ id: string; status: string }>;
};

const officialSourceUrl = "https://support.google.com/admob/answer/10564477";
const requiredCmpSourceUrls = [
  "https://support.google.com/admob/answer/10113207",
  "https://support.google.com/admob/answer/10107561",
  "https://support.google.com/admob/answer/13554116",
  "https://support.google.com/admob/answer/16918505",
  "https://support.google.com/admob/answer/9999955",
  "https://developers.google.com/admob/android/privacy",
  "https://developers.google.com/admob/ios/privacy",
];
const requiredRowSources = {
  public_app_ads_root: "https://support.google.com/admob/answer/14538460",
  admob_app_ads_txt_status: "https://support.google.com/admob/answer/14538460",
  public_google_play_listing: "https://support.google.com/googleplay/android-developer/answer/9859455",
  public_privacy_policy: "https://support.google.com/googleplay/android-developer/answer/9859455",
  admob_app_readiness: "https://support.google.com/admob/answer/10564477",
  admob_policy_center: "https://support.google.com/admob/answer/10448801",
  privacy_messages_cmp: "https://support.google.com/admob/answer/10113207",
  payments_tax_info: "https://support.google.com/admob/answer/2772513",
  payments_identity_address: "https://support.google.com/admob/answer/13030080",
  payments_payment_method: "https://support.google.com/admob/answer/12835021",
  payments_holds: "https://support.google.com/admob/answer/11601831",
  play_console_ads_data_safety: "https://developers.google.com/admob/android/privacy/play-data-disclosure",
  live_ad_playback_device: "https://support.google.com/admob/answer/7313578",
  full_cross_platform_ad_units: "https://support.google.com/admob/answer/7356431",
};

const passEvidenceByItem: Record<string, string> = {
  public_app_ads_root:
    "Public root app-ads check passed for https://yehor212.github.io/app-ads.txt with masked publisher pub-9501********2808.",
  admob_app_ads_txt_status:
    "AdMob Verify app page showed the ZenFlow app selected and confirmed with Done status.",
  public_google_play_listing:
    "Public listing check passed for com.zenflow.app with developer website, Contains ads signal, privacy policy, and rewarded ads copy.",
  public_privacy_policy:
    "GitHub Pages post-deploy public privacy smoke passed, and public privacy policy check passed with google-play:privacy:public-check; it disclosed Google Mobile Ads, UMP privacy choices, Advertising ID, optional rewarded ads, and Google Mobile Ads SDK data categories including IP address.",
  admob_app_readiness:
    "AdMob apps list showed ZenFlow Ready, ad serving enabled, Google Play linked, and active ad units.",
  admob_policy_center:
    "AdMob Policy Center showed no violations, no blocking issues, no regulatory issues, no advertiser-preference restrictions, and no restricted or disabled ad requests for app ad serving.",
  privacy_messages_cmp:
    "AdMob Privacy & messaging European regulations message for ZenFlow was published through a Google-certified CMP using TCF v2.3.",
  payments_tax_info: "Payments tax page showed tax setup with no action required.",
  payments_identity_address:
    "Payments verification showed identity and address no action required or verified.",
  payments_payment_method: "Payments settings showed payment method eligible for payouts.",
  payments_holds:
    "Payments page showed no payment hold, no tax hold, no identity hold, no compliance hold, and no self-hold.",
  play_console_ads_data_safety:
    "Play Console App content showed Ads=Yes, Advertising ID=Yes, Data safety includes Google Mobile Ads SDK data, and privacy policy URL matches listing.",
  live_ad_playback_device:
    "Release-equivalent Android rewarded ad smoke completed after consent; video opened, reward callback granted reward only after completion, revocation stopped new ad requests, and no prompt appeared in mood logging, active focus, focus reflection, journal editor, onboarding, or bad/terrible mood states.",
  full_cross_platform_ad_units:
    "Full cross-platform ad units check showed Android, iOS, banner, and rewarded IDs are owner-controlled non-sample units from the same publisher family.",
};

function loadChecker() {
  return require(checkerPath) as {
    evaluateExternalReadiness: (
      input: unknown,
      options?: { requirePass?: boolean; requireFullCrossPlatform?: boolean; maxPassAgeDays?: number; now?: Date },
    ) => ExternalReadinessReport;
    REQUIRED_EXTERNAL_READINESS_IDS: string[];
    CURRENT_ANDROID_REWARDED_READINESS_IDS: string[];
    FULL_CROSS_PLATFORM_READINESS_IDS: string[];
    REQUIRED_OFFICIAL_SOURCE_URLS_BY_ITEM: Record<string, string[]>;
  };
}

function completePassLedger(checkedAt = "2026-07-04") {
  const checker = loadChecker();
  return {
    schemaVersion: "zenflow-admob-external-readiness/v1",
    packageName: "com.zenflow.app",
    items: checker.REQUIRED_EXTERNAL_READINESS_IDS.map((id) => ({
      id,
      status: "PASS",
      checkedAt,
      evidence: passEvidenceByItem[id] || `Fresh public-safe evidence recorded for ${id}.`,
      ownerAction: `Re-check ${id} before production ad readiness claims.`,
      sourceUrls: [officialSourceUrl, ...(checker.REQUIRED_OFFICIAL_SOURCE_URLS_BY_ITEM[id] || [])],
    })),
  };
}

describe("AdMob external monetization readiness guard", () => {
  it("exposes project-owned external readiness commands and includes them in release contracts", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.scripts["google-play:admob:external-check"]).toBe(
      "node scripts/check-admob-external-readiness.cjs",
    );
    expect(packageJson.scripts["google-play:admob:external-check:pass"]).toBe(
      "node scripts/check-admob-external-readiness.cjs --require-pass",
    );
    expect(packageJson.scripts["google-play:admob:external-check:full-pass"]).toBe(
      "node scripts/check-admob-external-readiness.cjs --require-pass --require-full-cross-platform",
    );
    expect(packageJson.scripts["test:release-contracts"]).toContain(
      "scripts/__tests__/admob-external-readiness.test.ts",
    );
  });

  it("keeps the blocking external pass command in the task-completion guard", () => {
    const taskCompletionGuard = readFileSync("scripts/check-task-completion-protocol.cjs", "utf8");

    expect(taskCompletionGuard).toContain("google-play:admob:external-check");
    expect(taskCompletionGuard).toContain("google-play:admob:external-check:pass");
    expect(taskCompletionGuard).toContain("google-play:admob:external-check:full-pass");
  });

  it("keeps a public-safe external readiness ledger in the release packet", () => {
    expect(existsSync(checkerPath)).toBe(true);
    expect(existsSync(ledgerPath)).toBe(true);

    const ledgerText = readFileSync(ledgerPath, "utf8");
    expect(ledgerText).toContain("admob_app_readiness");
    expect(ledgerText).toContain("payments_holds");
    expect(ledgerText).not.toMatch(/ca-app-pub-\d{16}[~/]\d+/);
    expect(ledgerText).not.toMatch(/\b\d{9,}\b/);
  });

  it("requires dated PASS evidence in the external readiness ledger", () => {
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    const passItems = ledger.items.filter((item: { status: string }) => item.status === "PASS");

    expect(passItems.length).toBeGreaterThan(0);
    expect(passItems.every((item: { checkedAt?: string }) => /^\d{4}-\d{2}-\d{2}$/.test(item.checkedAt || ""))).toBe(
      true,
    );
  });

  it("accepts an honest ledger with external blockers without calling it production PASS", () => {
    const checker = loadChecker();
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    const report = checker.evaluateExternalReadiness(ledger);

    expect(report.ok).toBe(true);
    expect(report.passReady).toBe(false);
    expect(report.issues).toEqual([]);
    expect(report.items.some((item) => item.status === "UNVERIFIED")).toBe(true);
  });

  it("fails pass mode until every required external monetization item is freshly PASS", () => {
    const checker = loadChecker();
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    const report = checker.evaluateExternalReadiness(ledger, { requirePass: true });

    expect(report.ok).toBe(false);
    expect(report.passReady).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "external_item_not_pass",
        itemId: "payments_holds",
      }),
    );
  });

  it("rejects Policy Center PASS evidence that omits regulatory and advertiser-preference issue classes", () => {
    const checker = loadChecker();
    const ledger = completePassLedger();
    const report = checker.evaluateExternalReadiness({
      ...ledger,
      items: ledger.items.map((item) =>
        item.id === "admob_policy_center"
          ? {
              ...item,
              evidence: "AdMob Policy Center showed no violations and no blocking issues for app ad serving.",
            }
          : item,
      ),
    }, { requirePass: true, now: new Date("2026-07-04T12:00:00.000Z") });

    expect(report.ok).toBe(false);
    expect(report.passReady).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_required_pass_evidence", itemId: "admob_policy_center" }),
    );
  });

  it("rejects stale PASS evidence in production pass mode", () => {
    const checker = loadChecker();
    const report = checker.evaluateExternalReadiness(completePassLedger("2026-06-01"), {
      requirePass: true,
      maxPassAgeDays: 14,
      now: new Date("2026-07-04T12:00:00.000Z"),
    });

    expect(report.ok).toBe(false);
    expect(report.passReady).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "stale_pass_evidence",
        itemId: "public_app_ads_root",
      }),
    );
  });

  it("rejects stale PASS evidence even before strict production pass mode", () => {
    const checker = loadChecker();
    const report = checker.evaluateExternalReadiness(completePassLedger("2026-06-01"), {
      requirePass: false,
      maxPassAgeDays: 14,
      now: new Date("2026-07-04T12:00:00.000Z"),
    });

    expect(report.ok).toBe(false);
    expect(report.passReady).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "stale_pass_evidence",
        itemId: "public_app_ads_root",
      }),
    );
  });

  it("rejects future-dated PASS evidence in production pass mode", () => {
    const checker = loadChecker();
    const report = checker.evaluateExternalReadiness(completePassLedger("2026-08-01"), {
      requirePass: true,
      maxPassAgeDays: 14,
      now: new Date("2026-07-04T12:00:00.000Z"),
    });

    expect(report.ok).toBe(false);
    expect(report.passReady).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "future_pass_evidence",
        itemId: "public_app_ads_root",
      }),
    );
  });

  it("keeps the current Android rewarded-only gate separate from future full cross-platform expansion", () => {
    const checker = loadChecker();

    expect(checker.REQUIRED_EXTERNAL_READINESS_IDS).toEqual([
      "public_app_ads_root",
      "admob_app_ads_txt_status",
      "public_google_play_listing",
      "public_privacy_policy",
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
    expect(checker.CURRENT_ANDROID_REWARDED_READINESS_IDS).toEqual([
      "public_app_ads_root",
      "admob_app_ads_txt_status",
      "public_google_play_listing",
      "public_privacy_policy",
      "admob_app_readiness",
      "admob_policy_center",
      "privacy_messages_cmp",
      "payments_tax_info",
      "payments_identity_address",
      "payments_payment_method",
      "payments_holds",
      "play_console_ads_data_safety",
      "live_ad_playback_device",
    ]);
    expect(checker.FULL_CROSS_PLATFORM_READINESS_IDS).toContain("full_cross_platform_ad_units");
  });

  it("does not require future banner/iOS expansion for the current Android rewarded-only pass gate", () => {
    const checker = loadChecker();
    const ledger = completePassLedger();
    const report = checker.evaluateExternalReadiness({
      ...ledger,
      items: ledger.items.map((item) =>
        item.id === "full_cross_platform_ad_units"
          ? { ...item, status: "UNVERIFIED", evidence: "Future banner/iOS expansion remains intentionally separate." }
          : item,
      ),
    }, { requirePass: true, now: new Date("2026-07-04T12:00:00.000Z") });

    expect(report.ok).toBe(true);
    expect(report.passReady).toBe(true);
    expect(report.fullCrossPlatformReady).toBe(false);
  });

  it("requires future banner/iOS expansion only for the explicit full cross-platform pass gate", () => {
    const checker = loadChecker();
    const ledger = completePassLedger();
    const report = checker.evaluateExternalReadiness({
      ...ledger,
      items: ledger.items.map((item) =>
        item.id === "full_cross_platform_ad_units"
          ? { ...item, status: "UNVERIFIED", evidence: "Future banner/iOS expansion remains intentionally separate." }
          : item,
      ),
    }, { requirePass: true, requireFullCrossPlatform: true, now: new Date("2026-07-04T12:00:00.000Z") });

    expect(report.ok).toBe(false);
    expect(report.passReady).toBe(true);
    expect(report.fullCrossPlatformReady).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "external_item_not_pass", itemId: "full_cross_platform_ad_units" }),
    );
  });

  it("keeps the Play Console field packet from treating future full cross-platform IDs as current-pass blockers", () => {
    const packet = readFileSync("docs/release/google-play/GOOGLE_PLAY_CONSOLE_FIELD_PACKET.md", "utf8");

    expect(packet).toMatch(/Use `npm run google-play:admob:external-check:pass` only for\s+the current Android rewarded-only production gate/);
    expect(packet).toMatch(/Use `npm run google-play:admob:external-check:full-pass` only for future full\s+cross-platform\/banner\+iOS monetization readiness/);
    expect(packet).not.toContain("playback, or full cross-platform IDs are not freshly `PASS`");
  });

  it("marks the older monetization brainstorm as superseded by the current rewarded-only safety gate", () => {
    const plan = readFileSync("docs/AD_MONETIZATION_PLAN.md", "utf8");

    expect(plan).toContain("Status: superseded historical brainstorm");
    expect(plan).toContain("Current approved release path is optional Android rewarded-only");
    expect(plan).toMatch(/Do not implement Native Ads, interstitials, banners, app-open ads,\s+> companion\/tree placements, or full cross-platform monetization from this\s+> document/);
  });

  it("rejects live rewarded playback PASS until consent, Play declaration, app-ads, readiness, and policy are PASS", () => {
    const checker = loadChecker();
    const ledger = completePassLedger();
    const report = checker.evaluateExternalReadiness({
      ...ledger,
      items: ledger.items.map((item) =>
        item.id === "privacy_messages_cmp"
          ? { ...item, status: "PARTIAL", evidence: "CMP still needs owner publication proof." }
          : item,
      ),
    });

    expect(report.ok).toBe(false);
    expect(report.passReady).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "live_playback_prerequisite_not_pass", itemId: "live_ad_playback_device" }),
    );
  });

  it("rejects raw private/payment identifiers inside the external ledger", () => {
    const checker = loadChecker();
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    const report = checker.evaluateExternalReadiness({
      ...ledger,
      items: [
        ...ledger.items,
        {
          id: "unsafe_private_value",
          status: "UNVERIFIED",
          evidence: "payment profile 1234567890",
          ownerAction: "remove private value",
        },
      ],
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({ code: "private_identifier_leak" }));
  });

  it("rejects unknown external readiness rows even when they look public-safe", () => {
    const checker = loadChecker();
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    const report = checker.evaluateExternalReadiness({
      ...ledger,
      items: [
        ...ledger.items,
        {
          id: "owner_console_note",
          status: "UNVERIFIED",
          checkedAt: "2026-07-04",
          evidence: "Looks public-safe but is not part of the reviewed external readiness schema.",
          ownerAction: "Remove this unreviewed row.",
          sourceUrls: [officialSourceUrl],
        },
      ],
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "unknown_external_readiness_item", itemId: "owner_console_note" }),
    );
  });

  it("requires row-specific official source policy for every external readiness row", () => {
    const checker = loadChecker();

    for (const id of checker.REQUIRED_EXTERNAL_READINESS_IDS) {
      expect(checker.REQUIRED_OFFICIAL_SOURCE_URLS_BY_ITEM[id]?.length, id).toBeGreaterThan(0);
    }
  });

  it("rejects generic PASS evidence for every external readiness row", () => {
    const checker = loadChecker();

    for (const id of checker.REQUIRED_EXTERNAL_READINESS_IDS) {
      const ledger = completePassLedger();
      const report = checker.evaluateExternalReadiness({
        ...ledger,
        items: ledger.items.map((item) =>
          item.id === id ? { ...item, evidence: `Fresh public-safe evidence recorded for ${id}.` } : item,
        ),
      }, { requirePass: true, requireFullCrossPlatform: true, now: new Date("2026-07-04T12:00:00.000Z") });

      expect(report.ok, id).toBe(false);
      expect(report.issues, id).toContainEqual(
        expect.objectContaining({ code: "missing_required_pass_evidence", itemId: id }),
      );
    }
  });

  it("rejects WAIVED as an external readiness status because waivers cannot prove monetization readiness", () => {
    const checker = loadChecker();
    const ledger = completePassLedger();
    const report = checker.evaluateExternalReadiness({
      ...ledger,
      items: ledger.items.map((item) =>
        item.id === "payments_holds" ? { ...item, status: "WAIVED" } : item,
      ),
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "invalid_item_status", itemId: "payments_holds" }),
    );
  });

  it("uses the shared source policy that also covers AdMob rewarded-video guidance", () => {
    const sourcePolicy = require(sourcePolicyPath) as {
      ADMOB_READINESS_APPROVED_SOURCE_URLS: Set<string>;
      ADMOB_READINESS_REQUIRED_SOURCE_URLS_BY_ITEM: Record<string, string[]>;
    };

    expect(sourcePolicy.ADMOB_READINESS_APPROVED_SOURCE_URLS.has(
      "https://admob.google.com/home/resources/best-practices-for-in-app-rewarded-video-ads/",
    )).toBe(true);
    expect(sourcePolicy.ADMOB_READINESS_REQUIRED_SOURCE_URLS_BY_ITEM).toBe(
      loadChecker().REQUIRED_OFFICIAL_SOURCE_URLS_BY_ITEM,
    );
  });

  it("rejects private text and unknown fields inside the tracked external ledger", () => {
    const checker = loadChecker();
    const ledger = completePassLedger();
    ledger.items[0] = {
      ...ledger.items[0],
      evidence: "Owner pasted SSN 123-45-6789 and address 123 Main Street into release evidence.",
      streetAddress: "123 Main Street",
    } as (typeof ledger.items)[number] & { streetAddress: string };

    const report = checker.evaluateExternalReadiness(ledger);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "unsafe_private_evidence_detail", itemId: "public_app_ads_root" }),
    );
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "unknown_item_field", itemId: "public_app_ads_root" }),
    );
  });

  it("rejects personal names and non-numeric payment IDs in external evidence and owner actions", () => {
    const checker = loadChecker();
    const ledger = completePassLedger();
    ledger.items[0] = {
      ...ledger.items[0],
      evidence: "Owner pasted legal name John Doe into release evidence.",
      ownerAction: "Owner pasted payment ID PAY-ABC-123 into release owner action.",
    };

    const report = checker.evaluateExternalReadiness(ledger);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "unsafe_private_evidence_detail", itemId: "public_app_ads_root" }),
    );
  });

  it("rejects non-official source URLs in the external readiness ledger", () => {
    const checker = loadChecker();
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    const report = checker.evaluateExternalReadiness({
      ...ledger,
      items: ledger.items.map((item: { id: string }) =>
        item.id === "admob_app_readiness"
          ? {
              ...item,
              sourceUrls: ["https://example.com/admob-advice"],
            }
          : item,
      ),
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "unofficial_source_url",
        itemId: "admob_app_readiness",
      }),
    );
  });

  it("rejects source URL query or hash content in the external readiness ledger", () => {
    const checker = loadChecker();
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    const report = checker.evaluateExternalReadiness({
      ...ledger,
      items: ledger.items.map((item: { id: string }) =>
        item.id === "admob_app_readiness"
          ? {
              ...item,
              sourceUrls: ["https://support.google.com/admob/answer/10564477?payment_profile=private"],
            }
          : item,
      ),
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "source_url_must_not_have_query_or_hash",
        itemId: "admob_app_readiness",
      }),
    );
  });

  it("rejects encoded private data in official source URL paths", () => {
    const checker = loadChecker();
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    const report = checker.evaluateExternalReadiness({
      ...ledger,
      items: ledger.items.map((item: { id: string }) =>
        item.id === "admob_app_readiness"
          ? {
              ...item,
              sourceUrls: ["https://support.google.com/admob/answer/10564477/123%20Main%20Street"],
            }
          : item,
      ),
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "unapproved_source_url",
        itemId: "admob_app_readiness",
      }),
    );
  });

  it("requires row-specific official sources for public privacy, CMP, and Play Data safety evidence", () => {
    const checker = loadChecker();
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));

    for (const [id, requiredSource] of Object.entries(requiredRowSources)) {
      expect(checker.REQUIRED_OFFICIAL_SOURCE_URLS_BY_ITEM[id]).toContain(requiredSource);
    }
    expect(checker.REQUIRED_OFFICIAL_SOURCE_URLS_BY_ITEM.admob_policy_center).toContain(
      "https://support.google.com/admob/answer/15697162",
    );

    const report = checker.evaluateExternalReadiness({
      ...ledger,
      items: ledger.items.map((item: { id: string }) =>
        item.id === "privacy_messages_cmp"
          ? {
              ...item,
              sourceUrls: ["https://developers.google.com/admob/android/privacy"],
            }
          : item,
      ),
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_required_source_url",
        itemId: "privacy_messages_cmp",
      }),
    );
  });

  it("rejects public privacy PASS evidence without post-deploy public privacy smoke proof", () => {
    const checker = loadChecker();
    const ledger = completePassLedger();
    const report = checker.evaluateExternalReadiness({
      ...ledger,
      items: ledger.items.map((item) =>
        item.id === "public_privacy_policy"
          ? {
              ...item,
              evidence:
                "Public privacy policy check passed with google-play:privacy:public-check; it disclosed Google Mobile Ads, UMP privacy choices, Advertising ID, optional rewarded ads, and Google Mobile Ads SDK data categories.",
            }
          : item,
      ),
    }, { requirePass: true, now: new Date("2026-07-04T12:00:00.000Z") });

    expect(report.ok).toBe(false);
    expect(report.passReady).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_required_pass_evidence", itemId: "public_privacy_policy" }),
    );
  });

  it("rejects generic PASS evidence for the public privacy policy row", () => {
    const checker = loadChecker();
    const ledger = completePassLedger();
    const report = checker.evaluateExternalReadiness({
      ...ledger,
      items: ledger.items.map((item) =>
        item.id === "public_privacy_policy"
          ? { ...item, evidence: "Fresh public-safe evidence recorded for public_privacy_policy." }
          : item,
      ),
    }, { requirePass: true, now: new Date("2026-07-04T12:00:00.000Z") });

    expect(report.ok).toBe(false);
    expect(report.passReady).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_required_pass_evidence", itemId: "public_privacy_policy" }),
    );
  });

  it("requires the full official Google CMP source set in both source policy and tracked ledger", () => {
    const checker = loadChecker();
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as {
      items: Array<{ id: string; sourceUrls: string[] }>;
    };
    const cmpLedgerRow = ledger.items.find((item) => item.id === "privacy_messages_cmp");

    expect(checker.REQUIRED_OFFICIAL_SOURCE_URLS_BY_ITEM.privacy_messages_cmp).toEqual(requiredCmpSourceUrls);
    for (const sourceUrl of requiredCmpSourceUrls) {
      expect(cmpLedgerRow?.sourceUrls).toContain(sourceUrl);
    }
  });

  it("prints UNVERIFIED and exits 2 for blocking pass mode while Google-owned evidence is missing", () => {
    const result = spawnSync(process.execPath, [checkerPath, "--require-pass"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("UNVERIFIED");
    expect(result.stdout).toContain("payments_holds");
    expect(result.stdout).not.toMatch(/ca-app-pub-\d{16}[~/]\d+/);
  });
});
