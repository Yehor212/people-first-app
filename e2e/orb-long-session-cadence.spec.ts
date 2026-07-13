import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import sharp from "sharp";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

const OUTPUT_DIR = path.resolve(process.cwd(), "output/playwright/orb-long-session-cadence");
const MIN_PROOF_DWELL_MS = 60_000;
const ALLOW_SHORT_DWELL = process.env.ZENFLOW_ORB_ALLOW_SHORT_DWELL === "true";
const REQUESTED_DWELL_MS = readPositiveNumber("ZENFLOW_ORB_LONG_DWELL_MS", 65_000);
const DWELL_MS = ALLOW_SHORT_DWELL
  ? REQUESTED_DWELL_MS
  : Math.max(MIN_PROOF_DWELL_MS, REQUESTED_DWELL_MS);
const SAMPLE_WINDOW_MS = readPositiveNumber("ZENFLOW_ORB_SAMPLE_WINDOW_MS", 3_000);
const SHADER_TIME_WRAP_SECONDS = Math.PI * 6_000;
const GPU_NOISE_PHASE_WRAP = 8_670;
const MOTION_PHASE_WRAP = Math.PI * 2;
const UNIT_PHASE_WRAP = 1;
const MAX_CLOCK_TO_WALL_RATIO = 1.25;
const MIN_INITIAL_TO_LATE_PACE_RATIO = 0.85;
// Headless software compositors can legitimately render a settled late window
// slightly faster than the cold initial window while preserving clock bounds.
const MAX_INITIAL_TO_LATE_PACE_RATIO = 1.25;
const MIN_SCREENSHOT_WINDOW_PACE_RATIO = 0.65;
const MAX_SCREENSHOT_WINDOW_PACE_RATIO = 1.5;
const MIN_CANVAS_TRANSITION_PACE_RATIO = 0.7;
const MAX_CANVAS_TRANSITION_PACE_RATIO = 1.3;
const MAX_ROTATION_RADIANS_PER_SECOND = 0.055 * MAX_CLOCK_TO_WALL_RATIO + 0.005;
const MAX_NOISE_PHASE_PER_SECOND = 0.85 * MAX_CLOCK_TO_WALL_RATIO + 0.025;
const MAX_PULSE_PHASE_PER_SECOND = 0.15 * MAX_CLOCK_TO_WALL_RATIO + 0.005;
const MAX_BREATH_PHASE_PER_SECOND = (1 / 8) * MAX_CLOCK_TO_WALL_RATIO + 0.005;
const RENDERED_ENDPOINT_TOLERANCE = 0.04;
const RENDERED_ENDPOINT_ABSOLUTE_MIN = 1 - RENDERED_ENDPOINT_TOLERANCE;
const VISUAL_TRANSITION_FRAME_COUNT = 8;
const VISUAL_IDLE_FRAME_COUNT = 45;
const VISUAL_FRAME_INTERVAL_MS = 200;
const MIN_IDLE_VISUAL_WINDOW_MS = 8_000;
const SUSTAINED_CADENCE_WINDOW_MS = 250;
const ENTRY_RENDERED_CADENCE_WINDOW_MS = 10_000;
const RENDERED_CADENCE_WINDOW_MS = 5_000;
const RENDERED_CADENCE_STABILIZATION_WINDOW_MS = 2_000;
const RENDERED_CADENCE_MAX_STABILIZATION_WINDOWS = 4;
const WORKER_STATIC_HEALTHCHECK_MS = 5_000;
// This probe runs against CI/headless software compositors as well as local GPU
// Chrome. Real visual smoothness is covered by screenshot-motion proofs below;
// this clock-probe floor only catches frozen or severely starved worker cadence.
const MIN_RENDERED_FRAMES_PER_SECOND = 8;
// Software WebGL can spend several seconds proving the immutable first frame.
// The route stays behind its branded loader; steady-state ACKs keep the tighter budget below.
const MAX_COLD_ENTRY_WORKER_ACK_LATENCY_MS = 12_000;
const MAX_STEADY_WORKER_ACK_LATENCY_MS = 500;
const MAX_VISUAL_PROBE_WORKER_ACK_LATENCY_MS = 1_500;
const MIN_VISUAL_LUMA_STD_DEV = 5;
const ORB_PRODUCTION_SOURCES = [
  "src/components/state-of-mind/ValenceOrb.tsx",
  "src/components/state-of-mind/canonicalOrbPrewarm.ts",
  "src/components/state-of-mind/orbRenderer.ts",
  "src/components/state-of-mind/orbShader.frag",
  "src/components/state-of-mind/orbShader.ts",
  "src/components/state-of-mind/orbWebGpu.ts",
  "src/components/state-of-mind/orbWorker.ts",
] as const;

function sha256(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

const ORB_SOURCE_DIGEST = createHash("sha256")
  .update(ORB_PRODUCTION_SOURCES.map((file) => readFileSync(file)).join("\n"))
  .digest("hex");
const ORB_SOURCE_IDENTITIES = Object.fromEntries(
  ORB_PRODUCTION_SOURCES.map((file) => [file, sha256(readFileSync(file))]),
);
const LATEST_ORB_SOURCE_MTIME_MS = Math.max(
  ...ORB_PRODUCTION_SOURCES.map((file) => statSync(file).mtimeMs),
);
const DIST_INDEX_MTIME_MS = existsSync("dist/index.html") ? statSync("dist/index.html").mtimeMs : 0;
const DIST_ROOT = path.resolve(process.cwd(), "dist");
const LOCAL_PRODUCTION_PREVIEW =
  process.env.CI === "true" && process.env.ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER === "true";
const REAL_GPU_PARITY = process.env.ZENFLOW_ORB_REAL_GPU_PARITY === "true";
const REAL_CHROME_CHANNEL = process.env.ZENFLOW_ORB_CHROME_CHANNEL === "true";

type WebGpuAdapterIdentity = {
  architecture: string;
  description: string;
  device: string;
  isFallbackAdapter: boolean;
  vendor: string;
};

async function readWebGpuAdapterIdentity(page: Page): Promise<WebGpuAdapterIdentity | null> {
  return page.evaluate(async () => {
    const gpu = (navigator as Navigator & {
      gpu?: { requestAdapter?: () => Promise<unknown> };
    }).gpu;
    const adapter = await gpu?.requestAdapter?.() as {
      info?: {
        architecture?: string;
        description?: string;
        device?: string;
        vendor?: string;
      };
      isFallbackAdapter?: boolean;
    } | null | undefined;
    if (!adapter) return null;

    return {
      architecture: adapter.info?.architecture ?? "",
      description: adapter.info?.description ?? "",
      device: adapter.info?.device ?? "",
      isFallbackAdapter: adapter.isFallbackAdapter === true,
      vendor: adapter.info?.vendor ?? "",
    };
  });
}

function isSoftwareWebGpuAdapterIdentity(adapter: WebGpuAdapterIdentity | null): boolean {
  if (!adapter) return false;
  if (adapter.isFallbackAdapter) return true;
  const identity = [adapter.architecture, adapter.description, adapter.device, adapter.vendor]
    .join(" ")
    .toLowerCase();
  return [
    "swiftshader",
    "llvmpipe",
    "software rasterizer",
    "microsoft basic render driver",
    "warp adapter",
  ].some((marker) => identity.includes(marker));
}

function resolveDistAssetPath(assetHref: string) {
  const pathname = new URL(assetHref, "https://zenflow.test/").pathname;
  const relativePath = pathname.replace(/^\/people-first-app\//, "").replace(/^\//, "");
  return path.join(DIST_ROOT, relativePath);
}

function readDiskBuildIdentity() {
  if (!existsSync(path.join(DIST_ROOT, "index.html"))) return null;
  const indexPath = path.join(DIST_ROOT, "index.html");
  const indexHtml = readFileSync(indexPath);
  const mainAssetHref = indexHtml
    .toString("utf8")
    .match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
  const assetsDir = path.join(DIST_ROOT, "assets");
  const workerAssetName = existsSync(assetsDir)
    ? readdirSync(assetsDir).find((name) => /^orbWorker-[\w-]+\.js$/.test(name))
    : undefined;
  if (!mainAssetHref || !workerAssetName) return null;

  const mainAssetPath = resolveDistAssetPath(mainAssetHref);
  const workerAssetPath = path.join(assetsDir, workerAssetName);
  if (!existsSync(mainAssetPath) || !existsSync(workerAssetPath)) return null;

  return {
    index: {
      href: "/people-first-app/",
      sha256: sha256(indexHtml),
    },
    main: {
      href: mainAssetHref,
      sha256: sha256(readFileSync(mainAssetPath)),
    },
    worker: {
      href: `/people-first-app/assets/${workerAssetName}`,
      sha256: sha256(readFileSync(workerAssetPath)),
    },
  };
}

const DISK_BUILD_IDENTITY = readDiskBuildIdentity();

type ProbeSource = "canvas2d" | "webgl-main" | "webgpu-main" | "webgl-worker";

type ProbeSample = {
  source: ProbeSource;
  rendererPolicy: string;
  rendererTier: string | null;
  size: number;
  renderedValence: number;
  time: number;
  motionPhase: number;
  noisePhase: number;
  pulsePhase: number;
  breathPhase: number;
  renderedAt: number;
  postedAt?: number;
  requestId?: number;
};

type ProbeWindow = Window & {
  __zenCompoundStartupFaults?: {
    webgpuPresentationFailures: number;
    workerConstructionFailures: number;
  };
  __zenDropNextOrbWorkerAck?: boolean;
  __zenDroppedOrbWorkerAcks?: number;
  __zenOrbClockProbeSink?: (sample: ProbeSample) => void;
  __zenOrbLifecycleProbeSink?: (event: {
    at: number;
    event: string;
    details?: Record<string, boolean | number | string | null>;
  }) => void;
  __zenOrbRecoveryContinuity?: {
    gapsMs: number[];
    initialCanvas: HTMLCanvasElement;
    intervalId: number;
    lastCanvas: HTMLCanvasElement | null;
    missingSince: number | null;
    observer: MutationObserver;
    replacements: number;
  };
  __zenOrbLongSession?: {
    capabilities: {
      longAnimationFrameObserver: boolean;
      longTaskObserver: boolean;
      supportedEntryTypes: string[];
    };
    canvasEvents: Array<{ at: number; event: "append" | "replace"; size: number; tier: string }>;
    tierTimeline: Array<{ at: number; source: string; tier: string | null }>;
    visibilityEvents: Array<{
      at: number;
      event: "initial" | "visibilitychange" | "pagehide" | "pageshow";
      hidden: boolean;
      visibilityState: DocumentVisibilityState;
    }>;
    longAnimationFrames: Array<{
      blockingDuration: number;
      duration: number;
      maxScriptDuration: number;
      scriptCount: number;
      startTime: number;
    }>;
    longTasks: Array<{ duration: number; startTime: number }>;
    lifecycleEvents: Array<{
      at: number;
      event: string;
      details?: Record<string, boolean | number | string | null>;
    }>;
    samples: ProbeSample[];
  };
};

type Profile = {
  name: "canonical-default" | "canonical-main-thread" | "canvas-fallback";
  rendererOverride?: "canvas" | "webgpu";
  disableWorkerWebGL?: boolean;
  requiresMainThreadAsyncCapability?: boolean;
  expectedTier: RegExp;
  visualClaim: string;
};

const PROFILES: Profile[] = [
  {
    name: "canonical-default",
    expectedTier: /^(webgpu-main|webgl-main|webgl-worker)$/,
    visualClaim: "canonical visual and cadence proof",
  },
  {
    name: "canonical-main-thread",
    rendererOverride: "webgpu",
    disableWorkerWebGL: true,
    requiresMainThreadAsyncCapability: true,
    expectedTier: /^(?:webgpu-main|webgl-main)$/,
    visualClaim: "canonical main-thread visual and cadence proof",
  },
  {
    name: "canvas-fallback",
    rendererOverride: "canvas",
    expectedTier: /^canvas2d$/,
    visualClaim: "cadence fallback proof only; visual parity is not asserted",
  },
];

function readPositiveNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function readServedBuildIdentity(page: Page) {
  if (!DISK_BUILD_IDENTITY) {
    throw new Error("Current production build identity is unavailable");
  }

  const origin = new URL(page.url()).origin;
  const readAsset = async (href: string) => {
    const response = await page.request.get(new URL(href, origin).toString());
    expect(response.ok(), `${href} must be served by the production preview`).toBe(true);
    return sha256(await response.body());
  };

  return {
    index: {
      ...DISK_BUILD_IDENTITY.index,
      servedSha256: await readAsset(DISK_BUILD_IDENTITY.index.href),
    },
    main: {
      ...DISK_BUILD_IDENTITY.main,
      servedSha256: await readAsset(DISK_BUILD_IDENTITY.main.href),
    },
    worker: {
      ...DISK_BUILD_IDENTITY.worker,
      servedSha256: await readAsset(DISK_BUILD_IDENTITY.worker.href),
    },
  };
}

function expectServedBuildMatchesDisk(
  identity: Awaited<ReturnType<typeof readServedBuildIdentity>>,
) {
  for (const asset of [identity.index, identity.main, identity.worker]) {
    expect(asset.servedSha256, `${asset.href} must match the freshly built disk asset`).toBe(
      asset.sha256,
    );
  }
}

function positiveWrappedDelta(previous: number, current: number, wrap: number) {
  const delta = current - previous;
  return delta >= 0 ? delta : delta + wrap;
}

function maxOrZero(values: number[]) {
  return values.length === 0 ? 0 : Math.max(...values);
}

function cadenceTimestamp(sample: ProbeSample) {
  return sample.source === "webgl-worker" && sample.postedAt !== undefined
    ? sample.postedAt
    : sample.renderedAt;
}

function renderedCadenceTimestamp(sample: ProbeSample) {
  return sample.renderedAt;
}

type VisualMotionSummary = {
  elapsedMs: number;
  frameCount: number;
  meanFrameDifference: number;
  meanFrameDifferencePerSecond: number;
  medianFrameDifferencePerSecond: number;
  maxFrameDifferencePerSecond: number;
  meanIntervalMs: number;
  firstFrameLumaStdDev: number;
  lastFrameLumaStdDev: number;
};

async function decodeVisualFrame(buffer: Buffer) {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, channels: info.channels, width: info.width, height: info.height };
}

function visualLumaStdDev(frame: Awaited<ReturnType<typeof decodeVisualFrame>>) {
  let sum = 0;
  let sumSquares = 0;
  const pixelCount = frame.width * frame.height;
  for (let offset = 0; offset < frame.data.length; offset += frame.channels) {
    const luma =
      frame.data[offset] * 0.2126 +
      frame.data[offset + 1] * 0.7152 +
      frame.data[offset + 2] * 0.0722;
    sum += luma;
    sumSquares += luma * luma;
  }
  const mean = sum / pixelCount;
  return Math.sqrt(Math.max(0, sumSquares / pixelCount - mean * mean));
}

function normalizedVisualDifference(
  previous: Awaited<ReturnType<typeof decodeVisualFrame>>,
  current: Awaited<ReturnType<typeof decodeVisualFrame>>,
) {
  if (
    previous.width !== current.width ||
    previous.height !== current.height ||
    previous.channels !== current.channels
  ) {
    throw new Error("Orb visual samples changed dimensions during one measurement window");
  }

  let absoluteDifference = 0;
  for (let offset = 0; offset < previous.data.length; offset += previous.channels) {
    absoluteDifference += Math.abs(current.data[offset] - previous.data[offset]);
    absoluteDifference += Math.abs(current.data[offset + 1] - previous.data[offset + 1]);
    absoluteDifference += Math.abs(current.data[offset + 2] - previous.data[offset + 2]);
  }
  return absoluteDifference / (previous.width * previous.height * 3 * 255);
}

function visualDifferenceStats(
  previous: Awaited<ReturnType<typeof decodeVisualFrame>>,
  current: Awaited<ReturnType<typeof decodeVisualFrame>>,
) {
  if (
    previous.width !== current.width ||
    previous.height !== current.height ||
    previous.channels !== current.channels
  ) {
    throw new Error("Orb visual samples changed dimensions during one comparison");
  }

  const differences: number[] = [];
  let absoluteDifference = 0;
  let changedChannels = 0;
  for (let offset = 0; offset < previous.data.length; offset += previous.channels) {
    for (let channel = 0; channel < 3; channel += 1) {
      const difference = Math.abs(current.data[offset + channel] - previous.data[offset + channel]);
      differences.push(difference);
      absoluteDifference += difference;
      if (difference > 0) changedChannels += 1;
    }
  }
  differences.sort((left, right) => left - right);
  const percentile = (fraction: number) =>
    differences[Math.floor((differences.length - 1) * fraction)] ?? 0;

  return {
    changedChannelRatio: changedChannels / Math.max(1, differences.length),
    maxChannelDifference: differences.at(-1) ?? 0,
    meanNormalizedDifference: absoluteDifference / Math.max(1, differences.length * 255),
    p99ChannelDifference: percentile(0.99),
    p999ChannelDifference: percentile(0.999),
  };
}

async function captureVisualMotionWindow(
  page: Page,
  hero: Locator,
  frameCount = VISUAL_TRANSITION_FRAME_COUNT,
): Promise<VisualMotionSummary> {
  const frames: Array<Awaited<ReturnType<typeof decodeVisualFrame>>> = [];
  const capturedAt: number[] = [];
  const startedAt = Date.now();

  for (let index = 0; index < frameCount; index += 1) {
    if (index > 0) {
      const waitMs = Math.max(0, startedAt + index * VISUAL_FRAME_INTERVAL_MS - Date.now());
      if (waitMs > 0) await page.waitForTimeout(waitMs);
    }
    const screenshot = await hero.screenshot({ animations: "allow" });
    capturedAt.push(Date.now());
    frames.push(await decodeVisualFrame(screenshot));
  }

  const differences: number[] = [];
  const differencesPerSecond: number[] = [];
  const intervalsMs: number[] = [];
  for (let index = 1; index < frames.length; index += 1) {
    const intervalMs = Math.max(1, capturedAt[index] - capturedAt[index - 1]);
    const difference = normalizedVisualDifference(frames[index - 1], frames[index]);
    intervalsMs.push(intervalMs);
    differences.push(difference);
    differencesPerSecond.push(difference / (intervalMs / 1_000));
  }
  const orderedRates = [...differencesPerSecond].sort((left, right) => left - right);
  const middle = Math.floor(orderedRates.length / 2);
  const medianRate = orderedRates.length % 2 === 0
    ? ((orderedRates[middle - 1] ?? 0) + (orderedRates[middle] ?? 0)) / 2
    : (orderedRates[middle] ?? 0);

  return {
    elapsedMs: Math.max(0, (capturedAt.at(-1) ?? 0) - (capturedAt[0] ?? 0)),
    frameCount: frames.length,
    meanFrameDifference:
      differences.reduce((sum, value) => sum + value, 0) / Math.max(1, differences.length),
    meanFrameDifferencePerSecond:
      differencesPerSecond.reduce((sum, value) => sum + value, 0) /
      Math.max(1, differencesPerSecond.length),
    medianFrameDifferencePerSecond: medianRate,
    maxFrameDifferencePerSecond: maxOrZero(differencesPerSecond),
    meanIntervalMs:
      intervalsMs.reduce((sum, value) => sum + value, 0) / Math.max(1, intervalsMs.length),
    firstFrameLumaStdDev: visualLumaStdDev(frames[0]),
    lastFrameLumaStdDev: visualLumaStdDev(frames.at(-1) ?? frames[0]),
  };
}

async function captureCanvasPixels(page: Page, canvas: Locator) {
  const clip = await canvas.boundingBox();
  if (!clip) throw new Error("Canonical orb canvas has no screenshot bounds");
  return page.screenshot({ animations: "allow", clip });
}

function summarizeCadence(
  samples: ProbeSample[],
  timestampFor: (sample: ProbeSample) => number = cadenceTimestamp,
) {
  const ordered = samples
    .filter((sample) => sample.size >= 200)
    .sort((left, right) => timestampFor(left) - timestampFor(right));
  const pairs = ordered.slice(1).map((current, index) => {
    const previous = ordered[index];
    const wallSeconds = (timestampFor(current) - timestampFor(previous)) / 1_000;
    return {
      wallSeconds,
      clockStep: positiveWrappedDelta(previous.time, current.time, SHADER_TIME_WRAP_SECONDS),
      motionStep: positiveWrappedDelta(previous.motionPhase, current.motionPhase, MOTION_PHASE_WRAP),
      noiseStep: positiveWrappedDelta(previous.noisePhase, current.noisePhase, GPU_NOISE_PHASE_WRAP),
      pulseStep: positiveWrappedDelta(previous.pulsePhase, current.pulsePhase, UNIT_PHASE_WRAP),
      breathStep: positiveWrappedDelta(previous.breathPhase, current.breathPhase, UNIT_PHASE_WRAP),
    };
  }).filter((pair) => pair.wallSeconds > 0);
  const sustainedWindows = ordered.flatMap((start, index) => {
    const startAt = timestampFor(start);
    const end = ordered.slice(index + 1).find(
      (sample) => timestampFor(sample) - startAt >= SUSTAINED_CADENCE_WINDOW_MS,
    );
    if (!end) return [];
    const wallSeconds = (timestampFor(end) - startAt) / 1_000;
    if (wallSeconds <= 0) return [];
    return [{
      wallSeconds,
      clockStep: positiveWrappedDelta(start.time, end.time, SHADER_TIME_WRAP_SECONDS),
      motionStep: positiveWrappedDelta(start.motionPhase, end.motionPhase, MOTION_PHASE_WRAP),
      noiseStep: positiveWrappedDelta(start.noisePhase, end.noisePhase, GPU_NOISE_PHASE_WRAP),
      pulseStep: positiveWrappedDelta(start.pulsePhase, end.pulsePhase, UNIT_PHASE_WRAP),
      breathStep: positiveWrappedDelta(start.breathPhase, end.breathPhase, UNIT_PHASE_WRAP),
    }];
  });

  const first = ordered[0];
  const last = ordered.at(-1);
  const windowWallSeconds = first && last
    ? (timestampFor(last) - timestampFor(first)) / 1_000
    : 0;
  const windowClockSeconds = pairs.reduce((total, pair) => total + pair.clockStep, 0);
  const windowMotionPhase = pairs.reduce((total, pair) => total + pair.motionStep, 0);
  const windowNoisePhase = pairs.reduce((total, pair) => total + pair.noiseStep, 0);
  const windowPulsePhase = pairs.reduce((total, pair) => total + pair.pulseStep, 0);
  const windowBreathPhase = pairs.reduce((total, pair) => total + pair.breathStep, 0);

  return {
    sampleCount: ordered.length,
    sources: [...new Set(ordered.map((sample) => sample.source))],
    tiers: [...new Set(ordered.map((sample) => sample.rendererTier))],
    maxClockStepSeconds: maxOrZero(pairs.map((pair) => pair.clockStep)),
    maxAdjacentClockToWallRatio: maxOrZero(
      pairs.map((pair) => pair.clockStep / pair.wallSeconds),
    ),
    maxMotionPhasePerSecond: maxOrZero(
      pairs.map((pair) => pair.motionStep / pair.wallSeconds),
    ),
    maxNoisePhasePerSecond: maxOrZero(
      pairs.map((pair) => pair.noiseStep / pair.wallSeconds),
    ),
    maxPulsePhasePerSecond: maxOrZero(
      pairs.map((pair) => pair.pulseStep / pair.wallSeconds),
    ),
    maxBreathPhasePerSecond: maxOrZero(
      pairs.map((pair) => pair.breathStep / pair.wallSeconds),
    ),
    maxSustainedClockToWallRatio: maxOrZero(
      sustainedWindows.map((window) => window.clockStep / window.wallSeconds),
    ),
    maxSustainedMotionPhasePerSecond: maxOrZero(
      sustainedWindows.map((window) => window.motionStep / window.wallSeconds),
    ),
    maxSustainedNoisePhasePerSecond: maxOrZero(
      sustainedWindows.map((window) => window.noiseStep / window.wallSeconds),
    ),
    maxSustainedPulsePhasePerSecond: maxOrZero(
      sustainedWindows.map((window) => window.pulseStep / window.wallSeconds),
    ),
    maxSustainedBreathPhasePerSecond: maxOrZero(
      sustainedWindows.map((window) => window.breathStep / window.wallSeconds),
    ),
    maxWorkerAckLatencyMs: maxOrZero(
      ordered
        .filter((sample) => sample.source === "webgl-worker" && sample.postedAt !== undefined)
        .map((sample) => sample.renderedAt - (sample.postedAt ?? sample.renderedAt)),
    ),
    renderedFramesPerSecond:
      windowWallSeconds > 0 ? Math.max(0, ordered.length - 1) / windowWallSeconds : 0,
    windowClockToWallRatio: windowWallSeconds > 0 ? windowClockSeconds / windowWallSeconds : 0,
    windowMotionPhasePerSecond:
      windowWallSeconds > 0 ? windowMotionPhase / windowWallSeconds : 0,
    windowNoisePhasePerSecond:
      windowWallSeconds > 0 ? windowNoisePhase / windowWallSeconds : 0,
    windowPulsePhasePerSecond:
      windowWallSeconds > 0 ? windowPulsePhase / windowWallSeconds : 0,
    windowBreathPhasePerSecond:
      windowWallSeconds > 0 ? windowBreathPhase / windowWallSeconds : 0,
    workerSamplesMissingAckMetadata: ordered.filter(
      (sample) => sample.source === "webgl-worker" &&
        (sample.requestId === undefined || sample.postedAt === undefined),
    ).length,
  };
}

type TransitionSummary = {
  baselineValence: number;
  targetValence: number;
  sampleCount: number;
  t50Ms: number | null;
  t80Ms: number | null;
  t90Ms: number | null;
  finalValence: number;
  cadence: ReturnType<typeof summarizeCadence>;
  visualMotion?: VisualMotionSummary;
};

function summarizeTransition(
  samples: ProbeSample[],
  inputAt: number,
  targetValence: number,
): TransitionSummary {
  const ordered = samples
    .filter((sample) => sample.size >= 200)
    .sort((left, right) => left.renderedAt - right.renderedAt);
  const baseline = [...ordered].reverse().find((sample) => sample.renderedAt <= inputAt) ?? ordered[0];
  if (!baseline) throw new Error("Transition probe did not capture a baseline sample");

  const initialDistance = Math.abs(targetValence - baseline.renderedValence);
  if (initialDistance < 0.5) {
    throw new Error(`Transition baseline is too close to target: ${baseline.renderedValence}`);
  }

  const transitionSamples = ordered.filter((sample) => sample.renderedAt >= inputAt);
  const progressSamples = transitionSamples.map((sample) => ({
    atMs: sample.renderedAt - inputAt,
    progress: 1 - Math.abs(targetValence - sample.renderedValence) / initialDistance,
  }));
  const thresholdAt = (threshold: number) =>
    progressSamples.find((sample) => sample.progress >= threshold)?.atMs ?? null;

  return {
    baselineValence: baseline.renderedValence,
    targetValence,
    sampleCount: transitionSamples.length,
    t50Ms: thresholdAt(0.5),
    t80Ms: thresholdAt(0.8),
    t90Ms: thresholdAt(0.9),
    finalValence: transitionSamples.at(-1)?.renderedValence ?? baseline.renderedValence,
    cadence: summarizeCadence(transitionSamples),
  };
}

async function installLongSessionProbe(page: Page) {
  await page.addInitScript(() => {
    const win = window as ProbeWindow;
    win.__zenOrbLongSession = {
      capabilities: {
        longAnimationFrameObserver: false,
        longTaskObserver: false,
        supportedEntryTypes: [...(PerformanceObserver.supportedEntryTypes ?? [])],
      },
      canvasEvents: [],
      tierTimeline: [],
      visibilityEvents: [{
        at: performance.now(),
        event: "initial",
        hidden: document.hidden,
        visibilityState: document.visibilityState,
      }],
      longAnimationFrames: [],
      longTasks: [],
      lifecycleEvents: [],
      samples: [],
    };
    win.__zenOrbLifecycleProbeSink = (event) => {
      win.__zenOrbLongSession?.lifecycleEvents.push(event);
    };
    win.__zenOrbClockProbeSink = (sample) => {
      const state = win.__zenOrbLongSession;
      if (!state || sample.size < 200) return;
      state.samples.push(sample);
      if (state.samples.length > 20_000) state.samples.splice(0, 5_000);
      const previousTier = state.tierTimeline.at(-1);
      if (
        !previousTier ||
        previousTier.source !== sample.source ||
        previousTier.tier !== sample.rendererTier
      ) {
        state.tierTimeline.push({
          at: sample.renderedAt,
          source: sample.source,
          tier: sample.rendererTier,
        });
      }
    };

    const recordVisibility = (
      event: "visibilitychange" | "pagehide" | "pageshow",
    ) => {
      win.__zenOrbLongSession?.visibilityEvents.push({
        at: performance.now(),
        event,
        hidden: document.hidden,
        visibilityState: document.visibilityState,
      });
    };
    document.addEventListener("visibilitychange", () => recordVisibility("visibilitychange"));
    window.addEventListener("pagehide", () => recordVisibility("pagehide"));
    window.addEventListener("pageshow", () => recordVisibility("pageshow"));

    const isCanvas = (node: Node): node is HTMLCanvasElement => node.nodeName === "CANVAS";
    const recordCanvas = (event: "append" | "replace", canvas: HTMLCanvasElement) => {
      const state = win.__zenOrbLongSession;
      if (!state || Math.max(canvas.width, canvas.height) < 200) return;
      state.canvasEvents.push({
        at: performance.now(),
        event,
        size: Math.max(canvas.width, canvas.height),
        tier: canvas.dataset.orbRendererTier ?? "",
      });
    };

    const originalAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function appendChildWithProbe<T extends Node>(child: T): T {
      const result = originalAppendChild.call(this, child) as T;
      if (isCanvas(child)) recordCanvas("append", child);
      return result;
    };

    const originalReplaceChild = Element.prototype.replaceChild;
    Element.prototype.replaceChild = function replaceChildWithProbe<T extends Node>(
      newChild: Node,
      oldChild: T,
    ): T {
      const result = originalReplaceChild.call(this, newChild, oldChild) as T;
      if (isCanvas(newChild)) recordCanvas("replace", newChild);
      return result;
    };

    try {
      new PerformanceObserver((list) => {
        const state = win.__zenOrbLongSession;
        if (!state) return;
        state.longTasks.push(...list.getEntries().map((entry) => ({
          duration: entry.duration,
          startTime: entry.startTime,
        })));
      }).observe({ type: "longtask", buffered: true });
      win.__zenOrbLongSession.capabilities.longTaskObserver = true;
    } catch {
      // Browser capability is recorded by the empty collection and final evidence packet.
    }

    try {
      new PerformanceObserver((list) => {
        const state = win.__zenOrbLongSession;
        if (!state) return;
        state.longAnimationFrames.push(...list.getEntries().map((entry) => {
          const loaf = entry as PerformanceEntry & {
            blockingDuration?: number;
            scripts?: Array<{ duration?: number }>;
          };
          const scripts = loaf.scripts ?? [];
          return {
            blockingDuration: loaf.blockingDuration ?? 0,
            duration: entry.duration,
            maxScriptDuration: scripts.reduce(
              (maximum, script) => Math.max(maximum, script.duration ?? 0),
              0,
            ),
            scriptCount: scripts.length,
            startTime: entry.startTime,
          };
        }));
      }).observe({ type: "long-animation-frame", buffered: true });
      win.__zenOrbLongSession.capabilities.longAnimationFrameObserver = true;
    } catch {
      // Browser capability is recorded by the empty collection and final evidence packet.
    }
  });
}

async function installDroppedAckWorkerProbe(page: Page) {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const win = window as ProbeWindow;
    win.__zenDropNextOrbWorkerAck = false;
    win.__zenDroppedOrbWorkerAcks = 0;

    class AckDroppingWorker {
      private readonly delegate: Worker;
      private dropRequestId: number | null = null;
      onmessage: Worker["onmessage"] = null;
      onerror: Worker["onerror"] = null;

      constructor(scriptURL: string | URL, options?: WorkerOptions) {
        this.delegate = new NativeWorker(scriptURL, options);
        this.delegate.onmessage = (event) => {
          if (
            event.data?.type === "rendered" &&
            event.data?.requestId === this.dropRequestId
          ) {
            this.dropRequestId = null;
            win.__zenDroppedOrbWorkerAcks = (win.__zenDroppedOrbWorkerAcks ?? 0) + 1;
            return;
          }
          this.onmessage?.call(this as unknown as Worker, event);
        };
        this.delegate.onerror = (event) => {
          this.onerror?.call(this as unknown as AbstractWorker, event);
        };
      }

      postMessage(message: unknown, transfer?: Transferable[]) {
        const renderMessage = message as {
          payload?: { size?: number };
          requestId?: number;
          type?: string;
        };
        if (
          win.__zenDropNextOrbWorkerAck &&
          renderMessage.type === "render" &&
          (renderMessage.payload?.size ?? 0) >= 200 &&
          renderMessage.requestId !== undefined
        ) {
          win.__zenDropNextOrbWorkerAck = false;
          this.dropRequestId = renderMessage.requestId;
        }
        if (transfer) {
          this.delegate.postMessage(message, transfer);
          return;
        }
        this.delegate.postMessage(message);
      }

      terminate() {
        this.delegate.terminate();
      }
    }

    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: AckDroppingWorker,
    });
  });
}

async function installCompoundStartupFailureProbe(page: Page) {
  await page.addInitScript(() => {
    const win = window as ProbeWindow;
    win.__zenCompoundStartupFaults = {
      webgpuPresentationFailures: 0,
      workerConstructionFailures: 0,
    };

    const NativeWorker = window.Worker;
    const WorkerWithOrbConstructionFailure = new Proxy(NativeWorker, {
      construct(target, args) {
        const options = args[1] as WorkerOptions | undefined;
        if (options?.name === "zenflow-orb-renderer") {
          win.__zenCompoundStartupFaults!.workerConstructionFailures += 1;
          throw new Error("Injected orb worker construction failure");
        }
        return Reflect.construct(target, args, target);
      },
    });
    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: WorkerWithOrbConstructionFailure,
    });

    const nativeGpu = (navigator as Navigator & {
      gpu?: { requestAdapter?: (...args: unknown[]) => Promise<unknown> };
    }).gpu;
    if (nativeGpu?.requestAdapter) {
      const gpuWithTestHardwareIdentity = new Proxy(nativeGpu, {
        get(target, property) {
          if (property === "requestAdapter") {
            return async (...args: unknown[]) => {
              const adapter = await target.requestAdapter?.(...args);
              if (!adapter || typeof adapter !== "object") return adapter;
              return new Proxy(adapter, {
                get(adapterTarget, adapterProperty) {
                  if (adapterProperty === "info") {
                    return {
                      architecture: "injected-test-hardware",
                      description: "ZenFlow deterministic WebGPU fault probe",
                      device: "injected-test-device",
                      vendor: "zenflow-test",
                    };
                  }
                  if (adapterProperty === "isFallbackAdapter") return false;
                  const value = Reflect.get(adapterTarget, adapterProperty, adapterTarget);
                  return typeof value === "function" ? value.bind(adapterTarget) : value;
                },
              });
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      Object.defineProperty(navigator, "gpu", {
        configurable: true,
        value: gpuWithTestHardwareIdentity,
      });
    }

    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: function getContextWithWebGpuPresentationFailure(
        this: HTMLCanvasElement,
        contextId: string,
        ...args: unknown[]
      ) {
        const context = Reflect.apply(nativeGetContext, this, [contextId, ...args]);
        if (contextId !== "webgpu" || !context || typeof context !== "object") return context;

        return new Proxy(context, {
          get(target, property) {
            if (property === "getCurrentTexture") {
              return () => {
                win.__zenCompoundStartupFaults!.webgpuPresentationFailures += 1;
                throw new DOMException(
                  "Injected WebGPU first-frame presentation failure",
                  "InvalidStateError",
                );
              };
            }
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    });
  });
}

async function clearSamples(page: Page) {
  await page.evaluate(() => {
    const state = (window as ProbeWindow).__zenOrbLongSession;
    if (!state) throw new Error("Orb long-session probe was not installed");
    state.samples = [];
  });
}

async function readSamples(page: Page) {
  return page.evaluate(() => {
    const state = (window as ProbeWindow).__zenOrbLongSession;
    if (!state) throw new Error("Orb long-session probe was not installed");
    return state.samples;
  });
}

async function readLatestRenderedValence(page: Page) {
  return page.evaluate(() => {
    const samples = (window as ProbeWindow).__zenOrbLongSession?.samples ?? [];
    return [...samples].reverse().find((sample) => sample.size >= 200)?.renderedValence ?? null;
  });
}

async function waitForRenderedValence(
  page: Page,
  target: number,
  tolerance = RENDERED_ENDPOINT_TOLERANCE,
) {
  await expect.poll(async () => readLatestRenderedValence(page), { timeout: 12_000 }).not.toBeNull();
  await expect.poll(async () => Math.abs(((await readLatestRenderedValence(page)) ?? 99) - target), {
    timeout: 12_000,
  }).toBeLessThanOrEqual(tolerance);
}

async function setSliderEndpoint(
  page: Page,
  slider: Locator,
  key: "Home" | "End",
  ariaValue: string,
  renderedValence: number,
) {
  await slider.focus();
  await page.keyboard.press(key);
  await expect(slider).toHaveAttribute("aria-valuenow", ariaValue);
  await waitForRenderedValence(page, renderedValence);
}

async function measureSliderTransition(
  page: Page,
  slider: Locator,
  hero: Locator,
  options: {
    ariaValue?: string;
    key?: "Home" | "End";
    targetValence?: number;
  } = {},
): Promise<TransitionSummary> {
  const {
    ariaValue = "6",
    key = "End",
    targetValence = 1,
  } = options;
  await clearSamples(page);
  await page.waitForTimeout(250);
  const inputAt = await page.evaluate(() => performance.now());
  await slider.focus();
  await page.keyboard.press(key);
  await expect(slider).toHaveAttribute("aria-valuenow", ariaValue);
  const visualMotion = await captureVisualMotionWindow(page, hero);
  await waitForRenderedValence(page, targetValence);
  const samples = await readSamples(page);
  return {
    ...summarizeTransition(samples, inputAt, targetValence),
    visualMotion,
  };
}

async function measureSliderTransitionWithoutScreenshots(
  page: Page,
  slider: Locator,
  options: {
    ariaValue?: string;
    key?: "Home" | "End";
    targetValence?: number;
  } = {},
): Promise<TransitionSummary> {
  const {
    ariaValue = "6",
    key = "End",
    targetValence = 1,
  } = options;
  await clearSamples(page);
  await page.waitForTimeout(250);
  const inputAt = await page.evaluate(() => performance.now());
  await slider.focus();
  await page.keyboard.press(key);
  await expect(slider).toHaveAttribute("aria-valuenow", ariaValue);
  await waitForRenderedValence(page, targetValence);
  return summarizeTransition(await readSamples(page), inputAt, targetValence);
}

test.describe.configure({ mode: "serial" });
test.use({
  ...(REAL_CHROME_CHANNEL ? { channel: "chrome" as const } : {}),
  launchOptions: {
    args: REAL_GPU_PARITY
      ? ["--enable-unsafe-webgpu"]
      : ["--enable-unsafe-webgpu", "--use-webgpu-adapter=swiftshader"],
  },
});

test.describe("V2 orb long-session cadence", () => {
  for (const profile of PROFILES) {
    test(`${profile.name} keeps its initial pace after a 60+ second dwell`, async ({ page }) => {
      test.skip(
        !LOCAL_PRODUCTION_PREVIEW,
        "Orb long-session proof requires a local production preview of the current worktree",
      );
      expect(DISK_BUILD_IDENTITY).not.toBeNull();
      expect(DIST_INDEX_MTIME_MS).toBeGreaterThanOrEqual(LATEST_ORB_SOURCE_MTIME_MS);
      test.setTimeout(Math.max(180_000, DWELL_MS + SAMPLE_WINDOW_MS * 2 + 120_000));
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => {
        pageErrors.push(error.message);
      });
      page.on("requestfailed", (request) => {
        failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
      });
      page.on("response", (response) => {
        if (response.status() >= 400) {
          failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`);
        }
      });

      await page.setViewportSize({ width: 449, height: 698 });
      await page.emulateMedia({ colorScheme: "light" });
      if (profile.disableWorkerWebGL) {
        await page.addInitScript(() => {
          Object.defineProperty(window, "Worker", {
            configurable: true,
            value: undefined,
          });
        });
      }
      if (profile.requiresMainThreadAsyncCapability) {
        const capability = await page.evaluate(async () => {
          const gpu = (navigator as Navigator & {
            gpu?: { requestAdapter?: () => Promise<unknown> };
          }).gpu;
          const adapter = gpu?.requestAdapter
            ? await gpu.requestAdapter().catch(() => null)
            : null;
          const canvas = document.createElement("canvas");
          const gl = canvas.getContext("webgl") ?? canvas.getContext("webgl2");
          const parallelCompile = Boolean(gl?.getExtension("KHR_parallel_shader_compile"));
          gl?.getExtension("WEBGL_lose_context")?.loseContext();
          return {
            parallelCompile,
            webgpuAdapter: Boolean(adapter),
          };
        });
        test.skip(
          !capability.webgpuAdapter && !capability.parallelCompile,
          "Headless browser exposes neither a WebGPU adapter nor async main-thread WebGL compilation",
        );
      }
      await installLongSessionProbe(page);
      await primeZenflowV2(page, {
        language: "en",
        theme: "paper",
        user: { id: `orb-long-session-${profile.name}`, name: "Orb Cadence Probe" },
      });

      const route = new URL(v2RoutePath("orb", { layout: "phone" }), "https://zenflow.test/");
      route.searchParams.set("orbClockProbe", "true");
      if (profile.rendererOverride) route.searchParams.set("orbRenderer", profile.rendererOverride);
      await page.goto(`${route.pathname.slice(1)}${route.search}`, { waitUntil: "domcontentloaded" });

      const hero = page.getByTestId("orb-page-hero");
      await expect(hero).toBeVisible({ timeout: 30_000 });
      const heroCanvas = hero.locator("canvas[data-orb-renderer-tier]").first();
      await expect(heroCanvas).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => heroCanvas.getAttribute("data-orb-renderer-tier"), {
        timeout: 30_000,
      }).toMatch(profile.expectedTier);
      const stableTier = await heroCanvas.getAttribute("data-orb-renderer-tier");
      const servedBuildIdentity = await readServedBuildIdentity(page);
      expectServedBuildMatchesDisk(servedBuildIdentity);

      mkdirSync(OUTPUT_DIR, { recursive: true });
      const slider = page.getByRole("slider").first();
      const firstInteractionTransition = await measureSliderTransition(page, slider, hero, {
        ariaValue: "0",
        key: "Home",
        targetValence: -1,
      });
      const initialTransition = await measureSliderTransition(page, slider, hero);
      await setSliderEndpoint(page, slider, "Home", "0", -1);
      const initialScreenshotFreeTransition = await measureSliderTransitionWithoutScreenshots(
        page,
        slider,
      );
      await setSliderEndpoint(page, slider, "Home", "0", -1);
      await page.waitForTimeout(2_000);
      await clearSamples(page);
      const [initialVisualMotion] = await Promise.all([
        captureVisualMotionWindow(page, hero, VISUAL_IDLE_FRAME_COUNT),
        page.waitForTimeout(
          Math.max(SAMPLE_WINDOW_MS, (VISUAL_IDLE_FRAME_COUNT - 1) * VISUAL_FRAME_INTERVAL_MS),
        ),
      ]);
      const initialSamples = await readSamples(page);
      const initial = summarizeCadence(initialSamples);
      await hero.screenshot({ path: path.join(OUTPUT_DIR, `${profile.name}-initial.png`) });

      const dwellStartedAt = Date.now();
      await page.waitForTimeout(DWELL_MS);
      const dwellElapsedMs = Date.now() - dwellStartedAt;

      await clearSamples(page);
      const [lateVisualMotion] = await Promise.all([
        captureVisualMotionWindow(page, hero, VISUAL_IDLE_FRAME_COUNT),
        page.waitForTimeout(
          Math.max(SAMPLE_WINDOW_MS, (VISUAL_IDLE_FRAME_COUNT - 1) * VISUAL_FRAME_INTERVAL_MS),
        ),
      ]);
      const lateSamples = await readSamples(page);
      const late = summarizeCadence(lateSamples);
      await hero.screenshot({ path: path.join(OUTPUT_DIR, `${profile.name}-after-dwell-idle.png`) });
      const lateScreenshotFreeTransition = await measureSliderTransitionWithoutScreenshots(page, slider);
      await setSliderEndpoint(page, slider, "Home", "0", -1);
      const lateTransition = await measureSliderTransition(page, slider, hero);
      await hero.screenshot({ path: path.join(OUTPUT_DIR, `${profile.name}-after-dwell.png`) });

      const browserEvidence = await page.evaluate(() => {
        const state = (window as ProbeWindow).__zenOrbLongSession;
        if (!state) throw new Error("Orb long-session probe was not installed");
        const heroCanvas = document.querySelector<HTMLCanvasElement>(
          '[data-testid="orb-page-hero"] canvas[data-orb-renderer-tier]',
        );
        return {
          capabilities: state.capabilities,
          canvasEvents: state.canvasEvents,
          currentTier: heroCanvas?.dataset.orbRendererTier ?? null,
          href: window.location.href,
          longAnimationFrames: state.longAnimationFrames,
          longTasks: state.longTasks,
          userAgent: navigator.userAgent,
        };
      });

      const firstHeroCanvasAt = browserEvidence.canvasEvents[0]?.at ?? 0;
      const lateCanvasReplacements = browserEvidence.canvasEvents.filter(
        (event) => event.event === "replace" && event.at - firstHeroCanvasAt > 1_200,
      );
      const maxLongTaskMs = maxOrZero(browserEvidence.longTasks.map((entry) => entry.duration));
      const longAnimationFrameCount = browserEvidence.longAnimationFrames.length;
      const maxLoafDurationMs = maxOrZero(
        browserEvidence.longAnimationFrames.map((entry) => entry.duration),
      );
      const loafWithScriptAttributionCount = browserEvidence.longAnimationFrames.filter(
        (entry) => entry.scriptCount > 0,
      ).length;
      const maxLoafScriptDurationMs = maxOrZero(
        browserEvidence.longAnimationFrames.map((entry) => entry.maxScriptDuration),
      );
      const maxLoafBlockingMs = maxOrZero(
        browserEvidence.longAnimationFrames.map((entry) => entry.blockingDuration),
      );

      const report = {
        generatedAt: new Date().toISOString(),
        profile: profile.name,
        visualClaim: profile.visualClaim,
        visualParityAsserted: profile.name !== "canvas-fallback",
        dwellElapsedMs,
        proofQualified: dwellElapsedMs >= MIN_PROOF_DWELL_MS,
        stableTier,
        buildIdentity: {
          distIndexMtimeMs: DIST_INDEX_MTIME_MS,
          latestOrbSourceMtimeMs: LATEST_ORB_SOURCE_MTIME_MS,
          localProductionPreview: LOCAL_PRODUCTION_PREVIEW,
          orbSourceSha256: ORB_SOURCE_DIGEST,
          orbSourceFiles: ORB_SOURCE_IDENTITIES,
          route: browserEvidence.href,
          servedAssets: servedBuildIdentity,
          userAgent: browserEvidence.userAgent,
        },
        consoleErrors,
        pageErrors,
        failedRequests,
        initial,
        late,
        initialVisualMotion,
        lateVisualMotion,
        firstInteractionTransition,
        initialTransition,
        lateTransition,
        initialScreenshotFreeTransition,
        lateScreenshotFreeTransition,
        workerAckCriteria: {
          coldEntryMaxMs: MAX_COLD_ENTRY_WORKER_ACK_LATENCY_MS,
          steadyMaxMs: MAX_STEADY_WORKER_ACK_LATENCY_MS,
        },
        maxLongTaskMs,
        longAnimationFrameCount,
        maxLoafDurationMs,
        loafWithScriptAttributionCount,
        maxLoafScriptDurationMs,
        maxLoafBlockingMs,
        currentTier: browserEvidence.currentTier,
        performanceObserverCapabilities: browserEvidence.capabilities,
        lateCanvasReplacements,
      };
      writeFileSync(
        path.join(OUTPUT_DIR, `${profile.name}.json`),
        `${JSON.stringify(report, null, 2)}\n`,
      );

      expect(dwellElapsedMs).toBeGreaterThanOrEqual(DWELL_MS - 250);
      if (!ALLOW_SHORT_DWELL) {
        expect(dwellElapsedMs).toBeGreaterThanOrEqual(MIN_PROOF_DWELL_MS);
      }
      expect(stableTier).toMatch(profile.expectedTier);
      expect(browserEvidence.currentTier).toBe(stableTier);
      expect(browserEvidence.capabilities.longTaskObserver).toBe(true);
      expect(browserEvidence.capabilities.longAnimationFrameObserver).toBe(true);
      expect(lateCanvasReplacements).toEqual([]);
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(failedRequests).toEqual([]);
      const minimumWindowSamples = Math.max(4, Math.floor(SAMPLE_WINDOW_MS / 250));
      expect(initial.sampleCount).toBeGreaterThan(minimumWindowSamples);
      expect(late.sampleCount).toBeGreaterThan(minimumWindowSamples);
      expect(firstInteractionTransition.sampleCount).toBeGreaterThan(5);
      expect(initialTransition.sampleCount).toBeGreaterThan(5);
      expect(lateTransition.sampleCount).toBeGreaterThan(5);
      expect(initialScreenshotFreeTransition.sampleCount).toBeGreaterThan(5);
      expect(lateScreenshotFreeTransition.sampleCount).toBeGreaterThan(5);
      for (const [visualMotion, expectedFrameCount] of [
        [initialVisualMotion, VISUAL_IDLE_FRAME_COUNT],
        [lateVisualMotion, VISUAL_IDLE_FRAME_COUNT],
        [firstInteractionTransition.visualMotion, VISUAL_TRANSITION_FRAME_COUNT],
        [initialTransition.visualMotion, VISUAL_TRANSITION_FRAME_COUNT],
        [lateTransition.visualMotion, VISUAL_TRANSITION_FRAME_COUNT],
      ] as const) {
        expect(visualMotion).toBeDefined();
        expect(visualMotion?.frameCount).toBe(expectedFrameCount);
        expect(visualMotion?.firstFrameLumaStdDev ?? 0).toBeGreaterThan(MIN_VISUAL_LUMA_STD_DEV);
        expect(visualMotion?.lastFrameLumaStdDev ?? 0).toBeGreaterThan(MIN_VISUAL_LUMA_STD_DEV);
        expect(visualMotion?.meanFrameDifferencePerSecond ?? 0).toBeGreaterThan(0);
        expect(visualMotion?.medianFrameDifferencePerSecond ?? 0).toBeGreaterThan(0);
      }
      expect(initialVisualMotion.elapsedMs).toBeGreaterThanOrEqual(MIN_IDLE_VISUAL_WINDOW_MS);
      expect(lateVisualMotion.elapsedMs).toBeGreaterThanOrEqual(MIN_IDLE_VISUAL_WINDOW_MS);

      for (const window of [
        initial,
        late,
        firstInteractionTransition.cadence,
        initialTransition.cadence,
        lateTransition.cadence,
        initialScreenshotFreeTransition.cadence,
        lateScreenshotFreeTransition.cadence,
      ]) {
        expect(window.maxClockStepSeconds).toBeLessThanOrEqual(0.051);
        expect(window.maxSustainedClockToWallRatio).toBeLessThanOrEqual(MAX_CLOCK_TO_WALL_RATIO);
        expect(window.maxSustainedMotionPhasePerSecond).toBeLessThanOrEqual(
          MAX_ROTATION_RADIANS_PER_SECOND,
        );
        expect(window.maxSustainedNoisePhasePerSecond).toBeLessThanOrEqual(
          MAX_NOISE_PHASE_PER_SECOND,
        );
        expect(window.maxSustainedPulsePhasePerSecond).toBeLessThanOrEqual(
          MAX_PULSE_PHASE_PER_SECOND,
        );
        expect(window.maxSustainedBreathPhasePerSecond).toBeLessThanOrEqual(
          MAX_BREATH_PHASE_PER_SECOND,
        );
        expect(window.windowClockToWallRatio).toBeGreaterThan(0.05);
        expect(window.windowClockToWallRatio).toBeLessThanOrEqual(1.08);
        expect(window.workerSamplesMissingAckMetadata).toBe(0);
      }
      expect(firstInteractionTransition.cadence.maxWorkerAckLatencyMs).toBeLessThanOrEqual(
        MAX_COLD_ENTRY_WORKER_ACK_LATENCY_MS,
      );
      expect(initial.maxWorkerAckLatencyMs).toBeLessThanOrEqual(
        MAX_VISUAL_PROBE_WORKER_ACK_LATENCY_MS,
      );
      for (const window of [
        late,
        initialTransition.cadence,
        lateTransition.cadence,
        initialScreenshotFreeTransition.cadence,
        lateScreenshotFreeTransition.cadence,
      ]) {
        expect(window.maxWorkerAckLatencyMs).toBeLessThanOrEqual(
          MAX_STEADY_WORKER_ACK_LATENCY_MS,
        );
      }

      // Repeated screenshot decoding perturbs worker backpressure. Keep this as
      // a broad visual-stall/runaway guard; the screenshot-free renderedAt test
      // below owns the strict 0.85-1.15 cadence comparison.
      expect(late.windowClockToWallRatio / initial.windowClockToWallRatio)
        .toBeGreaterThan(MIN_SCREENSHOT_WINDOW_PACE_RATIO);
      expect(late.windowClockToWallRatio / initial.windowClockToWallRatio)
        .toBeLessThan(MAX_SCREENSHOT_WINDOW_PACE_RATIO);
      expect(Math.abs(firstInteractionTransition.baselineValence)).toBeLessThanOrEqual(0.25);
      expect(firstInteractionTransition.finalValence).toBeLessThanOrEqual(
        -RENDERED_ENDPOINT_ABSOLUTE_MIN,
      );
      expect(firstInteractionTransition.t50Ms).not.toBeNull();
      expect(firstInteractionTransition.t80Ms).not.toBeNull();
      expect(firstInteractionTransition.t90Ms).not.toBeNull();
      for (const transition of [initialTransition, lateTransition]) {
        expect(transition.baselineValence).toBeLessThanOrEqual(-RENDERED_ENDPOINT_ABSOLUTE_MIN);
        expect(transition.finalValence).toBeGreaterThanOrEqual(RENDERED_ENDPOINT_ABSOLUTE_MIN);
        expect(transition.t50Ms).not.toBeNull();
        expect(transition.t80Ms).not.toBeNull();
        expect(transition.t90Ms).not.toBeNull();
      }
      for (const transition of [
        initialScreenshotFreeTransition,
        lateScreenshotFreeTransition,
      ]) {
        expect(transition.baselineValence).toBeLessThanOrEqual(-RENDERED_ENDPOINT_ABSOLUTE_MIN);
        expect(transition.finalValence).toBeGreaterThanOrEqual(RENDERED_ENDPOINT_ABSOLUTE_MIN);
        expect(transition.t50Ms).not.toBeNull();
        expect(transition.t80Ms).not.toBeNull();
        expect(transition.t90Ms).not.toBeNull();
      }
      const minimumTransitionPaceRatio = profile.name === "canvas-fallback"
        ? MIN_CANVAS_TRANSITION_PACE_RATIO
        : MIN_INITIAL_TO_LATE_PACE_RATIO;
      const maximumTransitionPaceRatio = profile.name === "canvas-fallback"
        ? MAX_CANVAS_TRANSITION_PACE_RATIO
        : MAX_INITIAL_TO_LATE_PACE_RATIO;
      const strictScreenshotFreeRatios = [
        (lateScreenshotFreeTransition.t50Ms ?? 0) /
          (initialScreenshotFreeTransition.t50Ms ?? 1),
        (lateScreenshotFreeTransition.t80Ms ?? 0) /
          (initialScreenshotFreeTransition.t80Ms ?? 1),
        (lateScreenshotFreeTransition.t90Ms ?? 0) /
          (initialScreenshotFreeTransition.t90Ms ?? 1),
      ];
      for (const ratio of strictScreenshotFreeRatios) {
        expect(ratio).toBeGreaterThan(minimumTransitionPaceRatio);
        expect(ratio).toBeLessThan(maximumTransitionPaceRatio);
      }
      const screenshotTransitionRatios = [
        (lateTransition.t50Ms ?? 0) / (initialTransition.t50Ms ?? 1),
        (lateTransition.t80Ms ?? 0) / (initialTransition.t80Ms ?? 1),
        (lateTransition.t90Ms ?? 0) / (initialTransition.t90Ms ?? 1),
      ];
      for (const ratio of screenshotTransitionRatios) {
        expect(ratio).toBeGreaterThan(MIN_SCREENSHOT_WINDOW_PACE_RATIO);
        expect(ratio).toBeLessThan(MAX_SCREENSHOT_WINDOW_PACE_RATIO);
      }
      // Pixel decoding perturbs Worker ACK timing. The dedicated screenshot-free
      // transitions above own the strict initial-versus-late response proof.
      expect(maxLongTaskMs).toBeLessThan(500);
      // Render-only LoAF stays diagnostic; blockingDuration is the interaction-jank gate.
      expect(maxLoafBlockingMs).toBeLessThanOrEqual(120);
    });
  }

  test("canonical-default preserves rendered cadence after a 60+ second screenshot-free dwell", async ({
    page,
  }, testInfo) => {
    test.skip(
      !LOCAL_PRODUCTION_PREVIEW,
      "Orb rendered-cadence proof requires a local production preview of the current worktree",
    );
    expect(DISK_BUILD_IDENTITY).not.toBeNull();
    expect(DIST_INDEX_MTIME_MS).toBeGreaterThanOrEqual(LATEST_ORB_SOURCE_MTIME_MS);
    test.setTimeout(Math.max(
      165_000,
      DWELL_MS + ENTRY_RENDERED_CADENCE_WINDOW_MS + RENDERED_CADENCE_WINDOW_MS * 2 + 60_000,
    ));

    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });

    await page.setViewportSize({ width: 449, height: 698 });
    await page.emulateMedia({ colorScheme: "light" });
    await installLongSessionProbe(page);
    await primeZenflowV2(page, {
      language: "en",
      theme: "paper",
      user: { id: "orb-rendered-cadence", name: "Orb Rendered Cadence Probe" },
    });

    const route = new URL(v2RoutePath("orb", { layout: "phone" }), "https://zenflow.test/");
    route.searchParams.set("orbClockProbe", "true");
    await page.goto(`${route.pathname.slice(1)}${route.search}`, {
      waitUntil: "domcontentloaded",
    });

    const hero = page.getByTestId("orb-page-hero");
    await expect(hero).toBeVisible({ timeout: 30_000 });
    const heroCanvas = hero.locator("canvas[data-orb-renderer-tier]").first();
    await expect(heroCanvas).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => heroCanvas.getAttribute("data-orb-renderer-tier"), {
      timeout: 30_000,
    }).toMatch(/^(webgpu-main|webgl-main|webgl-worker)$/);
    const preludeTier = await heroCanvas.getAttribute("data-orb-renderer-tier");
    const servedBuildIdentity = await readServedBuildIdentity(page);
    expectServedBuildMatchesDisk(servedBuildIdentity);

    await clearSamples(page);
    const entryStartedAt = await page.evaluate(() => performance.now());
    await page.waitForTimeout(ENTRY_RENDERED_CADENCE_WINDOW_MS);
    const entryEndedAt = await page.evaluate(() => performance.now());
    const entrySamples = await readSamples(page);
    const entry = summarizeCadence(entrySamples, renderedCadenceTimestamp);

    const stabilizationWindows: Array<{
      cadence: ReturnType<typeof summarizeCadence>;
      endedAt: number;
      paceRatioToPrevious: number | null;
      startedAt: number;
    }> = [];
    let previousStabilizationCadence: ReturnType<typeof summarizeCadence> | null = null;
    let stabilizationQualified = false;
    for (
      let attempt = 0;
      attempt < RENDERED_CADENCE_MAX_STABILIZATION_WINDOWS;
      attempt += 1
    ) {
      await clearSamples(page);
      const startedAt = await page.evaluate(() => performance.now());
      await page.waitForTimeout(RENDERED_CADENCE_STABILIZATION_WINDOW_MS);
      const endedAt = await page.evaluate(() => performance.now());
      const cadence = summarizeCadence(await readSamples(page), renderedCadenceTimestamp);
      const paceRatioToPrevious = previousStabilizationCadence &&
          previousStabilizationCadence.windowClockToWallRatio > 0
        ? cadence.windowClockToWallRatio / previousStabilizationCadence.windowClockToWallRatio
        : null;
      stabilizationWindows.push({ cadence, endedAt, paceRatioToPrevious, startedAt });

      const usesStableTier = cadence.tiers.length === 1 && cadence.tiers[0] === preludeTier;
      const previousUsesStableTier = previousStabilizationCadence?.tiers.length === 1 &&
        previousStabilizationCadence.tiers[0] === preludeTier;
      if (
        paceRatioToPrevious !== null &&
        usesStableTier &&
        previousUsesStableTier &&
        cadence.renderedFramesPerSecond >= MIN_RENDERED_FRAMES_PER_SECOND &&
        (previousStabilizationCadence?.renderedFramesPerSecond ?? 0) >=
          MIN_RENDERED_FRAMES_PER_SECOND &&
        cadence.maxWorkerAckLatencyMs <= MAX_STEADY_WORKER_ACK_LATENCY_MS &&
        (previousStabilizationCadence?.maxWorkerAckLatencyMs ?? Number.POSITIVE_INFINITY) <=
          MAX_STEADY_WORKER_ACK_LATENCY_MS &&
        paceRatioToPrevious > MIN_INITIAL_TO_LATE_PACE_RATIO &&
        paceRatioToPrevious < MAX_INITIAL_TO_LATE_PACE_RATIO
      ) {
        stabilizationQualified = true;
        break;
      }
      previousStabilizationCadence = cadence;
    }

    await clearSamples(page);
    const initialStartedAt = await page.evaluate(() => performance.now());
    await page.waitForTimeout(RENDERED_CADENCE_WINDOW_MS);
    const initialEndedAt = await page.evaluate(() => performance.now());
    const initialSamples = await readSamples(page);
    const stableTier = await heroCanvas.getAttribute("data-orb-renderer-tier");

    const dwellStartedAt = await page.evaluate(() => performance.now());
    await page.waitForTimeout(DWELL_MS);
    const dwellEndedAt = await page.evaluate(() => performance.now());

    await clearSamples(page);
    const lateStartedAt = await page.evaluate(() => performance.now());
    await page.waitForTimeout(RENDERED_CADENCE_WINDOW_MS);
    const lateEndedAt = await page.evaluate(() => performance.now());
    const lateSamples = await readSamples(page);

    const initial = summarizeCadence(initialSamples, renderedCadenceTimestamp);
    const late = summarizeCadence(lateSamples, renderedCadenceTimestamp);
    const browserEvidence = await page.evaluate(() => {
      const state = (window as ProbeWindow).__zenOrbLongSession;
      if (!state) throw new Error("Orb long-session probe was not installed");
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-testid="orb-page-hero"] canvas[data-orb-renderer-tier]',
      );
      return {
        capabilities: state.capabilities,
        canvasEvents: state.canvasEvents,
        crashLog: (() => {
          try {
            const parsed = JSON.parse(localStorage.getItem("zenflow-crash-log") ?? "[]");
            if (!Array.isArray(parsed)) return [];
            return parsed
              .filter((entry) => entry?.context?.component === "ValenceOrb")
              .map((entry) => ({
                action: entry.context?.action ?? null,
                message: entry.message ?? null,
                time: entry.time ?? null,
              }));
          } catch {
            return [{ action: null, message: "crash-log-parse-failed", time: null }];
          }
        })(),
        currentTier: canvas?.dataset.orbRendererTier ?? null,
        href: window.location.href,
        lifecycleEvents: state.lifecycleEvents,
        longAnimationFrames: state.longAnimationFrames,
        longTasks: state.longTasks,
        tierTimeline: state.tierTimeline,
        userAgent: navigator.userAgent,
        visibilityEvents: state.visibilityEvents,
      };
    });

    const phaseFor = (startTime: number) => {
      if (startTime < entryStartedAt) return "prelude";
      if (startTime <= entryEndedAt) return "entry";
      if (startTime < initialStartedAt) return "stabilization";
      if (startTime <= initialEndedAt) return "initial";
      if (startTime < lateStartedAt) return "dwell";
      if (startTime <= lateEndedAt) return "late";
      return "postlude";
    };
    const phaseLabelledLongAnimationFrames = browserEvidence.longAnimationFrames.map((entry) => ({
      ...entry,
      phase: phaseFor(entry.startTime),
    }));
    const phaseLabelledLongTasks = browserEvidence.longTasks.map((entry) => ({
      ...entry,
      phase: phaseFor(entry.startTime),
    }));
    const maxLoafBlockingMs = maxOrZero(
      phaseLabelledLongAnimationFrames.map((entry) => entry.blockingDuration),
    );
    const maxLongTaskMs = maxOrZero(phaseLabelledLongTasks.map((entry) => entry.duration));
    const firstCanvasAt = browserEvidence.canvasEvents[0]?.at ?? 0;
    const lateCanvasReplacements = browserEvidence.canvasEvents.filter(
      (event) => event.event === "replace" && event.at - firstCanvasAt > 1_200,
    );
    const dwellElapsedMs = dwellEndedAt - dwellStartedAt;

    const generatedAt = new Date().toISOString();
    const report = {
      generatedAt,
      profile: "canonical-default-rendered-cadence",
      captureMethod: "clock probe only; no screenshots or image decoding during cadence windows",
      proofQualified: dwellElapsedMs >= MIN_PROOF_DWELL_MS,
      dwellElapsedMs,
      preludeTier,
      workerAckCriteria: {
        coldEntryMaxMs: MAX_COLD_ENTRY_WORKER_ACK_LATENCY_MS,
        steadyMaxMs: MAX_STEADY_WORKER_ACK_LATENCY_MS,
      },
      cadenceWindowCriteria: {
        entryMs: ENTRY_RENDERED_CADENCE_WINDOW_MS,
        steadyMs: RENDERED_CADENCE_WINDOW_MS,
      },
      stabilization: {
        criteria: {
          maxWindows: RENDERED_CADENCE_MAX_STABILIZATION_WINDOWS,
          maxWorkerAckLatencyMs: MAX_STEADY_WORKER_ACK_LATENCY_MS,
          paceRatio: [MIN_INITIAL_TO_LATE_PACE_RATIO, MAX_INITIAL_TO_LATE_PACE_RATIO],
          windowMs: RENDERED_CADENCE_STABILIZATION_WINDOW_MS,
        },
        qualified: stabilizationQualified,
        windows: stabilizationWindows,
      },
      stableTier,
      currentTier: browserEvidence.currentTier,
      windows: {
        entry: { startedAt: entryStartedAt, endedAt: entryEndedAt, ...entry },
        initial: { startedAt: initialStartedAt, endedAt: initialEndedAt, ...initial },
        dwell: { startedAt: dwellStartedAt, endedAt: dwellEndedAt },
        late: { startedAt: lateStartedAt, endedAt: lateEndedAt, ...late },
      },
      performance: {
        capabilities: browserEvidence.capabilities,
        longAnimationFrames: phaseLabelledLongAnimationFrames,
        longTasks: phaseLabelledLongTasks,
        maxLoafBlockingMs,
        maxLongTaskMs,
      },
      lateCanvasReplacements,
      lifecycle: {
        canvasEvents: browserEvidence.canvasEvents,
        crashLog: browserEvidence.crashLog,
        events: browserEvidence.lifecycleEvents,
        tierTimeline: browserEvidence.tierTimeline,
        visibilityEvents: browserEvidence.visibilityEvents,
      },
      consoleErrors,
      pageErrors,
      failedRequests,
      buildIdentity: {
        distIndexMtimeMs: DIST_INDEX_MTIME_MS,
        latestOrbSourceMtimeMs: LATEST_ORB_SOURCE_MTIME_MS,
        localProductionPreview: LOCAL_PRODUCTION_PREVIEW,
        orbSourceSha256: ORB_SOURCE_DIGEST,
        orbSourceFiles: ORB_SOURCE_IDENTITIES,
        route: browserEvidence.href,
        servedAssets: servedBuildIdentity,
        userAgent: browserEvidence.userAgent,
      },
    };
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const reportJson = `${JSON.stringify(report, null, 2)}\n`;
    const attemptName = [
      "canonical-default-rendered-cadence",
      generatedAt.replace(/[:.]/g, "-"),
      `retry-${testInfo.retry}`,
      `repeat-${testInfo.repeatEachIndex}`,
      `worker-${testInfo.workerIndex}`,
    ].join("-");
    writeFileSync(
      path.join(OUTPUT_DIR, "canonical-default-rendered-cadence.json"),
      reportJson,
    );
    writeFileSync(path.join(OUTPUT_DIR, `${attemptName}.json`), reportJson);
    await testInfo.attach("orb-rendered-cadence-report", {
      body: Buffer.from(reportJson),
      contentType: "application/json",
    });

    expect(dwellElapsedMs).toBeGreaterThanOrEqual(DWELL_MS - 250);
    if (!ALLOW_SHORT_DWELL) {
      expect(dwellElapsedMs).toBeGreaterThanOrEqual(MIN_PROOF_DWELL_MS);
    }
    expect(stabilizationQualified).toBe(true);
    expect(stabilizationWindows.length).toBeGreaterThanOrEqual(2);
    expect.soft(
      entry.tiers.filter((tier): tier is string => tier !== null),
      "entry cadence window must use the first painted tier after cold-start probes settle",
    ).toEqual([
      preludeTier,
    ]);
    expect.soft(initial.tiers, "initial cadence window must use one stabilized tier").toEqual([
      stableTier,
    ]);
    expect.soft(browserEvidence.currentTier, "renderer tier changed after the initial window")
      .toBe(stableTier);
    expect.soft(late.tiers, "late cadence window must remain on the stabilized tier").toEqual([
      stableTier,
    ]);
    expect(browserEvidence.capabilities.longTaskObserver).toBe(true);
    expect(browserEvidence.capabilities.longAnimationFrameObserver).toBe(true);
    expect.soft(lateCanvasReplacements).toEqual([]);
    expect.soft(consoleErrors).toEqual([]);
    expect.soft(pageErrors).toEqual([]);
    expect.soft(failedRequests).toEqual([]);

    for (const window of [entry, initial, late]) {
      expect(window.sampleCount).toBeGreaterThanOrEqual(MIN_RENDERED_FRAMES_PER_SECOND * 4);
      expect(window.renderedFramesPerSecond).toBeGreaterThanOrEqual(
        MIN_RENDERED_FRAMES_PER_SECOND,
      );
      expect(window.maxClockStepSeconds).toBeLessThanOrEqual(0.051);
      expect(window.maxSustainedClockToWallRatio).toBeLessThanOrEqual(MAX_CLOCK_TO_WALL_RATIO);
      expect(window.maxSustainedMotionPhasePerSecond).toBeLessThanOrEqual(
        MAX_ROTATION_RADIANS_PER_SECOND,
      );
      expect(window.maxSustainedNoisePhasePerSecond).toBeLessThanOrEqual(
        MAX_NOISE_PHASE_PER_SECOND,
      );
      expect(window.maxSustainedPulsePhasePerSecond).toBeLessThanOrEqual(
        MAX_PULSE_PHASE_PER_SECOND,
      );
      expect(window.maxSustainedBreathPhasePerSecond).toBeLessThanOrEqual(
        MAX_BREATH_PHASE_PER_SECOND,
      );
      // Worker backpressure intentionally slows the internal clock when the GPU
      // cannot sustain 60 rendered frames; the regression gate is late/initial
      // parity below, not catch-up to wall time.
      expect(window.windowClockToWallRatio).toBeGreaterThan(0.05);
      expect(window.windowClockToWallRatio).toBeLessThanOrEqual(1.08);
      expect(window.workerSamplesMissingAckMetadata).toBe(0);
    }

    // Headless software compositors can pay a one-time OffscreenCanvas presentation
    // cost after the first painted frame. Keep it bounded by the runtime watchdog,
    // while the settled early/late windows retain the stricter cadence limit.
    expect(entry.maxWorkerAckLatencyMs).toBeLessThanOrEqual(
      MAX_COLD_ENTRY_WORKER_ACK_LATENCY_MS,
    );
    for (const window of [initial, late]) {
      expect(window.maxWorkerAckLatencyMs).toBeLessThanOrEqual(
        MAX_STEADY_WORKER_ACK_LATENCY_MS,
      );
    }

    for (const baseline of [initial]) {
      for (const [baselineRate, lateRate] of [
        [baseline.windowClockToWallRatio, late.windowClockToWallRatio],
        [baseline.windowMotionPhasePerSecond, late.windowMotionPhasePerSecond],
        [baseline.windowNoisePhasePerSecond, late.windowNoisePhasePerSecond],
        [baseline.windowPulsePhasePerSecond, late.windowPulsePhasePerSecond],
        [baseline.windowBreathPhasePerSecond, late.windowBreathPhasePerSecond],
      ]) {
        expect(baselineRate).toBeGreaterThan(0);
        expect(lateRate / baselineRate).toBeGreaterThan(MIN_INITIAL_TO_LATE_PACE_RATIO);
        expect(lateRate / baselineRate).toBeLessThan(MAX_INITIAL_TO_LATE_PACE_RATIO);
      }
    }
    for (const baseline of [initial]) {
      const renderedFpsRatio = late.renderedFramesPerSecond / baseline.renderedFramesPerSecond;
      expect(renderedFpsRatio).toBeGreaterThan(MIN_SCREENSHOT_WINDOW_PACE_RATIO);
      expect(renderedFpsRatio).toBeLessThan(MAX_SCREENSHOT_WINDOW_PACE_RATIO);
    }
    expect(maxLongTaskMs).toBeLessThan(500);
    expect(maxLoafBlockingMs).toBeLessThanOrEqual(120);
  });

  test("canonical startup falls back to WebGL after worker construction and WebGPU first-frame failures", async ({
    page,
  }, testInfo) => {
    test.skip(
      !LOCAL_PRODUCTION_PREVIEW,
      "Compound startup recovery proof requires a local production preview of the current worktree",
    );
    test.setTimeout(60_000);
    expect(DISK_BUILD_IDENTITY).not.toBeNull();
    expect(DIST_INDEX_MTIME_MS).toBeGreaterThanOrEqual(LATEST_ORB_SOURCE_MTIME_MS);

    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
    });

    await page.setViewportSize({ width: 449, height: 698 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
    await installCompoundStartupFailureProbe(page);
    await installLongSessionProbe(page);
    await primeZenflowV2(page, {
      language: "en",
      theme: "paper",
      user: { id: "orb-compound-startup-recovery", name: "Orb Startup Recovery Probe" },
    });

    const route = new URL(v2RoutePath("orb", { layout: "phone" }), "https://zenflow.test/");
    route.searchParams.set("orbClockProbe", "true");
    await page.goto(`${route.pathname.slice(1)}${route.search}`, {
      waitUntil: "domcontentloaded",
    });

    const hero = page.getByTestId("orb-page-hero");
    const heroCanvas = hero.locator("canvas[data-orb-renderer-tier]").first();
    await expect(hero).toBeVisible({ timeout: 30_000 });
    await expect(heroCanvas).toHaveAttribute("data-orb-renderer-tier", "webgl-main", {
      timeout: 30_000,
    });
    await expect(heroCanvas).toHaveAttribute("data-orb-visual-ready", "true", {
      timeout: 30_000,
    });
    await expect(hero.locator("canvas[data-orb-renderer-tier='canvas2d']")).toHaveCount(0);
    await expect(hero.locator("canvas[data-orb-renderer-tier]")).toHaveCount(1);

    const servedBuildIdentity = await readServedBuildIdentity(page);
    expectServedBuildMatchesDisk(servedBuildIdentity);
    const screenshot = await captureCanvasPixels(page, heroCanvas);
    const lumaStdDev = visualLumaStdDev(await decodeVisualFrame(screenshot));
    expect(lumaStdDev).toBeGreaterThanOrEqual(MIN_VISUAL_LUMA_STD_DEV);

    const slider = page.getByRole("slider").first();
    await setSliderEndpoint(page, slider, "Home", "0", -1);
    const recoveredTransition = await measureSliderTransition(page, slider, hero);
    for (const threshold of [
      recoveredTransition.t50Ms,
      recoveredTransition.t80Ms,
      recoveredTransition.t90Ms,
    ]) {
      expect(threshold).not.toBeNull();
    }
    expect(recoveredTransition.finalValence).toBeGreaterThanOrEqual(RENDERED_ENDPOINT_ABSOLUTE_MIN);
    expect(recoveredTransition.cadence.maxClockStepSeconds).toBeLessThanOrEqual(0.051);

    const browserEvidence = await page.evaluate(() => {
      let crashLog: Array<{ action: string | null; message: string | null }> = [];
      try {
        const parsed = JSON.parse(localStorage.getItem("zenflow-crash-log") ?? "[]");
        if (Array.isArray(parsed)) {
          crashLog = parsed
            .filter((entry) => entry?.context?.component === "ValenceOrb")
            .map((entry) => ({
              action: entry.context?.action ?? null,
              message: entry.message ?? null,
            }));
        }
      } catch {
        crashLog = [{ action: null, message: "crash-log-parse-failed" }];
      }
      const state = (window as ProbeWindow).__zenOrbLongSession;
      return {
        crashLog,
        faults: (window as ProbeWindow).__zenCompoundStartupFaults ?? null,
        lifecycleEvents: state?.lifecycleEvents ?? [],
        tierTimeline: state?.tierTimeline ?? [],
      };
    });
    expect(browserEvidence.faults).toEqual({
      webgpuPresentationFailures: 1,
      workerConstructionFailures: 1,
    });
    const requiredLifecycleSequence = [
      "worker-upgrade-start",
      "main-upgrade-start",
      "main-upgrade-first-frame-failed",
      "main-upgrade-webgpu-first-frame-fallback",
      "main-upgrade-start",
      "main-upgrade-applied",
    ];
    let lifecycleCursor = -1;
    for (const event of requiredLifecycleSequence) {
      const eventIndex = browserEvidence.lifecycleEvents.findIndex(
        (entry, index) => index > lifecycleCursor && entry.event === event,
      );
      expect(eventIndex, `missing lifecycle event after index ${lifecycleCursor}: ${event}`).toBeGreaterThan(
        lifecycleCursor,
      );
      lifecycleCursor = eventIndex;
    }
    expect(browserEvidence.crashLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "worker-webgl-construction" }),
        expect.objectContaining({ action: "webgpu-first-frame" }),
      ]),
    );

    const unexpectedConsoleErrors = consoleErrors.filter(
      (message) =>
        !message.includes("Injected orb worker construction failure") &&
        !message.includes("Injected WebGPU first-frame presentation failure"),
    );
    const report = {
      browserEvidence,
      buildIdentity: servedBuildIdentity,
      consoleErrors,
      failedRequests,
      generatedAt: new Date().toISOString(),
      lumaStdDev,
      pageErrors,
      recoveredTransition,
      sourceSha256: ORB_SOURCE_DIGEST,
      unexpectedConsoleErrors,
    };
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(path.join(OUTPUT_DIR, "compound-startup-recovery.png"), screenshot);
    const reportJson = `${JSON.stringify(report, null, 2)}\n`;
    writeFileSync(path.join(OUTPUT_DIR, "canonical-compound-startup-recovery.json"), reportJson);
    await testInfo.attach("orb-compound-startup-recovery", {
      body: Buffer.from(reportJson),
      contentType: "application/json",
    });

    expect(unexpectedConsoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });

  test("canonical worker ACK recovery preserves its frozen frame and transition pace", async ({
    page,
  }, testInfo) => {
    test.skip(
      !LOCAL_PRODUCTION_PREVIEW,
      "Worker recovery proof requires a local production preview of the current worktree",
    );
    test.setTimeout(60_000);
    expect(DISK_BUILD_IDENTITY).not.toBeNull();
    expect(DIST_INDEX_MTIME_MS).toBeGreaterThanOrEqual(LATEST_ORB_SOURCE_MTIME_MS);

    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
    });

    await page.setViewportSize({ width: 449, height: 698 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
    await installDroppedAckWorkerProbe(page);
    await installLongSessionProbe(page);
    await primeZenflowV2(page, {
      language: "en",
      theme: "paper",
      user: { id: "orb-worker-recovery", name: "Orb Worker Recovery Probe" },
    });

    const route = new URL(v2RoutePath("orb", { layout: "phone" }), "https://zenflow.test/");
    route.searchParams.set("orbClockProbe", "true");
    route.searchParams.set("orbRenderer", "webgl");
    await page.goto(`${route.pathname.slice(1)}${route.search}`, {
      waitUntil: "domcontentloaded",
    });

    const hero = page.getByTestId("orb-page-hero");
    const heroCanvas = hero.locator("canvas[data-orb-renderer-tier]").first();
    await expect(hero).toBeVisible({ timeout: 30_000 });
    await expect(heroCanvas).toHaveAttribute("data-orb-renderer-tier", "webgl-worker", {
      timeout: 30_000,
    });
    await expect(heroCanvas).toHaveAttribute("data-orb-visual-ready", "true", {
      timeout: 30_000,
    });
    const servedBuildIdentity = await readServedBuildIdentity(page);
    expectServedBuildMatchesDisk(servedBuildIdentity);

    const slider = page.getByRole("slider").first();
    await setSliderEndpoint(page, slider, "Home", "0", -1);
    const initialTransition = await measureSliderTransition(page, slider, hero);

    const setAnimations = async (enabled: boolean) => {
      await page.evaluate((animations) => {
        const preference = { reduceMotion: !animations };
        localStorage.setItem("zenflow_reduce_motion", JSON.stringify(preference));
        window.dispatchEvent(
          new CustomEvent("zenflow-motion-preference-change", { detail: preference }),
        );
      }, enabled);
    };

    const beforeFreezeCount = (await readSamples(page)).length;
    await setAnimations(false);
    await expect.poll(async () => (await readSamples(page)).length, { timeout: 5_000 })
      .toBeGreaterThan(beforeFreezeCount);
    await page.waitForTimeout(200);
    const frozenSamples = await readSamples(page);
    const frozen = frozenSamples.at(-1);
    if (!frozen) throw new Error("Reduced-motion worker frame was not captured");
    const frozenCount = frozenSamples.length;
    await page.waitForTimeout(180);
    expect((await readSamples(page)).length).toBe(frozenCount);
    await hero.scrollIntoViewIfNeeded();
    await expect(hero).toBeInViewport();

    await page.evaluate(() => {
      const heroNode = document.querySelector<HTMLElement>("[data-testid='orb-page-hero']");
      const initialCanvas = heroNode?.querySelector<HTMLCanvasElement>(
        "canvas[data-orb-renderer-tier]",
      );
      if (!heroNode || !initialCanvas) throw new Error("Canonical hero canvas is missing");
      initialCanvas.style.backgroundColor = "rgb(255, 255, 255)";
      const state: NonNullable<ProbeWindow["__zenOrbRecoveryContinuity"]> = {
        gapsMs: [],
        initialCanvas,
        intervalId: 0,
        lastCanvas: initialCanvas,
        missingSince: null,
        observer: null as unknown as MutationObserver,
        replacements: 0,
      };
      const check = () => {
        const current = heroNode.querySelector<HTMLCanvasElement>(
          "canvas[data-orb-renderer-tier]",
        );
        const now = performance.now();
        if (!current) {
          state.missingSince ??= now;
          return;
        }
        current.style.backgroundColor = "rgb(255, 255, 255)";
        if (state.missingSince !== null) {
          state.gapsMs.push(now - state.missingSince);
          state.missingSince = null;
        }
        if (state.lastCanvas && state.lastCanvas !== current) state.replacements += 1;
        state.lastCanvas = current;
      };
      state.observer = new MutationObserver(check);
      state.observer.observe(heroNode, { childList: true, subtree: true });
      state.intervalId = window.setInterval(check, 4);
      (window as ProbeWindow).__zenOrbRecoveryContinuity = state;
      (window as ProbeWindow).__zenDropNextOrbWorkerAck = true;
    });

    await expect.poll(
      () => page.evaluate(() => (window as ProbeWindow).__zenDroppedOrbWorkerAcks ?? 0),
      { timeout: WORKER_STATIC_HEALTHCHECK_MS + 2_000 },
    ).toBe(1);
    const beforeRecovery = await captureCanvasPixels(page, heroCanvas);
    const recovered = await page.waitForFunction(
      () => {
        const continuity = (window as ProbeWindow).__zenOrbRecoveryContinuity;
        const canvas = document.querySelector<HTMLCanvasElement>(
          "[data-testid='orb-page-hero'] canvas[data-orb-renderer-tier]",
        );
        return canvas?.dataset.orbRendererTier === "webgl-main" ||
          (continuity?.replacements ?? 0) >= 1;
      },
      undefined,
      { timeout: 10_000 },
    ).then(() => true, () => false);
    if (!recovered) {
      const diagnostics = await page.evaluate(() => {
        const state = (window as ProbeWindow).__zenOrbLongSession;
        const canvas = document.querySelector<HTMLCanvasElement>(
          "[data-testid='orb-page-hero'] canvas[data-orb-renderer-tier]",
        );
        const wrapper = canvas?.parentElement;
        let crashLog: unknown = [];
        try {
          crashLog = JSON.parse(localStorage.getItem("zenflow-crash-log") ?? "[]");
        } catch {
          crashLog = "crash-log-parse-failed";
        }
        return {
          motionPreference: localStorage.getItem("zenflow_reduce_motion"),
          canvasRect: canvas?.getBoundingClientRect().toJSON() ?? null,
          crashLog,
          documentHidden: document.hidden,
          droppedAcks: (window as ProbeWindow).__zenDroppedOrbWorkerAcks ?? 0,
          lifecycleEvents: state?.lifecycleEvents ?? [],
          tier: canvas?.dataset.orbRendererTier ?? null,
          tierTimeline: state?.tierTimeline ?? [],
          visibilityEvents: state?.visibilityEvents ?? [],
          visibilityState: document.visibilityState,
          wrapperRect: wrapper?.getBoundingClientRect().toJSON() ?? null,
        };
      });
      mkdirSync(OUTPUT_DIR, { recursive: true });
      writeFileSync(
        path.join(OUTPUT_DIR, "canonical-worker-ack-recovery-timeout.json"),
        `${JSON.stringify(diagnostics, null, 2)}\n`,
      );
      throw new Error(`Worker ACK recovery timed out: ${JSON.stringify(diagnostics)}`);
    }
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(path.join(OUTPUT_DIR, "worker-recovery-before.png"), beforeRecovery);
    const beforeFrame = await decodeVisualFrame(beforeRecovery);
    const presentationStartedAt = Date.now();
    const presentationSamples: Array<{
      afterMs: number;
      stats: ReturnType<typeof visualDifferenceStats>;
    }> = [];
    let firstPresentationBuffer: Buffer | null = null;
    let lastPresentationBuffer: Buffer | null = null;
    for (const targetMs of [0, 16, 33, 50, 75, 100, 150, 225, 350, 500, 700]) {
      const remainingMs = presentationStartedAt + targetMs - Date.now();
      if (remainingMs > 0) await page.waitForTimeout(remainingMs);
      const captured = await captureCanvasPixels(page, heroCanvas);
      firstPresentationBuffer ??= captured;
      lastPresentationBuffer = captured;
      const afterMs = Date.now() - presentationStartedAt;
      const frame = await decodeVisualFrame(captured);
      presentationSamples.push({
        afterMs,
        stats: visualDifferenceStats(beforeFrame, frame),
      });
      writeFileSync(
        path.join(OUTPUT_DIR, `worker-recovery-after-${String(afterMs).padStart(4, "0")}ms.png`),
        captured,
      );
    }
    if (!firstPresentationBuffer || !lastPresentationBuffer) {
      throw new Error("Recovered presentation screenshots are missing");
    }
    writeFileSync(
      path.join(OUTPUT_DIR, "worker-recovery-after.png"),
      firstPresentationBuffer,
    );
    writeFileSync(
      path.join(OUTPUT_DIR, "worker-recovery-after-settled.png"),
      lastPresentationBuffer,
    );

    const recoveryEvidence = await page.evaluate(() => {
      const continuity = (window as ProbeWindow).__zenOrbRecoveryContinuity;
      if (!continuity) throw new Error("Recovery continuity monitor is missing");
      window.clearInterval(continuity.intervalId);
      continuity.observer.disconnect();
      const current = document.querySelector<HTMLCanvasElement>(
        "[data-testid='orb-page-hero'] canvas[data-orb-renderer-tier]",
      );
      let crashLog: Array<{ action: string | null; message: string | null; time: string | null }> = [];
      try {
        const parsed = JSON.parse(localStorage.getItem("zenflow-crash-log") ?? "[]");
        if (Array.isArray(parsed)) {
          crashLog = parsed
            .filter((entry) => entry?.context?.component === "ValenceOrb")
            .map((entry) => ({
              action: entry.context?.action ?? null,
              message: entry.message ?? null,
              time: entry.time ?? null,
            }));
        }
      } catch {
        crashLog = [{ action: null, message: "crash-log-parse-failed", time: null }];
      }
      return {
        crashLog,
        currentTier: current?.dataset.orbRendererTier ?? null,
        gapsMs: continuity.gapsMs,
        initialCanvasConnected: continuity.initialCanvas.isConnected,
        lifecycleEvents: (window as ProbeWindow).__zenOrbLongSession?.lifecycleEvents ?? [],
        replacements: continuity.replacements,
      };
    });

    const afterRecoverySamples = await readSamples(page);
    const recoveredFrozen = afterRecoverySamples.at(-1);
    if (!recoveredFrozen) throw new Error("Recovered renderer did not publish its frozen frame");
    expect(recoveredFrozen.time).toBeCloseTo(frozen.time, 8);
    expect(recoveredFrozen.motionPhase).toBeCloseTo(frozen.motionPhase, 8);
    expect(recoveredFrozen.noisePhase).toBeCloseTo(frozen.noisePhase, 8);
    expect(recoveredFrozen.pulsePhase).toBeCloseTo(frozen.pulsePhase, 8);
    expect(recoveredFrozen.breathPhase).toBeCloseTo(frozen.breathPhase, 8);
    const recoveredSampleCount = afterRecoverySamples.length;
    await setAnimations(true);
    await expect.poll(async () => (await readSamples(page)).length, { timeout: 5_000 })
      .toBeGreaterThan(recoveredSampleCount);
    const firstResumed = (await readSamples(page))[recoveredSampleCount];
    if (!firstResumed) throw new Error("Recovered main-thread WebGL did not resume");
    expect(firstResumed.time).toBeCloseTo(frozen.time, 8);
    expect(firstResumed.motionPhase).toBeCloseTo(frozen.motionPhase, 8);
    expect(firstResumed.noisePhase).toBeCloseTo(frozen.noisePhase, 8);
    expect(firstResumed.pulsePhase).toBeCloseTo(frozen.pulsePhase, 8);
    expect(firstResumed.breathPhase).toBeCloseTo(frozen.breathPhase, 8);

    await setSliderEndpoint(page, slider, "Home", "0", -1);
    const recoveredTransition = await measureSliderTransition(page, slider, hero);
    const transitionRatios = Object.fromEntries(
      (["t50Ms", "t80Ms", "t90Ms"] as const).map((key) => {
        const initial = initialTransition[key];
        const recovered = recoveredTransition[key];
        if (initial === null || recovered === null) {
          throw new Error(`Transition threshold ${key} was not reached`);
        }
        return [key, recovered / initial];
      }),
    );

    const report = {
      buildIdentity: servedBuildIdentity,
      consoleErrors,
      failedRequests,
      generatedAt: new Date().toISOString(),
      initialTransition,
      pageErrors,
      presentationSamples,
      recoveredTransition,
      recoveryEvidence,
      sourceSha256: ORB_SOURCE_DIGEST,
      transitionRatios,
      visualParityBudget: {
        maxChannelDifference: 32,
        meanNormalizedDifference: 0.001,
        p99ChannelDifference: 3,
        p999ChannelDifference: 8,
      },
    };
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const reportJson = `${JSON.stringify(report, null, 2)}\n`;
    writeFileSync(path.join(OUTPUT_DIR, "canonical-worker-ack-recovery.json"), reportJson);
    await testInfo.attach("orb-worker-ack-recovery", {
      body: Buffer.from(reportJson),
      contentType: "application/json",
    });

    const firstPresentation = presentationSamples[0]?.stats;
    if (!firstPresentation) throw new Error("Recovered presentation sample is missing");
    expect(firstPresentation.meanNormalizedDifference).toBeLessThanOrEqual(0.001);
    expect(firstPresentation.p99ChannelDifference).toBeLessThanOrEqual(3);
    expect(firstPresentation.p999ChannelDifference).toBeLessThanOrEqual(8);
    expect(firstPresentation.maxChannelDifference).toBeLessThanOrEqual(32);
    expect(recoveryEvidence).toMatchObject({
      gapsMs: [],
      initialCanvasConnected: false,
      replacements: 1,
    });
    expect(recoveryEvidence.currentTier).toMatch(/^webgl-(?:main|worker)$/);
    expect(recoveryEvidence.crashLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "worker-webgl-render-timeout" }),
      ]),
    );
    for (const ratio of Object.values(transitionRatios)) {
      expect(ratio).toBeGreaterThan(MIN_INITIAL_TO_LATE_PACE_RATIO);
      expect(ratio).toBeLessThan(MAX_INITIAL_TO_LATE_PACE_RATIO);
    }
    expect(recoveredTransition.cadence.maxClockStepSeconds).toBeLessThanOrEqual(0.051);
    await expect(hero.locator("canvas[data-orb-renderer-tier='canvas2d']")).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });

  test("software WebGPU adapters preserve the canonical WebGL orb", async ({ page }, testInfo) => {
    test.skip(
      !LOCAL_PRODUCTION_PREVIEW,
      "Software-adapter fallback proof requires a local production preview of the current worktree",
    );
    test.setTimeout(60_000);
    expect(DISK_BUILD_IDENTITY).not.toBeNull();
    expect(DIST_INDEX_MTIME_MS).toBeGreaterThanOrEqual(LATEST_ORB_SOURCE_MTIME_MS);

    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
    });

    await page.setViewportSize({ width: 449, height: 698 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.addInitScript(() => {
      Object.defineProperty(window, "OffscreenCanvas", {
        configurable: true,
        value: undefined,
      });
    });
    await primeZenflowV2(page, {
      language: "en",
      theme: "paper",
      user: { id: "orb-software-webgpu-fallback", name: "Orb Software GPU Probe" },
    });

    await page.goto("/people-first-app/", { waitUntil: "domcontentloaded" });
    const adapterInfo = await readWebGpuAdapterIdentity(page);
    test.skip(
      !isSoftwareWebGpuAdapterIdentity(adapterInfo),
      "This runtime does not expose a software WebGPU adapter",
    );

    const route = new URL(v2RoutePath("orb", { layout: "phone" }), "https://zenflow.test/");
    route.searchParams.set("orbClockProbe", "true");
    route.searchParams.set("orbRenderer", "webgpu");
    await page.goto(`${route.pathname.slice(1)}${route.search}`, {
      waitUntil: "domcontentloaded",
    });

    const hero = page.getByTestId("orb-page-hero");
    const webGlCanvas = hero.locator("canvas[data-orb-renderer-tier='webgl-main']").first();
    await expect(hero).toBeVisible({ timeout: 30_000 });
    await expect(webGlCanvas).toBeVisible({ timeout: 30_000 });
    await expect(webGlCanvas).toHaveAttribute("data-orb-visual-ready", "true", {
      timeout: 30_000,
    });
    await expect(hero.locator("canvas[data-orb-renderer-tier='webgpu-main']")).toHaveCount(0);
    await expect(hero.locator("canvas[data-orb-renderer-tier]")).toHaveCount(1);

    const screenshot = await captureCanvasPixels(page, webGlCanvas);
    const lumaStdDev = visualLumaStdDev(await decodeVisualFrame(screenshot));
    const buildIdentity = await readServedBuildIdentity(page);
    expectServedBuildMatchesDisk(buildIdentity);
    expect(lumaStdDev).toBeGreaterThanOrEqual(MIN_VISUAL_LUMA_STD_DEV);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);

    const report = {
      adapterInfo,
      buildIdentity,
      consoleErrors,
      failedRequests,
      generatedAt: new Date().toISOString(),
      lumaStdDev,
      pageErrors,
      sourceSha256: ORB_SOURCE_DIGEST,
      tier: "webgl-main",
    };
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(
      path.join(OUTPUT_DIR, "software-webgpu-fallback.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    await testInfo.attach("orb-software-webgpu-fallback", {
      body: Buffer.from(`${JSON.stringify(report, null, 2)}\n`),
      contentType: "application/json",
    });
  });

  test("canonical WebGPU pixels match main-thread WebGL for one fixed reduced-motion frame", async ({
    browser,
  }, testInfo) => {
    test.skip(
      !REAL_GPU_PARITY,
      "Cross-GPU pixel parity requires an explicit visible hardware-GPU run",
    );
    test.skip(
      !LOCAL_PRODUCTION_PREVIEW,
      "Cross-GPU pixel proof requires a local production preview of the current worktree",
    );
    test.setTimeout(90_000);
    expect(DISK_BUILD_IDENTITY).not.toBeNull();
    expect(DIST_INDEX_MTIME_MS).toBeGreaterThanOrEqual(LATEST_ORB_SOURCE_MTIME_MS);

    const adapterProbeContext = await browser.newContext();
    const adapterProbePage = await adapterProbeContext.newPage();
    await adapterProbePage.goto("/people-first-app/", { waitUntil: "domcontentloaded" });
    const parityAdapter = await readWebGpuAdapterIdentity(adapterProbePage);
    await adapterProbeContext.close();
    test.skip(
      !parityAdapter || isSoftwareWebGpuAdapterIdentity(parityAdapter),
      "Cross-GPU parity requires a physical WebGPU adapter; software adapters use WebGL fallback",
    );

    const captureTier = async (disableWebGPU: boolean) => {
      const context = await browser.newContext({
        colorScheme: "light",
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        viewport: { width: 449, height: 698 },
      });
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) => {
        failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
      });

      await page.addInitScript(({ webGpuDisabled }) => {
        let randomState = 0x6d2b79f5;
        Math.random = () => {
          randomState = Math.imul(randomState ^ (randomState >>> 15), randomState | 1);
          randomState ^= randomState + Math.imul(randomState ^ (randomState >>> 7), randomState | 61);
          return ((randomState ^ (randomState >>> 14)) >>> 0) / 4_294_967_296;
        };
        Object.defineProperty(window, "OffscreenCanvas", {
          configurable: true,
          value: undefined,
        });
        if (webGpuDisabled) {
          Object.defineProperty(navigator, "gpu", {
            configurable: true,
            value: undefined,
          });
        }
      }, { webGpuDisabled: disableWebGPU });
      await installLongSessionProbe(page);
      await primeZenflowV2(page, {
        language: "en",
        theme: "paper",
        user: {
          id: disableWebGPU ? "orb-webgl-parity" : "orb-webgpu-parity",
          name: "Orb GPU Parity Probe",
        },
      });

      const route = new URL(v2RoutePath("orb", { layout: "phone" }), "https://zenflow.test/");
      route.searchParams.set("orbClockProbe", "true");
      route.searchParams.set("orbRenderer", "webgpu");
      await page.goto(`${route.pathname.slice(1)}${route.search}`, {
        waitUntil: "domcontentloaded",
      });

      const hero = page.getByTestId("orb-page-hero");
      const expectedTier = disableWebGPU ? "webgl-main" : "webgpu-main";
      const canvas = hero.locator(`canvas[data-orb-renderer-tier='${expectedTier}']`).first();
      await expect(hero).toBeVisible({ timeout: 30_000 });
      await expect(canvas).toBeVisible({ timeout: 30_000 });
      await expect(canvas).toHaveAttribute("data-orb-visual-ready", "true", {
        timeout: 30_000,
      });

      const beforeBuffer = await hero.screenshot({ animations: "allow" });
      const slider = page.getByRole("slider").first();
      await slider.focus();
      await page.keyboard.press("End");
      await expect(slider).toHaveAttribute("aria-valuenow", "6");
      await page.waitForTimeout(250);
      const buffer = await hero.screenshot({ animations: "allow" });
      const samples = await readSamples(page);
      const sample = [...samples].reverse().find(
        (candidate) => candidate.size >= 200 && candidate.source === expectedTier,
      );
      if (!sample) throw new Error(`Fixed ${expectedTier} probe sample is missing`);
      const buildIdentity = await readServedBuildIdentity(page);
      expectServedBuildMatchesDisk(buildIdentity);
      const adapterInfo = disableWebGPU ? null : await readWebGpuAdapterIdentity(page);
      const result = {
        adapterInfo,
        buildIdentity,
        beforeBuffer,
        buffer,
        consoleErrors,
        failedRequests,
        pageErrors,
        sample,
        tier: expectedTier,
      };
      await context.close();
      return result;
    };

    const webGpu = await captureTier(false);
    const webGl = await captureTier(true);
    const webGpuFrame = await decodeVisualFrame(webGpu.buffer);
    const webGlFrame = await decodeVisualFrame(webGl.buffer);
    const webGpuBeforeFrame = await decodeVisualFrame(webGpu.beforeBuffer);
    const webGlBeforeFrame = await decodeVisualFrame(webGl.beforeBuffer);
    const stats = visualDifferenceStats(webGlFrame, webGpuFrame);
    const initialStats = visualDifferenceStats(webGlBeforeFrame, webGpuBeforeFrame);
    const webGpuUpdateStats = visualDifferenceStats(webGpuBeforeFrame, webGpuFrame);
    const webGlUpdateStats = visualDifferenceStats(webGlBeforeFrame, webGlFrame);
    const phaseFields = [
      "time",
      "motionPhase",
      "noisePhase",
      "pulsePhase",
      "breathPhase",
    ] as const;
    for (const field of phaseFields) {
      expect(webGpu.sample[field]).toBeCloseTo(webGl.sample[field], 8);
    }

    const visualParityBudget = {
      maxChannelDifference: 32,
      meanNormalizedDifference: 0.001,
      p99ChannelDifference: 3,
      p999ChannelDifference: 8,
    };
    const report = {
      generatedAt: new Date().toISOString(),
      initialStats,
      sourceSha256: ORB_SOURCE_DIGEST,
      stats,
      updateStats: {
        webGl: webGlUpdateStats,
        webGpu: webGpuUpdateStats,
      },
      visualParityBudget,
      webGl: {
        buildIdentity: webGl.buildIdentity,
        consoleErrors: webGl.consoleErrors,
        failedRequests: webGl.failedRequests,
        pageErrors: webGl.pageErrors,
        sample: webGl.sample,
        tier: webGl.tier,
      },
      webGpu: {
        adapterInfo: webGpu.adapterInfo,
        buildIdentity: webGpu.buildIdentity,
        consoleErrors: webGpu.consoleErrors,
        failedRequests: webGpu.failedRequests,
        pageErrors: webGpu.pageErrors,
        sample: webGpu.sample,
        tier: webGpu.tier,
      },
    };
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(path.join(OUTPUT_DIR, "webgl-main-fixed-frame.png"), webGl.buffer);
    writeFileSync(path.join(OUTPUT_DIR, "webgpu-main-fixed-frame.png"), webGpu.buffer);
    writeFileSync(path.join(OUTPUT_DIR, "webgl-main-before-selection.png"), webGl.beforeBuffer);
    writeFileSync(path.join(OUTPUT_DIR, "webgpu-main-before-selection.png"), webGpu.beforeBuffer);
    const reportJson = `${JSON.stringify(report, null, 2)}\n`;
    writeFileSync(path.join(OUTPUT_DIR, "canonical-webgpu-webgl-parity.json"), reportJson);
    await testInfo.attach("orb-webgpu-webgl-parity", {
      body: Buffer.from(reportJson),
      contentType: "application/json",
    });

    expect(stats.meanNormalizedDifference).toBeLessThanOrEqual(
      visualParityBudget.meanNormalizedDifference,
    );
    expect(stats.p99ChannelDifference).toBeLessThanOrEqual(
      visualParityBudget.p99ChannelDifference,
    );
    expect(stats.p999ChannelDifference).toBeLessThanOrEqual(
      visualParityBudget.p999ChannelDifference,
    );
    expect(stats.maxChannelDifference).toBeLessThanOrEqual(
      visualParityBudget.maxChannelDifference,
    );
    expect(initialStats.meanNormalizedDifference).toBeLessThanOrEqual(
      visualParityBudget.meanNormalizedDifference,
    );
    expect(initialStats.p99ChannelDifference).toBeLessThanOrEqual(
      visualParityBudget.p99ChannelDifference,
    );
    expect(initialStats.p999ChannelDifference).toBeLessThanOrEqual(
      visualParityBudget.p999ChannelDifference,
    );
    expect(initialStats.maxChannelDifference).toBeLessThanOrEqual(
      visualParityBudget.maxChannelDifference,
    );
    expect(webGlUpdateStats.meanNormalizedDifference).toBeGreaterThan(0.005);
    expect(webGpuUpdateStats.meanNormalizedDifference).toBeGreaterThan(0.005);
    expect(webGpu.adapterInfo).not.toBeNull();
    expect(JSON.stringify(webGpu.adapterInfo).toLowerCase()).not.toContain("swiftshader");
    expect(webGl.consoleErrors).toEqual([]);
    expect(webGpu.consoleErrors).toEqual([]);
    expect(webGl.pageErrors).toEqual([]);
    expect(webGpu.pageErrors).toEqual([]);
    expect(webGl.failedRequests).toEqual([]);
    expect(webGpu.failedRequests).toEqual([]);
  });
});
