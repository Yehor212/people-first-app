#!/usr/bin/env node
/**
 * Codex Android visual-runtime gate.
 *
 * UserPromptSubmit injects the project-specific exact-artifact workflow for
 * Android visual and motion tasks. Stop blocks success claims unless a fresh
 * evidence packet proves that the same installed APK completed semantic input,
 * uninterrupted motion video, separate performance diagnostics, and visual
 * review without renderer failures.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const {
  extractEvidencePacketPath,
  hasAndroidVisualSuccessClaim,
  isAndroidVisualScope,
  validateEvidencePacket,
} = require("../../scripts/codex-governance/android-visual-runtime-core.cjs");

const HOOK_NAME = "android-visual-runtime-gate";

function readInput() {
  return JSON.parse(fs.readFileSync(0, "utf8"));
}

function androidVisualContext() {
  return [
    "ANDROID VISUAL RUNTIME GATE:",
    "- Read docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md and the active Android visual recovery plan before editing.",
    "- Record the local source APK SHA-256 and installed APK SHA-256 before and after the same run. Reject the run if any value, package path, version, or PID changes unexpectedly.",
    "- Drive the app through semantic Android interaction (UIAutomator/accessibility-derived ADB input): real taps, slider drag, Android Back, drawer routes, theme/lifecycle transitions, and the reported failure sequence.",
    "- Motion proof requires one uninterrupted recording of the specific Android Emulator window or the physical-device screen. A screen region, screenshots, DOM/CDP nodes, UIAutomator nodes, or successful taps do not prove visible raster or smoothness.",
    "- Use a separate performance pass: do not run motion video, WebView/JavaScript diagnostics, and CDP-off FrameTimeline/Perfetto at the same time. Align all three with action timestamps and logcat.",
    "- Any tile-memory exhaustion, context loss, ANR/crash, APK mismatch, wrong-window capture, missing required control, frame gap over 100 ms, or unreviewed motion keeps Visual Runtime or Motion at FAIL/UNVERIFIED.",
    "- Fix one reproduced root cause at a time. Rerun the same RED scenario and reject changes that do not improve Android or that change accepted geometry, color, blur, opacity, assets, timing, or trajectory.",
    "- An Android visual PASS must include an ANDROID VISUAL RUNTIME EVIDENCE section, an Evidence packet path under output/, and separate Technical, Visual Runtime, and Motion statuses.",
    "- Evidence packet: reference the fresh hash-bound JSON path under output/ in the final evidence section; the Stop hook recomputes every referenced artifact SHA-256.",
    "- Tracked hook registration is defense in depth; it does not prove the current Codex client loaded a newly changed hook. Keep runtime loading UNVERIFIED until a fresh client probe confirms it.",
  ].join("\n");
}

function outputContext() {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: androidVisualContext(),
      },
    }),
  );
}

function block(reasons) {
  process.stderr.write(
    [
      "ANDROID VISUAL RUNTIME GATE BLOCKED",
      `Detected: ${reasons.join("; ")}`,
      "Continue the Android visual task and report FAIL/UNVERIFIED until the exact same artifact has fresh semantic, uninterrupted-window-video, diagnostics, performance, and visual evidence.",
      "Required success packet: source and installed APK SHA-256 before/after; hash-bound journey, motion video, logcat, and performance analysis files under output/; specific emulator-window or physical-device capture; zero tile-memory/context-loss/ANR/crash; reviewed Orb, drawer, day theme, and unintended visual change.",
      "Do not replace motion proof with screenshots, DOM/UIAutomator visibility, successful taps, builds, or tests.",
    ].join("\n") + "\n",
  );
  process.exit(2);
}

function handleStop(data) {
  if (data.stop_hook_active) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const message = String(data.last_assistant_message || "");
  if (!isAndroidVisualScope(message) || !hasAndroidVisualSuccessClaim(message)) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const requiredStatusLines = [
    ["Technical", /^Technical:\s*PASS\s*$/im],
    ["Visual Runtime", /^Visual Runtime:\s*PASS\s*$/im],
    ["Motion", /^Motion:\s*PASS\s*$/im],
  ];
  const reasons = [];
  if (!/ANDROID VISUAL RUNTIME EVIDENCE/i.test(message)) {
    reasons.push("ANDROID VISUAL RUNTIME EVIDENCE section is missing");
  }
  for (const [label, pattern] of requiredStatusLines) {
    if (!pattern.test(message)) reasons.push(`${label}: PASS status is missing`);
  }

  const packetPath = extractEvidencePacketPath(message);
  if (!packetPath) {
    reasons.push("evidence packet path is missing");
  } else {
    const rootDir = path.resolve(process.env.ZENFLOW_REPO_ROOT || process.cwd());
    const validation = validateEvidencePacket({ rootDir, packetPath });
    reasons.push(...validation.reasons);
  }

  if (reasons.length > 0) {
    block(reasons);
    return;
  }

  console.log(JSON.stringify({ continue: true }));
}

try {
  const data = readInput();
  const eventName = data.hook_event_name || data.event || "UserPromptSubmit";

  if (eventName === "UserPromptSubmit") {
    if (isAndroidVisualScope(data.prompt || "")) outputContext();
    else console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }

  if (eventName === "Stop") {
    handleStop(data);
    process.exit(0);
  }

  console.log(JSON.stringify({ continue: true }));
} catch (error) {
  process.stderr.write(`HOOK ERROR [${HOOK_NAME}]: ${error.message || error}\n`);
  process.exit(2);
}

module.exports = { androidVisualContext };
