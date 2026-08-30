#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  assertRunArtifactIdentity,
  parseWebViewDevtoolsSocket,
  waitForChildExit,
} from "./evidence-lib.mjs";
import { assertJourneyScenario } from "./run-real-user-journey.mjs";

const execFileAsync = promisify(execFile);
const PACKAGE = "com.zenflow.app";
const ACTIVITY = "com.zenflow.app/.MainActivity";

function valueFor(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index < 0 ? fallback : argv[index + 1];
}

function safeIdentifier(value, label) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9._:-]+$/.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function resolveInsideRoot(root, candidate, label) {
  if (!candidate) throw new Error(`${label} is required`);
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} must stay inside the repository`);
  }
  return { absolute, relative: relative.split(path.sep).join("/") };
}

async function adb(serial, ...args) {
  const { stdout = "" } = await execFileAsync("adb", ["-s", serial, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout.trim();
}

async function installedIdentity(serial) {
  const packagePathOutput = await adb(serial, "shell", "pm", "path", PACKAGE);
  const installedPath = packagePathOutput
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("package:"))
    ?.slice("package:".length);
  if (!installedPath) throw new Error("Installed base.apk path is missing");
  const installedHashOutput = await adb(serial, "shell", "sha256sum", installedPath);
  const installedSha256 = installedHashOutput.split(/\s+/, 1)[0];
  const packageState = await adb(serial, "shell", "dumpsys", "package", PACKAGE);
  const versionName = packageState.match(/versionName=([^\s]+)/)?.[1] ?? "";
  const versionCode = Number(packageState.match(/versionCode=(\d+)/)?.[1]);
  const lastUpdateTime = packageState.match(/lastUpdateTime=([^\r\n]+)/)?.[1]?.trim() ?? "";
  return {
    installedPath,
    installedSha256,
    packageName: PACKAGE,
    versionName,
    versionCode,
    lastUpdateTime,
  };
}

const argv = process.argv.slice(2);
const root = process.cwd();
const serial = safeIdentifier(valueFor(argv, "--serial", "emulator-5554"), "ADB serial");
const runId = safeIdentifier(valueFor(argv, "--run-id"), "run id");
const scenario = assertJourneyScenario(valueFor(argv, "--scenario", "drawer-theme"));
const expectedSha256 = valueFor(argv, "--expected-sha256");
if (!/^[0-9a-f]{64}$/.test(expectedSha256 ?? "")) {
  throw new Error("--expected-sha256 must be a full lowercase SHA-256");
}
const sourceApk = resolveInsideRoot(root, valueFor(argv, "--source-apk"), "source APK");
const outputDirectory = resolveInsideRoot(root, valueFor(argv, "--output-dir"), "output directory");
if (!outputDirectory.relative.startsWith("output/")) {
  throw new Error("output directory must stay under output/");
}
try {
  await lstat(outputDirectory.absolute);
  throw new Error(`output directory already exists: ${outputDirectory.relative}`);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
await mkdir(outputDirectory.absolute, { recursive: false, mode: 0o700 });

const sourceApkBytes = await readFile(sourceApk.absolute);
const sourceSha256 = sha256(sourceApkBytes);
const before = await installedIdentity(serial);
assertRunArtifactIdentity({
  expectedSha256,
  sourceSha256,
  installedBeforeSha256: before.installedSha256,
  installedAfterSha256: before.installedSha256,
  packageName: before.packageName,
  versionName: before.versionName,
  versionCode: before.versionCode,
});

const remoteVideo = `/sdcard/zenflow-${runId}.mp4`;
const remoteLogcat = `/sdcard/zenflow-${runId}-logcat.txt`;
const localVideo = path.join(outputDirectory.absolute, "visual.mp4");
const localLogcat = path.join(outputDirectory.absolute, "logcat.txt");
const localJourney = path.join(outputDirectory.absolute, "journey.json");
const localRouteSetup = path.join(outputDirectory.absolute, "route-setup.json");
const localReceipt = path.join(outputDirectory.absolute, "visual-pass-receipt.json");
let screenrecord = null;
let screenrecordExitPromise = null;
let screenrecordExit = null;
let runnerResult = null;
let runFailure = null;
const showTouches = await adb(serial, "shell", "settings", "get", "system", "show_touches");
const pointerLocation = await adb(
  serial,
  "shell",
  "settings",
  "get",
  "system",
  "pointer_location",
);
const startedAt = new Date().toISOString();
let videoStartedAtMonotonicMs = null;
let videoStartedAtWallClockMs = null;

try {
  await adb(serial, "shell", "rm", "-f", remoteVideo, remoteLogcat);
  await adb(serial, "logcat", "-c");
  await adb(serial, "shell", "am", "start", "-W", "-n", ACTIVITY);
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  const appPid = Number(await adb(serial, "shell", "pidof", "-s", PACKAGE));
  const devtoolsSocket = parseWebViewDevtoolsSocket(
    await adb(serial, "shell", "cat", "/proc/net/unix"),
    appPid,
  );
  await adb(serial, "forward", "tcp:9222", `localabstract:${devtoolsSocket}`);
  try {
    await execFileAsync(
      process.execPath,
      [
        "scripts/android-motion/set-local-benchmark-route.mjs",
        "--output",
        localRouteSetup,
      ],
      { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    );
  } finally {
    await adb(serial, "forward", "--remove", "tcp:9222").catch(() => undefined);
  }
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  videoStartedAtMonotonicMs = globalThis.performance.now();
  videoStartedAtWallClockMs = Date.now();
  screenrecord = spawn(
    "adb",
    [
      "-s",
      serial,
      "shell",
      "screenrecord",
      "--time-limit",
      "120",
      "--bit-rate",
      "12000000",
      remoteVideo,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  screenrecordExitPromise = waitForChildExit(screenrecord, 135_000).then(
    (result) => ({ result, error: null }),
    (error) => ({ result: null, error }),
  );
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  runnerResult = await execFileAsync(
    process.execPath,
    [
      "scripts/android-motion/run-real-user-journey.mjs",
      "--serial",
      serial,
      "--output",
      localJourney,
      "--scenario",
      scenario,
      "--video-only",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  await new Promise((resolve) => setTimeout(resolve, 1_500));
} catch (error) {
  runFailure = error;
} finally {
  if (screenrecord) {
    if (screenrecord.exitCode === null && screenrecord.signalCode === null) {
      screenrecord.kill("SIGINT");
    }
    try {
      const observedExit = await screenrecordExitPromise;
      if (observedExit.error) throw observedExit.error;
      screenrecordExit = observedExit.result;
    } catch (error) {
      runFailure ??= error;
    }
  }
}

const videoEndedAtMonotonicMs = globalThis.performance.now();
try {
  await adb(serial, "shell", "logcat", "-d", "-f", remoteLogcat);
  await adb(serial, "pull", remoteLogcat, localLogcat);
} catch (error) {
  runFailure ??= error;
}
if (screenrecord) {
  try {
    await adb(serial, "pull", remoteVideo, localVideo);
  } catch (error) {
    runFailure ??= error;
  }
}
await adb(serial, "shell", "rm", "-f", remoteVideo, remoteLogcat).catch(
  () => undefined,
);
const after = await installedIdentity(serial);
assertRunArtifactIdentity({
  expectedSha256,
  sourceSha256,
  installedBeforeSha256: before.installedSha256,
  installedAfterSha256: after.installedSha256,
  packageName: after.packageName,
  versionName: after.versionName,
  versionCode: after.versionCode,
});

const artifact = async (absolute) => {
  try {
    const bytes = await readFile(absolute);
    return {
      path: path.relative(root, absolute).split(path.sep).join("/"),
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    };
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
};
const receipt = {
  schemaVersion: 1,
  runId,
  scenario,
  status: runFailure ? "FAIL" : "UNVERIFIED",
  startedAt,
  endedAt: new Date().toISOString(),
  sourceApk: {
    path: sourceApk.relative,
    bytes: sourceApkBytes.byteLength,
    sha256: sourceSha256,
  },
  installedBefore: before,
  installedAfter: after,
  videoTiming: {
    hostMonotonicStartedAtMs: videoStartedAtMonotonicMs,
    hostMonotonicEndedAtMs: videoEndedAtMonotonicMs,
    hostWallClockStartedAtMs: videoStartedAtWallClockMs,
  },
  inputOverlays: { showTouches, pointerLocation },
  screenrecordExit,
  runner: {
    exitCode: runFailure?.code ?? 0,
    stdout: runnerResult?.stdout?.trim() ?? "",
    stderr: runnerResult?.stderr?.trim() ?? String(runFailure?.message ?? ""),
  },
  artifacts: {
    video: await artifact(localVideo),
    logcat: await artifact(localLogcat),
    journey: await artifact(localJourney),
    routeSetup: await artifact(localRouteSetup),
  },
};
await writeFile(localReceipt, `${JSON.stringify(receipt, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(JSON.stringify({ outputDirectory: outputDirectory.relative, status: receipt.status }));
if (runFailure) throw runFailure;
