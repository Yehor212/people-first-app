import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function indexOfOrThrow(source: string, marker: string): number {
  const index = source.indexOf(marker);
  expect(index, `Expected workflow marker: ${marker}`).toBeGreaterThan(-1);
  return index;
}

function expectAscendingOrder(markers: Array<[string, number]>): void {
  for (let index = 1; index < markers.length; index += 1) {
    const [previousName, previousIndex] = markers[index - 1];
    const [currentName, currentIndex] = markers[index];
    expect(previousIndex, `${previousName} should run before ${currentName}`).toBeLessThan(currentIndex);
  }
}

describe("Sentry source-map build contract", () => {
  it("configures the Vite plugin for private production source-map uploads", () => {
    const pkg = JSON.parse(read("package.json")) as { devDependencies?: Record<string, string> };
    const viteConfig = read("vite.config.ts");

    expect(pkg.devDependencies?.["@sentry/vite-plugin"], "Sentry Vite plugin must be installed for source-map upload").toBeTruthy();
    expect(viteConfig).toContain('import { sentryVitePlugin } from "@sentry/vite-plugin"');
    expect(viteConfig).toContain("const sentrySourceMapUploadEnabled =");
    expect(viteConfig).toContain("process.env.SENTRY_AUTH_TOKEN");
    expect(viteConfig).toContain("process.env.SENTRY_ORG");
    expect(viteConfig).toContain("process.env.SENTRY_PROJECT");
    expect(viteConfig).toContain("sentryVitePlugin({");
    expect(viteConfig).toContain("release: {");
    expect(viteConfig).toContain("name: `zenflow@${appVersion}`");
    expect(viteConfig).toContain("sourcemaps: {");
    expect(viteConfig).toContain('filesToDeleteAfterUpload: ["./dist/**/*.map"]');
    expect(viteConfig).toContain('sourcemap: mode === "production" ? (sentrySourceMapUploadEnabled ? "hidden" : false) : mode === "development"');

    const pluginOrder = viteConfig.indexOf("sentryVitePlugin({");
    const normalizerOrder = viteConfig.indexOf("normalizeIndexBasePathPlugin(base)");
    expect(pluginOrder, "Sentry Vite plugin must be present").toBeGreaterThan(-1);
    expect(normalizerOrder, "normalizer plugin must be present").toBeGreaterThan(-1);
    expect(pluginOrder, "Sentry Vite plugin should run after other plugins").toBeGreaterThan(normalizerOrder);
  });

  it("does not enable Sentry source-map upload for placeholder upload env values", () => {
    const viteConfig = read("vite.config.ts");

    expect(viteConfig).toContain("function isPlaceholderSentryUploadValue");
    expect(viteConfig).toContain("function hasUsableSentryUploadEnv");
    expect(viteConfig).toContain("!isPlaceholderSentryUploadValue");
    expect(viteConfig).toContain('normalized.startsWith("your_")');
    expect(viteConfig).toContain('normalized.startsWith("set_")');
    expect(viteConfig).toContain("hasUsableSentryUploadEnv([");
    expect(viteConfig).toContain("process.env.SENTRY_AUTH_TOKEN");
    expect(viteConfig).toContain("process.env.SENTRY_ORG");
    expect(viteConfig).toContain("process.env.SENTRY_PROJECT");
    expect(viteConfig).toContain("const sentrySourceMapUploadEnabled =");
    expect(viteConfig).not.toContain(
      "Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT)",
    );
  });

  it("wires Sentry build-upload secrets into CI build steps without exposing values", () => {
    const deploy = read(".github/workflows/deploy.yml");
    const preview = read(".github/workflows/deploy-v2-preview.yml");

    for (const workflow of [deploy, preview]) {
      expect(workflow).toContain("SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}");
      expect(workflow).toContain("SENTRY_ORG: ${{ vars.SENTRY_ORG }}");
      expect(workflow).toContain("SENTRY_PROJECT: ${{ vars.SENTRY_PROJECT }}");
    }
  });

  it("keeps live Sentry proof strict only when upload env is configured", () => {
    const deploy = read(".github/workflows/deploy.yml");
    const preview = read(".github/workflows/deploy-v2-preview.yml");
    const uploadEnvRequiredExpression =
      "secrets.SENTRY_AUTH_TOKEN != '' && vars.SENTRY_ORG != '' && vars.SENTRY_PROJECT != ''";

    for (const workflow of [deploy, preview]) {
      expect(workflow).toContain("ZENFLOW_SENTRY_READINESS_REQUIRED: ${{ " + uploadEnvRequiredExpression + " }}");
      expect(workflow).toContain("ZENFLOW_SENTRY_API_REQUIRED: ${{ " + uploadEnvRequiredExpression + " }}");
      expect(workflow).toContain("npm run check:sentry-readiness");
      expect(workflow).toContain("npm run smoke:sentry-api");
    }

    const deployReadinessCount = (deploy.match(/npm run check:sentry-readiness/g) || []).length;
    const deploySmokeCount = (deploy.match(/npm run smoke:sentry-api/g) || []).length;
    const previewReadinessCount = (preview.match(/npm run check:sentry-readiness/g) || []).length;
    const previewSmokeCount = (preview.match(/npm run smoke:sentry-api/g) || []).length;
    expect(deploySmokeCount).toBe(deployReadinessCount);
    expect(previewSmokeCount).toBe(previewReadinessCount);

    expect(deploy.indexOf("npm run check:sentry-readiness")).toBeLessThan(
      deploy.indexOf("npm run smoke:sentry-api"),
    );
    expect(deploy.indexOf("npm run smoke:sentry-api")).toBeLessThan(
      deploy.indexOf("run: npm run build"),
    );
    expect(preview.indexOf("npm run check:sentry-readiness")).toBeLessThan(
      preview.indexOf("npm run smoke:sentry-api"),
    );
    expect(preview.indexOf("npm run smoke:sentry-api")).toBeLessThan(
      preview.indexOf("run: npm run build"),
    );
  });

  it("runs the Sentry artifact guard after CI build steps and final Pages artifact composition", () => {
    const deploy = read(".github/workflows/deploy.yml");
    const preview = read(".github/workflows/deploy-v2-preview.yml");

    for (const workflow of [deploy, preview]) {
      expect(workflow).toContain("npm run check:sentry-artifacts");
    }

    const deployBuild = indexOfOrThrow(deploy, "run: npm run build");
    const deployBuildGuard = indexOfOrThrow(deploy, "name: Check Sentry public artifacts");
    const deployPrepare = indexOfOrThrow(deploy, "name: Prepare GitHub Pages SPA artifact");
    const deployFinalGuard = indexOfOrThrow(deploy, "name: Check final Sentry public artifact");
    const deployUpload = indexOfOrThrow(deploy, "uses: actions/upload-pages-artifact@v5");
    expect(deployBuild).toBeLessThan(deployBuildGuard);
    expect(deployBuildGuard).toBeLessThan(deployPrepare);
    expect(deployPrepare).toBeLessThan(deployFinalGuard);
    expect(deployFinalGuard).toBeLessThan(deployUpload);

    const previewV2Build = indexOfOrThrow(preview, "name: Build V2 preview under /v2");
    const previewV2Guard = indexOfOrThrow(preview, "name: Check Sentry public artifacts for V2 preview");
    const previewV1Build = indexOfOrThrow(preview, "name: Build V1 public root from main");
    const previewV1Guard = indexOfOrThrow(preview, "name: Check Sentry public artifacts for V1 public root");
    const previewCompose = indexOfOrThrow(preview, "name: Compose GitHub Pages artifact");
    const previewFinalGuard = indexOfOrThrow(preview, "name: Check final Sentry combined Pages artifact");
    const previewUpload = indexOfOrThrow(preview, "name: Upload combined Pages artifact");
    expect(previewV2Build).toBeLessThan(previewV2Guard);
    expect(previewV1Build).toBeLessThan(previewV1Guard);
    expect(previewV2Guard).toBeLessThan(previewCompose);
    expect(previewV1Guard).toBeLessThan(previewCompose);
    expect(previewCompose).toBeLessThan(previewFinalGuard);
    expect(previewFinalGuard).toBeLessThan(previewUpload);

    expect(deploy).toContain("ZENFLOW_DIST_DIR: dist");
    expect(preview).toContain("ZENFLOW_DIST_DIR: pages");
  });


  it("keeps Sentry gates around Android and iOS native web-asset builds", () => {
    const deploy = read(".github/workflows/deploy.yml");

    const androidReadiness = indexOfOrThrow(deploy, "name: Check Sentry readiness for Android web assets");
    const androidSmoke = indexOfOrThrow(deploy, "name: Smoke Sentry API for Android web assets");
    const androidBuild = indexOfOrThrow(deploy, "name: Build Android web assets (required before cap sync)");
    const androidArtifactGuard = indexOfOrThrow(deploy, "name: Check Sentry public artifacts for Android web assets");
    const androidCapSync = indexOfOrThrow(deploy, "name: Capacitor sync (generates cordova.variables.gradle)");

    expectAscendingOrder([
      ["android readiness", androidReadiness],
      ["android api smoke", androidSmoke],
      ["android build", androidBuild],
      ["android artifact guard", androidArtifactGuard],
      ["android cap sync", androidCapSync],
    ]);

    const iosReadiness = indexOfOrThrow(deploy, "name: Check Sentry readiness for iOS web assets");
    const iosSmoke = indexOfOrThrow(deploy, "name: Smoke Sentry API for iOS web assets");
    const iosBuild = indexOfOrThrow(deploy, "name: Build iOS web assets");
    const iosArtifactGuard = indexOfOrThrow(deploy, "name: Check Sentry public artifacts for iOS web assets");
    const iosCapSync = indexOfOrThrow(deploy, "name: Capacitor sync iOS");

    expectAscendingOrder([
      ["ios readiness", iosReadiness],
      ["ios api smoke", iosSmoke],
      ["ios build", iosBuild],
      ["ios artifact guard", iosArtifactGuard],
      ["ios cap sync", iosCapSync],
    ]);

    for (const marker of ["run: npm run build:android", "run: npm run build:ios"]) {
      const buildIndex = indexOfOrThrow(deploy, marker);
      const precedingEnvBlock = deploy.slice(Math.max(0, buildIndex - 600), buildIndex);
      expect(precedingEnvBlock).toContain("SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}");
      expect(precedingEnvBlock).toContain("SENTRY_ORG: ${{ vars.SENTRY_ORG }}");
      expect(precedingEnvBlock).toContain("SENTRY_PROJECT: ${{ vars.SENTRY_PROJECT }}");
    }
  });

  it("does not leave malformed adjacent workflow step names", () => {
    const deploy = read(".github/workflows/deploy.yml");
    const preview = read(".github/workflows/deploy-v2-preview.yml");

    for (const workflow of [deploy, preview]) {
      const adjacentStepNames = new RegExp("\\n\\s*- name:[^\\n]+\\n\\s*- name:");
      expect(workflow).not.toMatch(adjacentStepNames);
    }
  });

});
