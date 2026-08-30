#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { inspectCloudlightLoopMetrics, parseWavMetrics } = require("./check-app-audio-assets.cjs");

const EXPECTED_CANDIDATE_FILES = Object.freeze([
  "cloudlight-v2-a-felt-hall.mp3",
  "cloudlight-v2-b-cloud-hall.mp3",
  "cloudlight-v2-c-warm-haze.mp3",
]);

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertPrivateReviewDirectory(rootDir, reviewDir) {
  const rootInput = path.resolve(rootDir);
  const reviewInput = path.resolve(reviewDir);
  const relative = path.relative(rootInput, reviewInput).split(path.sep).join("/");
  if (!relative.startsWith("output/private/")) {
    throw new Error("Cloudlight v2 audit target must stay under <root>/output/private");
  }
  const realRoot = fs.realpathSync(rootInput);
  const realReview = fs.realpathSync(reviewInput);
  const realRelative = path.relative(realRoot, realReview).split(path.sep).join("/");
  if (!realRelative.startsWith("output/private/")) {
    throw new Error("Cloudlight v2 audit target resolves outside <root>/output/private");
  }
  return realReview;
}

function writeAtomic(filePath, contents) {
  const temporaryPath =
    filePath + ".tmp-" + process.pid + "-" + crypto.randomBytes(6).toString("hex");
  try {
    fs.writeFileSync(temporaryPath, contents, { mode: 0o600 });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function auditCloudlightV2ReviewPack(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const reviewDir = assertPrivateReviewDirectory(
    rootDir,
    options.reviewDir || path.join(rootDir, "output", "private", "cloudlight-evening-v2-review")
  );
  const manifestPath = path.join(reviewDir, "review-manifest.json");
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const manifestFiles = manifest.candidates.map((candidate) => candidate.fileName);
  if (JSON.stringify(manifestFiles) !== JSON.stringify(EXPECTED_CANDIDATE_FILES)) {
    throw new Error("Cloudlight v2 manifest candidate inventory is not exact");
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloudlight-v2-decoded-audit-"));
  const candidates = [];
  try {
    for (const manifestCandidate of manifest.candidates) {
      const sourcePath = path.join(reviewDir, manifestCandidate.fileName);
      const sourceBytes = fs.readFileSync(sourcePath);
      const actualSha256 = sha256(sourceBytes);
      const provenanceViolations = [];
      if (sourceBytes.length !== manifestCandidate.bytes) provenanceViolations.push("bytes");
      if (actualSha256 !== manifestCandidate.sha256) provenanceViolations.push("sha256");

      const wavPath = path.join(tempDir, manifestCandidate.fileName.replace(/\.mp3$/i, ".wav"));
      const decoded = spawnSync("afconvert", [sourcePath, "-f", "WAVE", "-d", "LEI16", wavPath], {
        encoding: "utf8",
      });
      if (decoded.error && decoded.error.code === "ENOENT") {
        throw new Error("afconvert is unavailable; decoded MP3 audit is UNVERIFIED");
      }
      if (decoded.status !== 0) {
        throw new Error(
          "afconvert failed for " +
            manifestCandidate.fileName +
            ": " +
            String(decoded.stderr || decoded.stdout || "unknown decoder error").trim()
        );
      }

      const measured = {
        decoder: "afconvert",
        ...parseWavMetrics(wavPath, { measureStrictLoopMetrics: true }),
      };
      const metricViolations = inspectCloudlightLoopMetrics(measured);
      candidates.push({
        fileName: manifestCandidate.fileName,
        bytes: sourceBytes.length,
        sha256: actualSha256,
        provenanceViolations,
        metricViolations,
        status:
          provenanceViolations.length === 0 && metricViolations.length === 0 ? "PASS" : "FAIL",
        measured,
      });
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const status = candidates.every((candidate) => candidate.status === "PASS") ? "PASS" : "FAIL";
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status,
    scope:
      "Private review MP3 provenance, decoded PCM format, signal safety, stereo/mono compatibility, dynamics, silence, and strict loop-seam metrics.",
    decoder: "afconvert",
    thresholdContract: "CLOUDLIGHT_LOOP_METRIC_LIMITS from scripts/check-app-audio-assets.cjs",
    manifest: {
      fileName: "review-manifest.json",
      sha256: sha256(manifestBytes),
      artisticStatus: manifest.artisticStatus,
      runtimePromotionStatus: manifest.runtimePromotionStatus,
    },
    evidenceBoundary: {
      artisticPleasantness: "UNVERIFIED_OWNER_LISTENING_REQUIRED",
      formalLoudness: "UNVERIFIED_NO_BS1770_METER",
      formalTruePeak: "UNVERIFIED_NON_CONFORMANT_4X_ESTIMATE_ONLY",
      runtimeIntegration: "NOT_APPLICABLE_NOT_PROMOTED",
    },
    candidates,
  };
  writeAtomic(path.join(reviewDir, "decoded-audit.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

if (require.main === module) {
  try {
    const report = auditCloudlightV2ReviewPack();
    for (const candidate of report.candidates) {
      console.log(
        "[cloudlight-v2-audit] " +
          candidate.status +
          " " +
          candidate.fileName +
          " metricViolations=" +
          candidate.metricViolations.length +
          " provenanceViolations=" +
          candidate.provenanceViolations.length
      );
    }
    console.log("[cloudlight-v2-audit] " + report.status);
    if (report.status !== "PASS") process.exitCode = 1;
  } catch (error) {
    console.error(
      "[cloudlight-v2-audit] UNVERIFIED - " +
        (error instanceof Error ? error.message : String(error))
    );
    process.exitCode = 1;
  }
}

module.exports = {
  EXPECTED_CANDIDATE_FILES,
  auditCloudlightV2ReviewPack,
};
