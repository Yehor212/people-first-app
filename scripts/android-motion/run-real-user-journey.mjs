#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const LOOPBACK_CDP_ORIGIN = "ws://127.0.0.1:9222";
const DEFAULT_PACKAGE = "com.zenflow.app";
const DEFAULT_ACTIVITY = "com.zenflow.app/.MainActivity";
const SCREENSHOT_REMOTE_PATH = "/sdcard/zenflow-real-user-journey.png";
const JOURNEY_SCENARIOS = new Set([
  "orb-slider-refine",
  "drawer-theme",
  "full-route-cycle",
]);
const REFINE_JOURNEY_REQUIRED_TEXTS = [
  "How are you feeling right now?",
  "More precise",
];
let uiDumpSequence = 0;

const sleep = (durationMs) =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

export function getRefineJourneyRequiredTexts() {
  return [...REFINE_JOURNEY_REQUIRED_TEXTS];
}

function decodeXmlAttribute(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replace(/&#(\d+);/g, (_, codePoint) =>
      String.fromCodePoint(Number(codePoint)),
    );
}

function parseBounds(value) {
  const match = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(value);
  if (!match) return null;
  const [, left, top, right, bottom] = match.map(Number);
  return { bottom, left, right, top };
}

export function parseUiAutomatorNodes(xml) {
  const nodes = [];
  for (const nodeMatch of xml.matchAll(/<node\b([^>]*)\/?\s*>/g)) {
    const attributes = {};
    for (const attributeMatch of nodeMatch[1].matchAll(/([\w-]+)="([^"]*)"/g)) {
      attributes[attributeMatch[1]] = decodeXmlAttribute(attributeMatch[2]);
    }
    const bounds = parseBounds(attributes.bounds ?? "");
    nodes.push({
      bounds,
      className: attributes.class ?? "",
      clickable: attributes.clickable === "true",
      contentDescription: attributes["content-desc"] ?? "",
      enabled: attributes.enabled !== "false",
      resourceId: attributes["resource-id"] ?? "",
      scrollable: attributes.scrollable === "true",
      text: attributes.text ?? "",
      visibleToUser:
        attributes["visible-to-user"] !== "false" &&
        Boolean(bounds && bounds.right > bounds.left && bounds.bottom > bounds.top),
    });
  }
  return nodes;
}

export function listVisibleClickableNodes(nodes) {
  return nodes.filter(
    (node) => node.visibleToUser && node.enabled && node.clickable && node.bounds,
  );
}

export function findVisibleScrollableNode(nodes) {
  return nodes.find(
    (node) => node.visibleToUser && node.enabled && node.scrollable && node.bounds,
  );
}

export function sliderJourneyPoints(bounds, edgeInset = 44) {
  if (!bounds || bounds.right - bounds.left <= edgeInset * 2) {
    throw new Error("Mood slider bounds are too small for the semantic journey");
  }
  const y = centerOfBounds(bounds).y;
  return {
    negative: { x: bounds.left + edgeInset, y },
    neutral: { x: Math.round((bounds.left + bounds.right) / 2), y },
    positive: { x: bounds.right - edgeInset, y },
  };
}

export function verticalSwipeWithinBounds(bounds, direction) {
  if (!bounds || !new Set(["up", "down"]).has(direction)) {
    throw new Error("Scrollable bounds and direction are required");
  }
  const centerX = Math.round((bounds.left + bounds.right) / 2);
  const inset = Math.round((bounds.bottom - bounds.top) * 0.2);
  const upper = { x: centerX, y: bounds.top + inset };
  const lower = { x: centerX, y: bounds.bottom - inset };
  return direction === "up" ? { from: lower, to: upper } : { from: upper, to: lower };
}

export function createClickableNodeInventory(nodes, { route, capturedAtMs }) {
  if (!Number.isFinite(capturedAtMs)) {
    throw new Error("Clickable-node inventory timestamp must be finite");
  }
  return listVisibleClickableNodes(nodes).map((node) => ({
    ...node,
    label: node.text || node.contentDescription || node.resourceId || node.className,
    route,
    capturedAtMs,
    status: "UNVERIFIED",
  }));
}

function sameBounds(left, right) {
  return (
    left &&
    right &&
    left.left === right.left &&
    left.top === right.top &&
    left.right === right.right &&
    left.bottom === right.bottom
  );
}

export function reconcileClickableNode(inventory, { bounds, label, status }) {
  if (!new Set(["PASS", "FAIL", "NOT_REPRODUCIBLE", "N/A", "UNVERIFIED"]).has(status)) {
    throw new Error("Clickable-node reconciliation status is invalid");
  }
  return inventory.map((entry) =>
    sameBounds(entry.bounds, bounds)
      ? { ...entry, actionLabel: label, status }
      : entry,
  );
}

export async function runTimedJourneyStep({
  clock = () => globalThis.performance.now(),
  wallClock = () => Date.now(),
  entry,
  execute,
}) {
  const startedAtMs = clock();
  const startedAtWallClockMs = wallClock();
  if (!Number.isFinite(startedAtMs)) {
    throw new Error("Journey step start timestamp must be finite");
  }
  if (!Number.isFinite(startedAtWallClockMs)) {
    throw new Error("Journey step wall-clock start timestamp must be finite");
  }
  const result = await execute();
  const endedAtMs = clock();
  const endedAtWallClockMs = wallClock();
  if (!Number.isFinite(endedAtMs) || endedAtMs < startedAtMs) {
    throw new Error("Journey step end timestamp must be finite and monotonic");
  }
  if (
    !Number.isFinite(endedAtWallClockMs) ||
    endedAtWallClockMs < startedAtWallClockMs
  ) {
    throw new Error("Journey step wall-clock end timestamp must be finite and ordered");
  }
  return {
    ...entry,
    startedAtMs,
    endedAtMs,
    startedAtWallClockMs,
    endedAtWallClockMs,
    result,
  };
}

export function calculateClockSync({
  hostMonotonicStartedAtMs,
  hostMonotonicEndedAtMs,
  hostWallClockStartedAtMs,
  deviceUptimeSeconds,
}) {
  for (const [label, value] of Object.entries({
    hostMonotonicStartedAtMs,
    hostMonotonicEndedAtMs,
    hostWallClockStartedAtMs,
    deviceUptimeSeconds,
  })) {
    if (!Number.isFinite(value)) throw new Error(`Clock sync ${label} must be finite`);
  }
  if (hostMonotonicEndedAtMs < hostMonotonicStartedAtMs || deviceUptimeSeconds < 0) {
    throw new Error("Clock sync timestamps must be monotonic and non-negative");
  }
  const roundTripMs = hostMonotonicEndedAtMs - hostMonotonicStartedAtMs;
  return {
    deviceUptimeMs: deviceUptimeSeconds * 1000,
    hostMonotonicMidpointMs: hostMonotonicStartedAtMs + roundTripMs / 2,
    hostWallClockMidpointMs: hostWallClockStartedAtMs + roundTripMs / 2,
    uncertaintyMs: roundTripMs / 2,
  };
}

export function findVisibleUiNode(
  nodes,
  { clickable, contentDescription, contentDescriptionIncludes, text, textIncludes },
) {
  return nodes.find((node) => {
    if (!node.visibleToUser || !node.enabled) return false;
    if (clickable !== undefined && node.clickable !== clickable) return false;
    if (text !== undefined && node.text !== text) return false;
    if (textIncludes !== undefined && !node.text.includes(textIncludes)) return false;
    if (
      contentDescription !== undefined &&
      node.contentDescription !== contentDescription
    ) {
      return false;
    }
    if (
      contentDescriptionIncludes !== undefined &&
      !node.contentDescription.includes(contentDescriptionIncludes)
    ) {
      return false;
    }
    return true;
  });
}

export function findVisibleClickableUiNode(nodes, criteria) {
  return findVisibleUiNode(nodes, { ...criteria, clickable: true });
}

export function centerOfBounds(bounds) {
  return {
    x: Math.round((bounds.left + bounds.right) / 2),
    y: Math.round((bounds.top + bounds.bottom) / 2),
  };
}

function valueFor(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index < 0 ? fallback : argv[index + 1];
}

export function shouldCaptureJourneyScreenshots(argv) {
  return !argv.includes("--video-only");
}

export function assertJourneyScenario(value) {
  if (!JOURNEY_SCENARIOS.has(value)) {
    throw new Error(`Unsupported Android journey scenario: ${value}`);
  }
  return value;
}

export function hasIsolatedAndroidDayCompositor(surface) {
  if (!surface || surface.rendererState !== "ready") return false;
  if (surface.largeEffectsCanvasCount !== 1 || !surface.canvas) return false;
  if (
    surface.canvas.motionModel !==
    "large:4;photons:78;motes:35;threads:18"
  ) {
    return false;
  }
  if (surface.canvas.width <= 0 || surface.canvas.height <= 0) return false;

  return Object.values(surface.largeEffectDisplays ?? {}).every(
    (display) => display === null || display === "none",
  );
}

function assertSafeArgument(value, pattern, label) {
  if (!value || !pattern.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

async function runAdb(serial, ...args) {
  const { stdout = "" } = await execFileAsync("adb", ["-s", serial, ...args], {
    encoding: "utf8",
    maxBuffer: 24 * 1024 * 1024,
  });
  return stdout;
}

async function sampleDeviceClockSync(serial) {
  const hostMonotonicStartedAtMs = globalThis.performance.now();
  const hostWallClockStartedAtMs = Date.now();
  const uptime = await runAdb(serial, "shell", "cat", "/proc/uptime");
  const hostMonotonicEndedAtMs = globalThis.performance.now();
  const deviceUptimeSeconds = Number(uptime.trim().split(/\s+/, 1)[0]);
  return calculateClockSync({
    hostMonotonicStartedAtMs,
    hostMonotonicEndedAtMs,
    hostWallClockStartedAtMs,
    deviceUptimeSeconds,
  });
}

async function dumpUi(serial) {
  uiDumpSequence += 1;
  const remotePath =
    `/sdcard/zenflow-real-user-journey-ui-${process.pid}-${uiDumpSequence}.xml`;
  try {
    await runAdb(serial, "shell", "uiautomator", "dump", remotePath);
    const xml = await runAdb(serial, "exec-out", "cat", remotePath);
    if (!xml.includes("<hierarchy")) {
      throw new Error("Android UIAutomator returned no hierarchy");
    }
    return { nodes: parseUiAutomatorNodes(xml), xml };
  } finally {
    await runAdb(serial, "shell", "rm", "-f", remotePath).catch(() => undefined);
  }
}

async function captureNativeScreenshot(serial, outputDirectory, name) {
  const localPath = path.join(outputDirectory, `${name}.png`);
  await runAdb(serial, "shell", "screencap", "-p", SCREENSHOT_REMOTE_PATH);
  await runAdb(serial, "pull", SCREENSHOT_REMOTE_PATH, localPath);
  return localPath;
}

async function openCdp(port) {
  const targets = await fetch(`http://127.0.0.1:${port}/json`).then(
    async (response) => {
      if (!response.ok) {
        throw new Error(`CDP target discovery failed: HTTP ${response.status}`);
      }
      return response.json();
    },
  );
  const target = targets.find(
    (entry) => entry.type === "page" && entry.webSocketDebuggerUrl,
  );
  if (!target) throw new Error("No inspectable Android WebView page target was found");

  const endpoint = new URL(target.webSocketDebuggerUrl);
  endpoint.protocol = "ws:";
  endpoint.hostname = "127.0.0.1";
  endpoint.port = String(port);
  const socket = new WebSocket(endpoint);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("CDP WebSocket connection timed out")),
      10000,
    );
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(new Error("CDP WebSocket connection failed"));
      },
      { once: true },
    );
  });

  socket.addEventListener("message", (event) => {
    if (event.origin !== LOOPBACK_CDP_ORIGIN) return;
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const command = pending.get(message.id);
    clearTimeout(command.timeout);
    pending.delete(message.id);
    if (message.error) {
      command.reject(new Error(`${message.error.code}: ${message.error.message}`));
    } else {
      command.resolve(message.result ?? {});
    }
  });

  const send = (method, params = {}) => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 15000);
      pending.set(id, { reject, resolve, timeout });
      socket.send(JSON.stringify({ id, method, params }));
    });
  };

  return { close: () => socket.close(), send };
}

async function readWebViewState(port) {
  const cdp = await openCdp(port);
  try {
    await cdp.send("Runtime.enable");
    const result = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const root = document.querySelector('[data-testid="day-cosmic-background"]');
        const canvas = document.querySelector('[data-testid="android-day-webgl-large-effects"]');
        const page = document.querySelector('[data-testid="orb-page"]');
        const flourishLayer = document.querySelector('[data-testid="cosmic-orb-flourish-layer"]');
        const dynamicAmbienceIds = [
          'day-cosmic-light-curtain',
          'day-cosmic-sun-threads',
          'day-cosmic-sun-shower',
          'day-cosmic-prism-ribbon',
          'day-cosmic-caustics',
          'day-cosmic-photon-field',
          'day-cosmic-motes',
        ];
        return {
          animationCount: document.getAnimations().length,
          largeEffectsCanvasCount: document.querySelectorAll('[data-testid="android-day-webgl-large-effects"]').length,
          flourishSurfaceState: page?.getAttribute('data-android-day-flourish-surface') ?? null,
          canvas: canvas instanceof HTMLCanvasElement ? {
            height: canvas.height,
            pixels: canvas.getAttribute('data-android-day-pixels'),
            renderer: canvas.getAttribute('data-renderer'),
            motionModel: canvas.getAttribute('data-android-day-motion-model'),
            width: canvas.width,
          } : null,
          largeEffectDisplays: Object.fromEntries(
            dynamicAmbienceIds.map((id) => {
              const node = document.querySelector('[data-testid="' + id + '"]');
              return [id, node ? getComputedStyle(node).display : null];
            }),
          ),
          liveFlourishDisplay: flourishLayer ? getComputedStyle(flourishLayer).display : null,
          route: document.querySelector('[data-testid="nav-v2-orchestrator"]')?.getAttribute('data-active-page') ?? null,
          rendererState: root?.getAttribute('data-android-day-ambience') ?? null,
          theme: document.documentElement.getAttribute('data-theme') ?? document.documentElement.className,
        };
      })()`,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ?? "WebView state probe failed",
      );
    }
    return result.result?.value ?? null;
  } finally {
    cdp.close();
  }
}

async function runJourney({ captureScreenshots, outputDirectory, port, scenario, serial }) {
  const actions = [];
  const checkpoints = [];
  let clickableNodeInventories = [];

  const recordAction = async (entry, execute) => {
    const action = await runTimedJourneyStep({ entry, execute });
    actions.push(action);
    if (entry.bounds) {
      clickableNodeInventories = clickableNodeInventories.map((inventory) => ({
        ...inventory,
        nodes: reconcileClickableNode(inventory.nodes, {
          bounds: entry.bounds,
          label: entry.label,
          status: "PASS",
        }),
      }));
    }
    return action.result;
  };

  const captureClickableInventory = async (route) => {
    const startedAtMs = globalThis.performance.now();
    const { nodes } = await dumpUi(serial);
    const endedAtMs = globalThis.performance.now();
    clickableNodeInventories.push({
      route,
      startedAtMs,
      endedAtMs,
      nodes: createClickableNodeInventory(nodes, {
        route,
        capturedAtMs: endedAtMs,
      }),
    });
  };

  const requireNode = async (criteria, label) => {
    const deadline = Date.now() + 7000;
    do {
      try {
        const { nodes } = await dumpUi(serial);
        const node = findVisibleUiNode(nodes, criteria);
        if (node?.bounds) return node;
      } catch {
        // UIAutomator may return a transient null root during a native/WebView
        // accessibility refresh. A fresh unique dump is the only safe retry.
      }
      await sleep(250);
    } while (Date.now() < deadline);
    throw new Error(`Visible Android node not found: ${label}`);
  };

  const tapNode = async (criteria, label, settleMs = 800) => {
    const deadline = Date.now() + 7000;
    let node;
    do {
      try {
        const { nodes } = await dumpUi(serial);
        node = findVisibleClickableUiNode(nodes, criteria);
        if (node?.bounds) break;
      } catch {
        // UIAutomator may return a transient null root during a native/WebView
        // accessibility refresh. A fresh unique dump is the only safe retry.
      }
      await sleep(250);
    } while (Date.now() < deadline);
    if (!node?.bounds) throw new Error(`Visible clickable Android node not found: ${label}`);
    const point = centerOfBounds(node.bounds);
    await recordAction(
      { action: "tap", bounds: node.bounds, label, point },
      () => runAdb(serial, "shell", "input", "tap", String(point.x), String(point.y)),
    );
    await sleep(settleMs);
  };

  const requireTexts = async (texts, label) => {
    const startedAtMs = globalThis.performance.now();
    const deadline = Date.now() + 7000;
    let missing = texts;
    do {
      try {
        const { nodes } = await dumpUi(serial);
        missing = texts.filter(
          (text) => !findVisibleUiNode(nodes, { text }),
        );
        if (missing.length === 0) {
          checkpoints.push({
            label,
            visibleTexts: texts,
            startedAtMs,
            endedAtMs: globalThis.performance.now(),
          });
          return;
        }
      } catch {
        // See requireNode: retry a fresh dump instead of trusting stale XML.
      }
      await sleep(250);
    } while (Date.now() < deadline);
    throw new Error(`${label} is missing visible nodes: ${missing.join(", ")}`);
  };

  const capture = async (name) => {
    const startedAtMs = globalThis.performance.now();
    if (!captureScreenshots) {
      checkpoints.push({
        label: name,
        visualCapture: "continuous-video-only",
        startedAtMs,
        endedAtMs: globalThis.performance.now(),
      });
      return;
    }
    const screenshot = await captureNativeScreenshot(
      serial,
      outputDirectory,
      name,
    );
    const logcat = await runAdb(serial, "logcat", "-d");
    const tileWarningsSoFar =
      logcat.match(/Tile memory limits exceeded/gi)?.length ?? 0;
    checkpoints.push({
      label: name,
      screenshot,
      tileWarningsSoFar,
      startedAtMs,
      endedAtMs: globalThis.performance.now(),
    });
  };

  if (captureScreenshots) {
    await runAdb(serial, "logcat", "-c");
  }
  await requireTexts(
    [
      "Log how you're feeling",
      "In this moment",
      "At a specific time",
      "For the whole day",
      "Very Unpleasant",
      "Very Pleasant",
      "Next",
    ],
    "day Orb select",
  );
  await requireNode({ text: "Open menu" }, "Open menu");
  await captureClickableInventory("orb-day-select");
  const initialSurface = captureScreenshots
    ? await readWebViewState(port)
    : null;
  if (
    captureScreenshots &&
    !hasIsolatedAndroidDayCompositor(initialSurface)
  ) {
    throw new Error("Android day WebGL compositor isolation is not ready");
  }
  await capture("00-day-orb-select");

  if (scenario !== "drawer-theme") {
  const slider = await requireNode({ textIncludes: "How you feel" }, "mood slider");
  const sliderPoints = sliderJourneyPoints(slider.bounds);
  await recordAction(
    {
      action: "tap",
      bounds: slider.bounds,
      label: "mood set to negative",
      point: sliderPoints.negative,
    },
    () => runAdb(
      serial,
      "shell",
      "input",
      "tap",
      String(sliderPoints.negative.x),
      String(sliderPoints.negative.y),
    ),
  );
  await sleep(2000);
  await capture("01a-day-orb-slider-negative");

  const sliderJourney = [
    ["mood negative to neutral", sliderPoints.negative, sliderPoints.neutral, "01b-day-orb-slider-neutral"],
    ["mood neutral to positive", sliderPoints.neutral, sliderPoints.positive, "01c-day-orb-slider-positive"],
    ["mood positive to neutral", sliderPoints.positive, sliderPoints.neutral, "01d-day-orb-slider-neutral-return"],
    ["mood neutral to negative", sliderPoints.neutral, sliderPoints.negative, "01e-day-orb-slider-negative-return"],
  ];
  for (const [label, from, to, checkpoint] of sliderJourney) {
    await recordAction(
      { action: "swipe", bounds: slider.bounds, from, label, to },
      () =>
        runAdb(
          serial,
          "shell",
          "input",
          "swipe",
          String(from.x),
          String(from.y),
          String(to.x),
          String(to.y),
          "700",
        ),
    );
    await sleep(2000);
    await capture(checkpoint);
  }
  await requireTexts(["Very Unpleasant", "Next"], "day Orb after slider round trip");

  await tapNode({ text: "Next" }, "Next", 1200);
  await requireTexts(
    getRefineJourneyRequiredTexts(),
    "day Orb refine",
  );
  await capture("03-day-orb-refine");
  const { nodes: refineNodes } = await dumpUi(serial);
  const scrollOwner = findVisibleScrollableNode(refineNodes);
  if (!scrollOwner?.bounds) throw new Error("Visible semantic scroll owner not found: Orb refine");
  const refineScroll = verticalSwipeWithinBounds(scrollOwner.bounds, "up");
  await recordAction(
    {
      action: "swipe",
      bounds: scrollOwner.bounds,
      from: refineScroll.from,
      label: "refine actions into view",
      to: refineScroll.to,
    },
    () =>
      runAdb(
        serial,
        "shell",
        "input",
        "swipe",
        String(refineScroll.from.x),
        String(refineScroll.from.y),
        String(refineScroll.to.x),
        String(refineScroll.to.y),
        "450",
      ),
  );
  await sleep(700);
  await requireTexts(
    ["Back", "Save mood", "Save mood and start today's entry"],
    "day Orb refine actions",
  );
  await capture("04-day-orb-refine-actions");

  await recordAction(
    { action: "android-back", label: "refine to select" },
    () => runAdb(serial, "shell", "input", "keyevent", "4"),
  );
  await sleep(900);
  await requireTexts(["Next", "For the whole day"], "day Orb after Android Back");
  }

  if (scenario === "orb-slider-refine") {
    return {
      actions,
      clickableNodeInventories,
      checkpoints,
      finalSurface: null,
      initialSurface,
      nightState: null,
      restoredDayState: null,
      steadyTileWarnings: null,
      tileWarnings: null,
    };
  }

  const openDrawer = async () => {
    await tapNode({ text: "Open menu" }, "Open menu", 700);
    await requireTexts(
      ["Menu", "Mood", "Habits", "Diary", "Planning", "Dark", "Settings"],
      "global drawer",
    );
    await captureClickableInventory("global-drawer");
  };

  await openDrawer();
  await capture("05-day-drawer");
  await tapNode({ text: "Mood" }, "Mood", 900);
  await requireTexts(["Next"], "Mood route");
  await captureClickableInventory("orb-day-return");

  const routes = scenario === "drawer-theme" ? [] : [
    { marker: "Build your first loop", name: "Habits", screenshot: "06-day-habits" },
    { marker: "Diary", name: "Diary", screenshot: "07-day-diary" },
    { marker: "Plan your next ritual", name: "Planning", screenshot: "08-day-planning" },
    { marker: "Choose how ZenFlow looks, sounds, reminds you, and handles your data.", name: "Settings", screenshot: "09-day-settings" },
  ];

  for (const route of routes) {
    await openDrawer();
    await tapNode({ text: route.name }, route.name, 1400);
    await requireTexts([route.marker], `${route.name} route`);
    await captureClickableInventory(route.name.toLowerCase());
    await capture(route.screenshot);
  }

  await openDrawer();
  await tapNode({ text: "Dark" }, "Dark theme", 1200);
  const nightState = captureScreenshots ? await readWebViewState(port) : null;
  await capture("10-night-drawer-control");
  await tapNode({ text: "Mood" }, "Mood in night theme", 1200);
  await requireTexts(["Next", "For the whole day"], "night Orb control");
  await capture("11-night-orb-control");

  await openDrawer();
  await tapNode({ text: "Dark" }, "Light theme", 1800);
  const restoredDayState = captureScreenshots
    ? await readWebViewState(port)
    : null;
  await capture("12-restored-day-drawer");
  await tapNode({ text: "Close menu" }, "Close menu", 900);
  await requireTexts(["Next", "For the whole day"], "restored day Orb");
  await capture("13-restored-day-orb");

  let finalSurface = null;
  let steadyTileWarnings = null;
  let tileWarnings = null;
  if (captureScreenshots) {
    const allLogcat = await runAdb(serial, "logcat", "-d");
    tileWarnings = allLogcat.match(/Tile memory limits exceeded/gi)?.length ?? 0;
    await runAdb(serial, "logcat", "-c");
    await sleep(5000);
    const steadyLogcat = await runAdb(serial, "logcat", "-d");
    steadyTileWarnings =
      steadyLogcat.match(/Tile memory limits exceeded/gi)?.length ?? 0;
    finalSurface = await readWebViewState(port);
  }

  return {
    actions,
    clickableNodeInventories,
    checkpoints,
    finalSurface,
    initialSurface,
    nightState,
    restoredDayState,
    steadyTileWarnings,
    tileWarnings,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const serial = valueFor(argv, "--serial", "emulator-5554");
  const output = valueFor(argv, "--output");
  const port = Number(valueFor(argv, "--port", "9222"));
  const packageName = valueFor(argv, "--package", DEFAULT_PACKAGE);
  const activity = valueFor(argv, "--activity", DEFAULT_ACTIVITY);
  const scenario = assertJourneyScenario(
    valueFor(argv, "--scenario", "full-route-cycle"),
  );
  const captureScreenshots = shouldCaptureJourneyScreenshots(argv);

  if (!output || port !== 9222) {
    throw new Error(
      "Usage: run-real-user-journey.mjs --output <run.json> [--serial emulator-5554] [--scenario orb-slider-refine|drawer-theme|full-route-cycle] [--port 9222] [--video-only]",
    );
  }
  assertSafeArgument(serial, /^[a-zA-Z0-9._:-]+$/, "ADB serial");
  assertSafeArgument(packageName, /^[a-zA-Z][a-zA-Z0-9_.]+$/, "Android package");
  assertSafeArgument(activity, /^[a-zA-Z0-9_.]+\/[.a-zA-Z0-9_]+$/, "Android activity");

  const resolvedOutput = path.resolve(output);
  const outputDirectory = path.join(
    path.dirname(resolvedOutput),
    `${path.basename(resolvedOutput, path.extname(resolvedOutput))}-screens`,
  );
  if (captureScreenshots) {
    await mkdir(outputDirectory, { recursive: true });
  }
  const startedAt = new Date().toISOString();
  const clockSyncStarted = await sampleDeviceClockSync(serial);
  const result = await runJourney({
    captureScreenshots,
    outputDirectory,
    port,
    scenario,
    serial,
  });
  const clockSyncEnded = await sampleDeviceClockSync(serial);
  const payload = {
    schemaVersion: 2,
    activity,
    endedAt: new Date().toISOString(),
    interactionSource: "uiautomator-adb",
    monotonicClock: "host-performance-now",
    clockSync: {
      started: clockSyncStarted,
      ended: clockSyncEnded,
    },
    packageName,
    scenario,
    serial,
    startedAt,
    visualCaptureMode: captureScreenshots
      ? "screenshots-and-diagnostics"
      : "continuous-video-only",
    ...result,
  };
  await writeFile(resolvedOutput, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      actions: payload.actions.length,
      checkpoints: payload.checkpoints.length,
      clickableNodes: payload.clickableNodeInventories.reduce(
        (total, inventory) => total + inventory.nodes.length,
        0,
      ),
      output,
      steadyTileWarnings: payload.steadyTileWarnings,
      tileWarnings: payload.tileWarnings,
    }),
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  await main();
}
