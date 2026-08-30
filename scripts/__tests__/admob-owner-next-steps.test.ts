import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/generate-admob-owner-next-steps.cjs");
const ledgerPath = join(process.cwd(), "docs/release/google-play/ADMOB_EXTERNAL_READINESS.json");

function runNextSteps(args: string[] = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function outputPath(name: string) {
  const dir = join(process.cwd(), "output", "private", "admob-next-steps-tests");
  mkdirSync(dir, { recursive: true });
  return join(dir, name);
}

describe("AdMob owner next-steps packet", () => {
  it("is wired into package scripts and release contracts", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.scripts["google-play:admob:owner-next-steps"]).toBe(
      "node scripts/generate-admob-owner-next-steps.cjs",
    );
    expect(packageJson.scripts["test:release-contracts"]).toContain(
      "scripts/__tests__/admob-owner-next-steps.test.ts",
    );
    expect(existsSync(scriptPath)).toBe(true);
  });

  it("writes a public-safe owner action packet from the current external ledger", () => {
    const outFile = outputPath("current.md");
    const result = runNextSteps(["--out", outFile, "--date", "2026-08-25"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("WROTE");
    expect(result.stdout).toContain("readiness=UNVERIFIED");
    expect(result.stdout).toContain("support=NOT_READY");
    expect(result.stdout).not.toContain("PASS - wrote");
    expect(result.stdout).toContain(outFile);

    const packet = readFileSync(outFile, "utf8");
    expect(packet).toContain("# ZenFlow AdMob Owner Next Steps");
    expect(packet).toContain("Current Android banner monetization: UNVERIFIED");
    expect(packet).toContain("Support escalation: NOT READY");
    expect(packet).toContain("Do not contact AdMob support yet");
    expect(packet).not.toContain("after AdMob readiness is PASS");
    expect(packet).not.toContain("## Ledger Validation\n\nPASS:");
    expect(packet).toContain("Source ledger validation: STRUCTURALLY_VALID");
    expect(packet).toContain("privacy_messages_cmp");
    expect(packet).toContain("payments_tax_info");
    expect(packet).toContain("play_console_ads_data_safety");
    expect(packet).toContain("live_ad_playback_device");
    expect(packet).toContain("admob_policy_center");
    expect(packet).toContain("no regulatory issues");
    expect(packet).toContain("no advertiser-preference restrictions");
    expect(packet).toContain("no restricted or disabled ad requests");
    expect(packet).toContain("https://support.google.com/admob/answer/15697162");
    expect(packet).toContain("## Public-Safe Owner Evidence Checklist");
    expect(packet).toContain("Set `status` to `PASS` only when every fact below is true");
    expect(packet).toContain("keep this row non-PASS");
    expect(packet).not.toContain("PARTIAL or PARTIAL");
    expect(packet).toContain("`policyCenterReviewed`");
    expect(packet).toContain("`europeanRegulationsMessagePublished`");
    expect(packet).toContain("`taxNoActionRequired`");
    expect(packet).toContain("`noComplianceHold`");
    expect(packet).toContain("`gmaIpAddressDisclosureReviewed`");
    expect(packet).toContain("`habitsBannerRendered`");
    expect(packet).toContain("`adMobRequestObserved`");
    expect(packet).toContain("`adMobImpressionObserved`");
    expect(packet).toContain("`bannerDoesNotOverlapAppContent`");
    expect(packet).toContain("`rotationRecreatesAdaptiveBanner`");
    expect(packet).toContain("`backgroundRemovesBanner`");
    expect(packet).toContain("`noOnboardingBannerOrRequest`");
    expect(packet).toContain("`noDrawerSheetModalBanner`");
    expect(packet).toContain("`cmpLanguageEnReviewed`");
    expect(packet).toContain("`cmpLanguageUkReviewed`");
    expect(packet).toContain("`cmpLanguageEsReviewed`");
    expect(packet).toContain("`cmpLanguageDeReviewed`");
    expect(packet).toContain("`cmpLanguageFrReviewed`");
    expect(packet).toContain("`cmpLanguageJaReviewed`");
    expect(packet).toContain("`googleSupportedLanguageListReviewed`");
    expect(packet).toContain("`cmpLanguageArFallbackReviewed`");
    expect(packet).toContain("`cmpLanguageHeFallbackReviewed`");
    expect(packet).toContain("If any required Google-supported language is unavailable");
    expect(packet).toContain("PASS evidence must be affirmative");
    expect(packet).toContain("Public-safe evidence: one sentence summarizing status only");
    expect(packet).toContain("npm run google-play:admob:owner-evidence:prepare");
    expect(packet).toContain("npm run google-play:admob:external-check:pass");
    expect(packet).toContain("https://support.google.com/admob/answer/10113207");
    expect(packet).toContain("https://support.google.com/admob/answer/10107561");
    expect(packet).not.toMatch(/ca-app-pub-\d{16}[~/]\d+/i);
    expect(packet).not.toMatch(/\bpub-\d{16}\b/i);
    expect(packet).not.toMatch(/\b\d{9,}\b/);
    expect(packet).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  });
  it("includes checklist facts for service rows when they become blockers", () => {
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    ledger.items = ledger.items.map((item: { id: string; status: string; evidence: string }) => {
      if (item.id === "admob_app_ads_txt_status") {
        return {
          ...item,
          status: "UNVERIFIED",
          evidence: "Owner console app verification status is not recorded yet.",
        };
      }
      if (item.id === "admob_app_readiness") {
        return {
          ...item,
          status: "UNVERIFIED",
          evidence: "Owner console app readiness status is not recorded yet.",
        };
      }
      return item;
    });
    const serviceLedger = outputPath("service-blockers-ledger.json");
    const outFile = outputPath("service-blockers.md");
    writeFileSync(serviceLedger, JSON.stringify(ledger, null, 2));

    const result = runNextSteps(["--file", serviceLedger, "--out", outFile, "--date", "2026-08-25"]);

    expect(result.status).toBe(0);
    const packet = readFileSync(outFile, "utf8");
    expect(packet).toContain("### `admob_app_ads_txt_status`");
    expect(packet).toContain("`verifyAppConfirmedDone`");
    expect(packet).toContain("`zenflowAppSelected`");
    expect(packet).toContain("### `admob_app_readiness`");
    expect(packet).toContain("`adServingEnabled`");
    expect(packet).toContain("`googlePlayLinked`");
    expect(packet).toContain("`activeAdUnits`");
  });

  it("refuses support-ready mode while owner-owned rows remain incomplete", () => {
    const outFile = outputPath("current-support-required.md");
    const result = runNextSteps(["--out", outFile, "--date", "2026-08-25", "--require-support-ready"]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("UNVERIFIED");
    expect(result.stdout).toContain("owner blockers remain");
  });

  it("fails closed when the ledger contains unsafe private evidence", () => {
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    ledger.items = ledger.items.map((item: { id: string; evidence: string }) =>
      item.id === "payments_holds"
        ? { ...item, evidence: "Owner pasted legal name Jane Example and payment profile detail." }
        : item,
    );
    const unsafeLedger = outputPath("unsafe-ledger.json");
    writeFileSync(unsafeLedger, JSON.stringify(ledger, null, 2));

    const result = runNextSteps(["--file", unsafeLedger, "--out", outputPath("unsafe.md")]);

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("UNVERIFIED");
    expect(result.stdout).toContain("unsafe_private_evidence_detail");
  });
});
