import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

function pcmHash(left: Float32Array, right: Float32Array): string {
  return createHash("sha256")
    .update(Buffer.from(left.buffer, left.byteOffset, left.byteLength))
    .update(Buffer.from(right.buffer, right.byteOffset, right.byteLength))
    .digest("hex");
}

describe("Cloudlight Evening v2 review synthesis", () => {
  it("defines three sparse, slow, independently composed review profiles", () => {
    const { getCloudlightV2CandidateSpecs } = require("../cloudlight-evening-v2-synthesis.cjs") as {
      getCloudlightV2CandidateSpecs: () => Array<{
        id: string;
        durationSeconds: number;
        tempoBpm: number;
        minimumForegroundGapSeconds: number;
        reverbT60Seconds: number;
        tonalCenterMidi: number;
        eventSeed: number;
        referenceWaveformInput: null;
      }>;
    };

    const specs = getCloudlightV2CandidateSpecs();

    expect(specs).toHaveLength(3);
    expect(new Set(specs.map((spec) => spec.id)).size).toBe(3);
    expect(new Set(specs.map((spec) => spec.eventSeed)).size).toBe(3);
    expect(new Set(specs.map((spec) => spec.tonalCenterMidi)).size).toBe(3);

    for (const spec of specs) {
      expect(spec.durationSeconds).toBe(150);
      expect(spec.tempoBpm).toBeGreaterThanOrEqual(56);
      expect(spec.tempoBpm).toBeLessThanOrEqual(62);
      expect(spec.minimumForegroundGapSeconds).toBeGreaterThanOrEqual(1.8);
      expect(spec.reverbT60Seconds).toBeGreaterThanOrEqual(6.5);
      expect(spec.referenceWaveformInput).toBeNull();
    }
  });

  it("builds non-repeating foreground phrases with breathing space and a circular harmony", () => {
    const { buildCloudlightV2Composition, getCloudlightV2CandidateSpecs } =
      require("../cloudlight-evening-v2-synthesis.cjs") as {
        getCloudlightV2CandidateSpecs: () => Array<{
          id: string;
          durationSeconds: number;
          minimumForegroundGapSeconds: number;
        }>;
        buildCloudlightV2Composition: (spec: {
          id: string;
          durationSeconds: number;
          minimumForegroundGapSeconds: number;
        }) => {
          foregroundEvents: Array<{
            startSeconds: number;
            durationSeconds: number;
            midi: number;
            velocity: number;
          }>;
          harmonicFields: Array<{ pitchClasses: number[] }>;
        };
      };

    const signatures = new Set<string>();
    for (const spec of getCloudlightV2CandidateSpecs()) {
      const composition = buildCloudlightV2Composition(spec);
      const events = composition.foregroundEvents;

      expect(events.length).toBeGreaterThanOrEqual(28);
      expect(events.length).toBeLessThanOrEqual(52);
      expect(composition.harmonicFields).toHaveLength(6);
      expect(composition.harmonicFields.at(-1)?.pitchClasses).toEqual(
        composition.harmonicFields[0].pitchClasses
      );

      for (let index = 0; index < events.length; index += 1) {
        const event = events[index];
        expect(event.startSeconds).toBeGreaterThanOrEqual(0);
        expect(event.startSeconds).toBeLessThan(spec.durationSeconds);
        expect(event.durationSeconds).toBeGreaterThanOrEqual(1.1);
        expect(event.durationSeconds).toBeLessThanOrEqual(4.8);
        expect(event.midi).toBeGreaterThanOrEqual(53);
        expect(event.midi).toBeLessThanOrEqual(84);
        expect(event.velocity).toBeGreaterThanOrEqual(0.22);
        expect(event.velocity).toBeLessThanOrEqual(0.58);
        if (index > 0) {
          expect(event.startSeconds - events[index - 1].startSeconds).toBeGreaterThanOrEqual(
            spec.minimumForegroundGapSeconds
          );
        }
      }

      const offGridCount = events.filter(
        (event) => Math.abs(event.startSeconds * 4 - Math.round(event.startSeconds * 4)) > 0.02
      ).length;
      expect(offGridCount / events.length).toBeGreaterThan(0.8);
      signatures.add(events.map((event) => event.midi).join(","));
    }

    expect(signatures.size).toBe(3);
  });

  it("renders deterministic finite stereo PCM through a modal felt-piano and FDN room", () => {
    const { getCloudlightV2CandidateSpecs, renderCloudlightV2Candidate } =
      require("../cloudlight-evening-v2-synthesis.cjs") as {
        getCloudlightV2CandidateSpecs: () => Array<Record<string, unknown>>;
        renderCloudlightV2Candidate: (
          spec: Record<string, unknown>,
          options: { sampleRate: number; durationSeconds: number }
        ) => {
          left: Float32Array;
          right: Float32Array;
          metrics: {
            finiteSamples: boolean;
            peak: number;
            rms: number;
            stereoCorrelation: number;
            boundaryDelta: number;
            loopWindowDelta: number;
            foregroundEventCount: number;
            synthesisModel: string;
            reverbModel: string;
          };
        };
      };

    const sampleRate = 8_000;
    const durationSeconds = 12;
    const spec = getCloudlightV2CandidateSpecs()[0];
    const first = renderCloudlightV2Candidate(spec, { sampleRate, durationSeconds });
    const second = renderCloudlightV2Candidate(spec, { sampleRate, durationSeconds });

    expect(first.left).toBeInstanceOf(Float32Array);
    expect(first.right).toBeInstanceOf(Float32Array);
    expect(first.left).toHaveLength(sampleRate * durationSeconds);
    expect(first.right).toHaveLength(sampleRate * durationSeconds);
    expect(first.metrics.finiteSamples).toBe(true);
    expect(first.metrics.peak).toBeGreaterThan(0.08);
    expect(first.metrics.peak).toBeLessThanOrEqual(0.82);
    expect(first.metrics.rms).toBeGreaterThan(0.008);
    expect(first.metrics.rms).toBeLessThan(0.16);
    expect(Math.abs(first.metrics.stereoCorrelation)).toBeLessThan(0.97);
    expect(first.metrics.stereoCorrelation).toBeGreaterThan(0.15);
    expect(first.metrics.boundaryDelta).toBeLessThanOrEqual(0.01);
    expect(first.metrics.loopWindowDelta).toBeLessThanOrEqual(0.03);
    expect(first.metrics.foregroundEventCount).toBeGreaterThanOrEqual(2);
    expect(first.metrics.synthesisModel).toContain("modal");
    expect(first.metrics.reverbModel).toContain("feedback-delay-network");
    expect(pcmHash(first.left, first.right)).toBe(pcmHash(second.left, second.right));
  });

  it("writes three distinct MP3 candidates and a rights-bound manifest only to private output", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "cloudlight-v2-review-"));
    const outputDir = join(rootDir, "output/private/cloudlight-evening-v2-review");
    try {
      const { writeCloudlightV2ReviewPack } = require("../cloudlight-evening-v2-synthesis.cjs") as {
        writeCloudlightV2ReviewPack: (options: {
          rootDir: string;
          outputDir: string;
          sampleRate: number;
          durationSeconds: number;
          encoderKbps: number;
        }) => {
          manifest: {
            artisticStatus: string;
            runtimePromotionStatus: string;
            rights: {
              referenceResearch: {
                sourceUrl: string;
                sourceAudioImported: boolean;
                sourceAudioRetained: boolean;
                samplesCopied: boolean;
                melodyOrHarmonyTranscribed: boolean;
              };
            };
            candidates: Array<{ fileName: string; sha256: string; bytes: number }>;
          };
        };
      };

      const result = writeCloudlightV2ReviewPack({
        rootDir,
        outputDir,
        sampleRate: 8_000,
        durationSeconds: 3,
        encoderKbps: 32,
      });
      const files = readdirSync(outputDir).sort();
      const expectedMp3s = [
        "cloudlight-v2-a-felt-hall.mp3",
        "cloudlight-v2-b-cloud-hall.mp3",
        "cloudlight-v2-c-warm-haze.mp3",
      ];

      expect(files).toEqual([...expectedMp3s, "README.md", "review-manifest.json"].sort());
      expect(result.manifest.candidates.map((candidate) => candidate.fileName)).toEqual(
        expectedMp3s
      );
      expect(new Set(result.manifest.candidates.map((candidate) => candidate.sha256)).size).toBe(3);
      expect(result.manifest.candidates.every((candidate) => candidate.bytes > 1_000)).toBe(true);
      expect(result.manifest.artisticStatus).toBe("UNVERIFIED_OWNER_LISTENING_REQUIRED");
      expect(result.manifest.runtimePromotionStatus).toBe("NOT_PROMOTED");
      expect(result.manifest.rights.referenceResearch).toMatchObject({
        sourceUrl: "https://www.youtube.com/watch?v=cJvhJqgDbKI",
        sourceAudioImported: false,
        sourceAudioRetained: false,
        samplesCopied: false,
        melodyOrHarmonyTranscribed: false,
      });
      expect(JSON.parse(readFileSync(join(outputDir, "review-manifest.json"), "utf8"))).toEqual(
        result.manifest
      );
      expect(existsSync(join(rootDir, "public"))).toBe(false);
      expect(existsSync(join(rootDir, "docs"))).toBe(false);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects review output outside output/private before creating runtime directories", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "cloudlight-v2-boundary-"));
    try {
      const { writeCloudlightV2ReviewPack } = require("../cloudlight-evening-v2-synthesis.cjs") as {
        writeCloudlightV2ReviewPack: (options: { rootDir: string; outputDir: string }) => unknown;
      };

      expect(() =>
        writeCloudlightV2ReviewPack({
          rootDir,
          outputDir: join(rootDir, "public/sounds/cloudlight-review"),
        })
      ).toThrow("must stay under <root>/output/private");
      expect(existsSync(join(rootDir, "public"))).toBe(false);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
