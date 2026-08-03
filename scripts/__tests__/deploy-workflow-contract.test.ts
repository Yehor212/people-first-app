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
  const match = source.match(/concurrency:\n(?:\s*#[^\n]*\n)*\s+group:\s+([^\n]+)/);
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

  it("runs exact-SHA remote CI contracts in the deploy-blocking release contract command", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    const releaseContracts = pkg.scripts["test:release-contracts"];

    expect(releaseContracts).toContain("scripts/__tests__/remote-ci-core.test.ts");
    expect(releaseContracts).toContain("scripts/__tests__/check-remote-ci-cli.test.ts");
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

  it("isolates pull-request Pages checks while serializing main and explicit V2 production overwrites", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    expect(extractConcurrencyGroup(workflow)).toBe(
      "${{ github.event_name == 'pull_request' && format('pages-pr-{0}', github.event.pull_request.number) || github.event_name == 'push' && 'pages' || github.event.inputs.telegram_approval == 'telegram-approved' && github.ref == 'refs/heads/main' && 'pages' || format('pages-nondeploy-{0}', github.ref) }}"
    );
    expect(workflow).toContain("cancel-in-progress: true");
    expect(previewWorkflow).toContain(
      "group: ${{ github.event.inputs.publish_target == 'overwrite-github-pages' && 'pages' || 'pages-v2-preview' }}"
    );
    expect(previewWorkflow).toContain(
      "cancel-in-progress: ${{ github.event.inputs.publish_target != 'overwrite-github-pages' }}"
    );
    const protectedJobs = [
      sliceBetween(workflow, "  deploy:", "  public-privacy-smoke:"),
      sliceBetween(workflow, "  public-privacy-smoke:", "  public-auth-smoke:"),
      workflow.slice(indexOfOrThrow(workflow, "  public-auth-smoke:")),
    ];
    for (const job of protectedJobs) {
      expect(job).toContain(
        "if: github.event_name == 'push' || github.event.inputs.telegram_approval == 'telegram-approved'"
      );
    }
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
    expect(pkg.scripts["ci:preflight"]).toContain("npm run test:agent-orchestra");
    expect(pkg.scripts["ci:preflight"]).toContain("npm run check:agent-orchestra");
    expect(pkg.scripts["ci:preflight"]).toContain("npm run check:agent-orchestra:eval");
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

  it("runs exact-ten governance checks on pull requests and direct pushes to main", () => {
    const workflow = readFileSync(".github/workflows/drift-checks.yml", "utf8");
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(workflow).toMatch(/on:\s*\n\s+push:\s*\n\s+branches:\s*\[main\]/);
    expect(workflow).toContain("name: agent-orchestra-contracts");
    expect(workflow).toContain("cmd: npm run test:agent-orchestra");
    expect(workflow).toContain("cmd: npm run check:agent-orchestra");
    expect(workflow).toContain("cmd: npm run check:agent-orchestra:eval");
    expect(pkg.scripts["test:agent-orchestra"]).toContain(
      "scripts/__tests__/persistent-agent-orchestra-evidence.test.mjs"
    );
    expect(pkg.scripts["test:agent-orchestra"]).toContain(
      "scripts/__tests__/codex-change-governance-gate.test.mjs"
    );
    expect(pkg.scripts["test:agent-orchestra"]).toContain(
      "scripts/__tests__/private-receipt-export.test.mjs",
    );
    expect(pkg.scripts["test:release-contracts"]).toContain(
      "scripts/__tests__/skill-routing-hook-payload.test.ts"
    );
    expect(pkg.scripts["test:release-contracts"]).toContain(
      "scripts/__tests__/private-receipt-export.test.mjs",
    );
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
    const perfDiagnostics = indexOfOrThrow(workflow, "name: Upload V2 Orb performance diagnostics");
    const stagedVisual = indexOfOrThrow(workflow, "name: Run staged V2 visual regression tests");
    expect(stagedPerf).toBeLessThan(perfDiagnostics);
    expect(perfDiagnostics).toBeLessThan(stagedVisual);
    expect(stagedPerf).toBeLessThan(indexOfOrThrow(workflow, "name: Upload artifact"));

    const perfSpec = readFileSync("e2e/orb-user-flow-performance.spec.ts", "utf8");
    expect(perfSpec).toContain("const directUserEventNames = new Set([");
    expect(perfSpec).toContain("async function waitForFiniteAnimationsToSettle(page: Page)");
    expect(perfSpec).toContain("await noteInput.focus();");
    expect(perfSpec).toContain("await expect(noteInput).toBeFocused();");
    expect(perfSpec).toContain('await page.keyboard.insertText("Quick performance proof");');
    expect(perfSpec).not.toContain("await noteInput.click();");
    expect(perfSpec).not.toContain('fill("Quick performance proof")');
    expect(perfSpec).not.toContain('keyboard.type("Quick performance proof"');
    const directUserEventsStart = indexOfOrThrow(
      perfSpec,
      "const directUserEventNames = new Set(["
    );
    const directUserEventsEnd = perfSpec.indexOf("]);", directUserEventsStart);
    expect(directUserEventsEnd).toBeGreaterThan(directUserEventsStart);
    const directUserEventsBlock = perfSpec.slice(directUserEventsStart, directUserEventsEnd);
    expect(directUserEventsBlock).not.toContain('"beforeinput"');
    expect(directUserEventsBlock).not.toContain('"input"');
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

    expect(pkg.scripts["prune:release-artifacts:android"]).toBe(
      "node scripts/prune-duplicate-artifacts.cjs android/app/src/main/assets/public"
    );
    expect(pkg.scripts["prune:release-artifacts:ios"]).toBe(
      "node scripts/prune-duplicate-artifacts.cjs ios/App/App/public"
    );
    expect(pkg.scripts["check:release-artifacts:android"]).toBe(
      "node scripts/prune-duplicate-artifacts.cjs android/app/src/main/assets/public --verify && node scripts/prune-duplicate-artifacts.cjs android/app/src/main/res/xml --verify"
    );
    expect(pkg.scripts["check:release-artifacts:ios"]).toBe(
      "node scripts/prune-duplicate-artifacts.cjs ios/App/App/public --verify"
    );
    expect(pkg.scripts["cap:sync"]).toContain("npm run prune:release-artifacts:android");
    expect(pkg.scripts["cap:sync"]).toContain("npm run prune:release-artifacts:ios");
    expect(pkg.scripts["cap:sync"]).toContain("npm run check:release-artifacts:android");
    expect(pkg.scripts["cap:sync"]).toContain("npm run check:release-artifacts:ios");
    expect(pkg.scripts["cap:sync:android"]).toContain("npm run prune:release-artifacts:android");
    expect(pkg.scripts["cap:sync:android"]).toContain("npm run check:release-artifacts:android");
    expect(pkg.scripts["cap:sync:ios"]).toContain("npm run prune:release-artifacts:ios");
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

  it("keeps normal deploy journal Magic Link checks smoke-free and one-time-link free", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    for (const [file, source, readinessName, statusName] of [
      [
        ".github/workflows/deploy.yml",
        workflow,
        "name: Check journal Magic Link live readiness",
        "name: Check journal Magic Link proof status",
      ],
      [
        ".github/workflows/deploy-v2-preview.yml",
        previewWorkflow,
        "name: Check journal Magic Link live readiness for V2 preview",
        "name: Check journal Magic Link proof status for V2 preview",
      ],
    ] as const) {
      expect(source).toContain("name: Check journal Magic Link GitHub name inventory");
      const readiness = sliceBetween(source, readinessName, statusName);
      expect(readiness, file).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED: false");
      expect(readiness, file).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_SMTP_REQUIRED:");
      expect(readiness, file).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE: false");
      expect(readiness, file).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL: false");
      expect(readiness, file).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL: false");
      expect(readiness, file).toContain("ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL: false");
      expect(readiness, file).not.toContain(
        "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL: ${{ secrets.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL }}"
      );
    }
  });

  it("requires the manual journal Magic Link proof to consume a captured URL before SMTP apply", () => {
    const workflow = readFileSync(".github/workflows/journal-magic-link-live-proof.yml", "utf8");
    const validation = sliceBetween(
      workflow,
      "name: Validate production proof request",
      "name: Checkout"
    );
    const inventory = sliceBetween(
      workflow,
      "name: Check journal Magic Link GitHub names before proof",
      "name: Apply Supabase Auth custom SMTP"
    );
    const fullProof = sliceBetween(
      workflow,
      "name: Run journal Magic Link full live proof",
      "name: Clear consumed journal Magic Link captured URL secret"
    );
    const cleanup = sliceBetween(
      workflow,
      "name: Clear consumed journal Magic Link captured URL secret",
      "name: Write journal Magic Link runtime proof status packet"
    );
    const runtimePacket = sliceBetween(
      workflow,
      "name: Write journal Magic Link runtime proof status packet",
      "name: Check journal Magic Link proof status packet"
    );
    const statusPacket = workflow.slice(
      indexOfOrThrow(workflow, "name: Check journal Magic Link proof status packet")
    );

    expect(validation).toContain(
      "CONSUME_CAPTURED_URL: ${{ inputs.consume_captured_url && 'true' || 'false' }}"
    );
    expect(validation).toContain(
      "Full live proof requires consuming the fresh captured Supabase verify URL."
    );
    expect(inventory).toContain("ZENFLOW_GITHUB_SECRET_ZENFLOW_AUTH_SMTP_PASS_PRESENT");
    expect(inventory).toContain(
      "ZENFLOW_GITHUB_SECRET_ZENFLOW_GITHUB_SECRET_CLEANUP_TOKEN_PRESENT"
    );
    expect(inventory).toContain("npm run check:github-journal-magic-link-secrets:pass");
    expect(fullProof).toContain("id: full_live_proof");
    expect(fullProof).toContain(
      "ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE: ${{ inputs.consume_captured_url && 'true' || 'false' }}"
    );
    expect(fullProof).toContain(
      "ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL: ${{ inputs.consume_captured_url && 'true' || 'false' }}"
    );
    expect(fullProof).toContain(
      "ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL: ${{ inputs.consume_captured_url && 'true' || 'false' }}"
    );
    expect(cleanup).toContain(
      "if: ${{ always() && inputs.consume_captured_url && steps.full_live_proof.outcome != 'skipped' }}"
    );
    expect(cleanup).toContain("GH_TOKEN: ${{ secrets.ZENFLOW_GITHUB_SECRET_CLEANUP_TOKEN }}");
    expect(cleanup).toContain("ZENFLOW_GITHUB_REPO: ${{ github.repository }}");
    expect(cleanup).toContain("npm run clear:journal-magic-link-captured-url:apply");
    expect(runtimePacket).toContain(
      "npm run write:journal-magic-link-proof-status -- --file output/journal-magic-link-live-proof-status.json"
    );
    expect(statusPacket).toContain(
      "npm run check:journal-magic-link-proof-status -- --file output/journal-magic-link-live-proof-status.json"
    );
    expect(statusPacket).toContain(
      "npm run check:journal-magic-link-proof-status:pass -- --file output/journal-magic-link-live-proof-status.json"
    );
  });
  it("keeps workflow checkout credentials non-persistent on protected CI paths", () => {
    const files = [
      ".github/workflows/deploy.yml",
      ".github/workflows/deploy-v2-preview.yml",
      ".github/workflows/telegram-control.yml",
      ".github/workflows/visual-regression.yml",
      ".github/workflows/desktop-release.yml",
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

  it("keeps visual regression workflow read-only", () => {
    const workflow = readFileSync(".github/workflows/visual-regression.yml", "utf8");
    const visualJob = workflow.slice(indexOfOrThrow(workflow, "visual:"));

    expect(visualJob).not.toContain("pull-requests: write");
    expect(visualJob).toContain("contents: read");
  });
  it("runs a cache-busted public privacy policy smoke after Pages deployment", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    expect(workflow).toContain("public-privacy-smoke:");
    expect(workflow).toContain("needs: [deploy]");
    expect(workflow).toContain(
      "ZENFLOW_PUBLIC_PRIVACY_URL: ${{ needs.deploy.outputs.page_url }}privacy.html?admobPrivacyCheck=${{ github.sha }}"
    );
    expect(workflow).toContain("npm run google-play:privacy:public-check");
    expect(workflow).toContain("Public privacy policy did not pass after Pages deployment.");

    const deployJob = sliceBetween(workflow, "deploy:", "public-privacy-smoke:");
    const privacyJob = sliceBetween(workflow, "public-privacy-smoke:", "public-auth-smoke:");
    expect(deployJob).toContain("outputs:");
    expect(deployJob).toContain("page_url: ${{ steps.deployment.outputs.page_url }}");
    expect(privacyJob).toContain("needs: [deploy]");
    expect(privacyJob).toContain("persist-credentials: false");
    expect(privacyJob).toContain("for attempt in {1..12}");
    expect(privacyJob).toContain("sleep 10");
    expect(privacyJob).not.toContain("secrets.");

    expect(previewWorkflow).toContain("public-privacy-smoke:");
    expect(previewWorkflow).toContain(
      "ZENFLOW_PUBLIC_PRIVACY_URL: ${{ needs.deploy.outputs.page_url }}privacy.html?admobPrivacyCheck=${{ github.sha }}"
    );
    expect(previewWorkflow).toContain("npm run google-play:privacy:public-check");

    const previewDeploy = sliceBetween(previewWorkflow, "deploy:", "public-privacy-smoke:");
    const previewPrivacy = previewWorkflow.slice(
      indexOfOrThrow(previewWorkflow, "public-privacy-smoke:")
    );
    expect(previewDeploy).toContain("outputs:");
    expect(previewDeploy).toContain("page_url: ${{ steps.deployment.outputs.page_url }}");
    expect(previewPrivacy).toContain("needs: [deploy]");
    expect(previewPrivacy).toContain(
      "github.event.inputs.publish_target == 'overwrite-github-pages'"
    );
    expect(previewPrivacy).toContain("for attempt in {1..12}");
    expect(previewPrivacy).toContain("sleep 10");
    expect(previewPrivacy).not.toContain("secrets.");
  });

  it("checks the staged public privacy policy artifact before Pages uploads", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts["google-play:privacy:artifact-check"]).toBe(
      "node scripts/check-public-privacy-policy.cjs --file output/pages-artifact.nosync/privacy.html"
    );
    expect(workflow).toContain("name: Check staged public privacy policy");
    expect(workflow).toContain("npm run google-play:privacy:artifact-check");
    expect(previewWorkflow).toContain("name: Check staged public privacy policy for V2 preview");
    expect(previewWorkflow).toContain("npm run google-play:privacy:artifact-check");

    const productionIntegrity = indexOfOrThrow(
      workflow,
      "name: Check staged release artifact integrity"
    );
    const productionPrivacy = indexOfOrThrow(workflow, "name: Check staged public privacy policy");
    const productionUpload = indexOfOrThrow(workflow, "name: Upload artifact");
    expect(productionIntegrity).toBeLessThan(productionPrivacy);
    expect(productionPrivacy).toBeLessThan(productionUpload);

    const previewIntegrity = indexOfOrThrow(
      previewWorkflow,
      "name: Check staged release artifact integrity for V2 preview"
    );
    const previewPrivacy = indexOfOrThrow(
      previewWorkflow,
      "name: Check staged public privacy policy for V2 preview"
    );
    const previewReviewUpload = indexOfOrThrow(
      previewWorkflow,
      "name: Upload V2 preview artifact for review"
    );
    const previewPagesUpload = indexOfOrThrow(previewWorkflow, "name: Upload V2 Pages artifact");
    expect(previewIntegrity).toBeLessThan(previewPrivacy);
    expect(previewPrivacy).toBeLessThan(previewReviewUpload);
    expect(previewPrivacy).toBeLessThan(previewPagesUpload);
  });

  it("runs journal Magic Link GitHub name inventory before live proof without exposing values", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    const productionInventory = sliceBetween(
      workflow,
      "name: Check journal Magic Link GitHub name inventory",
      "name: Check journal Magic Link live readiness"
    );
    expect(productionInventory).toContain("ZENFLOW_GITHUB_JOURNAL_MAGIC_LINK_FROM_ENV: true");
    expect(productionInventory).toContain("ZENFLOW_GITHUB_JOURNAL_MAGIC_LINK_SECRETS_REQUIRED:");
    expect(productionInventory).not.toContain("ZENFLOW_JOURNAL_MAGIC_LINK_GITHUB_NAMES_REQUIRED:");
    expect(productionInventory).toContain("npm run check:github-journal-magic-link-secrets");
    expect(productionInventory).toContain("secrets.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL != ''");
    expect(productionInventory).not.toContain(
      "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL: ${{ secrets.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL }}"
    );

    const previewInventory = sliceBetween(
      previewWorkflow,
      "name: Check journal Magic Link GitHub name inventory for V2 preview",
      "name: Check journal Magic Link live readiness for V2 preview"
    );
    expect(previewInventory).toContain("working-directory: v2-src");
    expect(previewInventory).toContain("ZENFLOW_GITHUB_JOURNAL_MAGIC_LINK_FROM_ENV: true");
    expect(previewInventory).toContain("ZENFLOW_GITHUB_JOURNAL_MAGIC_LINK_SECRETS_REQUIRED:");
    expect(previewInventory).not.toContain("ZENFLOW_JOURNAL_MAGIC_LINK_GITHUB_NAMES_REQUIRED:");
    expect(previewInventory).toContain("npm run check:github-journal-magic-link-secrets");
    expect(previewInventory).not.toContain(
      "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL: ${{ secrets.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL }}"
    );
  });

  it("does not consume journal Magic Link proof material or mutate Supabase in deploy workflows", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    for (const source of [workflow, previewWorkflow]) {
      expect(source).not.toContain(
        "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL: ${{ secrets.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL }}"
      );
      expect(source).not.toContain("npm run apply:supabase-auth-smtp");
      expect(source).not.toContain("npm run apply:journal-magic-link-github-secrets");
      expect(source).not.toContain("npm run clear:journal-magic-link-captured-url:apply");
    }
  });

  it("keeps Journal Magic Link SMTP apply and live proof behind a manual production workflow", () => {
    const workflow = readFileSync(".github/workflows/journal-magic-link-live-proof.yml", "utf8");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("confirm_live_smtp_apply:");
    expect(workflow).toContain("APPLY_JOURNAL_MAGIC_LINK_LIVE_PROOF");
    expect(workflow).toContain('if [ "$GITHUB_REF" != "refs/heads/main" ]; then');
    expect(workflow).toContain("Journal Magic Link live proof must run from main.");
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("permissions:");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("id-token: write");
    expect(workflow).not.toContain("pull-requests: write");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("npm run check:supabase-auth-smtp");
    expect(workflow).toContain("npm run apply:supabase-auth-smtp");
    expect(workflow).toContain("npm run check:github-journal-magic-link-secrets");
    expect(workflow).toContain("npm run check:github-journal-magic-link-secrets:pass");
    expect(workflow).toContain("ZENFLOW_GITHUB_JOURNAL_MAGIC_LINK_SECRETS_REQUIRED: true");
    expect(workflow).not.toContain("ZENFLOW_JOURNAL_MAGIC_LINK_GITHUB_NAMES_REQUIRED:");
    expect(workflow).toContain("npm run check:journal-magic-link-live");
    expect(workflow).toContain("npm run check:journal-magic-link-proof-status");
    expect(workflow).toContain("npm run check:journal-magic-link-proof-status:pass");
    expect(workflow).toContain("ZENFLOW_AUTH_SMTP_CONFIRM_PRODUCTION: true");
    expect(workflow).toContain("ZENFLOW_AUTH_SMTP_PASS: ${{ secrets.ZENFLOW_AUTH_SMTP_PASS }}");
    expect(workflow).toContain(
      "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL: ${{ secrets.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL }}"
    );
    expect(workflow).toContain(
      "ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL: ${{ inputs.consume_captured_url && 'true' || 'false' }}"
    );
    expect(workflow).toContain(
      "ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL: ${{ inputs.consume_captured_url && 'true' || 'false' }}"
    );
    expect(workflow).not.toContain("echo $ZENFLOW_AUTH_SMTP_PASS");
    expect(workflow).not.toContain("echo $ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL");
  });
});
