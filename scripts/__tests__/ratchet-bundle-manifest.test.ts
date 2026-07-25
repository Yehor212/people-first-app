import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  RATCHET_BUNDLE_MANIFEST_RELATIVE_PATH,
  beginProductionWebBundleManifest,
  completeProductionWebBundleManifest,
  runRatchetBundleManifestCli,
  validateProductionWebBundleManifest,
} from "../ratchet-bundle-manifest";

const fixtureRoots: string[] = [];

function createFixtureRoot(): string {
  const rootDir = mkdtempSync(join(tmpdir(), "zenflow-ratchet-bundle-"));
  fixtureRoots.push(rootDir);

  mkdirSync(join(rootDir, "src"), { recursive: true });
  mkdirSync(join(rootDir, "public"), { recursive: true });
  writeFileSync(join(rootDir, "src", "main.ts"), "export const value = 1;\n");
  writeFileSync(join(rootDir, "public", "version.json"), '{"version":"test"}\n');
  writeFileSync(join(rootDir, "CHANGELOG.md"), "# Changelog\n\n- Initial fixture.\n");
  writeFileSync(join(rootDir, "index.html"), '<div id="root"></div>\n');
  writeFileSync(join(rootDir, "package.json"), '{"name":"ratchet-fixture"}\n');
  writeFileSync(join(rootDir, "package-lock.json"), '{"lockfileVersion":3}\n');
  writeFileSync(join(rootDir, "vite.config.ts"), "export default {};\n");

  return rootDir;
}

function finishProductionBuild(
  rootDir: string,
  files: Record<string, string> = {
    "assets/app.js": "export const app = true;\n",
    "assets/chunk.js": "export const chunk = true;\n",
  }
): void {
  rmSync(join(rootDir, "dist"), { recursive: true, force: true });
  mkdirSync(join(rootDir, "dist", "assets"), { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = join(rootDir, "dist", relativePath);
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, content);
  }
}

function createCompletedManifest(
  rootDir: string,
  env: Record<string, string | undefined> = {}
): void {
  beginProductionWebBundleManifest({
    rootDir,
    target: "web",
    mode: "production",
    env,
  });
  finishProductionBuild(rootDir);
  completeProductionWebBundleManifest({
    rootDir,
    target: "web",
    mode: "production",
    env,
  });
}

function mutateManifest(
  rootDir: string,
  mutate: (manifest: Record<string, unknown>) => void
): void {
  const manifestPath = join(rootDir, RATCHET_BUNDLE_MANIFEST_RELATIVE_PATH);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  mutate(manifest);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

afterEach(() => {
  for (const rootDir of fixtureRoots.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe("production-web ratchet bundle manifest", () => {
  it("rejects a symlinked dist before writing the clean-build sentinel outside the repository", () => {
    const rootDir = createFixtureRoot();
    const external = mkdtempSync(join(tmpdir(), "zenflow-ratchet-external-dist-"));
    fixtureRoots.push(external);
    symlinkSync(external, join(rootDir, "dist"), "dir");

    expect(() =>
      beginProductionWebBundleManifest({
        rootDir,
        target: "web",
        mode: "production",
        env: {},
      })
    ).toThrow(/dist.*(?:symbolic link|repository|real directory)/i);
    expect(existsSync(join(external, ".zenflow-ratchet-build-must-clean"))).toBe(false);
  });

  it("rejects a symlinked build-state directory before writing outside the repository", () => {
    const rootDir = createFixtureRoot();
    const external = mkdtempSync(join(tmpdir(), "zenflow-ratchet-external-state-"));
    fixtureRoots.push(external);
    mkdirSync(join(rootDir, "node_modules", ".cache"), { recursive: true });
    symlinkSync(external, join(rootDir, "node_modules", ".cache", "zenflow-ratchet"), "dir");

    expect(() =>
      beginProductionWebBundleManifest({
        rootDir,
        target: "web",
        mode: "production",
        env: {},
      })
    ).toThrow(/build state.*(?:symbolic link|real directory|repository)/i);
    expect(existsSync(join(external, "production-web-build-start.json"))).toBe(false);
  });

  it("accepts only a completed production-web artifact snapshot and returns its byte total", () => {
    const rootDir = createFixtureRoot();
    createCompletedManifest(rootDir);

    const evidence = validateProductionWebBundleManifest({ rootDir, env: {} });

    expect(evidence.target).toBe("web");
    expect(evidence.mode).toBe("production");
    expect(evidence.completed).toBe(true);
    expect(evidence.files.map((file) => file.path)).toEqual(["assets/app.js", "assets/chunk.js"]);
    expect(evidence.bundleSizeBytes).toBe(
      Buffer.byteLength("export const app = true;\n") +
        Buffer.byteLength("export const chunk = true;\n")
    );
  });

  it("rejects a missing manifest instead of treating the bundle as zero bytes", () => {
    const rootDir = createFixtureRoot();
    finishProductionBuild(rootDir);

    expect(() => validateProductionWebBundleManifest({ rootDir, env: {} })).toThrow(
      /bundle manifest is missing/i
    );
  });

  it("rejects an empty JavaScript artifact set at completion", () => {
    const rootDir = createFixtureRoot();
    beginProductionWebBundleManifest({
      rootDir,
      target: "web",
      mode: "production",
      env: {},
    });
    finishProductionBuild(rootDir, {});

    expect(() =>
      completeProductionWebBundleManifest({
        rootDir,
        target: "web",
        mode: "production",
        env: {},
      })
    ).toThrow(/no non-empty JavaScript artifacts/i);
  });

  it.each([
    ["target", "android", /target.*web/i],
    ["mode", "development", /mode.*production/i],
  ] as const)("rejects a manifest with the wrong %s", (field, value, expected) => {
    const rootDir = createFixtureRoot();
    createCompletedManifest(rootDir);
    mutateManifest(rootDir, (manifest) => {
      manifest[field] = value;
    });

    expect(() => validateProductionWebBundleManifest({ rootDir, env: {} })).toThrow(expected);
  });

  it("rejects an orphan JavaScript artifact absent from the manifest", () => {
    const rootDir = createFixtureRoot();
    createCompletedManifest(rootDir);
    writeFileSync(join(rootDir, "dist", "assets", "orphan.js"), "export const orphan = true;\n");

    expect(() => validateProductionWebBundleManifest({ rootDir, env: {} })).toThrow(
      /artifact inventory mismatch.*orphan\.js/i
    );
  });

  it("rejects Finder/FileProvider ordinal copies before recording a production manifest", () => {
    const rootDir = createFixtureRoot();
    beginProductionWebBundleManifest({
      rootDir,
      target: "web",
      mode: "production",
      env: {},
    });
    finishProductionBuild(rootDir, {
      "assets/app.js": "export const app = true;\n",
      "assets/app 2.js": "export const app = false;\n",
    });

    expect(() =>
      completeProductionWebBundleManifest({
        rootDir,
        target: "web",
        mode: "production",
        env: {},
      })
    ).toThrow(/duplicate generated artifact.*assets\/app 2\.js/i);
  });

  it("rejects a late ordinal copy anywhere in dist while allowing ordinary numeric names", () => {
    const rootDir = createFixtureRoot();
    createCompletedManifest(rootDir);
    writeFileSync(join(rootDir, "dist", "version2.json"), '{"allowed":true}\n');

    expect(() => validateProductionWebBundleManifest({ rootDir, env: {} })).not.toThrow();

    writeFileSync(join(rootDir, "dist", "404 2.html.gz"), "late conflict");
    expect(() => validateProductionWebBundleManifest({ rootDir, env: {} })).toThrow(
      /duplicate generated artifact.*404 2\.html\.gz/i
    );
  });

  it("rejects an artifact whose bytes no longer match the manifest hash", () => {
    const rootDir = createFixtureRoot();
    createCompletedManifest(rootDir);
    writeFileSync(join(rootDir, "dist", "assets", "app.js"), "export const app = fail;\n");

    expect(() => validateProductionWebBundleManifest({ rootDir, env: {} })).toThrow(
      /hash mismatch.*assets\/app\.js/i
    );
  });

  it("rejects artifacts that change between validation passes", () => {
    const rootDir = createFixtureRoot();
    createCompletedManifest(rootDir);

    expect(() =>
      validateProductionWebBundleManifest({
        rootDir,
        env: {},
        afterFirstArtifactPass: () => {
          writeFileSync(join(rootDir, "dist", "assets", "app.js"), "export const app = false;\n");
        },
      })
    ).toThrow(/artifacts changed while being validated/i);
  });

  it("rejects a manifest that does not declare build completion", () => {
    const rootDir = createFixtureRoot();
    createCompletedManifest(rootDir);
    mutateManifest(rootDir, (manifest) => {
      manifest.completed = false;
    });

    expect(() => validateProductionWebBundleManifest({ rootDir, env: {} })).toThrow(
      /completed.*true/i
    );
  });

  it("rejects a source tree that changed after the completed build snapshot", () => {
    const rootDir = createFixtureRoot();
    createCompletedManifest(rootDir);
    writeFileSync(join(rootDir, "src", "main.ts"), "export const value = 2;\n");

    expect(() => validateProductionWebBundleManifest({ rootDir, env: {} })).toThrow(
      /build input fingerprint mismatch/i
    );
  });

  it("rejects a changelog mutation because the Vite changelog plugin emits it into JavaScript", () => {
    const rootDir = createFixtureRoot();
    createCompletedManifest(rootDir);
    writeFileSync(join(rootDir, "CHANGELOG.md"), "# Changelog\n\n- Changed after build.\n");

    expect(() => validateProductionWebBundleManifest({ rootDir, env: {} })).toThrow(
      /build input fingerprint mismatch/i
    );
  });

  it("rejects a changed production env file because Vite loads it into import.meta.env", () => {
    const rootDir = createFixtureRoot();
    writeFileSync(join(rootDir, ".env.production"), "VITE_FIXTURE=before\n");
    createCompletedManifest(rootDir);
    writeFileSync(join(rootDir, ".env.production"), "VITE_FIXTURE=after\n");

    expect(() => validateProductionWebBundleManifest({ rootDir, env: {} })).toThrow(
      /build input fingerprint mismatch/i
    );
  });

  it("rejects changed Sentry build environment used by the Vite plugin", () => {
    const rootDir = createFixtureRoot();
    const buildEnv = {
      SENTRY_AUTH_TOKEN: "fixture-token-a",
      SENTRY_ORG: "fixture-org-a",
      SENTRY_PROJECT: "fixture-project",
    };
    createCompletedManifest(rootDir, buildEnv);

    expect(() =>
      validateProductionWebBundleManifest({
        rootDir,
        env: { ...buildEnv, SENTRY_ORG: "fixture-org-b" },
      })
    ).toThrow(/build input fingerprint mismatch/i);
  });

  it("rejects a top-level Tailwind content source changed after build", () => {
    const rootDir = createFixtureRoot();
    mkdirSync(join(rootDir, "pages"), { recursive: true });
    writeFileSync(join(rootDir, "pages", "fixture.tsx"), "export const className = 'p-4';\n");
    createCompletedManifest(rootDir);
    writeFileSync(join(rootDir, "pages", "fixture.tsx"), "export const className = 'p-8';\n");

    expect(() => validateProductionWebBundleManifest({ rootDir, env: {} })).toThrow(
      /build input fingerprint mismatch/i
    );
  });

  it("requires the production build to clean the pre-build sentinel", () => {
    const rootDir = createFixtureRoot();
    beginProductionWebBundleManifest({
      rootDir,
      target: "web",
      mode: "production",
      env: {},
    });
    mkdirSync(join(rootDir, "dist", "assets"), { recursive: true });
    writeFileSync(join(rootDir, "dist", "assets", "app.js"), "export const app = true;\n");

    expect(() =>
      completeProductionWebBundleManifest({
        rootDir,
        target: "web",
        mode: "production",
        env: {},
      })
    ).toThrow(/output directory was not cleaned/i);
  });

  it.each([
    ["android", "production", /target.*web/i],
    ["web", "development", /mode.*production/i],
  ] as const)("refuses to begin a %s/%s manifest", (target, mode, expected) => {
    const rootDir = createFixtureRoot();

    expect(() =>
      beginProductionWebBundleManifest({
        rootDir,
        target,
        mode,
        env: {},
      })
    ).toThrow(expected);
  });

  it("exposes an exact begin/complete CLI lifecycle for the production build pipeline", () => {
    const rootDir = createFixtureRoot();

    expect(
      runRatchetBundleManifestCli({
        argv: ["--bundle-manifest-begin", "--target", "web", "--mode", "production"],
        rootDir,
        env: {},
      })
    ).toBe(true);
    finishProductionBuild(rootDir);
    expect(
      runRatchetBundleManifestCli({
        argv: ["--bundle-manifest-complete", "--target", "web", "--mode", "production"],
        rootDir,
        env: {},
      })
    ).toBe(true);
    expect(() =>
      runRatchetBundleManifestCli({
        argv: ["--bundle-manifest-complete", "--target", "web", "--mode", "development"],
        rootDir,
        env: {},
      })
    ).toThrow(/mode.*production/i);
    expect(() =>
      runRatchetBundleManifestCli({
        argv: ["--bundle-manifest-begin", "--target", "web", "--mode", "production", "--unknown"],
        rootDir,
        env: {},
      })
    ).toThrow(/unknown bundle manifest option/i);
  });

  it("wires the ratchet metric to validated manifest evidence instead of a zero fallback", () => {
    const checker = readFileSync(join(process.cwd(), "scripts", "check-ratchet.ts"), "utf8");

    expect(checker).toContain("validateProductionWebBundleManifest");
    expect(checker).toContain("runRatchetBundleManifestCli");
    expect(checker).not.toMatch(/function measureBundleSizeKB[\s\S]*?return 0;[\s\S]*?\n\}/);
  });
});
