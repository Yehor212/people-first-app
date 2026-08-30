#!/usr/bin/env node
"use strict";

const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(process.env.ZENFLOW_REPO_ROOT || process.cwd());
const failures = [];

const paths = {
  config: ".codex/hooks.json",
  hook: ".codex/hooks/android-visual-runtime-gate.cjs",
  core: "scripts/codex-governance/android-visual-runtime-core.cjs",
  videoInspector: "scripts/android-motion/inspect-video.swift",
  test: "scripts/__tests__/android-visual-runtime-hook.test.ts",
  contract: "docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md",
  plan: "docs/superpowers/plans/2026-08-25-android-visual-runtime-recovery.md",
};

function absolute(relative) {
  return path.join(root, relative);
}

function read(relative) {
  try {
    const filePath = absolute(relative);
    if (fs.lstatSync(filePath).isSymbolicLink()) {
      failures.push(`${relative} must not be a symbolic link`);
      return "";
    }
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    failures.push(`${relative} is missing or unreadable: ${error.message || error}`);
    return "";
  }
}

function requireMarkers(relative, content, markers) {
  for (const marker of markers) {
    if (!content.includes(marker)) failures.push(`${relative} is missing marker: ${marker}`);
  }
}

function runHook(payload) {
  return spawnSync(process.execPath, [absolute(paths.hook)], {
    cwd: root,
    env: { ...process.env, ZENFLOW_REPO_ROOT: root },
    input: JSON.stringify(payload),
    encoding: "utf8",
    timeout: 5_000,
  });
}

try {
  const hook = read(paths.hook);
  const core = read(paths.core);
  const videoInspector = read(paths.videoInspector);
  const test = read(paths.test);
  const contract = read(paths.contract);
  const plan = read(paths.plan);
  const configText = read(paths.config);

  requireMarkers(paths.hook, hook, [
    "ANDROID VISUAL RUNTIME GATE",
    "UserPromptSubmit",
    "Stop",
    "Evidence packet:",
    "process.exit(2)",
    "one reproduced root cause at a time",
  ]);
  requireMarkers(paths.core, core, [
    "installedBeforeSha256",
    "installedAfterSha256",
    "android-emulator-window",
    "physical-device-screen",
    "tileMemoryWarnings",
    "deadlineMissedPercent",
    "maxFrameGapMs",
    "sha256File",
    "physicalHighRefresh",
    "userReview",
    "reviewedFrameByFrame",
  ]);
  requireMarkers(paths.videoInspector, videoInspector, [
    "AVAssetReader",
    "decodedSampleCount",
    "durationSeconds",
    "loadTracks",
  ]);
  requireMarkers(paths.test, test, [
    "screen-region",
    "installed APK changed during the run",
    "tileMemoryWarnings",
    "hash-bound fresh packet",
    "malformed hook input",
    "fully decodable",
    "90/120 Hz physical-device gate",
    "user video review must be ACCEPTED",
  ]);
  requireMarkers(paths.contract, contract, [
    "uninterrupted external-window video",
    "same installed APK hash",
    "tile memory limits exceeded, some content may not draw",
  ]);
  requireMarkers(paths.plan, plan, [
    "Global execution checklist",
    "specific-emulator-window",
    "58 tile-memory warnings",
    "Done only when",
  ]);

  let config = null;
  try {
    config = JSON.parse(configText);
  } catch (error) {
    failures.push(`${paths.config} is malformed: ${error.message || error}`);
  }
  if (config?.hooks) {
    const serialized = (event) => JSON.stringify(config.hooks[event] || []);
    for (const event of ["UserPromptSubmit", "Stop"]) {
      if (!serialized(event).includes("android-visual-runtime-gate.cjs")) {
        failures.push(`${paths.config} must register android-visual-runtime-gate.cjs for ${event}`);
      }
    }
    for (const event of ["SubagentStart", "SubagentStop"]) {
      if (serialized(event).includes("android-visual-runtime-gate.cjs")) {
        failures.push(`${paths.config} must not register Android visual gate for ${event}`);
      }
    }
  }

  for (const relative of [paths.hook, paths.core]) {
    try {
      execFileSync(process.execPath, ["--check", absolute(relative)], {
        cwd: root,
        encoding: "utf8",
        timeout: 5_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      failures.push(`${relative} failed node --check: ${error.message || error}`);
    }
  }

  const prompt = runHook({
    hook_event_name: "UserPromptSubmit",
    prompt: "Android Orb visual animation glitches in the sidebar",
  });
  if (prompt.status !== 0 || !prompt.stdout.includes("ANDROID VISUAL RUNTIME GATE")) {
    failures.push("Android visual prompt must receive the runtime evidence contract");
  }

  const missingEvidence = runHook({
    hook_event_name: "Stop",
    last_assistant_message: [
      "Android Orb visual motion fixed: PASS.",
      "ANDROID VISUAL RUNTIME EVIDENCE",
      "Evidence packet: output/missing.json",
      "Technical: PASS",
      "Visual Runtime: PASS",
      "Motion: PASS",
    ].join("\n"),
  });
  if (
    missingEvidence.status !== 2 ||
    !missingEvidence.stderr.includes("ANDROID VISUAL RUNTIME GATE BLOCKED")
  ) {
    failures.push("Android visual PASS without evidence must fail closed");
  }

  const honestFailure = runHook({
    hook_event_name: "Stop",
    last_assistant_message:
      "Android Orb Visual Runtime: FAIL. Motion: UNVERIFIED. Renderer failures remain.",
  });
  if (honestFailure.status !== 0) {
    failures.push("honest Android FAIL/UNVERIFIED output must remain reportable");
  }

  if (failures.length > 0) {
    console.error("[android-visual-runtime-gate] FAIL");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    "[android-visual-runtime-gate] PASS - prompt routing, fail-closed Stop behavior, exact-artifact validator, no-subagent registration, plan, contract, and negative controls verified; current client hook loading remains UNVERIFIED.",
  );
} catch (error) {
  console.error(`[android-visual-runtime-gate] ERROR: ${error.message || error}`);
  process.exit(2);
}
