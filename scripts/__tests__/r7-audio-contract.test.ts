import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const qc = require("../check-app-audio-assets.cjs") as {
  inspectR7MusicMetrics: (file: string, metrics: Record<string, number>) => string[];
  inspectR7MusicProvenance: (provenance: unknown) => string[];
};
const generator = require("../generate-non-hyperfocus-audio.cjs") as {
  getGeneratedRuntimeAssets: () => Array<{ id: string; fileName: string; family?: string }>;
};

const healthyMusic = {
  sampleRate: 48000,
  channels: 2,
  durationSeconds: 168,
  peak: 0.7,
  rms: 0.1,
  audibleRms: 0.1,
  audibleBandEnergyRatio: 0.95,
  dcOffsetAbs: 0.0001,
  clippedSampleCount: 0,
  pinnedFullScaleSampleCount: 0,
  integratedLufs: -18,
  truePeakDbtp: -3,
  loudnessRangeLu: 11,
};

describe("R7 restoration quality and future-generation boundary", () => {
  it("keeps the default procedural generator out of every music path", () => {
    const assets = generator.getGeneratedRuntimeAssets();
    expect(assets.map((asset) => asset.id)).toEqual([
      "soft-air-veil",
      "gentle-water-bed",
      "soft-rain-veil",
      "feedback-success",
      "feedback-complete",
      "feedback-streak",
      "feedback-milestone",
      "feedback-notification",
    ]);
    expect(assets.every((asset) => asset.family !== "music")).toBe(true);
    expect(assets.some((asset) => /cloudlight|r7-/.test(asset.fileName))).toBe(false);
  });

  it("accepts a mastered natural-duration R7 song, not a forced 150-second loop", () => {
    expect(qc.inspectR7MusicMetrics("r7-shoji-rain.mp3", healthyMusic)).toEqual([]);
    expect(qc.inspectR7MusicMetrics("unlisted.mp3", healthyMusic)).toContain("fileName");
  });

  it.each([
    ["sampleRate", 44100],
    ["channels", 1],
    ["durationSeconds", 150],
    ["peak", 0],
    ["peak", 1],
    ["rms", 0],
    ["audibleRms", 0],
    ["audibleBandEnergyRatio", 0.2],
    ["dcOffsetAbs", 0.1],
    ["clippedSampleCount", 1],
    ["pinnedFullScaleSampleCount", 1],
    ["integratedLufs", -29],
    ["integratedLufs", -10],
    ["truePeakDbtp", 0],
    ["loudnessRangeLu", 30],
    ["integratedLufs", Number.NaN],
  ])("rejects the R7 signal defect %s=%s", (field, value) => {
    expect(
      qc.inspectR7MusicMetrics("r7-shoji-rain.mp3", {
        ...healthyMusic,
        [field]: value,
      })
    ).toContain(field);
  });

  it("binds provenance to the selected originals and rejects changed bytes and source claims", () => {
    const provenance = JSON.parse(
      readFileSync("docs/audio/r7-original-music-provenance.json", "utf8")
    );
    expect(qc.inspectR7MusicProvenance(provenance)).toEqual([]);
    const mutations = [
      (p: typeof provenance) => {
        p.assets.pop();
      },
      (p: typeof provenance) => {
        p.assets[0].sha256 = "0".repeat(64);
      },
      (p: typeof provenance) => {
        p.assets[0].bytes += 1;
      },
      (p: typeof provenance) => {
        p.assets[0].publicPath = "public/sounds/other.mp3";
      },
      (p: typeof provenance) => {
        p.assets[0].sourceFlacSha256 = "0".repeat(64);
      },
      (p: typeof provenance) => {
        p.generation.referenceConditioning = true;
      },
      (p: typeof provenance) => {
        p.generation.sourceAudio = true;
      },
      (p: typeof provenance) => {
        p.generation.modelRevision = "unverified";
      },
      (p: typeof provenance) => {
        p.restoration = "regenerated";
      },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(provenance);
      mutate(changed);
      expect(qc.inspectR7MusicProvenance(changed)).not.toEqual([]);
    }
  });
});
