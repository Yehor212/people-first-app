#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import {
  buildStyleExperimentExpression,
  selectLocalAppWebViewTarget,
} from "./evidence-lib.mjs";

const argv = process.argv.slice(2);
const valueFor = (name) => {
  const index = argv.indexOf(name);
  return index < 0 ? undefined : argv[index + 1];
};
const input = valueFor("--input");
const id = valueFor("--id");
const port = Number(valueFor("--port") ?? "9222");
const LOOPBACK_CDP_ORIGIN = "ws://127.0.0.1:9222";

if (!input || !id || port !== 9222) {
  throw new Error(
    "Usage: set-webview-style-experiment.mjs --input <css-file> --id <safe-id> [--port 9222]"
  );
}

const css = await readFile(input, "utf8");
if (/@import\b|url\s*\(/i.test(css)) {
  throw new Error("Android motion style experiments cannot load external resources");
}
const expression = buildStyleExperimentExpression({ css, id });
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => {
  if (!response.ok) throw new Error(`CDP target discovery failed: HTTP ${response.status}`);
  return response.json();
});
const target = selectLocalAppWebViewTarget(targets);

const cdpEndpoint = new URL(target.webSocketDebuggerUrl);
cdpEndpoint.protocol = "ws:";
cdpEndpoint.hostname = "127.0.0.1";
cdpEndpoint.port = String(port);
const socket = new WebSocket(cdpEndpoint);
const pending = new Map();
let nextId = 1;

await new Promise((resolve, reject) => {
  const timeout = setTimeout(
    () => reject(new Error("CDP WebSocket connection timed out")),
    10000
  );
  socket.addEventListener(
    "open",
    () => {
      clearTimeout(timeout);
      resolve();
    },
    { once: true }
  );
  socket.addEventListener(
    "error",
    () => {
      clearTimeout(timeout);
      reject(new Error("CDP WebSocket connection failed"));
    },
    { once: true }
  );
});
socket.addEventListener("message", (event) => {
  if (event.origin !== LOOPBACK_CDP_ORIGIN) return;
  const message = JSON.parse(String(event.data));
  if (!message.id || !pending.has(message.id)) return;
  const command = pending.get(message.id);
  clearTimeout(command.timeout);
  pending.delete(message.id);
  if (message.error) command.reject(new Error(`${message.error.code}: ${message.error.message}`));
  else command.resolve(message.result ?? {});
});
const send = (method, params = {}) => {
  const commandId = nextId++;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(commandId);
      reject(new Error(`CDP command timed out: ${method}`));
    }, 15000);
    pending.set(commandId, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id: commandId, method, params }));
  });
};

try {
  await send("Runtime.enable");
  const result = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "Style experiment failed");
  }
  console.log(JSON.stringify({ id, result: result.result?.value ?? null }));
} finally {
  socket.close();
}
