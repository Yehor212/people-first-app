#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import {
  selectLocalAppWebViewTarget,
  validateDomExperimentSource,
} from "./evidence-lib.mjs";

const argv = process.argv.slice(2);
const valueFor = (name) => {
  const index = argv.indexOf(name);
  return index < 0 ? undefined : argv[index + 1];
};
const input = valueFor("--input");
const port = Number(valueFor("--port") ?? "9222");
const LOOPBACK_CDP_ORIGIN = "ws://127.0.0.1:9222";
if (!input || port !== 9222) {
  throw new Error("Usage: evaluate-webview-experiment.mjs --input <js-file> [--port 9222]");
}

const source = validateDomExperimentSource(await readFile(input, "utf8"));
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => {
  if (!response.ok) throw new Error(`CDP target discovery failed: HTTP ${response.status}`);
  return response.json();
});
const target = selectLocalAppWebViewTarget(targets);

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
  const result = await send("Runtime.evaluate", {
    expression: `(async () => { ${source}\n})()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "DOM experiment failed");
  }
  console.log(JSON.stringify({ result: result.result?.value ?? null }));
} finally {
  socket.close();
}
