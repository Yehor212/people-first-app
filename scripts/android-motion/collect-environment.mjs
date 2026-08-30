#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseCurrentWebViewProvider,
  validateEvidenceLedger,
  validateRunEnvironmentEvidence,
} from "./evidence-lib.mjs";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error("Usage: collect-environment.mjs --serial <adb> --device-alias <safe alias> --output <environment.json> [--schema-version 2 --locale en --theme paper --motion normal] | [--baseline-sha <sha>]");
    args[key.slice(2)] = value;
  }
  for (const required of ["serial", "device-alias", "output"]) if (!args[required]) throw new Error(`Missing --${required}`);
  if (args["schema-version"] !== "2" && !args["baseline-sha"]) {
    throw new Error("Missing --baseline-sha for the legacy schema");
  }
  if (args["schema-version"] === "2") {
    for (const required of ["locale", "theme", "motion"]) {
      if (!args[required]) throw new Error(`Missing --${required} for schema v2`);
    }
  }
  return args;
}

function adb(serial, ...args) {
  return execFileSync("adb", ["-s", serial, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
}

function shell(serial, ...args) {
  return adb(serial, "shell", ...args);
}

function firstMatch(text, patterns, fallback = null) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return fallback;
}

function numeric(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Could not read ${label}`);
  return parsed;
}

const args = parseArgs(process.argv.slice(2));
const serial = args.serial;
if (adb(serial, "get-state") !== "device") throw new Error("ADB target is not ready");

const display = shell(serial, "dumpsys", "display");
const surfaceFlinger = shell(serial, "dumpsys", "SurfaceFlinger");
const thermal = shell(serial, "dumpsys", "thermalservice");
const webViewState = shell(serial, "dumpsys", "webviewupdate");
const activeWebView = parseCurrentWebViewProvider(webViewState);
const appPackage = shell(serial, "dumpsys", "package", "com.zenflow.app");
const wmSize = shell(serial, "wm", "size");
const wmDensity = shell(serial, "wm", "density");
const battery = shell(serial, "dumpsys", "battery");
const memory = shell(serial, "cat", "/proc/meminfo");

const animationScales = {
  window: numeric(shell(serial, "settings", "get", "global", "window_animation_scale"), "window animation scale"),
  transition: numeric(shell(serial, "settings", "get", "global", "transition_animation_scale"), "transition animation scale"),
  animator: numeric(shell(serial, "settings", "get", "global", "animator_duration_scale"), "animator duration scale"),
};
if (Object.values(animationScales).some((value) => value !== 1)) throw new Error("All Android animation scales must equal 1 before evidence collection");

const qemu = shell(serial, "getprop", "ro.kernel.qemu") === "1";
const refreshHz = numeric(firstMatch(display, [/renderFrameRate\s+([0-9.]+)/, /fps=([0-9.]+)/]), "refresh rate");
const densityDpi = Number(firstMatch(wmDensity, [/Override density:\s*(\d+)/, /Physical density:\s*(\d+)/], firstMatch(display, [/density\s+(\d+)/])));
const resolutionPx = firstMatch(wmSize, [/Override size:\s*([0-9]+x[0-9]+)/, /Physical size:\s*([0-9]+x[0-9]+)/], firstMatch(display, [/real\s+([0-9]+\s*x\s*[0-9]+)/]));
const locale = shell(serial, "getprop", "persist.sys.locale") || shell(serial, "getprop", "ro.product.locale") || "UNVERIFIED";
const thermalStatus = firstMatch(thermal, [/Thermal Status:\s*(\d+)/], null);

if (args["schema-version"] === "2") {
  const rotation = Number(firstMatch(display, [/rotation\s+(\d+)/], "0"));
  const orientation = new Map([
    [0, "portrait"],
    [1, "landscape"],
    [2, "reverse-portrait"],
    [3, "reverse-landscape"],
  ]).get(rotation) ?? "unknown";
  const availableMemoryKilobytes = numeric(
    firstMatch(memory, [/^MemAvailable:\s+(\d+)\s+kB$/m]),
    "available memory",
  );
  const charging = ["AC powered", "USB powered", "Wireless powered", "Dock powered"]
    .some((label) => firstMatch(battery, [new RegExp(`^\\s*${label}:\\s*(true|false)$`, "m")]) === "true");
  const environment = validateRunEnvironmentEvidence({
    deviceAlias: args["device-alias"],
    kind: qemu ? "emulator" : "physical",
    api: Number(shell(serial, "getprop", "ro.build.version.sdk")),
    abi: shell(serial, "getprop", "ro.product.cpu.abi"),
    model: shell(serial, "getprop", "ro.product.model"),
    gpu: firstMatch(
      surfaceFlinger,
      [/^GLES:\s*(.+)$/m],
      shell(serial, "getprop", "ro.hardware.egl") || "UNVERIFIED",
    ),
    webViewPackage: activeWebView?.packageName ?? "UNVERIFIED",
    webViewVersion: activeWebView?.version ?? "UNVERIFIED",
    resolutionPx: resolutionPx?.replace(/\s/g, "") ?? "UNVERIFIED",
    densityDpi: Number.isInteger(densityDpi) ? densityDpi : 1,
    refreshHz,
    orientation,
    locale: args.locale,
    theme: args.theme,
    motion: args.motion,
    animationScales,
    thermalStatus: thermalStatus === null ? null : Number(thermalStatus),
    batterySaver: shell(serial, "settings", "get", "global", "low_power") === "1",
    charging,
    availableMemoryBytes: availableMemoryKilobytes * 1024,
    collectedAt: new Date().toISOString(),
  });
  const output = path.resolve(args.output);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({ schemaVersion: 2, environment }, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      output: args.output,
      deviceAlias: environment.deviceAlias,
      kind: environment.kind,
      api: environment.api,
      refreshHz: environment.refreshHz,
      webViewVersion: environment.webViewVersion,
    }),
  );
  process.exit(0);
}

const environment = {
  deviceAlias: args["device-alias"],
  kind: qemu ? "emulator" : "physical",
  api: Number(shell(serial, "getprop", "ro.build.version.sdk")),
  refreshHz,
  webViewVersion: activeWebView?.version ?? "UNVERIFIED",
  gpu: firstMatch(surfaceFlinger, [/^GLES:\s*(.+)$/m], shell(serial, "getprop", "ro.hardware.egl") || null),
  densityDpi: Number.isInteger(densityDpi) ? densityDpi : null,
  thermalStatus: thermalStatus === null ? null : Number(thermalStatus),
  batterySaver: shell(serial, "settings", "get", "global", "low_power") === "1",
  animationScale: 1,
  animationScales,
  model: shell(serial, "getprop", "ro.product.model") || null,
  abi: shell(serial, "getprop", "ro.product.cpu.abi") || null,
  resolutionPx: resolutionPx?.replace(/\s/g, "") ?? null,
  locale,
  theme: args.theme || "unknown",
  collectedAt: new Date().toISOString(),
  packageVersion: firstMatch(appPackage, [/versionName=([^\s]+)/], null),
  packageVersionCode: Number(firstMatch(appPackage, [/versionCode=(\d+)/], "0")) || null,
  batteryTemperatureC: Number(firstMatch(thermal, [/Temperature\{mValue=([0-9.]+), mType=2/], "NaN")) || null,
  skinTemperatureC: Number(firstMatch(thermal, [/Temperature\{mValue=([0-9.]+), mType=3/], "NaN")) || null,
};

const ledger = validateEvidenceLedger({
  schemaVersion: 1,
  baselineSha: args["baseline-sha"],
  environment,
  runs: [],
});
const output = path.resolve(args.output);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(ledger, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
console.log(JSON.stringify({ output: args.output, deviceAlias: environment.deviceAlias, kind: environment.kind, api: environment.api, refreshHz: environment.refreshHz }));
