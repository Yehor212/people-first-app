#!/usr/bin/env node

import { execFile } from "node:child_process";
import { lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PACKAGE = "com.zenflow.app";
const COMMANDS = {
  gfxinfo: ["shell", "dumpsys", "gfxinfo", PACKAGE, "framestats"],
  logcat: ["logcat", "-d", "-v", "threadtime"],
  meminfo: ["shell", "dumpsys", "meminfo", PACKAGE],
  package: ["shell", "dumpsys", "package", PACKAGE],
  thermal: ["shell", "dumpsys", "thermalservice"],
};

function valueFor(argv, name) {
  const index = argv.indexOf(name);
  return index < 0 ? undefined : argv[index + 1];
}

const argv = process.argv.slice(2);
const serial = valueFor(argv, "--serial") ?? "emulator-5554";
const type = valueFor(argv, "--type");
const output = valueFor(argv, "--output");
if (!/^[a-zA-Z0-9._:-]+$/.test(serial)) throw new Error("ADB serial is invalid");
if (!type || !COMMANDS[type]) throw new Error("--type must be gfxinfo, logcat, meminfo, package, or thermal");
if (!output) throw new Error("--output is required");
const resolvedOutput = path.resolve(output);
const relativeOutput = path.relative(process.cwd(), resolvedOutput);
if (
  relativeOutput === ".." ||
  relativeOutput.startsWith(`..${path.sep}`) ||
  path.isAbsolute(relativeOutput) ||
  !relativeOutput.split(path.sep).includes("output")
) {
  throw new Error("ADB report output must stay under repository output/");
}
try {
  await lstat(resolvedOutput);
  throw new Error(`ADB report already exists: ${relativeOutput}`);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const { stdout = "" } = await execFileAsync(
  "adb",
  ["-s", serial, ...COMMANDS[type]],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
await mkdir(path.dirname(resolvedOutput), { recursive: true });
await writeFile(resolvedOutput, stdout, { encoding: "utf8", mode: 0o600 });
console.log(JSON.stringify({ output: relativeOutput, type, bytes: Buffer.byteLength(stdout) }));
