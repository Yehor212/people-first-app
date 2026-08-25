import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const runbookPath = "docs/release/google-play/ADMOB_OWNER_FINALIZATION_RUNBOOK.md";

describe("AdMob owner finalization runbook", () => {
  it("documents the current Android Habits banner gate and all platform boundaries", () => {
    const runbook = readFileSync(runbookPath, "utf8");

    expect(runbook).toContain("current Android banner gate");
    expect(runbook).toContain("Release-equivalent live Android banner smoke");
    expect(runbook).toContain("Habits screen");
    expect(runbook).toContain("Web/Vite");
    expect(runbook).toContain("Installed PWA");
    expect(runbook).toContain("Android/Capacitor");
    expect(runbook).toContain("iOS/WKWebView");
    expect(runbook).toContain("Desktop/Tauri");
    expect(runbook).not.toMatch(/current[^\n]{0,100}rewarded/i);
  });

  it("requires consent, request, impression, layout, lifecycle, and protected-surface evidence", () => {
    const runbook = readFileSync(runbookPath, "utf8");

    for (const fact of [
      "consentPathCompleted",
      "habitsBannerRendered",
      "adMobRequestObserved",
      "adMobImpressionObserved",
      "bannerDoesNotOverlapAppContent",
      "rotationRecreatesAdaptiveBanner",
      "backgroundRemovesBanner",
      "revocationStopsNewAdRequests",
      "noDrawerSheetModalBanner",
    ]) {
      expect(runbook).toContain(`\`${fact}\``);
    }
  });

  it("keeps production identifiers fail-closed and forbids tracked private evidence", () => {
    const runbook = readFileSync(runbookPath, "utf8");

    expect(runbook).toContain("VITE_ADMOB_BANNER_ID_ANDROID");
    expect(runbook).toContain("must not use Google sample IDs");
    expect(runbook).toContain("Forbidden evidence: raw IDs");
    expect(runbook).not.toMatch(/ca-app-pub-\d{16}[~/]\d+/i);
    expect(runbook).not.toMatch(/\bpub-\d{16}\b/i);
    expect(runbook).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  });

  it("matches every current public readiness row and passes its checker", () => {
    const runbook = readFileSync(runbookPath, "utf8");
    const ledger = JSON.parse(readFileSync("docs/release/google-play/ADMOB_EXTERNAL_READINESS.json", "utf8"));

    for (const item of ledger.items) {
      expect(runbook).toContain(`| \`${item.id}\` | ${item.status} |`);
    }

    const result = spawnSync(process.execPath, ["scripts/check-admob-owner-finalization-runbook.cjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS");
  });
});
