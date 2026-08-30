#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const argv = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const index = argv.indexOf(name);
  return index < 0 ? fallback : argv[index + 1];
};
const port = Number(valueFor("--port", "9222"));
const LOOPBACK_CDP_ORIGIN = "ws://127.0.0.1:9222";
const output = valueFor("--output");
const preservePage = argv.includes("--preserve-page");
if (!output || port !== 9222) {
  throw new Error(
    "Usage: capture-webview-visual.mjs --output <png> [--port 9222] [--preserve-page]",
  );
}

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
const socket = new WebSocket(cdpEndpoint);
const pending = new Map();
let nextId = 1;
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("CDP WebSocket connection timed out")), 10000);
  socket.addEventListener("open", () => {
    clearTimeout(timeout);
    resolve();
  }, { once: true });
  socket.addEventListener("error", () => {
    clearTimeout(timeout);
    reject(new Error("CDP WebSocket connection failed"));
  }, { once: true });
});
socket.addEventListener("message", (event) => {
  if (event.origin !== LOOPBACK_CDP_ORIGIN) return;
  const message = JSON.parse(String(event.data));
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject, timeout } = pending.get(message.id);
  clearTimeout(timeout);
  pending.delete(message.id);
  if (message.error) reject(new Error(`${message.error.code}: ${message.error.message}`));
  else resolve(message.result ?? {});
});
const send = (method, params = {}) => {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP command timed out: ${method}`));
    }, 15000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
};

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setEmulatedMedia", {
    media: "screen",
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  if (!preservePage) {
    await send("Page.reload", { ignoreCache: true });
    await new Promise((resolve) => setTimeout(resolve, 4000));
  } else {
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  await send("Runtime.evaluate", {
    expression: `(() => {
      for (const animation of document.getAnimations()) {
        try {
          animation.currentTime = 0;
          animation.pause();
        } catch {}
      }
      return {
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        animationCount: document.getAnimations().length,
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      };
    })()`,
    returnByValue: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  const capture = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  if (typeof capture.data !== "string" || capture.data.length === 0) throw new Error("CDP returned no screenshot payload");
  const resolvedOutput = path.resolve(output);
  await mkdir(path.dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, Buffer.from(capture.data, "base64"), { mode: 0o600 });
  console.log(
    JSON.stringify({
      output,
      preservedPage: preservePage,
      target: {
        protocol: new URL(target.url).protocol,
        hostname: new URL(target.url).hostname,
      },
    }),
  );
} finally {
  socket.close();
}
