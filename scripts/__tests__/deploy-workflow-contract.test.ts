import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function indexOfOrThrow(source: string, marker: string): number {
  const index = source.indexOf(marker);
  expect(index, `Expected workflow marker: ${marker}`).toBeGreaterThan(-1);
  return index;
}

function sliceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = indexOfOrThrow(source, startMarker);
  const end = indexOfOrThrow(source, endMarker);
  expect(start, `${startMarker} should be before ${endMarker}`).toBeLessThan(end);
  return source.slice(start, end);
}

function extractConcurrencyGroup(source: string): string {
  const match = source.match(/concurrency:\n\s+group:\s+([^\n]+)/);
  expect(match?.[1], "workflow must declare a top-level concurrency group").toBeTruthy();
  return match![1].trim().replace(/^['"]|['"]$/g, "");
}
const WORKFLOW_FILES = [
  ".github/workflows/deploy.yml",
  ".github/workflows/deploy-v2-preview.yml",
  ".github/workflows/telegram-control.yml",
  ".github/workflows/visual-regression.yml",
  ".github/workflows/desktop-release.yml",
  ".github/workflows/drift-checks.yml",
  ".github/workflows/claude-agent.yml",
  ".github/workflows/claude-review.yml",
] as const;

function findMutableActionRefs(source: string): string[] {
  const mutable: string[] = [];
  const actionRefPattern = /uses:\s+([^@\s]+)@([^\s#]+)/g;
  let match: RegExpExecArray | null;
  while ((match = actionRefPattern.exec(source)) !== null) {
    const [, action, ref] = match;
    if (action.startsWith("./") || /^[a-f0-9]{40}$/i.test(ref)) continue;
    mutable.push(action + "@" + ref);
  }
  return mutable;
}

describe("GitHub Pages deploy workflow contract", () => {
  it("validates Telegram Control base_ref before checkout and install", () => {
    const workflow = readFileSync(".github/workflows/telegram-control.yml", "utf8");

    const validation = indexOfOrThrow(workflow, "name: Validate trusted base ref");
    const checkout = indexOfOrThrow(workflow, "name: Checkout base ref");
    const install = indexOfOrThrow(workflow, "name: Install dependencies");

    expect(validation).toBeLessThan(checkout);
    expect(validation).toBeLessThan(install);
    expect(workflow).toContain(
      'if [ "$BASE_REF" != "main" ] && [ "$BASE_REF" != "refs/heads/main" ]; then'
    );
    expect(workflow).toContain("Only main is trusted for Telegram Control checkout.");
  });

  it("keeps Telegram Control write tokens scoped away from global env and scans artifacts before upload", () => {
    const workflow = readFileSync(".github/workflows/telegram-control.yml", "utf8");
    const topEnv = sliceBetween(workflow, "env:", "jobs:");
    const checkoutStep = sliceBetween(
      workflow,
      "name: Checkout base ref",
      "name: Prepare callback helper"
    );
    const dispatchStep = sliceBetween(
      workflow,
      "name: Dispatch production deploy workflow",
      "name: Optional Snyk code scan"
    );
    const publishStep = sliceBetween(
      workflow,
      "name: Publish branch and PR",
      "name: Final callback for non-Codex modes"
    );
    const artifactScan = indexOfOrThrow(workflow, "name: Scan control artifacts before upload");
    const upload = indexOfOrThrow(workflow, "name: Upload control artifacts");

    expect(topEnv).not.toContain("GH_TOKEN:");
    expect(checkoutStep).toContain("persist-credentials: false");
    expect(dispatchStep).toContain("GH_TOKEN: ${{ github.token }}");
    expect(publishStep).toContain("GH_TOKEN: ${{ github.token }}");
    expect(artifactScan).toBeLessThan(upload);
  });

  it("pins external GitHub Actions to full commit SHAs", () => {
    const mutableRefs = WORKFLOW_FILES.flatMap((file) =>
      findMutableActionRefs(readFileSync(file, "utf8")).map((ref) => file + ": " + ref)
    );

    expect(mutableRefs).toEqual([]);
  });

  it("uses the repository typecheck script instead of an ineffective root tsc invocation", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");

    expect(workflow).toContain("run: npm run typecheck");
    expect(workflow).not.toContain("run: npx tsc --noEmit");
  });
  it("does not auto-deploy preview branches to the production GitHub Pages environment", () => {
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    expect(previewWorkflow).toContain("workflow_dispatch:");
    expect(previewWorkflow).toContain("publish_target:");
    expect(previewWorkflow).toContain("artifact-only");
    expect(previewWorkflow).toContain("overwrite-github-pages");
    expect(previewWorkflow).toContain(
      "github.event.inputs.publish_target == 'overwrite-github-pages'"
    );
    expect(previewWorkflow).not.toContain("push:");
    expect(previewWorkflow).not.toContain("codex/journal-v2-hub");
    expect(previewWorkflow).not.toContain("VITE_DISABLE_PWA");
  });

  it("keeps artifact-only V2 previews isolated but serializes overwrites with production Pages", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    expect(extractConcurrencyGroup(workflow)).toBe("pages");
    expect(previewWorkflow).toContain(
      "group: ${{ github.event.inputs.publish_target == 'overwrite-github-pages' && 'pages' || 'pages-v2-preview' }}"
    );
    expect(previewWorkflow).toContain(
      "cancel-in-progress: ${{ github.event.inputs.publish_target != 'overwrite-github-pages' }}"
    );
  });

  it("guards explicit V2 production overwrites to main before Pages upload", () => {
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");
    const validationStep = sliceBetween(
      previewWorkflow,
      "name: Validate production overwrite source",
      "name: Setup Node"
    );
    const uploadStep = sliceBetween(previewWorkflow, "name: Upload V2 Pages artifact", "deploy:");

    expect(validationStep).toContain(
      "github.event.inputs.publish_target == 'overwrite-github-pages'"
    );
    expect(validationStep).toContain('if [ "$GITHUB_REF" != "refs/heads/main" ]; then');
    expect(uploadStep).toContain(
      "github.event.inputs.publish_target == 'overwrite-github-pages' && github.ref == 'refs/heads/main'"
    );
  });

  it("scopes Pages write and OIDC permissions to deploy jobs", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    const productionTopPermissions = sliceBetween(workflow, "permissions:", "concurrency:");
    const previewTopPermissions = sliceBetween(previewWorkflow, "permissions:", "concurrency:");
    expect(productionTopPermissions).toContain("contents: read");
    expect(productionTopPermissions).not.toContain("pages: write");
    expect(productionTopPermissions).not.toContain("id-token: write");
    expect(previewTopPermissions).toContain("contents: read");
    expect(previewTopPermissions).not.toContain("pages: write");
    expect(previewTopPermissions).not.toContain("id-token: write");

    const productionDeployJob = sliceBetween(workflow, "deploy:", "public-auth-smoke:");
    const previewDeployJob = previewWorkflow.slice(indexOfOrThrow(previewWorkflow, "deploy:"));
    for (const deployJob of [productionDeployJob, previewDeployJob]) {
      expect(deployJob).toContain("permissions:");
      expect(deployJob).toContain("contents: read");
      expect(deployJob).toContain("pages: write");
      expect(deployJob).toContain("id-token: write");
    }
  });

  it("preserves hidden GitHub Pages files in uploaded artifacts", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    for (const source of [workflow, previewWorkflow]) {
      expect(source).toMatch(
        /uses: actions\/upload-pages-artifact@[a-f0-9]{40}\s+# v5[\s\S]*include-hidden-files: true/
      );
    }
  });

  it("runs staged artifact integrity and smoke gates before Pages upload", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    expect(workflow).toContain("npm run check:release-artifacts");
    expect(workflow).toContain("npm run stage:release-artifacts");
    expect(workflow).toContain("npm run check:staged-release-artifacts");
    expect(previewWorkflow).toContain("npm run check:release-artifacts");
    expect(previewWorkflow).toContain("npm run stage:release-artifacts");
    expect(previewWorkflow).toContain("npm run check:staged-release-artifacts");

    const prepare = indexOfOrThrow(workflow, "name: Prepare GitHub Pages SPA artifact");
    const duplicateGate = indexOfOrThrow(workflow, "name: Check final duplicate release artifacts");
    const stage = indexOfOrThrow(workflow, "name: Stage Pages release artifact");
    const stagedIntegrity = indexOfOrThrow(
      workflow,
      "name: Check staged release artifact integrity"
    );
    const stagedSmoke = indexOfOrThrow(workflow, "name: Run staged deploy smoke tests");
    const stagedPwaOffline = indexOfOrThrow(workflow, "name: Run staged PWA offline tests");
    const upload = indexOfOrThrow(workflow, "uses: actions/upload-pages-artifact@");
    expect(prepare).toBeLessThan(duplicateGate);
    expect(duplicateGate).toBeLessThan(stage);
    expect(stage).toBeLessThan(stagedIntegrity);
    expect(stagedIntegrity).toBeLessThan(stagedSmoke);
    expect(stagedSmoke).toBeLessThan(stagedPwaOffline);
    expect(stagedPwaOffline).toBeLessThan(upload);
    expect(workflow).toContain("path: output/pages-artifact.nosync");
    expect(workflow).toContain("ZENFLOW_PLAYWRIGHT_PREVIEW_DIR: output/pages-artifact.nosync");
    expect(workflow).toContain("ZENFLOW_PWA_OFFLINE_PREVIEW_DIR: output/pages-artifact.nosync");
    expect(workflow).toContain("ZENFLOW_PWA_OFFLINE_SKIP_BUILD: true");

    const previewPrepare = indexOfOrThrow(
      previewWorkflow,
      "name: Prepare V2 GitHub Pages artifact"
    );
    const previewDuplicateGate = indexOfOrThrow(
      previewWorkflow,
      "name: Check final duplicate release artifacts for V2 preview"
    );
    const previewStage = indexOfOrThrow(previewWorkflow, "name: Stage V2 Pages release artifact");
    const previewIntegrity = indexOfOrThrow(
      previewWorkflow,
      "name: Check staged release artifact integrity for V2 preview"
    );
    const previewUpload = indexOfOrThrow(previewWorkflow, "name: Upload V2 Pages artifact");
    expect(previewPrepare).toBeLessThan(previewDuplicateGate);
    expect(previewDuplicateGate).toBeLessThan(previewStage);
    expect(previewStage).toBeLessThan(previewIntegrity);
    expect(previewIntegrity).toBeLessThan(previewUpload);
    expect(previewWorkflow).toContain("path: v2-src/output/pages-artifact.nosync");
  });

  it("runs staged PWA audio range tests before Pages upload", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts["test:e2e:v2:pwa-audio-range"]).toBe(
      "playwright test e2e/pwa-audio-range.spec.ts --config=e2e/helpers/pwa-offline/playwright.config.ts"
    );
    expect(workflow).toContain("name: Run staged PWA audio range tests");
    expect(workflow).toContain(
      "npm run test:e2e:v2:pwa-audio-range -- --project=pwa-offline-chromium-phone"
    );
    expect(previewWorkflow).toContain("name: Run V2 overwrite staged PWA audio range tests");
    expect(previewWorkflow).toContain(
      "npm run test:e2e:v2:pwa-audio-range -- --project=pwa-offline-chromium-phone"
    );

    const stagedPwaOffline = indexOfOrThrow(workflow, "name: Run staged PWA offline tests");
    const stagedAudioRange = indexOfOrThrow(workflow, "name: Run staged PWA audio range tests");
    const upload = indexOfOrThrow(workflow, "uses: actions/upload-pages-artifact@");
    expect(stagedPwaOffline).toBeLessThan(stagedAudioRange);
    expect(stagedAudioRange).toBeLessThan(upload);

    const previewPwaOffline = indexOfOrThrow(
      previewWorkflow,
      "name: Run V2 overwrite staged PWA offline tests"
    );
    const previewAudioRange = indexOfOrThrow(
      previewWorkflow,
      "name: Run V2 overwrite staged PWA audio range tests"
    );
    const previewUpload = indexOfOrThrow(previewWorkflow, "name: Upload V2 Pages artifact");
    expect(previewPwaOffline).toBeLessThan(previewAudioRange);
    expect(previewAudioRange).toBeLessThan(previewUpload);
  });

  it("lets the PWA offline harness serve the already-staged artifact", () => {
    const pwaConfig = readFileSync("e2e/helpers/pwa-offline/playwright.config.ts", "utf8");
    const pwaServer = readFileSync("e2e/helpers/pwa-offline/serve-pwa-preview.mjs", "utf8");

    expect(pwaConfig).toContain("ZENFLOW_PWA_OFFLINE_SKIP_BUILD");
    expect(pwaServer).toContain("ZENFLOW_PWA_OFFLINE_PREVIEW_DIR");
  });

  it("keeps ci preflight on the npm build path so postbuild release guards run", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts["ci:preflight"]).toContain("npm run build");
    expect(pkg.scripts["ci:preflight"]).not.toContain("vite build --configLoader runner");
    expect(pkg.scripts["prune:release-artifacts"]).toBe(
      "node scripts/prune-duplicate-artifacts.cjs dist"
    );
    expect(pkg.scripts["check:release-artifacts"]).toBe(
      "node scripts/prune-duplicate-artifacts.cjs dist --verify"
    );
    expect(pkg.scripts["check:staged-release-artifacts"]).toBe(
      "node scripts/check-release-artifact-integrity.cjs"
    );
    expect(pkg.scripts["stage:release-artifacts"]).toBe("node scripts/stage-release-artifact.cjs");
  });

  it("wires release workflow contract tests into blocking deploy CI", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts["test:release-contracts"]).toContain(
      "scripts/__tests__/deploy-workflow-contract.test.ts"
    );
    expect(pkg.scripts["test:release-contracts"]).toContain(
      "scripts/__tests__/release-artifact-integrity.test.ts"
    );
    expect(pkg.scripts["test:release-contracts"]).toContain(
      "scripts/__tests__/check-v2-paper-theme.test.ts"
    );
    expect(workflow).toContain("run: npm run test:release-contracts");
    expect(indexOfOrThrow(workflow, "run: npm run test:release-contracts")).toBeLessThan(
      indexOfOrThrow(workflow, "name: Build")
    );
  });

  it("keeps artifact-only V2 preview runs reviewable without overwriting production Pages", () => {
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    expect(previewWorkflow).toContain("name: Upload V2 preview artifact for review");
    expect(previewWorkflow).toContain("github.event.inputs.publish_target == 'artifact-only'");
    expect(previewWorkflow).toContain("uses: actions/upload-artifact@");
    expect(previewWorkflow).toContain("path: v2-src/output/pages-artifact.nosync");
  });

  it("keeps sync test credentials out of the staged preview server and uploaded logs", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const syncDrillStep = sliceBetween(
      workflow,
      "name: Run Telegram sync drill",
      "name: Upload Telegram sync drill artifact"
    );

    expect(syncDrillStep).not.toContain(
      "ZENFLOW_SYNC_TEST_EMAIL: ${{ secrets.ZENFLOW_SYNC_TEST_EMAIL }}"
    );
    expect(syncDrillStep).not.toContain(
      "ZENFLOW_SYNC_TEST_PASSWORD: ${{ secrets.ZENFLOW_SYNC_TEST_PASSWORD }}"
    );
    expect(syncDrillStep).toContain("SYNC_TEST_EMAIL: ${{ secrets.ZENFLOW_SYNC_TEST_EMAIL }}");
    expect(syncDrillStep).toContain(
      "SYNC_TEST_PASSWORD: ${{ secrets.ZENFLOW_SYNC_TEST_PASSWORD }}"
    );
    expect(syncDrillStep).toContain('SYNC_TEST_EMAIL_VALUE="${SYNC_TEST_EMAIL:-}"');
    expect(syncDrillStep).toContain('SYNC_TEST_PASSWORD_VALUE="${SYNC_TEST_PASSWORD:-}"');
    expect(syncDrillStep).toContain(
      "unset SYNC_TEST_EMAIL SYNC_TEST_PASSWORD ZENFLOW_SYNC_TEST_EMAIL ZENFLOW_SYNC_TEST_PASSWORD"
    );
    expect(syncDrillStep).toContain('ZENFLOW_SYNC_TEST_EMAIL="$SYNC_TEST_EMAIL_VALUE"');
    expect(syncDrillStep).toContain("Secret material leaked into uploaded sync drill artifacts");
  });

  it("uses reproducible dependency installs and aligned audit severity in deploy and visual workflows", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");
    const visualWorkflow = readFileSync(".github/workflows/visual-regression.yml", "utf8");

    for (const source of [workflow, previewWorkflow, visualWorkflow]) {
      expect(source).toContain("run: npm ci");
      expect(source).not.toContain("run: npm install");
    }

    expect(workflow).toContain("npm audit --audit-level=high");
    expect(workflow).not.toContain("npm audit --audit-level=critical");
  });

  it("runs V2 Orb/nav visual baselines in the visual regression workflow", () => {
    const visualWorkflow = readFileSync(".github/workflows/visual-regression.yml", "utf8");

    expect(visualWorkflow).toContain("e2e/nav-v2.spec.ts-snapshots");
    expect(visualWorkflow).toContain("npm run test:e2e:v2:visual -- --workers=1");
    expect(visualWorkflow).not.toContain("npx playwright test e2e/design-system.spec.ts\n");
  });

  it("runs the V2 Orb performance gate against the staged Pages artifact before upload", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");

    expect(workflow).toContain("name: Run staged V2 Orb performance tests");
    expect(workflow).toContain("ZENFLOW_PLAYWRIGHT_PREVIEW_DIR: output/pages-artifact.nosync");
    expect(workflow).toContain("e2e/orb-user-flow-performance.spec.ts");
    expect(workflow).toContain("--workers=1 --retries=0");
    expect(workflow).toContain("name: Upload V2 Orb performance diagnostics");
    expect(workflow).toContain("!cancelled() && failure()");
    expect(workflow).toContain("output/playwright/orb-user-flow-performance-2026-07-01/**");
    expect(workflow).toContain("test-results/orb-user-flow-performance-*/**");
    const stagedPerf = indexOfOrThrow(workflow, "name: Run staged V2 Orb performance tests");
    const perfDiagnostics = indexOfOrThrow(
      workflow,
      "name: Upload V2 Orb performance diagnostics"
    );
    const stagedVisual = indexOfOrThrow(workflow, "name: Run staged V2 visual regression tests");
    expect(stagedPerf).toBeLessThan(perfDiagnostics);
    expect(perfDiagnostics).toBeLessThan(stagedVisual);
    expect(stagedPerf).toBeLessThan(indexOfOrThrow(workflow, "name: Upload artifact"));
  });

  it("blocks Pages uploads on deep i18n and staged V2 runtime release gates", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    const productionDeepI18n = indexOfOrThrow(workflow, "name: Check deep i18n audit");
    expect(workflow).toContain("run: npm run i18n:deep");
    expect(productionDeepI18n).toBeLessThan(indexOfOrThrow(workflow, "name: Build"));

    const productionStagedVisual = indexOfOrThrow(
      workflow,
      "name: Run staged V2 visual regression tests"
    );
    expect(workflow).toContain("npm run test:e2e:v2:visual -- --workers=1");
    expect(productionStagedVisual).toBeLessThan(indexOfOrThrow(workflow, "name: Upload artifact"));

    const previewVerify = sliceBetween(
      previewWorkflow,
      "name: Verify V2-only shell",
      "name: Check hosted auth providers for V2 preview"
    );
    expect(previewVerify).toContain("npm run i18n:deep");

    const overwriteReleaseGates = sliceBetween(
      previewWorkflow,
      "name: Run production overwrite release gates",
      "name: Build V2 public root"
    );
    expect(overwriteReleaseGates).toContain(
      "github.event.inputs.publish_target == 'overwrite-github-pages'"
    );
    expect(overwriteReleaseGates).toContain("npm audit --audit-level=high");
    expect(overwriteReleaseGates).toContain("npm run check:task-completion");
    expect(overwriteReleaseGates).toContain("npm run check:best-practices");
    expect(overwriteReleaseGates).toContain("npm run test:release-contracts");

    const previewStagedSmoke = indexOfOrThrow(
      previewWorkflow,
      "name: Run V2 overwrite staged deploy smoke tests"
    );
    const previewStagedPwa = indexOfOrThrow(
      previewWorkflow,
      "name: Run V2 overwrite staged PWA offline tests"
    );
    const previewStagedOrbPerf = indexOfOrThrow(
      previewWorkflow,
      "name: Run V2 overwrite staged Orb performance tests"
    );
    const previewStagedVisual = indexOfOrThrow(
      previewWorkflow,
      "name: Run V2 overwrite staged visual regression tests"
    );
    const previewUpload = indexOfOrThrow(previewWorkflow, "name: Upload V2 Pages artifact");
    expect(previewStagedSmoke).toBeLessThan(previewStagedPwa);
    expect(previewStagedPwa).toBeLessThan(previewStagedOrbPerf);
    expect(previewStagedOrbPerf).toBeLessThan(previewStagedVisual);
    expect(previewStagedVisual).toBeLessThan(previewUpload);
    expect(previewWorkflow).toContain(
      "ZENFLOW_PLAYWRIGHT_PREVIEW_DIR: output/pages-artifact.nosync"
    );
    expect(previewWorkflow).toContain(
      "ZENFLOW_PWA_OFFLINE_PREVIEW_DIR: output/pages-artifact.nosync"
    );
    expect(previewWorkflow).toContain("npm run test:e2e:v2:visual -- --workers=1");
  });

  it("hard-blocks native gates and verifies native public assets after sync", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts["check:release-artifacts:android"]).toBe(
      "node scripts/prune-duplicate-artifacts.cjs android/app/src/main/assets/public --verify"
    );
    expect(pkg.scripts["check:release-artifacts:ios"]).toBe(
      "node scripts/prune-duplicate-artifacts.cjs ios/App/App/public --verify"
    );
    expect(pkg.scripts["cap:sync"]).toContain("npm run check:release-artifacts:android");
    expect(pkg.scripts["cap:sync"]).toContain("npm run check:release-artifacts:ios");
    expect(pkg.scripts["cap:sync:android"]).toContain("npm run check:release-artifacts:android");
    expect(pkg.scripts["cap:sync:ios"]).toContain("npm run check:release-artifacts:ios");

    const androidGate = sliceBetween(workflow, "android-gate:", "ios-gate:");
    expect(androidGate).not.toContain("continue-on-error: true");
    expect(androidGate).toContain("npm run check:release-artifacts:android");

    const androidSync = indexOfOrThrow(
      androidGate,
      "name: Capacitor sync (generates cordova.variables.gradle)"
    );
    const androidPostSyncGate = indexOfOrThrow(
      androidGate,
      "name: Check Android synced duplicate release artifacts"
    );
    const androidAssemble = indexOfOrThrow(androidGate, "name: Android assembleDebug");
    expect(androidSync).toBeLessThan(androidPostSyncGate);
    expect(androidPostSyncGate).toBeLessThan(androidAssemble);

    const iosGate = sliceBetween(workflow, "ios-gate:", "deploy:");
    expect(iosGate).toContain("npm run check:release-artifacts:ios");
    const iosSync = indexOfOrThrow(iosGate, "name: Capacitor sync iOS");
    const iosPostSyncGate = indexOfOrThrow(
      iosGate,
      "name: Check iOS synced duplicate release artifacts"
    );
    const iosBuild = indexOfOrThrow(iosGate, "name: Build iOS simulator");
    expect(iosSync).toBeLessThan(iosPostSyncGate);
    expect(iosPostSyncGate).toBeLessThan(iosBuild);
  });

  it("production Pages deploy waits for native release gates", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const deployJob = sliceBetween(workflow, "deploy:", "public-auth-smoke:");

    expect(deployJob).toContain("needs: [build, android-gate, ios-gate]");
    expect(deployJob).not.toContain("web deploy waits only for web release gates");
  });

  it("blocks artifact uploads when their redaction or leak scan fails", () => {
    const deployWorkflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const telegramWorkflow = readFileSync(".github/workflows/telegram-control.yml", "utf8");
    const visualWorkflow = readFileSync(".github/workflows/visual-regression.yml", "utf8");

    const syncUpload = sliceBetween(
      deployWorkflow,
      "name: Upload Telegram sync drill artifact",
      "name: Run deploy smoke tests"
    );
    expect(syncUpload).toContain("steps.telegram-sync-drill.outcome == 'success'");
    expect(syncUpload).not.toContain("if: always()");

    const controlScan = sliceBetween(
      telegramWorkflow,
      "name: Scan control artifacts before upload",
      "name: Upload control artifacts"
    );
    const controlUpload = telegramWorkflow.slice(
      indexOfOrThrow(telegramWorkflow, "name: Upload control artifacts")
    );
    expect(controlScan).toContain("id: control_artifact_scan");
    expect(controlUpload).toContain("steps.control_artifact_scan.outcome == 'success'");
    expect(controlUpload).not.toContain("if: always()");

    const visualScan = sliceBetween(
      visualWorkflow,
      "name: Scan visual artifacts before upload",
      "name: Upload Playwright snapshots"
    );
    const visualUpload = sliceBetween(
      visualWorkflow,
      "name: Upload Playwright snapshots",
      "name: Publish visual diff summary"
    );
    expect(visualScan).toContain("id: visual_artifact_scan");
    expect(visualScan).toContain('find test-results -type f -name ".last-run.json" -delete');
    expect(visualUpload).toContain("steps.visual_artifact_scan.outcome == 'success'");
    expect(visualUpload).not.toContain("if: always()");
  });

  it("keeps workflow checkout credentials non-persistent on protected CI paths", () => {
    const files = [
      ".github/workflows/deploy.yml",
      ".github/workflows/deploy-v2-preview.yml",
      ".github/workflows/telegram-control.yml",
      ".github/workflows/visual-regression.yml",
      ".github/workflows/desktop-release.yml",
      ".github/workflows/claude-review.yml",
    ];

    for (const file of files) {
      const workflow = readFileSync(file, "utf8");
      for (const match of workflow.matchAll(
        /uses: actions\/checkout@[a-f0-9]{40}[\s\S]*?(?=\n\s*- (?:name|uses):|$)/g
      )) {
        expect(match[0], file + " checkout must disable credential persistence").toContain(
          "persist-credentials: false"
        );
      }
    }
  });

  it("gates Claude issue-comment reviews to trusted PR collaborators", () => {
    const workflow = readFileSync(".github/workflows/claude-review.yml", "utf8");
    const topPermissions = sliceBetween(workflow, "permissions:", "jobs:");
    const jobCondition = sliceBetween(workflow, "if: >", "runs-on:");

    expect(topPermissions).not.toContain("id-token: write");
    expect(jobCondition).toContain("github.event.comment.author_association");
    expect(jobCondition).toContain("MEMBER");
    expect(jobCondition).toContain("OWNER");
    expect(jobCondition).toContain("COLLABORATOR");
  });

  it("keeps visual regression workflow read-only", () => {
    const workflow = readFileSync(".github/workflows/visual-regression.yml", "utf8");
    const visualJob = workflow.slice(indexOfOrThrow(workflow, "visual:"));

    expect(visualJob).not.toContain("pull-requests: write");
    expect(visualJob).toContain("contents: read");
  });
});
