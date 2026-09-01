import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";

import { afterEach, describe, expect, it } from "vitest";

import {
  TASK11_CANONICAL_RUNNER_ID,
  TASK11_SUBJECT_HEAD,
  validateTask11CaptureSet,
  validateTask11ProductionContext,
  validateTask11RuntimeReceipt,
} from "../ui-audit/task11-settings-visual-evidence.mjs";

const FIXED_CLOCK = "2026-07-29T14:00:00.000Z";
const RUN_TIMESTAMP = "2026-07-29T14:05:00.000Z";
const BUILD_ID = "11111111-2222-4333-8444-555555555555";
const BUILD_INPUTS_SHA = "b".repeat(64);
const OUTPUT_ROOT = `output/ui-system-audit/${TASK11_SUBJECT_HEAD}/after/task11-settings-matrix`;
const RUN_STARTED_AT = "2026-07-29T14:04:30.000Z";
const EXPECTED_SOURCE_PATHS = [
  "e2e/ui-system-settings-visual.spec.ts",
  "scripts/ui-audit/task11-settings-visual-evidence.mjs",
  "playwright.config.ts",
  "package.json",
] as const;

const EXPECTED_SCENARIOS = [
  {
    id: "T11-01-320-de-paper-text-200-overview",
    viewport: { width: 320, height: 800 },
    locale: "de",
    direction: "ltr",
    theme: "paper",
    layout: "phone",
    view: "overview",
    selectedSection: "appearance",
    rootFontScale: 2,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: false,
    hoverEvidence: false,
  },
  {
    id: "T11-02-360-en-ink-keyboard-detail",
    viewport: { width: 360, height: 800 },
    locale: "en",
    direction: "ltr",
    theme: "ink",
    layout: "phone",
    view: "detail",
    selectedSection: "account",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: true,
    hoverEvidence: false,
  },
  {
    id: "T11-03-390-uk-oled-hover-overview",
    viewport: { width: 390, height: 844 },
    locale: "uk",
    direction: "ltr",
    theme: "oled",
    layout: "phone",
    view: "overview",
    selectedSection: "privacy",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: false,
    hoverEvidence: true,
  },
  {
    id: "T11-04-393-ar-paper-high-contrast-detail",
    viewport: { width: 393, height: 852 },
    locale: "ar",
    direction: "rtl",
    theme: "paper",
    layout: "phone",
    view: "detail",
    selectedSection: "appearance",
    rootFontScale: 1,
    highContrast: true,
    forcedColors: false,
    offline: false,
    focusEvidence: true,
    hoverEvidence: false,
  },
  {
    id: "T11-05-430-he-ink-detail",
    viewport: { width: 430, height: 932 },
    locale: "he",
    direction: "rtl",
    theme: "ink",
    layout: "phone",
    view: "detail",
    selectedSection: "privacy",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: false,
    hoverEvidence: false,
  },
  {
    id: "T11-06-600-es-oled-short-landscape-offline",
    viewport: { width: 600, height: 360 },
    locale: "es",
    direction: "ltr",
    theme: "oled",
    layout: "phone",
    view: "detail",
    selectedSection: "sound",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: true,
    focusEvidence: false,
    hoverEvidence: false,
  },
  {
    id: "T11-07-768-fr-paper-overview",
    viewport: { width: 768, height: 1024 },
    locale: "fr",
    direction: "ltr",
    theme: "paper",
    layout: "phone",
    view: "overview",
    selectedSection: "appearance",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: false,
    hoverEvidence: false,
  },
  {
    id: "T11-08-1024-ja-ink-list-detail-focus",
    viewport: { width: 1024, height: 768 },
    locale: "ja",
    direction: "ltr",
    theme: "ink",
    layout: "desktop",
    view: "list-detail",
    selectedSection: "appearance",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: true,
    hoverEvidence: false,
  },
  {
    id: "T11-09-1280-en-oled-list-detail-hover",
    viewport: { width: 1280, height: 900 },
    locale: "en",
    direction: "ltr",
    theme: "oled",
    layout: "desktop",
    view: "list-detail",
    selectedSection: "privacy",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: false,
    offline: false,
    focusEvidence: false,
    hoverEvidence: true,
  },
  {
    id: "T11-10-1440-uk-paper-high-contrast-list-detail",
    viewport: { width: 1440, height: 900 },
    locale: "uk",
    direction: "ltr",
    theme: "paper",
    layout: "desktop",
    view: "list-detail",
    selectedSection: "sound",
    rootFontScale: 1,
    highContrast: true,
    forcedColors: false,
    offline: false,
    focusEvidence: false,
    hoverEvidence: false,
  },
  {
    id: "T11-11-1536-de-ink-forced-colors-list-detail",
    viewport: { width: 1536, height: 864 },
    locale: "de",
    direction: "ltr",
    theme: "ink",
    layout: "desktop",
    view: "list-detail",
    selectedSection: "account",
    rootFontScale: 1,
    highContrast: false,
    forcedColors: true,
    offline: false,
    focusEvidence: true,
    hoverEvidence: false,
  },
] as const;

const temporaryRoots: string[] = [];

function sha256File(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function writeEvidenceFile(repositoryRoot: string, relativePath: string, content: string | Buffer) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, typeof content === "string" ? Buffer.from(content) : content);
  return {
    path: relativePath,
    sha256: sha256File(absolutePath),
    sizeBytes: readFileSync(absolutePath).byteLength,
  };
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function createPng(width: number, height: number) {
  const signature = Buffer.from("89504e470d0a1a0a", "hex");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  const rows = Buffer.alloc((width + 1) * height);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function artifactSnapshotSha256(files: Array<{ path: string; sizeBytes: number; sha256: string }>) {
  return createHash("sha256")
    .update(files.map((file) => `${file.path}\0${file.sizeBytes}\0${file.sha256}\n`).join(""))
    .digest("hex");
}

function inventoryFile(repositoryRoot: string, relativePath: string) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  return {
    path: relativePath,
    sha256: sha256File(absolutePath),
    sizeBytes: readFileSync(absolutePath).byteLength,
  };
}

function createCompleteFixture() {
  const repositoryRoot = mkdtempSync(path.join(tmpdir(), "zenflow-task11-evidence-"));
  temporaryRoots.push(repositoryRoot);

  const javascriptArtifact = writeEvidenceFile(
    repositoryRoot,
    "dist/assets/task11-fixture.js",
    "export const task11Fixture = true;\n"
  );
  const manifestFiles = [
    {
      path: "assets/task11-fixture.js",
      sizeBytes: javascriptArtifact.sizeBytes,
      sha256: javascriptArtifact.sha256,
    },
  ];
  const buildReceiptFile = writeEvidenceFile(
    repositoryRoot,
    "dist/.zenflow-ratchet-production-web-manifest.json",
    JSON.stringify({
      schemaVersion: 1,
      producer: "zenflow-ratchet-production-web-v1",
      completed: true,
      target: "web",
      mode: "production",
      distRoot: "dist",
      buildId: BUILD_ID,
      startedAt: "2026-07-29T14:00:00.000Z",
      completedAt: "2026-07-29T14:01:00.000Z",
      artifactsSha256: artifactSnapshotSha256(manifestFiles),
      buildInputsSha256: BUILD_INPUTS_SHA,
      bundleSizeBytes: javascriptArtifact.sizeBytes,
      files: manifestFiles,
    })
  );
  const immutableBuildReceiptFile = writeEvidenceFile(
    repositoryRoot,
    `${OUTPUT_ROOT}/production-build-manifest.json`,
    readFileSync(path.join(repositoryRoot, buildReceiptFile.path))
  );
  const nonManifestDistFile = writeEvidenceFile(
    repositoryRoot,
    "dist/index.html",
    "<!doctype html><title>Task 11 fixture</title>\n"
  );
  const sourceFiles = EXPECTED_SOURCE_PATHS.map((relativePath) =>
    writeEvidenceFile(repositoryRoot, relativePath, `Task 11 source: ${relativePath}\n`)
  );

  const captures = EXPECTED_SCENARIOS.map((scenario, index) => {
    const expectedVisiblePanelCount =
      scenario.view === "overview"
        ? 0
        : scenario.selectedSection === "sound" || scenario.selectedSection === "privacy"
          ? 1
          : 2;
    const image = writeEvidenceFile(
      repositoryRoot,
      `${OUTPUT_ROOT}/${scenario.id}.png`,
      createPng(scenario.viewport.width, scenario.viewport.height)
    );
    return {
      ...scenario,
      ...image,
      route: "/people-first-app/settings?dev=true&nav=v2",
      state: scenario.offline ? "loaded-page-offline" : "local-no-account-data",
      subjectHead: TASK11_SUBJECT_HEAD,
      buildId: BUILD_ID,
      buildArtifactsSha256: artifactSnapshotSha256(manifestFiles),
      buildReceiptSha256: buildReceiptFile.sha256,
      runnerId: TASK11_CANONICAL_RUNNER_ID,
      runnerScope: "LOCAL_DIAGNOSTIC_ONLY",
      platformProof: "WEB_BROWSER_ONLY",
      nativeProof: "UNVERIFIED",
      host: {
        os: "darwin",
        osRelease: "25.5.0",
        architecture: "arm64",
        nodeVersion: "v22.22.0",
      },
      browser: {
        name: "chromium",
        version: "147.0.7727.15",
        playwrightVersion: "1.59.1",
      },
      dpr: 1,
      fontProvenance: "document.fonts.status=loaded; bodyFontFamily=system-ui",
      timezone: "UTC",
      capturedAt: RUN_TIMESTAMP,
      fixedClock: FIXED_CLOCK,
      reducedMotion: true,
      network: scenario.offline
        ? "offline after local production page load"
        : "isolated local production preview; external requests blocked",
      visualReferenceDisposition: "missing-state",
      sameRunRepeatSha256Match: true,
      fixtureProvenance: {
        kind: "ISOLATED_TEST_FIXTURE",
        source: "e2e/ui-system-settings-visual.spec.ts#primeTask11Settings",
        productionReachable: false,
        containsUserData: false,
      },
      observations: {
        documentOverflowPx: 0,
        clippedTextCount: 0,
        motionReductionActive: true,
        minMeasuredTargetWidth: 44,
        minMeasuredTargetHeight: 44,
        compactOverviewVisible: scenario.view === "overview",
        compactDetailVisible: scenario.view === "detail",
        desktopListVisible: scenario.view === "list-detail",
        desktopDetailVisible: scenario.view === "list-detail",
        selectedSection: scenario.view === "overview" ? "appearance" : scenario.selectedSection,
        focusVisible: scenario.focusEvidence ? true : null,
        focusIndicatorVisible: scenario.focusEvidence ? true : null,
        focusRestored: scenario.id === "T11-02-360-en-ink-keyboard-detail" ? true : null,
        hoveredTarget: scenario.hoverEvidence
          ? `settings-module-card-${scenario.selectedSection}`
          : null,
        hoverVisualChange: scenario.hoverEvidence ? true : null,
        forcedColorsActive: scenario.forcedColors,
        themeContrast: scenario.highContrast ? "high" : "standard",
        navigatorOnLine: !scenario.offline,
        offlineBannerVisible: scenario.offline,
        browserZoomControlVerified: false,
        observedRootFontSize: scenario.rootFontScale * 16,
        requestedRootFontScale: scenario.rootFontScale,
        groupedSurfaceContract: true,
        visiblePanelCount: expectedVisiblePanelCount,
        visibleGroupCount: expectedVisiblePanelCount,
        focusClipRisk: false,
        desktopColumnsNonOverlapping: scenario.view === "list-detail" ? true : null,
        captureCoverage: "INITIAL_VIEWPORT_ONLY",
        documentScrollHeight: Math.max(scenario.viewport.height, scenario.viewport.height + index),
        profileNameRowWidth:
          scenario.id === "T11-11-1536-de-ink-forced-colors-list-detail" ? 760 : null,
        profileNameInputWidth:
          scenario.id === "T11-11-1536-de-ink-forced-colors-list-detail" ? 560 : null,
        profileNameSaveActionWidth:
          scenario.id === "T11-11-1536-de-ink-forced-colors-list-detail" ? 184 : null,
        profileNameInputWidthShare:
          scenario.id === "T11-11-1536-de-ink-forced-colors-list-detail" ? 0.737 : null,
        germanHeadingNormalizedText:
          scenario.id === "T11-01-320-de-paper-text-200-overview" ? "Einstellungen" : null,
        germanHeadingHyphens:
          scenario.id === "T11-01-320-de-paper-text-200-overview" ? "manual" : null,
        germanHeadingSoftHyphenOffset:
          scenario.id === "T11-01-320-de-paper-text-200-overview" ? 3 : null,
        germanHeadingSoftHyphenGlyphWidth:
          scenario.id === "T11-01-320-de-paper-text-200-overview" ? 12 : null,
        germanHeadingRenderedBreakOffset:
          scenario.id === "T11-01-320-de-paper-text-200-overview" ? 3 : null,
        germanHeadingRenderedLineCount:
          scenario.id === "T11-01-320-de-paper-text-200-overview" ? 2 : null,
        germanHeadingFirstLineCharacterCount:
          scenario.id === "T11-01-320-de-paper-text-200-overview" ? 3 : null,
        germanHeadingLastLineCharacterCount:
          scenario.id === "T11-01-320-de-paper-text-200-overview" ? 10 : null,
        germanHeadingUsesAuthoredBreak:
          scenario.id === "T11-01-320-de-paper-text-200-overview" ? true : null,
        germanHeadingEmergencyTailAbsent:
          scenario.id === "T11-01-320-de-paper-text-200-overview" ? true : null,
        germanHeadingOverflowPx: scenario.id === "T11-01-320-de-paper-text-200-overview" ? 0 : null,
      },
    };
  });

  const servedDistFiles = [
    inventoryFile(repositoryRoot, "dist/.zenflow-ratchet-production-web-manifest.json"),
    inventoryFile(repositoryRoot, "dist/assets/task11-fixture.js"),
    nonManifestDistFile,
  ].sort((left, right) => left.path.localeCompare(right.path));

  const receipt = {
    schemaVersion: 2,
    task: "Task 11 Settings bounded factor matrix",
    subjectHead: TASK11_SUBJECT_HEAD,
    runStartedAtUtc: RUN_STARTED_AT,
    runCompletedAtUtc: RUN_TIMESTAMP,
    fixedClock: FIXED_CLOCK,
    outputRoot: OUTPUT_ROOT,
    runner: {
      id: TASK11_CANONICAL_RUNNER_ID,
      os: "darwin",
      osRelease: "25.5.0",
      architecture: "arm64",
      nodeVersion: "v22.22.0",
      playwrightVersion: "1.59.1",
      browser: "chromium",
      browserVersion: "147.0.7727.15",
      scope: "LOCAL_DIAGNOSTIC_ONLY",
      approvalBaseline: false,
    },
    productionBuild: {
      sourcePath: buildReceiptFile.path,
      evidencePath: immutableBuildReceiptFile.path,
      receiptSha256: buildReceiptFile.sha256,
      buildId: BUILD_ID,
      artifactsSha256: artifactSnapshotSha256(manifestFiles),
      buildInputsSha256: BUILD_INPUTS_SHA,
    },
    servedDist: {
      root: "dist",
      stableAcrossRun: true,
      inventorySha256: artifactSnapshotSha256(servedDistFiles),
      files: servedDistFiles,
    },
    evidenceSources: sourceFiles,
    captures,
    candidateBaselinePolicy: {
      approvedReferenceAvailable: false,
      automaticBaselineUpdate: false,
      sameRunExactRepeatRequired: true,
      sameRunAllowedByteMismatch: 0,
      requiredDisposition: "missing-state",
    },
    negativeControls: {
      visibleMutationRejected: true,
    },
    unverified: [
      {
        id: "approved-visual-reference-baseline",
        blocker: "No human-approved prior visual reference exists for this new bounded matrix.",
        evidenceNeeded:
          "Human-approved canonical Linux reference images and reviewed classifications.",
      },
      {
        id: "canonical-linux-approval-baseline",
        blocker:
          "This run is a local macOS diagnostic capture, not the canonical Linux approval runner.",
        evidenceNeeded: "Fresh Ubuntu 24.04 pinned-browser capture and review.",
      },
      {
        id: "browser-chrome-zoom-200",
        blocker:
          "Browser chrome zoom was not instrumented; the capture proves 200% root text expansion only.",
        evidenceNeeded: "Canonical-runner browser zoom control capture at 200%.",
      },
      {
        id: "loading",
        blocker: "No safe production-dist control exposes the Settings loading visual state.",
        evidenceNeeded: "Reachable production state or isolated component-preview evidence.",
      },
      {
        id: "error",
        blocker:
          "No safe production-dist control exposes a deterministic Settings error visual state.",
        evidenceNeeded: "Reachable production state or isolated component-preview evidence.",
      },
      {
        id: "disabled",
        blocker:
          "No stable disabled Settings state was reached without mutating application internals.",
        evidenceNeeded: "Reachable production state or isolated component-preview evidence.",
      },
      {
        id: "destructive-confirmation",
        blocker:
          "Opening live destructive UI was intentionally excluded from this no-data capture.",
        evidenceNeeded:
          "Isolated non-destructive preview plus behavior tests; never a real deletion.",
      },
      {
        id: "offline-first-load-installed-pwa",
        blocker:
          "The offline capture starts after a local production page load and is not an installed PWA.",
        evidenceNeeded: "Installed PWA offline-first runtime on an authorized device.",
      },
      {
        id: "native-and-assistive-runtime",
        blocker:
          "Chromium screenshots do not prove Android, iOS, Tauri, or assistive-technology behavior.",
        evidenceNeeded: "Fresh platform runtime and AT evidence.",
      },
      {
        id: "native-ads-consent-settings",
        blocker: "Web reports ads unsupported, so the privacy consent panel is not rendered.",
        evidenceNeeded: "Authorized Android or iOS runtime with an applicable consent state.",
      },
      {
        id: "full-surface-scroll-state-visuals",
        blocker:
          "Each PNG records the initial viewport; geometry checks do not visually prove every scroll position.",
        evidenceNeeded:
          "Reviewed scroll-position captures or a bounded full-page visual evidence set.",
      },
    ],
  };

  return {
    repositoryRoot,
    buildReceiptFile,
    immutableBuildReceiptFile,
    captures,
    receipt,
  };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Task 11 Settings visual evidence contract", () => {
  it("accepts the exact complete bounded factor capture matrix", () => {
    const fixture = createCompleteFixture();

    expect(
      validateTask11CaptureSet({
        captures: fixture.captures,
        outputRoot: OUTPUT_ROOT,
        repositoryRoot: fixture.repositoryRoot,
        buildReceiptPath: fixture.buildReceiptFile.path,
      })
    ).toEqual([]);
  });

  it("rejects corrupt PNG bytes and an IHDR size that differs from the viewport", () => {
    const corruptFixture = createCompleteFixture();
    const corrupt = corruptFixture.captures[0];
    const corruptPath = path.join(corruptFixture.repositoryRoot, corrupt.path);
    const corruptBytes = createPng(corrupt.viewport.width, corrupt.viewport.height);
    corruptBytes[corruptBytes.length - 20] ^= 0xff;
    writeFileSync(corruptPath, corruptBytes);
    corrupt.sha256 = sha256File(corruptPath);
    corrupt.sizeBytes = corruptBytes.length;

    expect(
      validateTask11CaptureSet({
        captures: corruptFixture.captures,
        outputRoot: OUTPUT_ROOT,
        repositoryRoot: corruptFixture.repositoryRoot,
        buildReceiptPath: corruptFixture.buildReceiptFile.path,
      })
    ).toEqual(expect.arrayContaining([expect.stringContaining("PNG chunk CRC is invalid")]));

    const wrongDimensionsFixture = createCompleteFixture();
    const wrongDimensions = wrongDimensionsFixture.captures[0];
    const wrongDimensionsPath = path.join(
      wrongDimensionsFixture.repositoryRoot,
      wrongDimensions.path
    );
    const wrongDimensionsBytes = createPng(
      wrongDimensions.viewport.width - 1,
      wrongDimensions.viewport.height
    );
    writeFileSync(wrongDimensionsPath, wrongDimensionsBytes);
    wrongDimensions.sha256 = sha256File(wrongDimensionsPath);
    wrongDimensions.sizeBytes = wrongDimensionsBytes.length;

    expect(
      validateTask11CaptureSet({
        captures: wrongDimensionsFixture.captures,
        outputRoot: OUTPUT_ROOT,
        repositoryRoot: wrongDimensionsFixture.repositoryRoot,
        buildReceiptPath: wrongDimensionsFixture.buildReceiptFile.path,
      })
    ).toEqual(
      expect.arrayContaining([expect.stringContaining("PNG IHDR dimensions must be 320x800")])
    );
  });

  it("rejects a missing scenario, duplicate ID, unexpected width, and tampered image", () => {
    const fixture = createCompleteFixture();
    const first = fixture.captures[0];
    const tamperedPath = path.join(fixture.repositoryRoot, first.path);
    writeFileSync(tamperedPath, Buffer.from("tampered"));
    const malformedDuplicate = {
      ...first,
      viewport: { width: 319, height: 800 },
    } as unknown as typeof first;
    fixture.captures.splice(1, 1, malformedDuplicate);

    expect(
      validateTask11CaptureSet({
        captures: fixture.captures,
        outputRoot: OUTPUT_ROOT,
        repositoryRoot: fixture.repositoryRoot,
        buildReceiptPath: fixture.buildReceiptFile.path,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("duplicate capture ID"),
        expect.stringContaining("missing expected capture"),
        expect.stringContaining("viewport must be 320x800"),
        expect.stringContaining("size does not match"),
        expect.stringContaining("sha256 does not match"),
      ])
    );
  });

  it("rejects missing focus, RTL, forced-colors, high-contrast, overflow, and target evidence", () => {
    const fixture = createCompleteFixture();
    const focus = fixture.captures.find(({ id }) => id.includes("360-en"));
    const rtl = fixture.captures.find(({ id }) => id.includes("393-ar"));
    const forced = fixture.captures.find(({ id }) => id.includes("forced-colors"));
    if (!focus || !rtl || !forced) throw new Error("Task 11 test fixture is incomplete");

    focus.observations.focusVisible = false;
    focus.observations.focusIndicatorVisible = false;
    focus.observations.focusRestored = false;
    focus.observations.documentOverflowPx = 8;
    focus.observations.minMeasuredTargetHeight = 40;
    focus.capturedAt = "not-an-iso-timestamp";
    rtl.direction = "ltr";
    rtl.observations.themeContrast = "standard";
    forced.observations.forcedColorsActive = false;

    expect(
      validateTask11CaptureSet({
        captures: fixture.captures,
        outputRoot: OUTPUT_ROOT,
        repositoryRoot: fixture.repositoryRoot,
        buildReceiptPath: fixture.buildReceiptFile.path,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("focus-visible evidence is incomplete"),
        expect.stringContaining("focus restoration evidence is incomplete"),
        expect.stringContaining("horizontal overflow must be zero"),
        expect.stringContaining("measured target height must be at least 44"),
        expect.stringContaining("capture timestamp must be canonical UTC"),
        expect.stringContaining("direction must be rtl"),
        expect.stringContaining("high-contrast evidence is incomplete"),
        expect.stringContaining("forced-colors evidence is incomplete"),
      ])
    );
  });

  it("rejects a symlink capture file even when its bytes and metadata match", () => {
    const fixture = createCompleteFixture();
    const capture = fixture.captures[0];
    const external = writeEvidenceFile(
      fixture.repositoryRoot,
      "outside.png",
      createPng(capture.viewport.width, capture.viewport.height)
    );
    rmSync(path.join(fixture.repositoryRoot, capture.path));
    symlinkSync(
      path.join(fixture.repositoryRoot, external.path),
      path.join(fixture.repositoryRoot, capture.path)
    );
    capture.sha256 = external.sha256;
    capture.sizeBytes = external.sizeBytes;

    expect(
      validateTask11CaptureSet({
        captures: fixture.captures,
        outputRoot: OUTPUT_ROOT,
        repositoryRoot: fixture.repositoryRoot,
        buildReceiptPath: fixture.buildReceiptFile.path,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("evidence path must not traverse a symbolic link"),
      ])
    );
  });

  it("rejects a symbolic-link ancestor in the exact capture path", () => {
    const fixture = createCompleteFixture();
    const matrixPath = path.join(fixture.repositoryRoot, OUTPUT_ROOT);
    const realMatrixPath = path.join(
      fixture.repositoryRoot,
      path.dirname(OUTPUT_ROOT),
      "task11-settings-matrix-real"
    );
    renameSync(matrixPath, realMatrixPath);
    symlinkSync(realMatrixPath, matrixPath);

    expect(
      validateTask11CaptureSet({
        captures: fixture.captures,
        outputRoot: OUTPUT_ROOT,
        repositoryRoot: fixture.repositoryRoot,
        buildReceiptPath: fixture.buildReceiptFile.path,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("evidence path must not traverse a symbolic link"),
      ])
    );
  });

  it("rejects an escaping build-receipt path before reading it", () => {
    const fixture = createCompleteFixture();

    expect(
      validateTask11CaptureSet({
        captures: fixture.captures,
        outputRoot: OUTPUT_ROOT,
        repositoryRoot: fixture.repositoryRoot,
        buildReceiptPath: "../outside-receipt.json",
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "build receipt path must be dist/.zenflow-ratchet-production-web-manifest.json"
        ),
        expect.stringContaining("path escapes the repository root"),
      ])
    );
  });

  it("rejects an orphan file in the bounded capture inventory", () => {
    const fixture = createCompleteFixture();
    writeEvidenceFile(fixture.repositoryRoot, `${OUTPUT_ROOT}/orphan.png`, createPng(1, 1));

    expect(
      validateTask11CaptureSet({
        captures: fixture.captures,
        outputRoot: OUTPUT_ROOT,
        repositoryRoot: fixture.repositoryRoot,
        buildReceiptPath: fixture.buildReceiptFile.path,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("capture evidence inventory contains orphan entries"),
      ])
    );
  });

  it("rejects vacuous or contradictory route, state, network, scale, and layout observations", () => {
    const fixture = createCompleteFixture();
    const overview = fixture.captures[0];
    const detail = fixture.captures[1];
    const desktop = fixture.captures[7];
    const forcedColorsAccount = fixture.captures[10];

    overview.route = "";
    overview.state = "loaded-page-offline";
    overview.network = "";
    overview.observations.requestedRootFontScale = 1;
    overview.observations.observedRootFontSize = 16;
    overview.observations.compactDetailVisible = true;
    overview.observations.groupedSurfaceContract = false;
    overview.observations.visiblePanelCount = 1;
    detail.observations.visiblePanelCount = 1;
    detail.observations.visibleGroupCount = 3;
    overview.observations.captureCoverage = "FULL_PAGE";
    overview.observations.documentScrollHeight = 0;
    overview.observations.selectedSection = "privacy";
    detail.observations.compactOverviewVisible = true;
    desktop.observations.compactDetailVisible = true;
    desktop.observations.desktopDetailVisible = false;
    forcedColorsAccount.observations.profileNameInputWidth = 91;
    forcedColorsAccount.observations.profileNameSaveActionWidth = 640;
    forcedColorsAccount.observations.profileNameRowWidth = 744;
    forcedColorsAccount.observations.profileNameInputWidthShare = 0.122;

    expect(
      validateTask11CaptureSet({
        captures: fixture.captures,
        outputRoot: OUTPUT_ROOT,
        repositoryRoot: fixture.repositoryRoot,
        buildReceiptPath: fixture.buildReceiptFile.path,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("route observation is invalid"),
        expect.stringContaining("state observation must be local-no-account-data"),
        expect.stringContaining("network observation is invalid"),
        expect.stringContaining("requested root font scale"),
        expect.stringContaining("observed root font size"),
        expect.stringContaining("layout visibility flags are contradictory"),
        expect.stringContaining("grouped-surface observation is incomplete"),
        expect.stringContaining("visible panel count must be 0"),
        expect.stringContaining("visible settings-group count must equal the 2 visible panels"),
        expect.stringContaining("capture coverage must be INITIAL_VIEWPORT_ONLY"),
        expect.stringContaining("document scroll height must be positive"),
        expect.stringContaining("active selected-section observation is incomplete"),
        expect.stringContaining("profile name input must be wider than its inline save action"),
        expect.stringContaining("profile name input must occupy at least half of its row"),
      ])
    );
  });

  it("rejects a German 200% heading that does not render at its authored soft-hyphen opportunity", () => {
    const fixture = createCompleteFixture();
    const germanHeading = fixture.captures[0];

    germanHeading.observations.germanHeadingNormalizedText = "Einstellung en";
    germanHeading.observations.germanHeadingHyphens = "none";
    germanHeading.observations.germanHeadingSoftHyphenOffset = 4;
    germanHeading.observations.germanHeadingSoftHyphenGlyphWidth = 0;
    germanHeading.observations.germanHeadingRenderedBreakOffset = 11;
    germanHeading.observations.germanHeadingRenderedLineCount = 3;
    germanHeading.observations.germanHeadingFirstLineCharacterCount = 11;
    germanHeading.observations.germanHeadingLastLineCharacterCount = 2;
    germanHeading.observations.germanHeadingUsesAuthoredBreak = false;
    germanHeading.observations.germanHeadingEmergencyTailAbsent = false;
    germanHeading.observations.germanHeadingOverflowPx = 4;

    expect(
      validateTask11CaptureSet({
        captures: fixture.captures,
        outputRoot: OUTPUT_ROOT,
        repositoryRoot: fixture.repositoryRoot,
        buildReceiptPath: fixture.buildReceiptFile.path,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("normalized German heading must be Einstellungen"),
        expect.stringContaining("German heading must use manual hyphenation"),
        expect.stringContaining("translator-authored soft-hyphen offset must be 3"),
        expect.stringContaining("soft-hyphen glyph must be rendered"),
        expect.stringContaining("rendered break must match the authored soft-hyphen offset"),
        expect.stringContaining("German heading must render on exactly two lines"),
        expect.stringContaining("first rendered line must end at the authored break"),
        expect.stringContaining("last rendered line must not be a two-character emergency tail"),
        expect.stringContaining("authored German break opportunity is not in use"),
        expect.stringContaining("German heading emergency-tail evidence is incomplete"),
        expect.stringContaining("German heading horizontal overflow must be zero"),
      ])
    );
  });

  it("rejects an incomplete or internally inconsistent canonical production build receipt", () => {
    const fixture = createCompleteFixture();
    const buildReceiptPath = path.join(fixture.repositoryRoot, fixture.buildReceiptFile.path);
    const buildReceipt = JSON.parse(readFileSync(buildReceiptPath, "utf8"));
    buildReceipt.producer = "generic-build";
    buildReceipt.completedAt = "2026-07-29T13:59:00.000Z";
    buildReceipt.bundleSizeBytes = 0;
    buildReceipt.files = [];
    writeFileSync(buildReceiptPath, JSON.stringify(buildReceipt));

    expect(
      validateTask11CaptureSet({
        captures: fixture.captures,
        outputRoot: OUTPUT_ROOT,
        repositoryRoot: fixture.repositoryRoot,
        buildReceiptPath: fixture.buildReceiptFile.path,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("producer must be zenflow-ratchet-production-web-v1"),
        expect.stringContaining("completedAt precedes startedAt"),
        expect.stringContaining("bundleSizeBytes must be a positive safe integer"),
        expect.stringContaining("files must be a non-empty array"),
      ])
    );
  });

  it("accepts only the isolated production-dist runner context", () => {
    const baseURL = "http://127.0.0.1:4211/people-first-app/";
    const valid = {
      env: {
        CI: "true",
        ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER: "true",
        ZENFLOW_PLAYWRIGHT_PREVIEW_DIR: "dist",
        ZENFLOW_PLAYWRIGHT_LOCAL_PORT: "4211",
      },
      baseURL,
      configuredBaseURL: baseURL,
      subjectHead: TASK11_SUBJECT_HEAD,
      runnerId: TASK11_CANONICAL_RUNNER_ID,
    };

    expect(validateTask11ProductionContext(valid)).toEqual([]);
    expect(
      validateTask11ProductionContext({
        ...valid,
        env: {
          ...valid.env,
          CI: "",
          ZENFLOW_PLAYWRIGHT_PREVIEW_DIR: "dist-task11",
        },
        baseURL: "https://yehor212.github.io/people-first-app/",
        subjectHead: "c".repeat(40),
        runnerId: "linux-unpinned",
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("CI must be explicitly true"),
        expect.stringContaining("preview directory must be exactly dist"),
        expect.stringContaining("baseURL must match the isolated local preview"),
        expect.stringContaining("subject HEAD must be"),
        expect.stringContaining("local diagnostic runner must be"),
      ])
    );
  });

  it("accepts a hash-bound local diagnostic receipt with an honest candidate baseline ledger", () => {
    const fixture = createCompleteFixture();

    expect(
      validateTask11RuntimeReceipt({
        receipt: fixture.receipt,
        repositoryRoot: fixture.repositoryRoot,
      })
    ).toEqual([]);
  });

  it("validates the immutable build-manifest copy after the shared dist changes", () => {
    const fixture = createCompleteFixture();
    writeFileSync(
      path.join(fixture.repositoryRoot, fixture.buildReceiptFile.path),
      JSON.stringify({ replacedByLaterBuild: true })
    );
    writeFileSync(
      path.join(fixture.repositoryRoot, "dist/assets/task11-fixture.js"),
      "export const laterBuild = true;\n"
    );

    expect(
      validateTask11RuntimeReceipt({
        receipt: fixture.receipt,
        repositoryRoot: fixture.repositoryRoot,
      })
    ).toEqual([]);
  });

  it("rejects a tampered immutable build-manifest copy", () => {
    const fixture = createCompleteFixture();
    writeFileSync(
      path.join(fixture.repositoryRoot, fixture.immutableBuildReceiptFile.path),
      JSON.stringify({ tampered: true })
    );

    expect(
      validateTask11RuntimeReceipt({
        receipt: fixture.receipt,
        repositoryRoot: fixture.repositoryRoot,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("runtime receipt immutable production build"),
      ])
    );
  });

  it("rejects a receipt whose retained full-dist inventory was changed", () => {
    const fixture = createCompleteFixture();
    fixture.receipt.servedDist.files.pop();

    expect(
      validateTask11RuntimeReceipt({
        receipt: fixture.receipt,
        repositoryRoot: fixture.repositoryRoot,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("served dist inventory sha256 does not match declared files"),
      ])
    );
  });

  it("rejects stale build/source hashes, false baseline claims, invalid run time, and erased blockers", () => {
    const fixture = createCompleteFixture();
    fixture.receipt.productionBuild.artifactsSha256 = "c".repeat(64);
    fixture.receipt.runStartedAtUtc = "2026-07-29T14:05:00.000Z";
    fixture.receipt.runCompletedAtUtc = "2026-07-29T14:03:00.000Z";
    fixture.receipt.evidenceSources[0].sha256 = "d".repeat(64);
    fixture.receipt.runner.scope = "APPROVAL_BASELINE";
    fixture.receipt.runner.approvalBaseline = true;
    fixture.receipt.candidateBaselinePolicy.approvedReferenceAvailable = true;
    fixture.receipt.candidateBaselinePolicy.automaticBaselineUpdate = true;
    fixture.receipt.candidateBaselinePolicy.sameRunAllowedByteMismatch = 1;
    fixture.receipt.negativeControls.visibleMutationRejected = false;
    fixture.receipt.captures[0].visualReferenceDisposition = "intended";
    fixture.receipt.captures[0].sameRunRepeatSha256Match = false;
    fixture.receipt.captures[0].runnerScope = "APPROVAL_BASELINE";
    fixture.receipt.unverified = [];

    expect(
      validateTask11RuntimeReceipt({
        receipt: fixture.receipt,
        repositoryRoot: fixture.repositoryRoot,
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("production build artifacts hash"),
        expect.stringContaining("runCompletedAtUtc precedes runStartedAtUtc"),
        expect.stringContaining("evidence source: sha256"),
        expect.stringContaining("runner must be local diagnostic only"),
        expect.stringContaining("approved visual reference must remain unavailable"),
        expect.stringContaining("automatic baseline updates must be disabled"),
        expect.stringContaining("same-run byte mismatch must be exactly zero"),
        expect.stringContaining("visible-mutation negative control"),
        expect.stringContaining("visual reference disposition must be missing-state"),
        expect.stringContaining("same-run repeat screenshot hash must match"),
        expect.stringContaining("capture runner scope must be local diagnostic only"),
        expect.stringContaining("UNVERIFIED ledger is incomplete"),
      ])
    );
  });
});
