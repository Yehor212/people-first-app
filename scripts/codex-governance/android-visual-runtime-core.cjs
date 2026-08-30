"use strict";

const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const MAX_PACKET_AGE_MS = 4 * 60 * 60 * 1000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ALLOWED_CAPTURE_TARGETS = new Set(["android-emulator-window", "physical-device-screen"]);

function isAndroidVisualScope(value) {
  const text = String(value || "");
  const android = /(?:^|\W)(?:android|apk|апк|эмулятор|emulator|webview|capacitor)(?:\W|$)/i;
  const visual =
    /(?:^|\W)(?:visual|визуал|анимац|animation|motion|лаг|jank|glitch|глитч|плавн|orb|орб|sidebar|сайд\s*бар|drawer|loader|рендер|отрисов|исчез|пропал|кнопк)(?:\W|$)/i;
  return android.test(text) && visual.test(text);
}

function hasAndroidVisualSuccessClaim(value) {
  const text = String(value || "");
  return /(?:^|\W)(?:PASS|fixed|complete|completed|done|ready|исправлен|исправил|исправлено|готово|завершено|плавно|не\s+лагает|без\s+(?:лаг|глитч|дефект|регресс))(?:\W|$)/i.test(
    text
  );
}

function extractEvidencePacketPath(value) {
  const match = String(value || "").match(/^Evidence packet:\s*(.+?)\s*$/im);
  if (!match) return null;
  return match[1].trim().replace(/^`|`$/g, "");
}

function validateEvidencePacket({ rootDir, packetPath, now = new Date() }) {
  const reasons = [];
  const root = path.resolve(rootDir);
  const resolvedPacket = resolveEvidenceFile(root, packetPath, reasons, "evidence packet");
  if (!resolvedPacket) return { allowed: false, reasons };

  let packet;
  try {
    packet = JSON.parse(fs.readFileSync(resolvedPacket, "utf8"));
  } catch (error) {
    reasons.push(`evidence packet is malformed: ${error.message || error}`);
    return { allowed: false, reasons };
  }

  if (!isPlainObject(packet)) {
    reasons.push("evidence packet must contain a JSON object");
    return { allowed: false, reasons };
  }

  if (packet.schemaVersion !== 1) reasons.push("schemaVersion must be 1");
  if (packet.status !== "PASS") reasons.push("packet status must be PASS");
  if (packet.platform !== "Android") reasons.push("packet platform must be Android");
  requireText(packet.scenario, 12, "scenario", reasons);
  validateFreshTimestamp(packet.generatedAt, now, reasons);

  const apk = isPlainObject(packet.apk) ? packet.apk : null;
  if (!apk) {
    reasons.push("apk evidence is missing");
  } else {
    const sourceDigest = validateArtifact(root, apk.source, "source APK", reasons);
    const before = normalizeSha(apk.installedBeforeSha256);
    const after = normalizeSha(apk.installedAfterSha256);
    if (!before) reasons.push("installedBeforeSha256 must be a full SHA-256");
    if (!after) reasons.push("installedAfterSha256 must be a full SHA-256");
    if (sourceDigest && (before !== sourceDigest || after !== sourceDigest)) {
      reasons.push("source and installed APK SHA-256 values do not match");
    }
    if (before && after && before !== after) {
      reasons.push("installed APK SHA-256 values do not match before and after the run");
    }
  }

  const journey = isPlainObject(packet.journey) ? packet.journey : null;
  if (!journey) {
    reasons.push("semantic journey evidence is missing");
  } else {
    validateArtifact(root, journey, "semantic journey", reasons);
    if (journey.interactionSource !== "uiautomator-adb") {
      reasons.push("journey interactionSource must be uiautomator-adb");
    }
    if (!Number.isInteger(journey.actionCount) || journey.actionCount < 1) {
      reasons.push("journey actionCount must be at least 1");
    }
  }

  const video = isPlainObject(packet.video) ? packet.video : null;
  if (!video) {
    reasons.push("uninterrupted motion video evidence is missing");
  } else {
    const videoPath = validateArtifactPath(root, video, "motion video", reasons);
    if (!ALLOWED_CAPTURE_TARGETS.has(video.captureTarget)) {
      reasons.push("video must target a specific emulator window or physical-device screen");
    }
    if (
      video.captureTarget === "android-emulator-window" &&
      (typeof video.windowTitle !== "string" || !/Android Emulator/i.test(video.windowTitle))
    ) {
      reasons.push("emulator video windowTitle must identify Android Emulator");
    }
    if (video.uninterrupted !== true) reasons.push("video uninterrupted must be true");
    if (video.reviewedAsMotion !== true) reasons.push("video reviewedAsMotion must be true");
    if (video.reviewedAt1x !== true) reasons.push("video reviewedAt1x must be true");
    if (video.reviewedAt025x !== true) reasons.push("video reviewedAt025x must be true");
    if (video.reviewedFrameByFrame !== true) {
      reasons.push("video reviewedFrameByFrame must be true");
    }
    if (!Number.isFinite(video.durationSeconds) || video.durationSeconds < 15) {
      reasons.push("video durationSeconds must be at least 15");
    }
    if (videoPath) validateVideoDecodability(root, videoPath, video.durationSeconds, reasons);
  }

  const diagnostics = isPlainObject(packet.diagnostics) ? packet.diagnostics : null;
  if (!diagnostics) {
    reasons.push("separate Android diagnostics are missing");
  } else {
    validateArtifact(root, diagnostics.logcat, "logcat", reasons);
    validateArtifact(root, diagnostics.performance, "performance analysis", reasons);
    requireZero(diagnostics.tileMemoryWarnings, "tileMemoryWarnings", reasons);
    requireZero(diagnostics.webglContextLoss, "webglContextLoss", reasons);
    requireZero(diagnostics.anrCrashCount, "anrCrashCount", reasons);
    if (
      !Number.isFinite(diagnostics.deadlineMissedPercent) ||
      diagnostics.deadlineMissedPercent < 0 ||
      diagnostics.deadlineMissedPercent > 1
    ) {
      reasons.push("deadlineMissedPercent must be between 0 and 1");
    }
    if (
      !Number.isFinite(diagnostics.maxFrameGapMs) ||
      diagnostics.maxFrameGapMs < 0 ||
      diagnostics.maxFrameGapMs > 100
    ) {
      reasons.push("maxFrameGapMs must be between 0 and 100");
    }
  }

  const visual = isPlainObject(packet.visual) ? packet.visual : null;
  if (!visual) {
    reasons.push("visual review evidence is missing");
  } else {
    for (const field of [
      "dayThemeReviewed",
      "orbReviewed",
      "drawerReviewed",
      "noUnintendedVisualChange",
    ]) {
      if (visual[field] !== true) reasons.push(`visual.${field} must be true`);
    }
  }

  const deviceGates = isPlainObject(packet.deviceGates) ? packet.deviceGates : null;
  if (!deviceGates) {
    reasons.push("device gates are missing");
  } else {
    requirePassStatus(deviceGates.emulatorApi26, "API 26 emulator gate", reasons);
    requirePassStatus(deviceGates.emulatorApi36, "API 36 emulator gate", reasons);
    validatePhysicalGate(root, deviceGates.physical60Hz, "60 Hz physical-device gate", reasons);
    validatePhysicalGate(
      root,
      deviceGates.physicalHighRefresh,
      "90/120 Hz physical-device gate",
      reasons
    );
  }

  const userReview = isPlainObject(packet.userReview) ? packet.userReview : null;
  if (!userReview) {
    reasons.push("user video review is missing");
  } else {
    validateArtifact(root, userReview, "user video review", reasons);
    if (userReview.status !== "ACCEPTED") {
      reasons.push("user video review must be ACCEPTED");
    }
  }

  return {
    allowed: reasons.length === 0,
    packet,
    packetPath: resolvedPacket,
    reasons,
  };
}

function validateArtifact(root, value, label, reasons) {
  const filePath = validateArtifactPath(root, value, label, reasons);
  if (!filePath) return null;
  return sha256File(filePath);
}

function validateArtifactPath(root, value, label, reasons) {
  if (!isPlainObject(value)) {
    reasons.push(`${label} artifact is missing`);
    return null;
  }
  const expected = normalizeSha(value.sha256);
  if (!expected) {
    reasons.push(`${label} sha256 must be a full SHA-256`);
    return null;
  }
  const filePath = resolveEvidenceFile(root, value.path, reasons, label);
  if (!filePath) return null;
  const actual = sha256File(filePath);
  if (actual !== expected) reasons.push(`${label} SHA-256 does not match the referenced file`);
  return actual === expected ? filePath : null;
}

function validatePhysicalGate(root, value, label, reasons) {
  if (!isPlainObject(value)) {
    reasons.push(`${label} is missing`);
    return;
  }
  validateArtifact(root, value, label, reasons);
  requirePassStatus(value.status, label, reasons);
  if (!Number.isInteger(value.warmups) || value.warmups < 3) {
    reasons.push(`${label} warmups must be at least 3`);
  }
  if (!Number.isInteger(value.measuredRuns) || value.measuredRuns < 5) {
    reasons.push(`${label} measuredRuns must be at least 5`);
  }
}

function requirePassStatus(value, label, reasons) {
  if (value !== "PASS") reasons.push(`${label} must be PASS`);
}

function validateVideoDecodability(_root, videoPath, declaredDurationSeconds, reasons) {
  const ffprobe = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "format=duration:stream=codec_name,width,height,r_frame_rate,avg_frame_rate",
      "-of",
      "json",
      videoPath,
    ],
    { encoding: "utf8", timeout: 30_000 }
  );

  if (ffprobe.status !== 0) {
    reasons.push("motion video must be fully decodable");
    return;
  }
  let probe;
  try {
    probe = JSON.parse(ffprobe.stdout || "{}");
  } catch {
    reasons.push("motion video ffprobe output is malformed; video must be fully decodable");
    return;
  }
  const stream = Array.isArray(probe.streams) ? probe.streams[0] : null;
  const durationSeconds = Number(probe.format?.duration);
  if (
    !stream ||
    !Number.isInteger(stream.width) ||
    stream.width < 1 ||
    !Number.isInteger(stream.height) ||
    stream.height < 1 ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 15
  ) {
    reasons.push(
      "motion video has no valid >=15 second video stream; video must be fully decodable"
    );
    return;
  }
  if (Math.abs(durationSeconds - declaredDurationSeconds) > 1) {
    reasons.push("motion video declared duration does not match decoded duration");
  }
  const decode = spawnSync("ffmpeg", ["-v", "error", "-i", videoPath, "-f", "null", "-"], {
    encoding: "utf8",
    timeout: 300_000,
  });
  if (decode.status !== 0) reasons.push("motion video must be fully decodable");
}

function resolveEvidenceFile(root, candidate, reasons, label) {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    reasons.push(`${label} path is missing`);
    return null;
  }
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    reasons.push(`${label} path must stay inside the repository evidence root`);
    return null;
  }
  if (!relative.split(path.sep).includes("output")) {
    reasons.push(`${label} path must be under output/`);
    return null;
  }
  if (!existsWithoutSymlinks(root, absolute)) {
    reasons.push(`${label} file is missing, not regular, or crosses a symbolic link`);
    return null;
  }
  return absolute;
}

function existsWithoutSymlinks(root, absolute) {
  try {
    const relative = path.relative(root, absolute);
    let current = root;
    for (const segment of relative.split(path.sep)) {
      current = path.join(current, segment);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return false;
    }
    return fs.lstatSync(absolute).isFile();
  } catch {
    return false;
  }
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function normalizeSha(value) {
  const candidate = String(value || "").toLowerCase();
  return SHA256_PATTERN.test(candidate) ? candidate : null;
}

function validateFreshTimestamp(value, now, reasons) {
  if (typeof value !== "string") {
    reasons.push("generatedAt timestamp is missing");
    return;
  }
  const parsed = new Date(value);
  const age = now.getTime() - parsed.getTime();
  if (!Number.isFinite(parsed.getTime()) || age < -60_000 || age > MAX_PACKET_AGE_MS) {
    reasons.push("generatedAt timestamp is stale, invalid, or in the future");
  }
}

function requireText(value, minimum, label, reasons) {
  if (typeof value !== "string" || value.trim().length < minimum) {
    reasons.push(`${label} must be at least ${minimum} characters`);
  }
}

function requireZero(value, label, reasons) {
  if (value !== 0) reasons.push(`${label} must be 0`);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  extractEvidencePacketPath,
  hasAndroidVisualSuccessClaim,
  isAndroidVisualScope,
  validateEvidencePacket,
};
