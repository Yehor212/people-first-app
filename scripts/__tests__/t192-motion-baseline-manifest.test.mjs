import { describe, expect, it } from "vitest";
import { validateT192BaselineManifest } from "../validate-t192-motion-baseline-manifest.mjs";

const SHA256 = "a".repeat(64);

function completeRow({ flow, motionPreference, locale = "en", direction = "ltr" }) {
  return {
    id: `${flow}-${locale}-${motionPreference}`,
    flow,
    subject_kind: "non_orb",
    apk_sha256: SHA256,
    locale,
    direction,
    motion_preference: motionPreference,
    route: "/journal",
    trigger: "existing journal action",
    start_condition: "visible control activated",
    end_condition: "semantic completion visible",
    device: { api: 36, abi: "arm64-v8a", viewport: "1080x2400", density: 420, font_scale: 1 },
    capture: {
      path: `output/android21/motion/t192/raw/${flow}-${motionPreference}.mp4`,
      bytes: 1,
      sha256: SHA256,
      duration_seconds: 1,
      fps: 30,
    },
    lifecycle: {
      back_cancel: "PASS",
      rapid_retrigger: "PASS",
      background_resume: "PASS",
      cleanup: "PASS",
      resource_owner: "PASS",
    },
    privacy: { raw_private_content: false },
  };
}

function manifest(rows) {
  return {
    task: "T192",
    source_freeze: { commit: "ee98d27142e5fdf44bf718a5e014e58e7048678b" },
    artifacts: {
      normal: { apk_sha256: SHA256, qa_sentinel_present: false },
      qa: { apk_sha256: SHA256 },
    },
    locale_applicability: ["en", "uk", "es", "de", "fr", "ja", "ar", "he"],
    rows,
  };
}

function mandatoryRows() {
  return ["gratitude-bloom", "let-go"].flatMap((flow) =>
    [
      ["en", "ltr"],
      ["ar", "rtl"],
      ["he", "rtl"],
    ].flatMap(([locale, direction]) => [
      completeRow({ flow, locale, direction, motionPreference: "normal" }),
      completeRow({ flow, locale, direction, motionPreference: "reduced" }),
    ]),
  );
}

describe("T192 baseline manifest", () => {
  it("accepts a complete normal/reduced pair for each required named flow", () => {
    const rows = mandatoryRows();

    expect(validateT192BaselineManifest(manifest(rows)).errors).toEqual([]);
  });

  it.each([
    ["missing paired video", (rows) => rows.filter((row) => row.id !== "let-go-en-reduced")],
    ["orb subject", (rows) => rows.map((row) => row.id === "gratitude-bloom-en-normal" ? { ...row, subject_kind: "orb" } : row)],
    ["raw private canary", (rows) => rows.map((row) => row.id === "let-go-en-normal" ? { ...row, privacy: { raw_private_content: true } } : row)],
    ["missing cleanup", (rows) => rows.map((row) => row.id === "let-go-en-normal" ? { ...row, lifecycle: { ...row.lifecycle, cleanup: "MISSING" } } : row)],
    ["wrong RTL direction", (rows) => rows.map((row) => row.id === "gratitude-bloom-ar-normal" ? { ...row, direction: "ltr" } : row)],
  ])("rejects %s", (_label, mutate) => {
    const rows = mandatoryRows();

    expect(validateT192BaselineManifest(manifest(mutate(rows))).errors).not.toEqual([]);
  });
});
