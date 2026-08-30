#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mapWithConcurrency, summarizeLayerAttribution } from "./evidence-lib.mjs";

const argv = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const index = argv.indexOf(name);
  return index < 0 ? fallback : argv[index + 1];
};

const port = Number(valueFor("--port", "9222"));
const settleMs = Number(valueFor("--settle-ms", "2000"));
const output = valueFor("--output");
const label = valueFor("--label", "webview-layer-snapshot");
const runtimePerfDebug = argv.includes("--runtime-perf-debug");
const summaryOnly = argv.includes("--summary-only");
const LOOPBACK_CDP_ORIGIN = "ws://127.0.0.1:9222";

if (
  !output ||
  port !== 9222 ||
  !Number.isFinite(settleMs) ||
  settleMs < 250 ||
  settleMs > 15000 ||
  !/^[a-zA-Z0-9._-]{1,80}$/.test(label)
) {
  throw new Error(
    "Usage: collect-webview-layers.mjs --output <evidence.json> [--port 9222] [--settle-ms 2000] [--label safe-label] [--runtime-perf-debug] [--summary-only]"
  );
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
        10000
      );
      this.socket.addEventListener(
        "open",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true }
      );
      this.socket.addEventListener(
        "error",
        () => {
          clearTimeout(timeout);
          reject(new Error("CDP WebSocket connection failed"));
        },
        { once: true }
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

  send(method, params = {}, timeoutMs = 15000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => {
  if (!response.ok) throw new Error(`CDP target discovery failed: HTTP ${response.status}`);
  return response.json();
});
const target = targets.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
if (!target) throw new Error("No inspectable Android WebView page target was found");

const cdpEndpoint = new URL(target.webSocketDebuggerUrl);
cdpEndpoint.protocol = "ws:";
cdpEndpoint.hostname = "127.0.0.1";
cdpEndpoint.port = String(port);
const cdp = new CdpConnection(cdpEndpoint.toString());
await cdp.open();

let latestLayers = [];
cdp.on("LayerTree.layerTreeDidChange", ({ layers }) => {
  if (Array.isArray(layers)) latestLayers = layers;
});

const inspectBackendNode = async (backendNodeId) => {
  let objectId;
  try {
    const resolved = await cdp.send("DOM.resolveNode", { backendNodeId }, 2500);
    objectId = resolved.object?.objectId;
    if (!objectId) return null;
    const inspected = await cdp.send("Runtime.callFunctionOn", {
      objectId,
      returnByValue: true,
      functionDeclaration: `function() {
        if (!(this instanceof Element)) return null;
        const style = getComputedStyle(this);
        const rect = this.getBoundingClientRect();
        const testId = this.getAttribute("data-testid");
        const region = this.getAttribute("data-theme-region");
        const readablePage = this.getAttribute("data-v2-readable-page");
        const rendererTier = this.getAttribute("data-orb-renderer-tier");
        const classes = typeof this.className === "string"
          ? this.className.trim().split(/\\s+/).filter(Boolean).slice(0, 8)
          : [];
        let selector = this.localName || this.nodeName.toLowerCase();
        if (this.id) selector = "#" + this.id;
        else if (testId) selector = '[data-testid="' + testId.replace(/"/g, "") + '"]';
        else if (region) selector = '[data-theme-region="' + region.replace(/"/g, "") + '"]';
        else if (readablePage) selector = '[data-v2-readable-page="' + readablePage.replace(/"/g, "") + '"]';
        else if (rendererTier) selector = '[data-orb-renderer-tier="' + rendererTier.replace(/"/g, "") + '"]';
        else if (classes.length > 0) selector += "." + classes.map((name) => name.replace(/[^a-zA-Z0-9_-]/g, "")).filter(Boolean).join(".");
        return {
          selector,
          nodeName: this.nodeName,
          id: this.id || null,
          testId: testId || null,
          region: region || null,
          readablePage: readablePage || null,
          rendererTier: rendererTier || null,
          classes,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          styles: {
            position: style.position,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            overflow: style.overflow,
            transform: style.transform,
            willChange: style.willChange,
            filter: style.filter,
            webkitFilter: style.webkitFilter || "",
            backdropFilter: style.backdropFilter || "",
            webkitBackdropFilter: style.webkitBackdropFilter || "",
            mixBlendMode: style.mixBlendMode,
            isolation: style.isolation,
            contain: style.contain,
            clipPath: style.clipPath,
            maskImage: style.maskImage,
            animationName: style.animationName,
            animationDuration: style.animationDuration,
            transitionProperty: style.transitionProperty,
            zIndex: style.zIndex,
          },
        };
      }`,
    }, 2500);
    return inspected.result?.value ?? null;
  } catch {
    return null;
  } finally {
    if (objectId) {
      await cdp.send("Runtime.releaseObject", { objectId }, 1000).catch(() => undefined);
    }
  }
};

try {
  await Promise.all([
    cdp.send("Page.enable"),
    cdp.send("Runtime.enable"),
    cdp.send("DOM.enable"),
    cdp.send("LayerTree.enable"),
  ]);
  if (runtimePerfDebug) {
    const debugUrl = new URL(target.url);
    debugUrl.searchParams.set("runtimePerf", "true");
    debugUrl.searchParams.set("runtimePerfGuard", "off");
    await cdp.send("Page.navigate", { url: debugUrl.toString() });
    await sleep(7500);
  }
  await cdp.send("Runtime.evaluate", {
    expression: "document.documentElement.getBoundingClientRect().height",
    returnByValue: true,
  });
  await sleep(settleMs);
  if (latestLayers.length === 0) {
    throw new Error("LayerTree did not publish a compositing tree for the current WebView state");
  }

  const [layoutMetrics, documentProbe] = await Promise.all([
    cdp.send("Page.getLayoutMetrics"),
    cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const animationTarget = (animation) => {
          const target = animation.effect && animation.effect.target;
          if (!(target instanceof Element)) return null;
          if (target.id) return "#" + target.id;
          const testId = target.getAttribute("data-testid");
          if (testId) return '[data-testid="' + testId.replace(/"/g, "") + '"]';
          const className = typeof target.className === "string"
            ? target.className.trim().split(/\\s+/).filter(Boolean).slice(0, 3).join(".")
            : "";
          return target.localName + (className ? "." + className.replace(/[^a-zA-Z0-9_.-]/g, "") : "");
        };
        const animations = document.getAnimations().slice(0, 250).map((animation) => ({
          target: animationTarget(animation),
          playState: animation.playState,
          currentTime: Number(animation.currentTime ?? 0),
          startTime: Number(animation.startTime ?? 0),
          playbackRate: animation.playbackRate,
          animationName: animation.animationName || null,
        }));
        const loaderNodes = [...document.querySelectorAll(".infinity-draw-line, .infinity-glow")].map((node) => {
          const style = getComputedStyle(node);
          return {
            className: node.getAttribute("class") || "",
            animationName: style.animationName,
            animationDuration: style.animationDuration,
            animationPlayState: style.animationPlayState,
            strokeDashoffset: style.strokeDashoffset,
            filter: style.filter,
          };
        });
        return {
          route: document.querySelector("[data-v2-readable-page]")?.getAttribute("data-v2-readable-page") || null,
          activePage: document.querySelector("[data-active-page]")?.getAttribute("data-active-page") || null,
          visibilityState: document.visibilityState,
          readyState: document.readyState,
          runtimePerformanceMode: document.documentElement.dataset.runtimePerf || null,
          runtimePerformanceGuard: window.__zenflowRuntimePerfGuard?.snapshot?.() || null,
          runtimeFlightRecorder: window.__zenflowRuntimePerf?.snapshot?.() || null,
          htmlReducedMotion: document.documentElement.dataset.reducedMotion || null,
          reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
          bodyReduceMotion: document.body.classList.contains("reduce-motion"),
          devicePixelRatio,
          innerWidth,
          innerHeight,
          animationCount: animations.length,
          runningAnimationCount: animations.filter((animation) => animation.playState === "running").length,
          animations,
          loaderNodes,
          canvases: document.querySelectorAll("canvas").length,
          orbCanvases: document.querySelectorAll("[data-orb-renderer-tier]").length,
          drawerOpen: document.querySelector('[data-testid="drawer-v2"]')?.getAttribute("aria-hidden") !== "true" && Boolean(document.querySelector('[data-testid="drawer-v2"]')),
        };
      })()`,
      returnByValue: true,
    }),
  ]);

  const rawDocumentProbe = documentProbe.result?.value;
  if (!rawDocumentProbe) {
    const description =
      documentProbe.exceptionDetails?.exception?.description ||
      documentProbe.exceptionDetails?.text ||
      "unknown Runtime.evaluate failure";
    throw new Error(`WebView document probe returned no value: ${description}`);
  }
  const viewport = {
    width: layoutMetrics.cssVisualViewport?.clientWidth ?? rawDocumentProbe.innerWidth,
    height: layoutMetrics.cssVisualViewport?.clientHeight ?? rawDocumentProbe.innerHeight,
    devicePixelRatio: rawDocumentProbe.devicePixelRatio,
  };

  const backendNodeIds = [
    ...new Set(
      latestLayers
        .map((layer) => layer.backendNodeId)
        .filter((backendNodeId) => Number.isInteger(backendNodeId))
    ),
  ];
  const nodesByBackendId = {};
  const inspectedNodes = summaryOnly
    ? []
    : await mapWithConcurrency(
        backendNodeIds,
        8,
        async (backendNodeId) => [backendNodeId, await inspectBackendNode(backendNodeId)]
      );
  for (const [backendNodeId, inspected] of inspectedNodes) {
    if (inspected) nodesByBackendId[String(backendNodeId)] = inspected;
  }

  const reasonsByLayerId = {};
  if (!summaryOnly) {
    await Promise.all(
      latestLayers.map(async (layer) => {
        try {
          const result = await cdp.send("LayerTree.compositingReasons", {
            layerId: layer.layerId,
          });
          reasonsByLayerId[layer.layerId] = result.compositingReasons ?? [];
        } catch {
          reasonsByLayerId[layer.layerId] = [];
        }
      })
    );
  }

  const summary = summarizeLayerAttribution({
    viewport,
    layers: latestLayers,
    nodesByBackendId,
    reasonsByLayerId,
  });
  const targetUrl = new URL(target.url);
  const payload = {
    schemaVersion: 1,
    collectedAt: new Date().toISOString(),
    label,
    target: { protocol: targetUrl.protocol, hostname: targetUrl.hostname },
    viewport,
    document: rawDocumentProbe,
    summary,
    layers: latestLayers,
    nodesByBackendId,
    reasonsByLayerId,
  };

  const resolvedOutput = path.resolve(output);
  await mkdir(path.dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      output,
      label,
      route: rawDocumentProbe.route,
      layerCount: summary.layerCount,
      drawingLayerCount: summary.drawingLayerCount,
      totalDrawingAreaRatio: summary.totalDrawingAreaRatio,
      largestDrawingLayers: summary.largestDrawingLayers.slice(0, 5),
    })
  );
} finally {
  cdp.close();
}
