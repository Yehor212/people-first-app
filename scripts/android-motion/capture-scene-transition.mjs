#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  assertRunArtifactIdentity,
  summarizeSceneTransitionSamples,
} from "./evidence-lib.mjs";
import {
  centerOfBounds,
  findVisibleUiNode,
  parseUiAutomatorNodes,
  sliderJourneyPoints,
} from "./run-real-user-journey.mjs";

const execFileAsync = promisify(execFile);
const PACKAGE = "com.zenflow.app";
const LOOPBACK_CDP_ORIGIN = "ws://127.0.0.1:9222";
const REQUIRED_SELECTORS = ["header", "emotion", "note", "actions", "miniOrb"];

function valueFor(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index < 0 ? fallback : argv[index + 1];
}

function safeIdentifier(value, label) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9._:-]+$/.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function resolveInsideRoot(root, candidate, label) {
  if (!candidate) throw new Error(`${label} is required`);
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} must stay inside the repository`);
  }
  return { absolute, relative: relative.split(path.sep).join("/") };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function adb(serial, ...args) {
  const { stdout = "" } = await execFileAsync("adb", ["-s", serial, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.trim();
}

async function installedIdentity(serial) {
  const packagePathOutput = await adb(serial, "shell", "pm", "path", PACKAGE);
  const installedPath = packagePathOutput
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("package:"))
    ?.slice("package:".length);
  if (!installedPath) throw new Error("Installed base.apk path is missing");
  const installedSha256 = (await adb(serial, "shell", "sha256sum", installedPath))
    .split(/\s+/, 1)[0];
  const packageState = await adb(serial, "shell", "dumpsys", "package", PACKAGE);
  return {
    installedPath,
    installedSha256,
    packageName: PACKAGE,
    versionName: packageState.match(/versionName=([^\s]+)/)?.[1] ?? "",
    versionCode: Number(packageState.match(/versionCode=(\d+)/)?.[1]),
  };
}

async function dumpUiOnce(serial, outputDirectory, fileName) {
  const remotePath = `/sdcard/zenflow-scene-transition-${process.pid}.xml`;
  try {
    await adb(serial, "shell", "uiautomator", "dump", remotePath);
    const xml = await adb(serial, "exec-out", "cat", remotePath);
    if (!xml.includes("<hierarchy")) {
      throw new Error("Android UIAutomator returned no hierarchy");
    }
    await writeFile(path.join(outputDirectory, fileName), xml, {
      encoding: "utf8",
      mode: 0o600,
    });
    return parseUiAutomatorNodes(xml);
  } finally {
    await adb(serial, "shell", "rm", "-f", remotePath).catch(() => undefined);
  }
}

class CdpConnection {
  constructor(endpoint) {
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.socket = new WebSocket(endpoint);
  }

  async open() {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("CDP WebSocket connection timed out")),
        10000,
      );
      this.socket.addEventListener(
        "open",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      this.socket.addEventListener(
        "error",
        () => {
          clearTimeout(timeout);
          reject(new Error("CDP WebSocket connection failed"));
        },
        { once: true },
      );
    });
    this.socket.addEventListener("message", (event) => {
      if (event.origin !== LOOPBACK_CDP_ORIGIN) return;
      const message = JSON.parse(String(event.data));
      if (message.method) {
        for (const handler of this.handlers.get(message.method) ?? []) {
          handler(message.params ?? {});
        }
        return;
      }
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject, timeout } = this.pending.get(message.id);
      clearTimeout(timeout);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.code}: ${message.error.message}`));
      else resolve(message.result ?? {});
    });
  }

  on(method, handler) {
    const handlers = this.handlers.get(method) ?? [];
    handlers.push(handler);
    this.handlers.set(method, handlers);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

const samplerSource = String.raw`(() => {
  const selectors = {
    header: '[data-testid="orb-page-refine"]',
    emotion: '[data-testid="orb-page-emotion-spectrum"]',
    note: '[data-testid="orb-page-note"]',
    actions: '[data-testid="orb-page-refine-actions"]',
    miniOrb: '[data-testid="orb-page-refine"] [data-orb-renderer-tier]',
  };
  const evidence = {
    installedAtWallClockMs: performance.timeOrigin + performance.now(),
    samples: [],
    mutations: [],
    inputEvents: [],
    longTasks: [],
    longAnimationFrames: [],
    stopped: false,
  };
  Object.defineProperty(window, '__zenSceneTransitionEvidence', {
    value: evidence,
    configurable: true,
  });

  const inspect = (selector) => {
    const node = document.querySelector(selector);
    if (!(node instanceof Element)) {
      return { exists: false, visible: false, effectiveOpacity: 0, rect: null };
    }
    const rect = node.getBoundingClientRect();
    let effectiveOpacity = 1;
    let visible = rect.width > 0 && rect.height > 0;
    let cursor = node;
    while (cursor instanceof Element && visible) {
      const style = getComputedStyle(cursor);
      if (style.display === 'none' || style.visibility === 'hidden') visible = false;
      const opacity = Number(style.opacity);
      if (Number.isFinite(opacity)) effectiveOpacity *= opacity;
      cursor = cursor.parentElement;
    }
    visible = visible && effectiveOpacity > 0.01;
    return {
      exists: true,
      visible,
      effectiveOpacity: Math.round(effectiveOpacity * 1000000) / 1000000,
      rect: {
        x: Math.round(rect.x * 1000) / 1000,
        y: Math.round(rect.y * 1000) / 1000,
        width: Math.round(rect.width * 1000) / 1000,
        height: Math.round(rect.height * 1000) / 1000,
      },
    };
  };
  const animationTarget = (animation) => {
    const target = animation.effect && animation.effect.target;
    if (!(target instanceof Element)) return null;
    return target.getAttribute('data-testid') ||
      target.getAttribute('data-orb-renderer-tier') ||
      target.id ||
      target.localName;
  };
  const observer = new MutationObserver((records) => {
    const at = performance.timeOrigin + performance.now();
    for (const record of records) {
      if (evidence.mutations.length >= 500) break;
      evidence.mutations.push({
        atWallClockMs: at,
        type: record.type,
        added: [...record.addedNodes].filter((node) => node instanceof Element).map((node) =>
          node.getAttribute('data-testid') || node.localName
        ).slice(0, 12),
        removed: [...record.removedNodes].filter((node) => node instanceof Element).map((node) =>
          node.getAttribute('data-testid') || node.localName
        ).slice(0, 12),
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const recordInput = (event) => {
    if (evidence.inputEvents.length >= 100) return;
    const target = event.target instanceof Element
      ? event.target.closest('[data-testid]')
      : null;
    evidence.inputEvents.push({
      at: performance.now(),
      atWallClockMs: performance.timeOrigin + performance.now(),
      type: event.type,
      target: target?.getAttribute('data-testid') || null,
    });
  };
  window.addEventListener('pointerdown', recordInput, true);
  window.addEventListener('click', recordInput, true);
  const observe = (type, sink, mapEntry) => {
    try {
      const performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (sink.length < 500) sink.push(mapEntry(entry));
        }
      });
      performanceObserver.observe({ type, buffered: true });
    } catch {}
  };
  observe('longtask', evidence.longTasks, (entry) => ({
    startTime: entry.startTime,
    duration: entry.duration,
  }));
  observe('long-animation-frame', evidence.longAnimationFrames, (entry) => ({
    startTime: entry.startTime,
    duration: entry.duration,
    blockingDuration: entry.blockingDuration || 0,
  }));

  const sample = () => {
    if (evidence.stopped || evidence.samples.length >= 900) return;
    const now = performance.now();
    const animations = document.getAnimations().slice(0, 120).map((animation) => ({
      target: animationTarget(animation),
      currentTime: typeof animation.currentTime === 'number'
        ? Math.round(animation.currentTime * 1000) / 1000
        : null,
      playState: animation.playState,
    }));
    evidence.samples.push({
      at: Math.round(now * 1000) / 1000,
      atWallClockMs: performance.timeOrigin + now,
      activePage: document.querySelector('[data-active-page]')?.getAttribute('data-active-page') || null,
      nodes: Object.fromEntries(Object.entries(selectors).map(([name, selector]) => [name, inspect(selector)])),
      animationCount: animations.length,
      runningAnimationCount: animations.filter((animation) => animation.playState === 'running').length,
      animations,
      canvasCount: document.querySelectorAll('canvas').length,
      orbCanvasCount: document.querySelectorAll('[data-orb-renderer-tier]').length,
    });
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  return { installed: true, selectors };
})()`;

const argv = process.argv.slice(2);
const root = process.cwd();
const serial = safeIdentifier(valueFor(argv, "--serial", "emulator-5554"), "ADB serial");
const port = Number(valueFor(argv, "--port", "9222"));
const scenario = valueFor(argv, "--scenario", "orb-next-refine");
const preDumpSettleMs = Number(valueFor(argv, "--pre-dump-settle-ms", "6000"));
const expectedSha256 = valueFor(argv, "--expected-sha256");
if (port !== 9222 || scenario !== "orb-next-refine") {
  throw new Error("Only --scenario orb-next-refine and --port 9222 are supported");
}
if (!/^[0-9a-f]{64}$/.test(expectedSha256 ?? "")) {
  throw new Error("--expected-sha256 must be a full lowercase SHA-256");
}
if (!Number.isFinite(preDumpSettleMs) || preDumpSettleMs < 1000 || preDumpSettleMs > 15000) {
  throw new Error("--pre-dump-settle-ms must be between 1000 and 15000");
}
const sourceApk = resolveInsideRoot(root, valueFor(argv, "--source-apk"), "source APK");
const outputDirectory = resolveInsideRoot(root, valueFor(argv, "--output-dir"), "output directory");
if (!outputDirectory.relative.startsWith("output/")) {
  throw new Error("output directory must stay under output/");
}
try {
  await lstat(outputDirectory.absolute);
  throw new Error(`output directory already exists: ${outputDirectory.relative}`);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
await mkdir(outputDirectory.absolute, { recursive: false, mode: 0o700 });

const sourceApkBytes = await readFile(sourceApk.absolute);
const sourceSha256 = sha256(sourceApkBytes);
const before = await installedIdentity(serial);
assertRunArtifactIdentity({
  expectedSha256,
  sourceSha256,
  installedBeforeSha256: before.installedSha256,
  installedAfterSha256: before.installedSha256,
  packageName: before.packageName,
  versionName: before.versionName,
  versionCode: before.versionCode,
});

// The Orb main surface remains intentionally inert until its canonical renderer
// publishes a visual-ready frame. Wait before the single semantic snapshot so
// the WebView accessibility subtree is complete without polling UIAutomation.
await new Promise((resolve) => setTimeout(resolve, preDumpSettleMs));
await dumpUiOnce(serial, outputDirectory.absolute, "semantic-priming.xml");
await new Promise((resolve) => setTimeout(resolve, 3000));
const semanticNodes = await dumpUiOnce(
  serial,
  outputDirectory.absolute,
  "semantic-before.xml",
);
const slider = findVisibleUiNode(semanticNodes, { textIncludes: "How you feel" });
const next = findVisibleUiNode(semanticNodes, { text: "Next" });
if (!slider?.bounds || !next?.bounds) {
  throw new Error("Semantic mood slider and Next controls must both be visible");
}
const sliderPoint = sliderJourneyPoints(slider.bounds).negative;
const nextPoint = centerOfBounds(next.bounds);
await adb(serial, "shell", "input", "tap", String(sliderPoint.x), String(sliderPoint.y));

// Let the one-shot UIAutomation process unregister before the diagnostic window.
await new Promise((resolve) => setTimeout(resolve, 3000));
await adb(serial, "logcat", "-c");

const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => {
  if (!response.ok) throw new Error(`CDP target discovery failed: HTTP ${response.status}`);
  return response.json();
});
const target = targets.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
if (!target) throw new Error("No inspectable Android WebView page target was found");
const endpoint = new URL(target.webSocketDebuggerUrl);
endpoint.protocol = "ws:";
endpoint.hostname = "127.0.0.1";
endpoint.port = String(port);
const cdp = new CdpConnection(endpoint.toString());
await cdp.open();

const layerEvents = [];
cdp.on("LayerTree.layerTreeDidChange", ({ layers }) => {
  if (!Array.isArray(layers) || layerEvents.length >= 500) return;
  const drawingLayers = layers.filter((layer) => layer.drawsContent !== false);
  layerEvents.push({
    atWallClockMs: Date.now(),
    layerCount: layers.length,
    drawingLayerCount: drawingLayers.length,
    totalDrawingPixels: drawingLayers.reduce(
      (total, layer) => total + Math.max(0, layer.width ?? 0) * Math.max(0, layer.height ?? 0),
      0,
    ),
  });
});

const startedAt = new Date().toISOString();
let actionStartedAtWallClockMs = null;
try {
  await Promise.all([
    cdp.send("Page.enable"),
    cdp.send("Runtime.enable"),
    cdp.send("LayerTree.enable"),
  ]);
  const installedSampler = await cdp.send("Runtime.evaluate", {
    expression: samplerSource,
    returnByValue: true,
  });
  if (installedSampler.exceptionDetails || !installedSampler.result?.value?.installed) {
    throw new Error("Scene transition sampler could not be installed");
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  actionStartedAtWallClockMs = Date.now();
  await adb(serial, "shell", "input", "tap", String(nextPoint.x), String(nextPoint.y));
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const evidence = window.__zenSceneTransitionEvidence;
      if (!evidence) return null;
      evidence.stopped = true;
      return evidence;
    })()`,
    returnByValue: true,
  });
  const evidence = result.result?.value;
  if (!evidence || !Array.isArray(evidence.samples)) {
    throw new Error("Scene transition sampler returned no samples");
  }
  const nextClick = evidence.inputEvents?.find(
    (event) => event.type === "click" && event.target === "orb-page-next",
  );
  if (!nextClick || !Number.isFinite(nextClick.atWallClockMs)) {
    throw new Error("Scene transition sampler did not observe the semantic Next click");
  }
  const relativeSamples = evidence.samples.map((sample) => ({
    ...sample,
    at: sample.atWallClockMs - nextClick.atWallClockMs,
  }));
  const summary = summarizeSceneTransitionSamples(relativeSamples, REQUIRED_SELECTORS);
  const logcat = await adb(serial, "logcat", "-d", "-v", "threadtime");
  const after = await installedIdentity(serial);
  assertRunArtifactIdentity({
    expectedSha256,
    sourceSha256,
    installedBeforeSha256: before.installedSha256,
    installedAfterSha256: after.installedSha256,
    packageName: after.packageName,
    versionName: after.versionName,
    versionCode: after.versionCode,
  });
  const payload = {
    schemaVersion: 1,
    scenario,
    startedAt,
    endedAt: new Date().toISOString(),
    sourceApk: {
      path: sourceApk.relative,
      bytes: sourceApkBytes.byteLength,
      sha256: sourceSha256,
    },
    installedBefore: before,
    installedAfter: after,
    interactionSource: "one-shot-uiautomator-tree-then-adb-semantic-bounds",
    action: {
      label: "Next",
      bounds: next.bounds,
      point: nextPoint,
      hostStartedAtWallClockMs: actionStartedAtWallClockMs,
      webViewClickAtMs: nextClick.at,
      webViewClickAtWallClockMs: nextClick.atWallClockMs,
    },
    uiAutomationDumpCount: 2,
    uiAutomationSettleMs: 3000,
    requiredSelectors: REQUIRED_SELECTORS,
    summary,
    layerEvents,
    logcatSummary: {
      tileMemoryWarnings: logcat.match(/Tile memory limits exceeded/gi)?.length ?? 0,
      skippedFrameMessages: [...logcat.matchAll(/Skipped (\d+) frames!/g)].map((match) => Number(match[1])),
      daveyDurationsMs: [...logcat.matchAll(/Davey! duration=(\d+)ms/g)].map((match) => Number(match[1])),
      uiAutomationRegistrations: logcat.match(/UiAutomationConnection: Created/gi)?.length ?? 0,
      anr: /\bANR\b|Application Not Responding/i.test(logcat),
      fatalException: /FATAL EXCEPTION/i.test(logcat),
      contextLoss: /context lost|contextloss/i.test(logcat),
    },
    evidence: { ...evidence, samples: relativeSamples },
  };
  await writeFile(
    path.join(outputDirectory.absolute, "transition-evidence.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(JSON.stringify({ outputDirectory: outputDirectory.relative, summary, logcatSummary: payload.logcatSummary }));
} finally {
  cdp.close();
}
