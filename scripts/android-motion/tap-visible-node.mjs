#!/usr/bin/env node

import { execFile } from "node:child_process";
import { lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  centerOfBounds,
  findVisibleUiNode,
  parseUiAutomatorNodes,
  runTimedJourneyStep,
} from "./run-real-user-journey.mjs";

const execFileAsync = promisify(execFile);

function valueFor(argv, name) {
  const index = argv.indexOf(name);
  return index < 0 ? undefined : argv[index + 1];
}

async function adb(serial, ...args) {
  const { stdout = "" } = await execFileAsync("adb", ["-s", serial, ...args], {
    encoding: "utf8",
    maxBuffer: 24 * 1024 * 1024,
  });
  return stdout;
}

const argv = process.argv.slice(2);
const serial = valueFor(argv, "--serial") ?? "emulator-5554";
if (!/^[a-zA-Z0-9._:-]+$/.test(serial)) throw new Error("ADB serial is invalid");
const text = valueFor(argv, "--text");
const contentDescription = valueFor(argv, "--content-description");
if ((text ? 1 : 0) + (contentDescription ? 1 : 0) !== 1) {
  throw new Error("Exactly one of --text or --content-description is required");
}
const output = valueFor(argv, "--output");
if (!output) throw new Error("--output is required");
const resolvedOutput = path.resolve(output);
const relativeOutput = path.relative(process.cwd(), resolvedOutput);
if (
  relativeOutput === ".." ||
  relativeOutput.startsWith(`..${path.sep}`) ||
  path.isAbsolute(relativeOutput) ||
  !relativeOutput.split(path.sep).includes("output")
) {
  throw new Error("Action output must stay under repository output/");
}
try {
  await lstat(resolvedOutput);
  throw new Error(`Action output already exists: ${relativeOutput}`);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const criteria = text
  ? { clickable: true, text }
  : { clickable: true, contentDescription };
const startedAt = new Date().toISOString();
const deadline = Date.now() + 7_000;
let node = null;
let attempt = 0;
do {
  attempt += 1;
  const remotePath = `/sdcard/zenflow-semantic-node-${process.pid}-${attempt}.xml`;
  try {
    await adb(serial, "shell", "uiautomator", "dump", remotePath);
    const xml = await adb(serial, "exec-out", "cat", remotePath);
    node = findVisibleUiNode(parseUiAutomatorNodes(xml), criteria) ?? null;
  } catch {
    node = null;
  } finally {
    await adb(serial, "shell", "rm", "-f", remotePath).catch(() => undefined);
  }
  if (!node?.bounds) await new Promise((resolve) => setTimeout(resolve, 250));
} while (!node?.bounds && Date.now() < deadline);
if (!node?.bounds) throw new Error("Requested visible semantic node was not found");
const point = centerOfBounds(node.bounds);
const action = await runTimedJourneyStep({
  entry: {
    action: "tap",
    label: text ?? contentDescription,
    bounds: node.bounds,
    point,
    selector: criteria,
  },
  execute: () =>
    adb(serial, "shell", "input", "tap", String(point.x), String(point.y)),
});
await mkdir(path.dirname(resolvedOutput), { recursive: true });
await writeFile(
  resolvedOutput,
  `${JSON.stringify({
    schemaVersion: 1,
    serial,
    interactionSource: "uiautomator-adb",
    startedAt,
    endedAt: new Date().toISOString(),
    action,
  }, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);
console.log(JSON.stringify({ output: relativeOutput, label: action.label, bounds: action.bounds }));
