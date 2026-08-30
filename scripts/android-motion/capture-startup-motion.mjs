#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const argv = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const index = argv.indexOf(name);
  return index < 0 ? fallback : argv[index + 1];
};

const port = Number(valueFor("--port", "9222"));
const output = valueFor("--output");
const durationMs = Number(valueFor("--duration-ms", "12000"));
const forceRuntimeStrain = argv.includes("--force-runtime-strain");
const holdLoader = argv.includes("--hold-loader");
const LOOPBACK_CDP_ORIGIN = "ws://127.0.0.1:9222";

if (
  !output ||
  port !== 9222 ||
  !Number.isFinite(durationMs) ||
  durationMs < 3000 ||
  durationMs > 30000
) {
  throw new Error(
    "Usage: capture-startup-motion.mjs --output <evidence.json> [--port 9222] [--duration-ms 12000]",
  );
}

class CdpConnection {
  constructor(endpoint) {
    this.nextId = 1;
    this.pending = new Map();
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
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject, timeout } = this.pending.get(message.id);
      clearTimeout(timeout);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.code}: ${message.error.message}`));
      else resolve(message.result ?? {});
    });
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

const preloadSource = String.raw`(() => {
  if (${forceRuntimeStrain ? "true" : "false"}) {
    document.documentElement.dataset.runtimePerf = "strained";
  }
  const evidence = {
    installedAt: performance.now(),
    firstLoaderSeenAt: null,
    lastLoaderSeenAt: null,
    samples: [],
  };
  Object.defineProperty(window, "__zenStartupMotionEvidence", {
    value: evidence,
    configurable: false,
  });

  const animationTargetLabel = (animation) => {
    const target = animation.effect && animation.effect.target;
    if (!(target instanceof Element)) return null;
    if (target.classList.contains("infinity-draw-line")) return "infinity-draw-line";
    if (target.classList.contains("infinity-glow")) return "infinity-glow";
    return target.tagName.toLowerCase();
  };

  const sample = () => {
    const now = performance.now();
    const loader = document.querySelector('[data-testid="splash-infinity-loader"]');
    if (loader) {
      evidence.firstLoaderSeenAt ??= now;
      evidence.lastLoaderSeenAt = now;
      const drawLine = loader.querySelector(".infinity-draw-line");
      const glow = loader.querySelector(".infinity-glow");
      const animations = document
        .getAnimations({ subtree: true })
        .filter((animation) => {
          const target = animation.effect && animation.effect.target;
          return target instanceof Node && loader.contains(target);
        })
        .map((animation) => ({
          currentTime:
            typeof animation.currentTime === "number"
              ? Math.round(animation.currentTime * 1000) / 1000
              : null,
          playState: animation.playState,
          target: animationTargetLabel(animation),
        }));

      evidence.samples.push({
        at: Math.round(now * 1000) / 1000,
        bodyReduceMotion: document.body.classList.contains("reduce-motion"),
        reducedMotion: document.documentElement.getAttribute("data-reduced-motion"),
        runtimePerformanceLimited:
          document.documentElement.hasAttribute("data-runtime-perf"),
        drawAnimationName: drawLine ? getComputedStyle(drawLine).animationName : null,
        drawStrokeDashoffset: drawLine
          ? getComputedStyle(drawLine).strokeDashoffset
          : null,
        glowAnimationName: glow ? getComputedStyle(glow).animationName : null,
        animations,
      });
    }

    if (now - evidence.installedAt < 30000 && evidence.samples.length < 1500) {
      requestAnimationFrame(sample);
    }
  };
  requestAnimationFrame(sample);
})();`;

const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => {
  if (!response.ok) {
    throw new Error(`CDP target discovery failed: HTTP ${response.status}`);
  }
  return response.json();
});
const target = targets.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
if (!target) throw new Error("No inspectable Android WebView page target was found");

const targetUrl = new URL(target.url);
targetUrl.searchParams.delete("runtimePerfDebug");
targetUrl.searchParams.delete("runtimePerformanceDebug");
targetUrl.searchParams.delete("orbClockProbe");
if (holdLoader) targetUrl.searchParams.set("androidMotionProbe", "loader");
else targetUrl.searchParams.delete("androidMotionProbe");

const endpoint = new URL(target.webSocketDebuggerUrl);
endpoint.protocol = "ws:";
endpoint.hostname = "127.0.0.1";
endpoint.port = "9222";

const resolvedOutput = path.resolve(output);
const frameDirectory = path.join(
  path.dirname(resolvedOutput),
  `${path.basename(resolvedOutput, path.extname(resolvedOutput))}-frames`,
);
await mkdir(frameDirectory, { recursive: true });

const cdp = new CdpConnection(endpoint.toString());
await cdp.open();
try {
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: preloadSource });
  if (targetUrl.toString() === target.url) {
    await cdp.send("Page.reload", { ignoreCache: true });
  } else {
    await cdp.send("Page.navigate", { url: targetUrl.toString() });
  }

  const startedAt = Date.now();
  let firstSeenWallTime = null;
  let lastSeenWallTime = null;
  let frameIndex = 0;
  let lastFrameAt = 0;

  while (Date.now() - startedAt < durationMs) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const probe = await cdp.send("Runtime.evaluate", {
      expression: `(() => ({
        loaderPresent: Boolean(document.querySelector('[data-testid="splash-infinity-loader"]')),
        evidencePresent: Boolean(window.__zenStartupMotionEvidence),
      }))()`,
      returnByValue: true,
    });
    const state = probe.result?.value;
    if (!state?.evidencePresent) continue;

    if (state.loaderPresent) {
      firstSeenWallTime ??= Date.now();
      lastSeenWallTime = Date.now();
      if (frameIndex < 8 && Date.now() - lastFrameAt >= 180) {
        const screenshot = await cdp.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true,
          captureBeyondViewport: false,
        });
        if (typeof screenshot.data === "string" && screenshot.data.length > 0) {
          const framePath = path.join(
            frameDirectory,
            `loader-${String(frameIndex).padStart(2, "0")}.png`,
          );
          await writeFile(framePath, Buffer.from(screenshot.data, "base64"), { mode: 0o600 });
          frameIndex += 1;
          lastFrameAt = Date.now();
        }
      }
    } else if (firstSeenWallTime !== null && Date.now() - lastSeenWallTime > 800) {
      break;
    }
  }

  const result = await cdp.send("Runtime.evaluate", {
    expression: "window.__zenStartupMotionEvidence",
    returnByValue: true,
  });
  const evidence = result.result?.value;
  if (!evidence || !Array.isArray(evidence.samples)) {
    throw new Error("Startup motion preload probe returned no samples");
  }

  const runningTimes = evidence.samples.flatMap((sample) =>
    sample.animations
      .filter((animation) => animation.playState === "running")
      .map((animation) => animation.currentTime)
      .filter((value) => typeof value === "number"),
  );
  const dashOffsets = [
    ...new Set(
      evidence.samples
        .map((sample) => sample.drawStrokeDashoffset)
        .filter((value) => typeof value === "string"),
    ),
  ];
  const payload = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    target: { protocol: targetUrl.protocol, hostname: targetUrl.hostname },
    durationMs: Date.now() - startedAt,
    frameDirectory,
    frameCount: frameIndex,
    summary: {
      loaderObserved: evidence.samples.length > 0,
      sampleCount: evidence.samples.length,
      runningAnimationSampleCount: runningTimes.length,
      runningAnimationCurrentTimeAdvanced:
        runningTimes.length > 1 && Math.max(...runningTimes) > Math.min(...runningTimes),
      distinctStrokeDashoffsetCount: dashOffsets.length,
      strokeDashoffsetChanged: dashOffsets.length > 1,
      bodyReduceMotionObserved: evidence.samples.some((sample) => sample.bodyReduceMotion),
      runtimePerformanceLimitedObserved: evidence.samples.some(
        (sample) => sample.runtimePerformanceLimited,
      ),
    },
    evidence,
  };
  await writeFile(resolvedOutput, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(JSON.stringify({ output, summary: payload.summary, frameCount: frameIndex }));
} finally {
  cdp.close();
}
