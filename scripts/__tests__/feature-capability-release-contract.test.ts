import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (fragments: string[]) =>
  readFileSync(path.join(root, fragments.join("")), "utf8");

describe("feature capability release wiring", () => {
  it("keeps one tracked release policy fail closed while human admission is missing", () => {
    const policyPath = path.join(root, "config", "feature-capability-release.json");
    expect(existsSync(policyPath)).toBe(true);

    const policy = JSON.parse(readFileSync(policyPath, "utf8"));
    expect(Object.keys(policy)).toEqual([
      "schemaVersion",
      "requestedCapabilities",
      "killSwitches",
      "admission",
    ]);
    expect(policy).toEqual({
      schemaVersion: 1,
      requestedCapabilities: { journalSaveCeremony: false },
      killSwitches: { journalSaveCeremony: true },
      admission: {
        technical: "unverified",
        accessibility: "unverified",
        performance: "unverified",
        visualRuntime: "unverified",
        artisticCraft: "unverified",
        userApproval: "unverified",
      },
    });
  });

  it("routes all canonical production builds through the guarded receipt decision", () => {
    const packageJson = JSON.parse(read(["package", ".json"]));
    const orchestrator = read(["scripts/", "run-shared-dist-build.mjs"]);
    const vite = read(["vite.config.ts"]);
    const runtimeEnv = read(["src/", "lib/", "env.ts"]);
    const tauri = JSON.parse(read(["src-tauri/", "tauri.conf.json"]));

    expect(packageJson.scripts["build:tauri"]).toBe(
      "node scripts/run-shared-dist-build.mjs --target tauri --mode production",
    );
    expect(tauri.build.beforeBuildCommand).toContain("npm run build:tauri");
    expect(orchestrator).toContain('"tauri:production"');
    expect(orchestrator).toContain("resolveFeatureCapabilityBuildEnvironment");
    expect(orchestrator).toContain("feature capability receipt");
    expect(orchestrator).toContain("ZENFLOW_RELEASE_SOURCE_COMMIT");
    expect(orchestrator).toContain("ZENFLOW_REQUIRE_CAPABILITY_RECEIPT");
    expect(orchestrator).toContain("ZENFLOW_JOURNAL_SAVE_CEREMONY_BUILD_ENABLED");
    expect(vite).toContain("ZENFLOW_JOURNAL_SAVE_CEREMONY_BUILD_ENABLED");
    expect(vite).not.toContain("process.env.VITE_ENABLE_JOURNAL_SAVE_CEREMONY");
    expect(vite).not.toContain("fileEnvironment.VITE_ENABLE_JOURNAL_SAVE_CEREMONY");
    expect(runtimeEnv).not.toContain("import.meta.env.VITE_ENABLE_JOURNAL_SAVE_CEREMONY");
  });

  it("binds Pages, Android, iOS, and Desktop workflows to their exact checkout SHA", () => {
    const deploy = read([".github", "/workflows/", "deploy", ".yml"]);
    const desktop = read([".github", "/workflows/", "desktop", "-release.yml"]);
    const shaBinding = "ZENFLOW_RELEASE_SOURCE_COMMIT: ${{ github.sha }}";
    const requiredReceipt = 'ZENFLOW_REQUIRE_CAPABILITY_RECEIPT: "true"';

    expect(deploy.split(shaBinding)).toHaveLength(4);
    expect(deploy.split(requiredReceipt)).toHaveLength(4);
    expect(desktop).toContain(shaBinding);
    expect(desktop).toContain(requiredReceipt);
  });

  it("writes one privacy-safe receipt inside each release artifact and validates it", () => {
    const integration = read(["scripts/", "feature-capability-build.cjs"]);
    const orchestrator = read(["scripts/", "run-shared-dist-build.mjs"]);

    expect(integration).toContain("config/feature-capability-release.json");
    expect(integration).toContain("dist/feature-capability-receipt.json");
    expect(integration).toContain("createFeatureCapabilityReceipt");
    expect(integration).toContain("validateFeatureCapabilityReceipt");
    expect(integration).toContain("git status --porcelain");
    expect(orchestrator).toContain("--write");
    expect(orchestrator).toContain("--validate");
  });
});
