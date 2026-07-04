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
    const result = runNextSteps(["--out", outFile, "--date", "2026-07-04"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS");
    expect(result.stdout).toContain(outFile);

    const packet = readFileSync(outFile, "utf8");
    expect(packet).toContain("# ZenFlow AdMob Owner Next Steps");
    expect(packet).toContain("Current Android rewarded monetization: UNVERIFIED");
    expect(packet).toContain("Support escalation: NOT READY");
    expect(packet).toContain("Do not contact AdMob support yet");
    expect(packet).toContain("privacy_messages_cmp");
    expect(packet).toContain("payments_tax_info");
    expect(packet).toContain("play_console_ads_data_safety");
    expect(packet).toContain("live_ad_playback_device");
    expect(packet).toContain("npm run google-play:admob:owner-evidence:prepare");
    expect(packet).toContain("npm run google-play:admob:external-check:pass");
    expect(packet).toContain("https://support.google.com/admob/answer/10113207");
    expect(packet).not.toMatch(/ca-app-pub-\d{16}[~/]\d+/i);
    expect(packet).not.toMatch(/\bpub-\d{16}\b/i);
    expect(packet).not.toMatch(/\b\d{9,}\b/);
    expect(packet).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  });

  it("refuses support-ready mode while owner-owned rows remain incomplete", () => {
    const outFile = outputPath("current-support-required.md");
    const result = runNextSteps(["--out", outFile, "--date", "2026-07-04", "--require-support-ready"]);

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
