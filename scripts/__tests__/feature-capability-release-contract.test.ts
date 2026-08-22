import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("journal save ceremony release capability contract", () => {
  it("routes all four production targets through the shared build owner", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

    expect(pkg.scripts.build).toContain("--target web --mode production");
    expect(pkg.scripts["build:android"]).toContain("--target android --mode production");
    expect(pkg.scripts["build:ios"]).toContain("--target ios --mode production");
    expect(pkg.scripts["build:tauri"]).toContain("--target tauri --mode production");
  });

  it("assigns the explicit web target to local Vite serve commands", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

    expect(pkg.scripts.dev).toContain(
      "ZENFLOW_FEATURE_CAPABILITY_PLATFORM=web-pages",
    );
    expect(pkg.scripts.preview).toContain(
      "ZENFLOW_FEATURE_CAPABILITY_PLATFORM=web-pages",
    );
  });

  it("creates one target-specific receipt inside every production build plan", () => {
    const sharedBuild = read("scripts/run-shared-dist-build.mjs");

    expect(sharedBuild).toContain('"tauri:production"');
    expect(sharedBuild).toContain('"web-pages"');
    expect(sharedBuild).toContain('"feature-capability-build.cjs"');
    expect(sharedBuild).toContain('"--write-receipt"');
    expect(sharedBuild).toContain("ZENFLOW_FEATURE_CAPABILITY_PLATFORM");
  });

  it("keeps production Vite admission behind the guarded capability decision", () => {
    const vite = read("vite.config.ts");
    const env = read("src/lib/env.ts");

    expect(vite).toContain("journalSaveCeremonyBuildDecision");
    expect(vite).toContain("ZENFLOW_FEATURE_CAPABILITY_PLATFORM");
    expect(vite).not.toMatch(
      /const journalSaveCeremonyBuildEnabled\s*=\s*\n?\s*\(process\.env\.VITE_ENABLE_JOURNAL_SAVE_CEREMONY/,
    );
    expect(env).not.toContain(
      'import.meta.env.VITE_ENABLE_JOURNAL_SAVE_CEREMONY === "true"',
    );
  });

  it("uses the shared Tauri build entry instead of a second handwritten Vite path", () => {
    const tauri = JSON.parse(read("src-tauri/tauri.conf.json")) as {
      build: { beforeBuildCommand: string };
    };

    expect(tauri.build.beforeBuildCommand).toBe("npm run build:tauri");
  });

  it("validates the exact receipt after Pages, Android, iOS, and Desktop builds", () => {
    const deploy = read(".github/workflows/deploy.yml");
    const desktop = read(".github/workflows/desktop-release.yml");

    expect(
      deploy.match(/node scripts\/check-feature-capability-receipt\.cjs --platform web-pages/g),
    ).toHaveLength(1);
    expect(
      deploy.match(/node scripts\/check-feature-capability-receipt\.cjs --platform android/g),
    ).toHaveLength(1);
    expect(
      deploy.match(/node scripts\/check-feature-capability-receipt\.cjs --platform ios/g),
    ).toHaveLength(1);
    expect(desktop).toContain(
      "node scripts/check-feature-capability-receipt.cjs --platform tauri",
    );
  });

  it("tracks one explicit non-enabling policy with an active rollback kill switch", () => {
    const policy = JSON.parse(read("config/feature-capabilities.json")) as {
      schemaVersion: number;
      capabilities: {
        journalSaveCeremony: {
          requested: boolean;
          killSwitch: boolean;
          admission: Record<string, string>;
        };
      };
    };

    expect(policy.schemaVersion).toBe(1);
    expect(policy.capabilities.journalSaveCeremony.requested).toBe(false);
    expect(policy.capabilities.journalSaveCeremony.killSwitch).toBe(true);
    expect(Object.values(policy.capabilities.journalSaveCeremony.admission)).toEqual([
      "unverified",
      "unverified",
      "unverified",
      "unverified",
      "unverified",
      "unverified",
    ]);
  });
});
