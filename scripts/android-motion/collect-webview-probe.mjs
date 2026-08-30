#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { summarizeOrbProbeSamples } from "./evidence-lib.mjs";

const argv = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const index = argv.indexOf(name);
  return index < 0 ? fallback : argv[index + 1];
};

const port = Number(valueFor("--port", "9222"));
const LOOPBACK_CDP_ORIGIN = "ws://127.0.0.1:9222";
const durationMs = Number(valueFor("--duration-ms", "65000"));
const output = valueFor("--output");
if (!output || port !== 9222 || !Number.isFinite(durationMs) || durationMs < 1000 || durationMs > 300000) {
  throw new Error("Usage: collect-webview-probe.mjs --output <evidence.json> [--port 9222] [--duration-ms 65000]");
}

class CdpConnection {
  constructor(endpoint) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(endpoint);
  }

  async open() {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("CDP WebSocket connection timed out")), 10000);
      this.socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("CDP WebSocket connection failed"));
      }, { once: true });
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
  const evidence = {
    installedAt: performance.now(),
    samples: [],
    lifecycle: [],
    longTasks: [],
    longAnimationFrames: [],
    resources: {
      workersCreated: 0,
      workersTerminated: 0,
      listenersAdded: 0,
      listenersRemoved: 0,
      rafRequested: 0,
      rafFired: 0,
      rafCancelled: 0,
      pendingRaf: 0,
      errors: 0,
    },
  };
  Object.defineProperty(window, "__zenAndroidMotionEvidence", { value: evidence, configurable: false });
  window.__zenOrbClockProbeSink = (sample) => {
    if (evidence.samples.length < 20000) evidence.samples.push(sample);
  };
  window.__zenOrbLifecycleProbeSink = (event) => {
    if (evidence.lifecycle.length < 2000) evidence.lifecycle.push(event);
  };

  const originalWorker = window.Worker;
  window.Worker = new Proxy(originalWorker, {
    construct(target, args, newTarget) {
      evidence.resources.workersCreated += 1;
      const worker = Reflect.construct(target, args, newTarget);
      const originalTerminate = worker.terminate.bind(worker);
      let terminated = false;
      worker.terminate = () => {
        if (!terminated) {
          terminated = true;
          evidence.resources.workersTerminated += 1;
        }
        return originalTerminate();
      };
      return worker;
    },
  });

  const originalAdd = EventTarget.prototype.addEventListener;
  const originalRemove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    evidence.resources.listenersAdded += 1;
    return originalAdd.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    evidence.resources.listenersRemoved += 1;
    return originalRemove.call(this, type, listener, options);
  };

  const originalRaf = window.requestAnimationFrame.bind(window);
  const originalCancelRaf = window.cancelAnimationFrame.bind(window);
  const pendingRaf = new Set();
  window.requestAnimationFrame = (callback) => {
    evidence.resources.rafRequested += 1;
    let id = 0;
    id = originalRaf((timestamp) => {
      pendingRaf.delete(id);
      evidence.resources.pendingRaf = pendingRaf.size;
      evidence.resources.rafFired += 1;
      callback(timestamp);
    });
    pendingRaf.add(id);
    evidence.resources.pendingRaf = pendingRaf.size;
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    if (pendingRaf.delete(id)) evidence.resources.rafCancelled += 1;
    evidence.resources.pendingRaf = pendingRaf.size;
    return originalCancelRaf(id);
  };

  const observe = (type, sink, mapEntry) => {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (sink.length < 5000) sink.push(mapEntry(entry));
        }
      });
      observer.observe({ type, buffered: true });
    } catch {}
  };
  observe("longtask", evidence.longTasks, (entry) => ({ startTime: entry.startTime, duration: entry.duration }));
  observe("long-animation-frame", evidence.longAnimationFrames, (entry) => ({
    startTime: entry.startTime,
    duration: entry.duration,
    blockingDuration: entry.blockingDuration ?? 0,
  }));
  window.addEventListener("error", () => { evidence.resources.errors += 1; });
  window.addEventListener("unhandledrejection", () => { evidence.resources.errors += 1; });
})();`;

const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => {
  if (!response.ok) throw new Error(`CDP target discovery failed: HTTP ${response.status}`);
  return response.json();
});
const target = targets.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
if (!target) throw new Error("No inspectable Android WebView page target was found");

const cdpEndpoint = new URL(target.webSocketDebuggerUrl);
cdpEndpoint.protocol = "ws:";
cdpEndpoint.hostname = "127.0.0.1";
cdpEndpoint.port = "9222";
const cdp = new CdpConnection(cdpEndpoint.toString());
await cdp.open();
try {
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: preloadSource });
  const measurementUrl = new URL(target.url);
  measurementUrl.searchParams.set("orbClockProbe", "true");
  await cdp.send("Page.navigate", { url: measurementUrl.toString() });
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const startedAt = new Date().toISOString();
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  const endedAt = new Date().toISOString();
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const evidence = window.__zenAndroidMotionEvidence;
      if (!evidence) throw new Error("Android motion preload probe is unavailable");
      return {
        ...evidence,
        resources: {
          ...evidence.resources,
          canvases: document.querySelectorAll("canvas").length,
          orbCanvases: document.querySelectorAll("[data-orb-renderer-tier]").length,
          activeWorkers: evidence.resources.workersCreated - evidence.resources.workersTerminated,
          listenerBalance: evidence.resources.listenersAdded - evidence.resources.listenersRemoved,
        },
        collectedAt: performance.now(),
        visibilityState: document.visibilityState,
        hrefProtocol: location.protocol,
        hrefHostname: location.hostname,
      };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  const raw = result.result?.value;
  if (!raw || !Array.isArray(raw.samples)) throw new Error("Android motion probe returned no samples array");
  const payload = {
    schemaVersion: 1,
    startedAt,
    endedAt,
    durationMs,
    target: { protocol: raw.hrefProtocol, hostname: raw.hrefHostname },
    summary: summarizeOrbProbeSamples(raw.samples),
    resources: raw.resources,
    longTasks: raw.longTasks,
    longAnimationFrames: raw.longAnimationFrames,
    lifecycle: raw.lifecycle,
    samples: raw.samples,
  };
  const resolvedOutput = path.resolve(output);
  await mkdir(path.dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(JSON.stringify({ output, summary: payload.summary, resources: payload.resources }));
} finally {
  cdp.close();
}
