import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const HOOK = ".codex/hooks/android-visual-runtime-gate.cjs";
const HOOK_PATH = resolve(HOOK);
let cachedMotionVideoFixture: Buffer | null = null;

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function writeArtifact(
  root: string,
  name: string,
  contents: string
): {
  path: string;
  sha256: string;
} {
  const relativePath = `output/${name}`;
  const absolutePath = join(root, relativePath);
  writeFileSync(absolutePath, contents, "utf8");
  return { path: relativePath, sha256: sha256(contents) };
}

function writeVideoArtifact(
  root: string,
  name: string
): {
  path: string;
  sha256: string;
} {
  const relativePath = `output/${name}`;
  const absolutePath = join(root, relativePath);
  if (!cachedMotionVideoFixture) {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "zenflow-motion-video-fixture-"));
    const generatedVideo = join(temporaryDirectory, "fixture.mp4");
    try {
      const result = spawnSync(
        "ffmpeg",
        [
          "-v",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=c=#181818:s=64x64:r=1:d=17",
          "-c:v",
          "mpeg4",
          "-pix_fmt",
          "yuv420p",
          "-y",
          generatedVideo,
        ],
        { encoding: "utf8", timeout: 120_000 }
      );
      if (result.status !== 0) {
        throw new Error(`Could not create video fixture: ${result.stderr}`);
      }
      cachedMotionVideoFixture = readFileSync(generatedVideo);
    } finally {
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  }
  writeFileSync(absolutePath, cachedMotionVideoFixture);
  return { path: relativePath, sha256: sha256(readFileSync(absolutePath)) };
}

function createEvidenceRoot() {
  const root = mkdtempSync(join(tmpdir(), "zenflow-android-visual-hook-"));
  mkdirSync(join(root, "output"), { recursive: true });

  const apk = writeArtifact(root, "app-benchmark.apk", "exact signed benchmark apk");
  const journey = writeArtifact(
    root,
    "journey.json",
    JSON.stringify({ interactionSource: "uiautomator-adb", actions: ["drag", "drawer"] })
  );
  const video = writeVideoArtifact(root, "orb-sidebar-window.mp4");
  const logcat = writeArtifact(root, "logcat.txt", "no blocking Android renderer failures");
  const performance = writeArtifact(
    root,
    "frametimeline-analysis.json",
    JSON.stringify({ deadlineMissedPercent: 0.4, maxFrameGapMs: 74 })
  );
  const physical60Hz = writeArtifact(
    root,
    "physical-android12-60hz.json",
    JSON.stringify({ warmups: 3, measuredRuns: 5, refreshHz: 60, status: "PASS" })
  );
  const physicalHighRefresh = writeArtifact(
    root,
    "physical-android14-120hz.json",
    JSON.stringify({ warmups: 3, measuredRuns: 5, refreshHz: 120, status: "PASS" })
  );
  const userReview = writeArtifact(
    root,
    "user-video-review.json",
    JSON.stringify({ status: "ACCEPTED", reviewedAt: new Date().toISOString() })
  );

  const packet = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: "PASS",
    platform: "Android",
    scenario: "day Orb drag, refine/back, and repeated global drawer route cycle",
    apk: {
      source: apk,
      installedBeforeSha256: apk.sha256,
      installedAfterSha256: apk.sha256,
    },
    journey: {
      ...journey,
      interactionSource: "uiautomator-adb",
      actionCount: 2,
    },
    video: {
      ...video,
      captureTarget: "android-emulator-window",
      windowTitle: "Android Emulator - codex_pixel_7_api36:5554",
      uninterrupted: true,
      durationSeconds: 16,
      reviewedAsMotion: true,
      reviewedAt1x: true,
      reviewedAt025x: true,
      reviewedFrameByFrame: true,
    },
    diagnostics: {
      logcat,
      performance,
      tileMemoryWarnings: 0,
      webglContextLoss: 0,
      anrCrashCount: 0,
      deadlineMissedPercent: 0.4,
      maxFrameGapMs: 74,
    },
    visual: {
      dayThemeReviewed: true,
      orbReviewed: true,
      drawerReviewed: true,
      noUnintendedVisualChange: true,
    },
    deviceGates: {
      emulatorApi26: "PASS",
      emulatorApi36: "PASS",
      physical60Hz: { ...physical60Hz, status: "PASS", warmups: 3, measuredRuns: 5 },
      physicalHighRefresh: {
        ...physicalHighRefresh,
        status: "PASS",
        warmups: 3,
        measuredRuns: 5,
      },
    },
    userReview: {
      ...userReview,
      status: "ACCEPTED",
    },
  };

  const packetPath = join(root, "output/android-visual-runtime-evidence.json");
  writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  return { packet, packetPath, root };
}

function runHook(input: unknown, root = process.cwd()) {
  return spawnSync(process.execPath, [HOOK_PATH], {
    cwd: root,
    env: { ...process.env, ZENFLOW_REPO_ROOT: root },
    input: JSON.stringify(input),
    encoding: "utf8",
  });
}

function passMessage(packetPath = "output/android-visual-runtime-evidence.json") {
  return [
    "Android Orb and sidebar visual motion is fixed and smooth: PASS.",
    "ANDROID VISUAL RUNTIME EVIDENCE",
    `Evidence packet: ${packetPath}`,
    "Technical: PASS",
    "Visual Runtime: PASS",
    "Motion: PASS",
  ].join("\n");
}

describe("Android visual-runtime Codex hook", () => {
  it("ships and registers the hook for Android prompt routing and final evidence checks", () => {
    expect(existsSync(HOOK)).toBe(true);
    const hooksConfig = JSON.parse(readFileSync(".codex/hooks.json", "utf8")) as {
      hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
    };

    expect(JSON.stringify(hooksConfig.hooks?.UserPromptSubmit ?? [])).toContain(
      "android-visual-runtime-gate.cjs"
    );
    expect(JSON.stringify(hooksConfig.hooks?.Stop ?? [])).toContain(
      "android-visual-runtime-gate.cjs"
    );
    expect(JSON.stringify(hooksConfig.hooks?.SubagentStart ?? [])).not.toContain(
      "android-visual-runtime-gate.cjs"
    );
  });

  it("injects the exact-artifact and motion-review contract only for Android visual work", () => {
    const result = runHook({
      hook_event_name: "UserPromptSubmit",
      prompt: "Проверь Android Orb и sidebar: анимация лагает и элементы исчезают",
    });

    expect(result.status).toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toContain("ANDROID VISUAL RUNTIME GATE");
    expect(output).toContain("installed APK SHA-256 before and after");
    expect(output).toContain("specific Android Emulator window");
    expect(output).toContain("semantic Android interaction");
    expect(output).toContain("separate performance pass");
    expect(output).toContain("one reproduced root cause at a time");

    const unrelated = runHook({
      hook_event_name: "UserPromptSubmit",
      prompt: "Объясни формат даты в TypeScript",
    });
    expect(unrelated.status).toBe(0);
    expect(unrelated.stdout).not.toContain("ANDROID VISUAL RUNTIME GATE");
  });

  it("blocks an Android visual PASS claim without a fresh evidence packet", () => {
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message: passMessage("output/missing.json"),
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("ANDROID VISUAL RUNTIME GATE BLOCKED");
    expect(result.stderr).toContain("evidence packet");
  });

  it("allows an explicit Android visual FAIL or UNVERIFIED report without pretending success", () => {
    const result = runHook({
      hook_event_name: "Stop",
      last_assistant_message:
        "Android Orb Visual Runtime: FAIL. Motion: UNVERIFIED. Tile memory warnings remain; no success claim.",
    });

    expect(result.status).toBe(0);
  });

  it("blocks evidence when the installed APK changed during the run", () => {
    const fixture = createEvidenceRoot();
    fixture.packet.apk.installedAfterSha256 = sha256("different APK");
    writeFileSync(fixture.packetPath, `${JSON.stringify(fixture.packet, null, 2)}\n`, "utf8");

    const result = runHook(
      { hook_event_name: "Stop", last_assistant_message: passMessage() },
      fixture.root
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("installed APK SHA-256 values do not match");
  });

  it("rejects a screen-region recording that may contain the wrong desktop window", () => {
    const fixture = createEvidenceRoot();
    fixture.packet.video.captureTarget = "screen-region";
    writeFileSync(fixture.packetPath, `${JSON.stringify(fixture.packet, null, 2)}\n`, "utf8");

    const result = runHook(
      { hook_event_name: "Stop", last_assistant_message: passMessage() },
      fixture.root
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("specific emulator window or physical-device screen");
  });

  it("rejects a hash-matched motion video that is not fully decodable", () => {
    const fixture = createEvidenceRoot();
    const absoluteVideo = join(fixture.root, fixture.packet.video.path);
    writeFileSync(absoluteVideo, "corrupt mp4 payload", "utf8");
    fixture.packet.video.sha256 = sha256(readFileSync(absoluteVideo));
    writeFileSync(fixture.packetPath, `${JSON.stringify(fixture.packet, null, 2)}\n`, "utf8");

    const result = runHook(
      { hook_event_name: "Stop", last_assistant_message: passMessage() },
      fixture.root
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("fully decodable");
  });

  it("blocks PASS without both physical-device gates and explicit user video acceptance", () => {
    const missingPhysical = createEvidenceRoot();
    Reflect.deleteProperty(missingPhysical.packet.deviceGates, "physicalHighRefresh");
    writeFileSync(
      missingPhysical.packetPath,
      `${JSON.stringify(missingPhysical.packet, null, 2)}\n`,
      "utf8"
    );
    const missingPhysicalResult = runHook(
      { hook_event_name: "Stop", last_assistant_message: passMessage() },
      missingPhysical.root
    );
    expect(missingPhysicalResult.status).toBe(2);
    expect(missingPhysicalResult.stderr).toContain("90/120 Hz physical-device gate");

    const missingReview = createEvidenceRoot();
    missingReview.packet.userReview.status = "UNVERIFIED";
    writeFileSync(
      missingReview.packetPath,
      `${JSON.stringify(missingReview.packet, null, 2)}\n`,
      "utf8"
    );
    const missingReviewResult = runHook(
      { hook_event_name: "Stop", last_assistant_message: passMessage() },
      missingReview.root
    );
    expect(missingReviewResult.status).toBe(2);
    expect(missingReviewResult.stderr).toContain("user video review must be ACCEPTED");
  });

  it("rejects a packet with renderer failures even when files and hashes exist", () => {
    const fixture = createEvidenceRoot();
    fixture.packet.diagnostics.tileMemoryWarnings = 1;
    writeFileSync(fixture.packetPath, `${JSON.stringify(fixture.packet, null, 2)}\n`, "utf8");

    const result = runHook(
      { hook_event_name: "Stop", last_assistant_message: passMessage() },
      fixture.root
    );

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("tileMemoryWarnings must be 0");
  });

  it("allows a hash-bound fresh packet after independently checking every artifact", () => {
    const fixture = createEvidenceRoot();
    const result = runHook(
      { hook_event_name: "Stop", last_assistant_message: passMessage() },
      fixture.root
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("fails closed on malformed hook input", () => {
    const result = spawnSync(process.execPath, [HOOK_PATH], {
      input: "NOT JSON",
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("HOOK ERROR [android-visual-runtime-gate]");
  });
});
