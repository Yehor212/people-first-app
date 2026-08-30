#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildLocalBenchmarkRoute,
  selectLocalAppWebViewTarget,
} from "./evidence-lib.mjs";

const LOOPBACK_CDP_ORIGIN = "ws://127.0.0.1:9222";

function valueFor(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index < 0 ? fallback : argv[index + 1];
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
        10_000,
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
      const pending = this.pending.get(message.id);
      clearTimeout(pending.timeout);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
      else pending.resolve(message.result ?? {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 15_000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

const argv = process.argv.slice(2);
const port = Number(valueFor(argv, "--port", "9222"));
const route = valueFor(argv, "--route", "/orb?nav=v2&navLayout=phone&dev=true");
const output = valueFor(argv, "--output");
if (!output || port !== 9222) {
  throw new Error(
    "Usage: set-local-benchmark-route.mjs --output <receipt.json> [--route /orb?nav=v2&navLayout=phone&dev=true] [--port 9222]",
  );
}

const targets = await fetch(`http://127.0.0.1:${port}/json`).then(async (response) => {
  if (!response.ok) throw new Error(`CDP target discovery failed: HTTP ${response.status}`);
  return response.json();
});
const target = selectLocalAppWebViewTarget(targets);
const destination = buildLocalBenchmarkRoute(target.url, route);
const endpoint = new URL(target.webSocketDebuggerUrl);
endpoint.protocol = "ws:";
endpoint.hostname = "127.0.0.1";
endpoint.port = String(port);
const cdp = new CdpConnection(endpoint.toString());
await cdp.open();
const startedAt = new Date().toISOString();
let readiness = null;
try {
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: destination });
  const deadline = Date.now() + 20_000;
  do {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const result = await cdp.send("Runtime.evaluate", {
      expression: `({
        readyState: document.readyState,
        href: location.href,
        orbVisible: Boolean(document.querySelector('[data-testid="orb-page"]')),
        authVisible: Boolean(document.querySelector('[data-testid="auth-screen"]'))
      })`,
      returnByValue: true,
    });
    readiness = result.result?.value ?? null;
    if (
      readiness?.readyState === "complete" &&
      readiness.orbVisible === true &&
      readiness.authVisible === false
    ) {
      break;
    }
  } while (Date.now() < deadline);
  if (
    readiness?.readyState !== "complete" ||
    readiness.orbVisible !== true ||
    readiness.authVisible !== false
  ) {
    throw new Error("Local benchmark Orb route did not become ready");
  }
} finally {
  cdp.close();
}

const resolvedOutput = path.resolve(output);
const relativeOutput = path.relative(process.cwd(), resolvedOutput);
if (
  relativeOutput === ".." ||
  relativeOutput.startsWith(`..${path.sep}`) ||
  path.isAbsolute(relativeOutput) ||
  !relativeOutput.split(path.sep).includes("output")
) {
  throw new Error("Benchmark route receipt must stay under repository output/");
}
await mkdir(path.dirname(resolvedOutput), { recursive: true });
await writeFile(
  resolvedOutput,
  `${JSON.stringify({
    schemaVersion: 1,
    startedAt,
    endedAt: new Date().toISOString(),
    from: new URL(target.url).origin,
    destination,
    readiness,
    productDataCreated: false,
    authBypass: "localhost-dev-query-only",
  }, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);
console.log(JSON.stringify({ output, destination, readiness }));
