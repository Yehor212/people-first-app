import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const integration = require("../feature-capability-build.cjs") as {
  resolveFeatureCapabilityBuildEnvironment(options: Record<string, unknown>): NodeJS.ProcessEnv;
  writeFeatureCapabilityReceipt(options: Record<string, unknown>): unknown;
  validateFeatureCapabilityReceiptArtifact(options: Record<string, unknown>): unknown;
};

const SOURCE_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const OTHER_COMMIT = "89abcdef0123456789abcdef0123456789abcdef";
const roots: string[] = [];

const policy = {
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
};

function fixtureRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "zenflow-feature-capability-"));
  roots.push(root);
  mkdirSync(path.join(root, "config"));
  mkdirSync(path.join(root, "dist"));
  writeFileSync(
    path.join(root, "config", "feature-capability-release.json"),
    `${JSON.stringify(policy, null, 2)}\n`,
  );
  return root;
}

const cleanGit = () => ({ sourceCommit: SOURCE_COMMIT, clean: true });

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("feature capability build boundary", () => {
  it("keeps non-release builds disabled and emits no source-commit claim", () => {
    const env = integration.resolveFeatureCapabilityBuildEnvironment({
      rootDir: fixtureRoot(),
      platform: "web-pages",
      mode: "production",
      env: {},
      probeGitState: cleanGit,
    });

    expect(env.ZENFLOW_JOURNAL_SAVE_CEREMONY_BUILD_ENABLED).toBe("false");
    expect(env.ZENFLOW_REQUIRE_CAPABILITY_RECEIPT).toBe("false");
    expect(env.ZENFLOW_RELEASE_SOURCE_COMMIT).toBeUndefined();
  });

  it("rejects raw enablement attempts outside the shared release policy", () => {
    expect(() =>
      integration.resolveFeatureCapabilityBuildEnvironment({
        rootDir: fixtureRoot(),
        platform: "android",
        mode: "production",
        env: { VITE_ENABLE_JOURNAL_SAVE_CEREMONY: "true" },
        probeGitState: cleanGit,
      }),
    ).toThrow(/RAW_ENABLEMENT/);
  });

  it("requires an exact clean checkout when a release receipt is mandatory", () => {
    const rootDir = fixtureRoot();
    const base = {
      rootDir,
      platform: "ios",
      mode: "production",
      env: {
        ZENFLOW_REQUIRE_CAPABILITY_RECEIPT: "true",
        ZENFLOW_RELEASE_SOURCE_COMMIT: SOURCE_COMMIT,
      },
    };

    expect(() =>
      integration.resolveFeatureCapabilityBuildEnvironment({
        ...base,
        probeGitState: () => ({ sourceCommit: OTHER_COMMIT, clean: true }),
      }),
    ).toThrow(/SOURCE_COMMIT_MISMATCH/);
    expect(() =>
      integration.resolveFeatureCapabilityBuildEnvironment({
        ...base,
        probeGitState: () => ({ sourceCommit: SOURCE_COMMIT, clean: false }),
      }),
    ).toThrow(/DIRTY_RELEASE_SOURCE/);
  });

  it("derives the release flag from the policy and carries only guarded build metadata", () => {
    const env = integration.resolveFeatureCapabilityBuildEnvironment({
      rootDir: fixtureRoot(),
      platform: "tauri",
      mode: "production",
      env: {
        ZENFLOW_REQUIRE_CAPABILITY_RECEIPT: "true",
        ZENFLOW_RELEASE_SOURCE_COMMIT: SOURCE_COMMIT,
      },
      probeGitState: cleanGit,
    });

    expect(env).toMatchObject({
      ZENFLOW_REQUIRE_CAPABILITY_RECEIPT: "true",
      ZENFLOW_RELEASE_SOURCE_COMMIT: SOURCE_COMMIT,
      ZENFLOW_FEATURE_CAPABILITY_PLATFORM: "tauri",
      ZENFLOW_JOURNAL_SAVE_CEREMONY_BUILD_ENABLED: "false",
    });
  });

  it("writes and validates the target receipt without user or host fields", () => {
    const rootDir = fixtureRoot();
    const env = integration.resolveFeatureCapabilityBuildEnvironment({
      rootDir,
      platform: "web-pages",
      mode: "production",
      env: {
        ZENFLOW_REQUIRE_CAPABILITY_RECEIPT: "true",
        ZENFLOW_RELEASE_SOURCE_COMMIT: SOURCE_COMMIT,
      },
      probeGitState: cleanGit,
    });

    integration.writeFeatureCapabilityReceipt({ rootDir, env, probeGitState: cleanGit });
    const receiptPath = path.join(rootDir, "dist", "feature-capability-receipt.json");
    const serialized = readFileSync(receiptPath, "utf8");

    expect(JSON.parse(serialized)).toMatchObject({
      sourceCommit: SOURCE_COMMIT,
      platform: "web-pages",
      capabilities: { journalSaveCeremony: false },
    });
    expect(serialized).not.toMatch(
      /"(?:user|userId|account|accountId|journalContent|token|hostname|absolutePath)"\s*:/,
    );
    expect(
      integration.validateFeatureCapabilityReceiptArtifact({
        rootDir,
        env,
        probeGitState: cleanGit,
      }),
    ).toMatchObject({ sourceCommit: SOURCE_COMMIT, platform: "web-pages" });
  });
});
