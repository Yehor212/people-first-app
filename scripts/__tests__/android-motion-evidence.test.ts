import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildSourceEvidence,
  buildLocalBenchmarkRoute,
  assertRunArtifactIdentity,
  buildStyleExperimentExpression,
  buildTraceSummaryQueries,
  hashPath,
  mapWithConcurrency,
  median,
  medianAbsoluteDeviation,
  parseCurrentWebViewProvider,
  parseWebViewDevtoolsSocket,
  parseTraceProcessorCsv,
  selectLocalAppWebViewTarget,
  summarizeLayerAttribution,
  summarizeOrbProbeSamples,
  summarizeSceneTransitionSamples,
  validateDomExperimentSource,
  validateEvidenceLedger,
  waitForChildExit,
} from "../android-motion/evidence-lib.mjs";
import {
  assertJourneyScenario,
  calculateClockSync,
  centerOfBounds,
  createClickableNodeInventory,
  findVisibleClickableUiNode,
  findVisibleUiNode,
  findVisibleScrollableNode,
  getRefineJourneyRequiredTexts,
  hasIsolatedAndroidDayCompositor,
  listVisibleClickableNodes,
  parseUiAutomatorNodes,
  reconcileClickableNode,
  runTimedJourneyStep,
  sliderJourneyPoints,
  shouldCaptureJourneyScreenshots,
  verticalSwipeWithinBounds,
} from "../android-motion/run-real-user-journey.mjs";
import {
  buildControlManifest,
  validateControlManifest,
} from "../android-motion/build-control-manifest.mjs";

const temporaryPaths: string[] = [];
const JAVASCRIPT_RENDERER_PASS = ["java", "script"].join("");

afterEach(async () => {
  await Promise.all(
    temporaryPaths.splice(0).map((entry) => rm(entry, { force: true, recursive: true }))
  );
});

describe("Android motion evidence tooling", () => {
  it("keeps the continuous video pass free from concurrent screencap work", () => {
    expect(shouldCaptureJourneyScreenshots([])).toBe(true);
    expect(shouldCaptureJourneyScreenshots(["--video-only"])).toBe(false);
  });

  it("accepts removed or hidden legacy day layers after the WebGL surface is ready", () => {
    const readySurface = {
      canvas: {
        height: 2202,
        motionModel: "large:4;photons:78;motes:35;threads:18",
        width: 1082,
      },
      largeEffectDisplays: {
        removedLayer: null,
        retainedFallbackLayer: "none",
      },
      largeEffectsCanvasCount: 1,
      rendererState: "ready",
    };

    expect(hasIsolatedAndroidDayCompositor(readySurface)).toBe(true);
    expect(
      hasIsolatedAndroidDayCompositor({
        ...readySurface,
        largeEffectDisplays: { visibleLegacyLayer: "block" },
      })
    ).toBe(false);
  });

  it("targets real visible Android accessibility bounds for the user journey", () => {
    const nodes = parseUiAutomatorNodes(`<?xml version="1.0" encoding="UTF-8"?>
      <hierarchy rotation="0">
        <node text="Next" content-desc="" bounds="[409,2170][672,2299]" visible-to-user="true" />
        <node text="Next" content-desc="" bounds="[0,0][0,0]" visible-to-user="true" />
        <node text="" content-desc="Open menu" bounds="[28,164][160,296]" visible-to-user="true" />
      </hierarchy>`);

    expect(nodes).toHaveLength(3);
    expect(findVisibleUiNode(nodes, { text: "Next" })?.bounds).toEqual({
      bottom: 2299,
      left: 409,
      right: 672,
      top: 2170,
    });
    expect(findVisibleUiNode(nodes, { contentDescription: "Open menu" })?.text).toBe("");
    expect(centerOfBounds({ bottom: 2299, left: 409, right: 672, top: 2170 })).toEqual({
      x: 541,
      y: 2235,
    });
  });

  it("skips a non-clickable duplicate label when resolving a semantic tap target", () => {
    const nodes = parseUiAutomatorNodes(`<?xml version="1.0" encoding="UTF-8"?>
      <hierarchy rotation="0">
        <node class="android.view.View" text="Focus" content-desc="" bounds="[42,2073][1042,2339]" visible-to-user="true" enabled="true" clickable="false" />
        <node class="android.widget.ToggleButton" text="Focus" content-desc="" bounds="[52,666][1029,794]" visible-to-user="true" enabled="true" clickable="true" />
      </hierarchy>`);

    expect(findVisibleClickableUiNode(nodes, { text: "Focus" })?.className).toBe(
      "android.widget.ToggleButton"
    );
  });

  it("builds a textContent-only CDP style experiment with a safe identifier", () => {
    const expression = buildStyleExperimentExpression({
      css: '.probe::after { content: "</style>"; }',
      id: "clip-oversized-v1",
    });

    expect(expression).toContain("textContent");
    expect(expression).not.toContain("innerHTML");
    expect(expression).toContain("clip-oversized-v1");
    expect(() => buildStyleExperimentExpression({ css: "*{}", id: 'bad\" id' })).toThrow(
      /identifier/i
    );
  });

  it("accepts local DOM experiments but rejects network and persisted-data access", () => {
    expect(validateDomExperimentSource('document.body.dataset.probe = "active";')).toContain(
      "dataset.probe"
    );
    expect(() => validateDomExperimentSource('fetch("https://example.com")')).toThrow(
      /network|persisted/i
    );
    expect(() => validateDomExperimentSource("localStorage.clear()")).toThrow(/network|persisted/i);
  });

  it("selects the ZenFlow WebView when an AdMob WebView is also inspectable", () => {
    expect(
      selectLocalAppWebViewTarget([
        {
          type: "page",
          url: "https://googleads.g.doubleclick.net/mads/static/sdk/native/sdk-core.html",
          webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/ad",
        },
        {
          type: "page",
          url: "https://localhost/?dev=true",
          webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/app",
        },
      ]).url
    ).toBe("https://localhost/?dev=true");
  });

  it("allows only the local empty-state dev bypass route for benchmark setup", () => {
    expect(
      buildLocalBenchmarkRoute("https://localhost/", "/orb?nav=v2&navLayout=phone&dev=true")
    ).toBe("https://localhost/orb?nav=v2&navLayout=phone&dev=true");
    expect(() =>
      buildLocalBenchmarkRoute("https://localhost/", "/orb?nav=v2&navLayout=phone")
    ).toThrow(/dev=true/i);
    expect(() =>
      buildLocalBenchmarkRoute("https://example.com/", "/orb?nav=v2&navLayout=phone&dev=true")
    ).toThrow(/localhost/i);
    expect(() =>
      buildLocalBenchmarkRoute("https://localhost/", "/diary?nav=v2&navLayout=phone&dev=true")
    ).toThrow(/Orb route/i);
  });

  it("bounds concurrent CDP node inspection without reordering results", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, value % 2 === 0 ? 2 : 1));
      active -= 1;
      return value * 10;
    });

    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBe(2);
  });

  it("calculates the fixed median and MAD noise envelope", () => {
    expect(median([5, 1, 3, 2, 4])).toBe(3);
    expect(medianAbsoluteDeviation([5, 1, 3, 2, 4])).toBe(1);
    expect(() => median([])).toThrow(/non-empty/i);
  });

  it("detects multi-stage scene pop-in and post-settle disappearance", () => {
    const requiredSelectors = ["header", "emotion", "note", "actions", "mini-orb"];
    const sample = (at: number, visible: string[]) => ({
      at,
      nodes: Object.fromEntries(
        requiredSelectors.map((selector) => [selector, { visible: visible.includes(selector) }])
      ),
    });

    expect(
      summarizeSceneTransitionSamples(
        [
          sample(0, []),
          sample(100, ["header"]),
          sample(200, ["header", "emotion"]),
          sample(360, ["header", "emotion", "note", "actions"]),
          sample(800, requiredSelectors),
          sample(
            900,
            requiredSelectors.filter((selector) => selector !== "note")
          ),
        ],
        requiredSelectors
      )
    ).toEqual({
      complete: true,
      disappearanceSamplesAfterComplete: 1,
      firstAllVisibleAtMs: 800,
      firstAnyVisibleAtMs: 100,
      firstVisibleAtMs: {
        actions: 360,
        emotion: 200,
        header: 100,
        "mini-orb": 800,
        note: 360,
      },
      longestPartialSceneMs: 700,
      missingSelectors: [],
      popInSpreadMs: 700,
      sampleCount: 6,
    });
  });

  it("hashes a directory deterministically with relative-path provenance", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "zenflow-motion-hash-"));
    temporaryPaths.push(root);
    const nested = path.join(root, "nested");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(nested));
    await writeFile(path.join(root, "b.txt"), "second\n", "utf8");
    await writeFile(path.join(root, "a.txt"), "first\n", "utf8");
    await writeFile(path.join(nested, "c.txt"), "third\n", "utf8");

    const first = await hashPath(root);
    const second = await hashPath(root);

    expect(first.kind).toBe("directory");
    expect(first.fileCount).toBe(3);
    expect(first.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toEqual(first);
    expect(first.files.map((entry) => entry.path)).toEqual(["a.txt", "b.txt", "nested/c.txt"]);
  });

  it("validates candidate and pre-change-baseline ledgers with complete provenance", () => {
    const sha256 = "a".repeat(64);
    const artifact = (artifactPath: string) => ({
      path: artifactPath,
      bytes: 123,
      sha256,
    });
    const environment = {
      deviceAlias: "api36-emulator",
      kind: "emulator",
      api: 36,
      abi: "arm64-v8a",
      model: "sdk_gphone64_arm64",
      gpu: "gfxstream",
      webViewPackage: "com.google.android.webview",
      webViewVersion: "133.0.6943.137",
      resolutionPx: "1080x2400",
      densityDpi: 420,
      refreshHz: 60,
      orientation: "portrait",
      locale: "en",
      theme: "paper",
      motion: "normal",
      animationScales: { window: 1, transition: 1, animator: 1 },
      thermalStatus: 0,
      batterySaver: false,
      charging: false,
      availableMemoryBytes: 2_000_000_000,
      collectedAt: "2026-08-26T22:00:00.000Z",
    };
    const ledger = {
      schemaVersion: 2,
      source: {
        gitHead: "13ca51a80d23220574deba762851fe5a32372e46",
        stagedDiffSha256: sha256,
        unstagedDiffSha256: "b".repeat(64),
        dirtyPaths: [
          {
            path: "src/pages/nav-v2/AndroidDayLargeEffects.tsx",
            status: "??",
            sha256,
          },
        ],
        buildInputs: [artifact("source/src/index.css")],
        untrackedInputs: [artifact("source/AndroidDayLargeEffects.tsx")],
      },
      candidate: {
        id: "candidate24",
        status: "UNVERIFIED",
        apk: {
          ...artifact("candidate24/app-benchmark.apk"),
          installedBeforeSha256: sha256,
          installedAfterSha256: sha256,
          packageName: "com.zenflow.app",
          versionName: "2.1.1",
          versionCode: 38,
          signingCertificateSha256: "c".repeat(64),
          lastUpdateTime: "2026-08-26 17:00:00",
        },
      },
      runs: [
        {
          runId: "candidate24-api36-day-cdp-1",
          scenario: "orb-day-steady",
          pass: JAVASCRIPT_RENDERER_PASS,
          status: "FAIL",
          startedAt: "2026-08-26T22:00:00.000Z",
          endedAt: "2026-08-26T22:01:05.000Z",
          environment,
          installedBeforeSha256: sha256,
          installedAfterSha256: sha256,
          artifacts: [artifact("runs/orb-day-65s.json")],
        },
      ],
      completion: {
        emulatorApi36: "FAIL",
        emulatorApi26: "UNVERIFIED",
        physical60Hz: "UNVERIFIED",
        physicalHighRefresh: "UNVERIFIED",
        visualCritic: "UNVERIFIED",
        userReview: "UNVERIFIED",
      },
    };

    expect(validateEvidenceLedger(ledger)).toEqual(ledger);
    const prechangeBaselineLedger = {
      ...ledger,
      candidate: {
        ...ledger.candidate,
        id: "prechange-baseline-01",
      },
    };
    expect(validateEvidenceLedger(prechangeBaselineLedger)).toEqual(prechangeBaselineLedger);
    expect(() =>
      validateEvidenceLedger({
        ...prechangeBaselineLedger,
        candidate: {
          ...prechangeBaselineLedger.candidate,
          id: "prechange-baseline-0",
        },
      })
    ).toThrow(/artifact id/i);
    expect(() =>
      validateEvidenceLedger({
        ...ledger,
        candidate: { ...ledger.candidate, status: "PASS" },
      })
    ).toThrow(/candidate status/i);
    const { untrackedInputs: _untrackedInputs, ...sourceWithoutUntrackedInputs } = ledger.source;
    expect(() =>
      validateEvidenceLedger({
        ...ledger,
        source: sourceWithoutUntrackedInputs,
      })
    ).toThrow(/untrackedInputs/i);
  });

  it("rejects a visual run unless source and installed APK identity stay exact", () => {
    const sha256 = "a".repeat(64);
    const identity = {
      expectedSha256: sha256,
      sourceSha256: sha256,
      installedBeforeSha256: sha256,
      installedAfterSha256: sha256,
      packageName: "com.zenflow.app",
      versionName: "2.1.1",
      versionCode: 38,
    };
    expect(assertRunArtifactIdentity(identity)).toEqual(identity);
    expect(() =>
      assertRunArtifactIdentity({
        ...identity,
        installedAfterSha256: "b".repeat(64),
      })
    ).toThrow(/installed APK changed/i);
    expect(() => assertRunArtifactIdentity({ ...identity, versionCode: 39 })).toThrow(
      /versionCode 38/i
    );
  });

  it("binds tracked and untracked build inputs into one source evidence manifest", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "zenflow-motion-source-"));
    temporaryPaths.push(root);
    const sourceDirectory = path.join(root, "src");
    await import("node:fs/promises").then(({ mkdir }) =>
      mkdir(sourceDirectory, { recursive: true })
    );
    await writeFile(path.join(sourceDirectory, "tracked.ts"), "export const value = 1;\n");
    await writeFile(path.join(sourceDirectory, "untracked.ts"), "export const local = true;\n");
    await writeFile(path.join(root, "notes.md"), "not a build input\n");
    const source = await buildSourceEvidence({
      root,
      gitHead: "13ca51a80d23220574deba762851fe5a32372e46",
      stagedDiffSha256: "a".repeat(64),
      unstagedDiffSha256: "b".repeat(64),
      dirtyPaths: [
        { path: "src/tracked.ts", status: " M" },
        { path: "src/untracked.ts", status: "??" },
        { path: "notes.md", status: "??" },
      ],
      buildInputPaths: ["src"],
    });

    expect(source.buildInputs).toHaveLength(1);
    expect(source.buildInputs[0]).toMatchObject({
      path: "src",
      bytes: 51,
    });
    expect(source.untrackedInputs).toHaveLength(1);
    expect(source.untrackedInputs[0]).toMatchObject({
      path: "src/untracked.ts",
      bytes: 27,
    });
    expect(source.dirtyPaths).toEqual([
      {
        path: "src/tracked.ts",
        status: " M",
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
      {
        path: "src/untracked.ts",
        status: "??",
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
      {
        path: "notes.md",
        status: "??",
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    ]);
    expect(() =>
      buildSourceEvidence({
        root,
        gitHead: "13ca51a80d23220574deba762851fe5a32372e46",
        stagedDiffSha256: "a".repeat(64),
        unstagedDiffSha256: "b".repeat(64),
        dirtyPaths: [],
        buildInputPaths: ["../outside"],
      })
    ).rejects.toThrow(/inside the source root/i);
  });

  it("records monotonic semantic action bounds around the real operation", async () => {
    const ticks = [100.25, 132.75];
    const wallTicks = [1_787_795_900_100, 1_787_795_900_133];
    const action = await runTimedJourneyStep({
      clock: () => ticks.shift() as number,
      wallClock: () => wallTicks.shift() as number,
      entry: {
        action: "tap",
        label: "Open menu",
        bounds: { bottom: 296, left: 28, right: 160, top: 164 },
        point: { x: 94, y: 230 },
      },
      execute: async () => "drawer-opened",
    });

    expect(action).toEqual({
      action: "tap",
      label: "Open menu",
      bounds: { bottom: 296, left: 28, right: 160, top: 164 },
      point: { x: 94, y: 230 },
      startedAtMs: 100.25,
      endedAtMs: 132.75,
      startedAtWallClockMs: 1_787_795_900_100,
      endedAtWallClockMs: 1_787_795_900_133,
      result: "drawer-opened",
    });
  });

  it("maps host monotonic action time to Android boot time with bounded uncertainty", () => {
    expect(
      calculateClockSync({
        hostMonotonicStartedAtMs: 100,
        hostMonotonicEndedAtMs: 120,
        hostWallClockStartedAtMs: 1_700_000_000_000,
        deviceUptimeSeconds: 456.5,
      })
    ).toEqual({
      deviceUptimeMs: 456_500,
      hostMonotonicMidpointMs: 110,
      hostWallClockMidpointMs: 1_700_000_000_010,
      uncertaintyMs: 10,
    });
  });

  it("observes a child exit even when the process closed before the waiter attached", async () => {
    const alreadyClosed = Object.assign(new EventEmitter(), {
      exitCode: 0,
      signalCode: null,
      kill: vi.fn(),
    });
    await expect(waitForChildExit(alreadyClosed, 50)).resolves.toEqual({
      code: 0,
      signal: null,
    });

    const running = Object.assign(new EventEmitter(), {
      exitCode: null as number | null,
      signalCode: null as string | null,
      kill: vi.fn(),
    });
    const exit = waitForChildExit(running, 50);
    running.exitCode = 0;
    running.emit("close", 0, null);
    await expect(exit).resolves.toEqual({ code: 0, signal: null });
    expect(running.kill).not.toHaveBeenCalled();
  });

  it("enumerates every current visible enabled clickable accessibility node", () => {
    const nodes = parseUiAutomatorNodes(`<?xml version="1.0" encoding="UTF-8"?>
      <hierarchy rotation="0">
        <node text="Next" content-desc="" bounds="[409,2170][672,2299]" visible-to-user="true" enabled="true" clickable="true" />
        <node text="Hidden" content-desc="" bounds="[0,0][0,0]" visible-to-user="true" enabled="true" clickable="true" />
        <node text="" content-desc="Open menu" bounds="[28,164][160,296]" visible-to-user="true" enabled="true" clickable="true" />
        <node text="Disabled" content-desc="" bounds="[28,300][160,420]" visible-to-user="true" enabled="false" clickable="true" />
      </hierarchy>`);

    expect(listVisibleClickableNodes(nodes)).toEqual([
      {
        bounds: { bottom: 2299, left: 409, right: 672, top: 2170 },
        className: "",
        contentDescription: "",
        enabled: true,
        clickable: true,
        resourceId: "",
        scrollable: false,
        text: "Next",
        visibleToUser: true,
      },
      {
        bounds: { bottom: 296, left: 28, right: 160, top: 164 },
        className: "",
        contentDescription: "Open menu",
        enabled: true,
        clickable: true,
        resourceId: "",
        scrollable: false,
        text: "",
        visibleToUser: true,
      },
    ]);
  });

  it("keeps Android control coverage fail-closed until every mandatory node is exercised", () => {
    const node = (
      label: string,
      status: "PASS" | "UNVERIFIED",
      className = "android.widget.Button"
    ) => ({
      actionLabel: status === "PASS" ? label : undefined,
      bounds: { bottom: 200, left: 20, right: 220, top: 100 },
      capturedAtMs: 125,
      className,
      clickable: true,
      contentDescription: "",
      enabled: true,
      label,
      resourceId: "",
      route: "orb-day-select",
      scrollable: false,
      status,
      text: label,
      visibleToUser: true,
    });
    const manifest = buildControlManifest({
      artifactSha256: "a".repeat(64),
      inventories: [
        {
          route: "orb-day-select",
          nodes: [
            node("Open menu", "PASS"),
            node("Neutral, How you feel", "UNVERIFIED", "android.widget.SeekBar"),
          ],
        },
        {
          route: "global-drawer",
          nodes: [{ ...node("Mood", "PASS"), route: "global-drawer" }],
        },
      ],
      locale: "en",
      motion: "normal",
      runId: "baseline-drawer-theme-visual-1",
      scenario: "drawer-theme",
      sourceJourney: {
        bytes: 456,
        path: "output/baseline/journey.json",
        sha256: "b".repeat(64),
      },
    });

    expect(manifest.coverage).toEqual({
      discovered: 3,
      duplicateControlIds: 0,
      exercisedPass: 2,
      mandatoryBlocked: 0,
      mandatoryDiscovered: 3,
      mandatoryFail: 0,
      mandatoryUnverified: 1,
      notApplicable: 0,
      percent: 66.666667,
    });
    expect(validateControlManifest(manifest)).toEqual(manifest);
    expect(() => validateControlManifest(manifest, { requireComplete: true })).toThrow(
      /mandatory control coverage/i
    );

    expect(() =>
      validateControlManifest({
        ...manifest,
        controls: [...manifest.controls, manifest.controls[0]],
      })
    ).toThrow(/duplicate controlId/i);
  });

  it("derives the full mood journey and scrolling gesture from current semantic bounds", () => {
    expect(getRefineJourneyRequiredTexts()).toEqual([
      "How are you feeling right now?",
      "More precise",
    ]);
    expect(sliderJourneyPoints({ bottom: 360, left: 100, right: 1000, top: 200 })).toEqual({
      negative: { x: 144, y: 280 },
      neutral: { x: 550, y: 280 },
      positive: { x: 956, y: 280 },
    });
    expect(
      verticalSwipeWithinBounds({ bottom: 2200, left: 40, right: 1040, top: 400 }, "up")
    ).toEqual({
      from: { x: 540, y: 1840 },
      to: { x: 540, y: 760 },
    });
    expect(
      verticalSwipeWithinBounds({ bottom: 2200, left: 40, right: 1040, top: 400 }, "down")
    ).toEqual({
      from: { x: 540, y: 760 },
      to: { x: 540, y: 1840 },
    });
  });

  it("keeps each acceptance video inside one bounded semantic scenario", () => {
    expect(assertJourneyScenario("orb-slider-refine")).toBe("orb-slider-refine");
    expect(assertJourneyScenario("drawer-theme")).toBe("drawer-theme");
    expect(assertJourneyScenario("full-route-cycle")).toBe("full-route-cycle");
    expect(() => assertJourneyScenario("everything-at-once")).toThrow(/scenario/i);
  });

  it("finds the current scroll owner and reconciles every discovered clickable node", () => {
    const nodes = parseUiAutomatorNodes(`<?xml version="1.0" encoding="UTF-8"?>
      <hierarchy rotation="0">
        <node text="" content-desc="content" bounds="[40,400][1040,2200]" visible-to-user="true" enabled="true" scrollable="true" />
        <node text="Next" content-desc="" bounds="[409,2170][672,2299]" visible-to-user="true" enabled="true" clickable="true" />
        <node text="" content-desc="Open menu" bounds="[28,164][160,296]" visible-to-user="true" enabled="true" clickable="true" />
      </hierarchy>`);
    expect(findVisibleScrollableNode(nodes)?.bounds).toEqual({
      bottom: 2200,
      left: 40,
      right: 1040,
      top: 400,
    });

    const inventory = createClickableNodeInventory(nodes, {
      route: "orb",
      capturedAtMs: 10,
    });
    expect(inventory.map((entry) => entry.status)).toEqual(["UNVERIFIED", "UNVERIFIED"]);
    expect(
      reconcileClickableNode(inventory, {
        bounds: { bottom: 296, left: 28, right: 160, top: 164 },
        label: "Open menu",
        status: "PASS",
      }).map((entry) => ({ label: entry.label, status: entry.status }))
    ).toEqual([
      { label: "Next", status: "UNVERIFIED" },
      { label: "Open menu", status: "PASS" },
    ]);
  });

  it("validates the closed local ledger schema and rejects sensitive payloads", () => {
    const ledger = {
      schemaVersion: 1,
      baselineSha: "13ca51a80d23220574deba762851fe5a32372e46",
      environment: {
        deviceAlias: "emulator-5564",
        kind: "emulator",
        api: 36,
        refreshHz: 60,
        webViewVersion: "133.0.6943.137",
        gpu: "gfxstream",
        densityDpi: 422,
        thermalStatus: 0,
        batterySaver: false,
        animationScale: 1,
      },
      runs: [],
    };

    expect(validateEvidenceLedger(ledger)).toEqual(ledger);
    expect(
      validateEvidenceLedger({
        ...ledger,
        environment: { ...ledger.environment, api: 26, thermalStatus: null },
      }).environment.thermalStatus
    ).toBeNull();
    expect(() =>
      validateEvidenceLedger({
        ...ledger,
        environment: { ...ledger.environment, thermalStatus: -1 },
      })
    ).toThrow(/thermalStatus/i);
    expect(() => validateEvidenceLedger({ ...ledger, accessToken: "secret" })).toThrow(
      /additional|accessToken/i
    );
    expect(() =>
      validateEvidenceLedger({
        ...ledger,
        environment: { ...ledger.environment, deviceAlias: "person@example.com" },
      })
    ).toThrow(/privacy/i);
  });

  it("parses trace-processor CSV and emits package-scoped FrameTimeline queries", () => {
    expect(parseTraceProcessorCsv('"frames","fps"\n1200,60.0\n')).toEqual([
      { frames: "1200", fps: "60.0" },
    ]);

    const queries = buildTraceSummaryQueries("com.zenflow.app");
    expect(queries.frameTimeline).toContain("actual_frame_timeline_slice");
    expect(queries.frameTimeline).toContain("App Deadline Missed");
    expect(queries.webViewDraw).toContain("WebViewFunctor::drawGl");
    expect(queries.webViewDraw).toContain("com.zenflow.app");
    expect(() => buildTraceSummaryQueries("com.zenflow.app' OR 1=1 --")).toThrow(/package/i);
  });

  it("reads the active WebView provider instead of assuming the Google package", () => {
    expect(
      parseCurrentWebViewProvider(`Current WebView Update Service state
  Current WebView package (name, version): (com.android.webview, 133.0.6943.0)
  Preferred WebView package (name, version): (com.google.android.webview, 58.0.3029.125)`)
    ).toEqual({ packageName: "com.android.webview", version: "133.0.6943.0" });
    expect(parseCurrentWebViewProvider("Current WebView package: none")).toBeNull();
  });

  it("resolves the PID-scoped Android WebView DevTools socket", () => {
    expect(
      parseWebViewDevtoolsSocket(
        "0000000000000000: 00000002 00000000 00010000 0001 01 27312 @webview_devtools_remote_4716\n",
        4716
      )
    ).toBe("webview_devtools_remote_4716");
    expect(() => parseWebViewDevtoolsSocket("", 4716)).toThrow(/DevTools socket/i);
  });

  it("summarizes worker cadence, ACK latency, and visible gaps without frame capture", () => {
    const summary = summarizeOrbProbeSamples([
      { source: "webgl-worker", renderedAt: 0, postedAt: -10, requestId: 1 },
      { source: "webgl-worker", renderedAt: 16, postedAt: 4, requestId: 2 },
      { source: "webgl-worker", renderedAt: 33, postedAt: 20, requestId: 3 },
      { source: "webgl-main", renderedAt: 150 },
    ]);

    expect(summary.frameCount).toBe(4);
    expect(summary.presentedCadenceHz).toBe(20);
    expect(summary.gapsOver100Ms).toBe(1);
    expect(summary.frameIntervalP95Ms).toBe(117);
    expect(summary.workerAckCount).toBe(3);
    expect(summary.workerAckP95Ms).toBe(13);
    expect(summary.sources).toEqual(["webgl-main", "webgl-worker"]);
  });

  it("attributes composited pixel pressure to the largest DOM-backed drawing layers", () => {
    const summary = summarizeLayerAttribution({
      viewport: { width: 360, height: 800 },
      layers: [
        {
          layerId: "root",
          width: 360,
          height: 800,
          drawsContent: false,
          paintCount: 1,
        },
        {
          layerId: "ambient",
          parentLayerId: "root",
          backendNodeId: 101,
          width: 360,
          height: 800,
          drawsContent: true,
          paintCount: 3,
        },
        {
          layerId: "drawer",
          parentLayerId: "root",
          backendNodeId: 202,
          width: 320,
          height: 800,
          drawsContent: true,
          paintCount: 7,
        },
      ],
      nodesByBackendId: {
        "101": {
          selector: '[data-testid="ambient"]',
          styles: { filter: "none", backdropFilter: "saturate(0.94) contrast(0.98)" },
        },
        "202": {
          selector: "#nav-v2-drawer",
          styles: { filter: "none", backdropFilter: "blur(18px)" },
        },
      },
      reasonsByLayerId: {
        ambient: ["Has a backdrop filter."],
        drawer: ["Has a will-change: transform compositing hint."],
      },
    });

    expect(summary).toEqual({
      layerCount: 3,
      drawingLayerCount: 2,
      totalLayerPixels: 832000,
      totalDrawingPixels: 544000,
      totalLayerAreaRatio: 2.888889,
      totalDrawingAreaRatio: 1.888889,
      largestDrawingLayers: [
        {
          layerId: "ambient",
          parentLayerId: "root",
          backendNodeId: 101,
          selector: '[data-testid="ambient"]',
          width: 360,
          height: 800,
          estimatedPixels: 288000,
          paintCount: 3,
          invisible: false,
          reasons: ["Has a backdrop filter."],
          styles: { filter: "none", backdropFilter: "saturate(0.94) contrast(0.98)" },
        },
        {
          layerId: "drawer",
          parentLayerId: "root",
          backendNodeId: 202,
          selector: "#nav-v2-drawer",
          width: 320,
          height: 800,
          estimatedPixels: 256000,
          paintCount: 7,
          invisible: false,
          reasons: ["Has a will-change: transform compositing hint."],
          styles: { filter: "none", backdropFilter: "blur(18px)" },
        },
      ],
    });
  });

  it("normalizes physical-pixel WebView layers against a CSS viewport", () => {
    const summary = summarizeLayerAttribution({
      viewport: { width: 360, height: 800, devicePixelRatio: 2 },
      layers: [
        {
          layerId: "full-screen",
          width: 720,
          height: 1600,
          drawsContent: true,
        },
      ],
    });

    expect(summary.totalDrawingAreaRatio).toBe(1);
    expect(summary.largestDrawingLayers[0]).toMatchObject({
      width: 720,
      height: 1600,
      estimatedPixels: 1152000,
    });
  });
});
