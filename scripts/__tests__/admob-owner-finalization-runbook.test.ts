import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const runbookPath = join(repoRoot, "docs/release/google-play/ADMOB_OWNER_FINALIZATION_RUNBOOK.md");
const checkerPath = join(repoRoot, "scripts/check-admob-owner-finalization-runbook.cjs");
const ownerEvidenceTemplatePath = join(repoRoot, "docs/release/google-play/ADMOB_OWNER_EVIDENCE_TEMPLATE.json");

describe("AdMob owner finalization runbook", () => {
  it("is wired as a checked release command", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const taskCompletionGuard = readFileSync("scripts/check-task-completion-protocol.cjs", "utf8");
    const releaseContracts = packageJson.scripts["test:release-contracts"];

    expect(packageJson.scripts["google-play:admob:owner-runbook:check"]).toBe(
      "node scripts/check-admob-owner-finalization-runbook.cjs",
    );
    expect(packageJson.scripts["google-play:admob:owner-evidence:check"]).toBe(
      "node scripts/check-admob-owner-evidence.cjs",
    );
    expect(packageJson.scripts["google-play:admob:owner-evidence:apply"]).toBe(
      "node scripts/apply-admob-owner-evidence.cjs",
    );
    expect(releaseContracts).toContain("scripts/__tests__/admob-owner-finalization-runbook.test.ts");
    expect(taskCompletionGuard).toContain("google-play:admob:owner-runbook:check");
    expect(taskCompletionGuard).toContain("google-play:admob:owner-evidence:apply");

    const checkerSource = readFileSync(checkerPath, "utf8");
    expect(checkerSource).toContain("google-play:privacy:artifact-check");
    expect(checkerSource).toContain("post-deploy public privacy smoke");
  });

  it("keeps an owner-only finalization runbook linked from the release packet", () => {
    expect(existsSync(runbookPath)).toBe(true);
    expect(existsSync(checkerPath)).toBe(true);

    const runbook = readFileSync(runbookPath, "utf8");
    const releaseReadme = readFileSync("docs/release/google-play/README.md", "utf8");

    expect(releaseReadme).toContain("ADMOB_OWNER_FINALIZATION_RUNBOOK.md");
    expect(runbook).toContain("External Finalization Status");
    expect(runbook).toContain("Privacy & messages / CMP");
    expect(runbook).toContain("Payments, identity, tax, and holds");
    expect(runbook).toContain("Release-equivalent live rewarded-ad smoke");
    expect(runbook).toContain("Full cross-platform ad-unit expansion");
    expect(runbook).toContain("Psychological safety approval");
    expect(runbook).toContain("Public-safe evidence rules");
    expect(runbook).toContain("Owner evidence intake");
    expect(runbook).toContain("Owner PASS evidence fact requirements");
    expect(runbook).toContain("current Android rewarded-only gate");
    expect(runbook).toContain("not part of the approved current release path");
    expect(runbook).toContain("future expansion gate, not a blocker");
    expect(runbook).toContain("Privacy controls are consent, disclosure, and withdrawal only");
    expect(runbook).toContain("No production rewarded playback surface is approved inside Settings / Privacy");
    expect(runbook).toContain("separate Optional Rewards surface");
    expect(runbook).toContain("google-play:admob:owner-evidence:apply");
    expect(runbook).toContain("google-play:admob:external-check:full-pass");
    expect(runbook).toContain("ADMOB_OWNER_EVIDENCE_TEMPLATE.json");
    expect(runbook).toContain("output/private/admob-owner-evidence.json");
  });

  it("anchors the runbook to official sources and the current external ledger", () => {
    const runbook = readFileSync(runbookPath, "utf8");

    expect(runbook).toContain("ADMOB_EXTERNAL_READINESS.json");
    expect(runbook).toContain("https://support.google.com/admob/answer/10564477");
    expect(runbook).toContain("https://support.google.com/admob/answer/10448801");
    expect(runbook).toContain("https://support.google.com/admob/answer/14538460");
    expect(runbook).toContain("https://support.google.com/admob/answer/10113207");
    expect(runbook).toContain("https://developers.google.com/admob/android/privacy");
    expect(runbook).toContain("https://developers.google.com/admob/ios/privacy");
    expect(runbook).toContain("https://developers.google.com/admob/android/privacy/play-data-disclosure");
    expect(runbook).toContain("https://support.google.com/admob/answer/2772513");
    expect(runbook).toContain("https://support.google.com/admob/answer/11601831");
  });

  it("keeps the runbook status table synchronized with the external readiness ledger", () => {
    const runbook = readFileSync(runbookPath, "utf8");
    const ledger = JSON.parse(readFileSync("docs/release/google-play/ADMOB_EXTERNAL_READINESS.json", "utf8")) as {
      items: Array<{ id: string; status: string }>;
    };

    for (const item of ledger.items) {
      expect(runbook).toContain(`| \`${item.id}\` | ${item.status} |`);
    }
  });

  it("contains a concrete Google CMP owner setup packet for ZenFlow", () => {
    const runbook = readFileSync(runbookPath, "utf8");

    expect(runbook).toContain("Google-certified CMP");
    expect(runbook).toContain("IAB Transparency and Consent Framework");
    expect(runbook).toContain("TCF v2.3");
    expect(runbook).toContain("Countries subject to GDPR (EEA, UK, and Switzerland)");
    expect(runbook).toContain("Do not consent");
    expect(runbook).toContain("Close (do not consent)");
    expect(runbook).toContain("English, Ukrainian, Spanish, German, French, Japanese, Arabic, and Hebrew");
    expect(runbook).toContain("privacy-options entry point");
    expect(runbook).toContain("canRequestAds");
    expect(runbook).toContain("https://support.google.com/admob/answer/13554116");
    expect(runbook).toContain("https://support.google.com/admob/answer/16918505");
    expect(runbook).toContain("https://support.google.com/admob/answer/9999955");
  });

  it("requires live rewarded smoke prerequisites before owner PASS evidence", () => {
    const runbook = readFileSync(runbookPath, "utf8");

    expect(runbook).toContain("live_ad_playback_device: PASS");
    expect(runbook).toContain("admob_app_ads_txt_status");
    expect(runbook).toContain("admob_app_readiness");
    expect(runbook).toContain("admob_policy_center");
    expect(runbook).toContain("privacy_messages_cmp");
    expect(runbook).toContain("play_console_ads_data_safety");
  });

  it("documents concrete public-safe facts required before owner PASS evidence", () => {
    const runbook = readFileSync(runbookPath, "utf8");

    expect(runbook).toContain("privacy_messages_cmp: published European regulations message, Google-certified CMP, TCF v2.3, and ZenFlow app selection");
    expect(runbook).toContain("play_console_ads_data_safety: Ads=Yes, Advertising ID=Yes, Data safety includes Google Mobile Ads SDK data, and privacy policy URL matches listing");
    expect(runbook).toContain("payments_holds: no payment hold, no tax hold, no identity hold, no compliance hold, and no self-hold");
    expect(runbook).toContain("live_ad_playback_device: release-equivalent Android, consent path, rewarded video open, reward callback, revocation stop check, and no prompts or ad requests in sacred zones");
    expect(runbook).toContain("full_cross_platform_ad_units: Android, iOS, banner, rewarded, owner-controlled non-sample IDs, and same publisher family");
    expect(runbook).toContain("Each owner evidence row also has a `facts` object");
    expect(runbook).toContain("free-text evidence alone is never enough");
    expect(runbook).toContain("does not copy `facts` into the public `ADMOB_EXTERNAL_READINESS.json` ledger");
    expect(runbook).toContain("dataSafetyIncludesGoogleMobileAdsSdkData");
    expect(runbook).toContain("googleMobileAdsSdkDataDisclosureReviewed");
    expect(runbook).toContain("rewardCallbackGrantedAfterCompletion");
    expect(runbook).toContain("revocationStopsNewAdRequests");
    expect(runbook).toContain("noMoodCheckInPromptOrRequest");
    expect(runbook).toContain("noActiveFocusPromptOrRequest");
    expect(runbook).toContain("noFocusReflectionPromptOrRequest");
    expect(runbook).toContain("noJournalEditorPromptOrRequest");
    expect(runbook).toContain("noBadOrTerribleMoodPromptOrRequest");
    expect(runbook).toContain("samePublisherFamily");
  });

  it("keeps the owner evidence template public-safe", () => {
    expect(existsSync(ownerEvidenceTemplatePath)).toBe(true);
    const template = readFileSync(ownerEvidenceTemplatePath, "utf8");

    expect(template).toContain("zenflow-admob-owner-evidence/v1");
    expect(template).toContain("output/private/admob-owner-evidence.json");
    expect(template).not.toMatch(/ca-app-pub-\d{16}[~/]\d+/i);
    expect(template).not.toMatch(/\bpub-\d{16}\b/i);
    expect(template).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  });

  it("keeps Privacy controls separate from rewarded playback surfaces", () => {
    const runbook = readFileSync(runbookPath, "utf8");

    expect(runbook).toContain("Privacy controls are consent, disclosure, and withdrawal only");
    expect(runbook).toContain("No production rewarded playback surface is approved inside Settings / Privacy");
    expect(runbook).toContain("separate Optional Rewards surface");
    expect(runbook).not.toContain("Settings / Privacy optional rewarded-ad prompt");
    expect(runbook).not.toContain("Settings privacy surface");
  });

  it("does not store raw account/payment/ad identifiers or pressure copy", () => {
    const runbook = readFileSync(runbookPath, "utf8");

    expect(runbook).not.toMatch(/ca-app-pub-\d{16}[~/]\d+/i);
    expect(runbook).not.toMatch(/\bpub-\d{16}\b/i);
    expect(runbook).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(runbook).not.toMatch(/need treats\? watch|can't (feed|water)|needs you|care failure|streak harm|countdown/i);
  });

  it("blocks private payment, tax, address, identity, and bank-like runbook drift", () => {
    const checker = readFileSync(checkerPath, "utf8");

    for (const requiredPattern of [
      "\\bSSN\\b",
      "\\bTIN\\b",
      "\\bEIN\\b",
      "\\bW-?9\\b",
      "\\bbank account\\b",
      "\\blegal name\\b",
      "\\bpayment profile\\b",
      "\\bhome address\\b",
    ]) {
      expect(checker).toContain(requiredPattern);
    }
  });

  it("passes its dedicated checker", () => {
    const result = spawnSync(process.execPath, [checkerPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS");
  });
});
