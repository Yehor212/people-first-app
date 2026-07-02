import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { describe, expect, it } from "vitest";

const contract = require("../check-hyperfocus-nature-soundscape-contract.cjs") as {
  validateHyperfocusNatureSoundscapeSpec: (options?: { rootDir?: string; spec?: unknown; specPath?: string }) => {
    ok: boolean;
    familyCount: number;
    levelCount: number;
    legacyAudioScan?: { ok: boolean; scannedTargets: number; issues: Array<{ code: string; relativePath?: string }> };
    issues: Array<{ code: string; familyId?: string; levelId?: string; relativePath?: string }>;
  };
  scanForbiddenLegacyRootAudioAssets: (options?: { rootDir?: string }) => {
    ok: boolean;
    scannedTargets: number;
    issues: Array<{ code: string; relativePath?: string }>;
  };
  buildHyperfocusNatureGenerationQueue: (options?: { phase?: "pilot" | "full" }) => {
    ok: boolean;
    phase: string;
    jobCount: number;
    requiresAcceptedPilot: boolean;
    jobs: Array<{ id: string; prompt: string; fileName: string }>;
  };
};

describe("hyperfocus nature soundscape generation contract", () => {
  it("accepts only the six V1 focus families with three non-musical levels each", () => {
    const result = contract.validateHyperfocusNatureSoundscapeSpec();
    expect(result.ok).toBe(true);
    expect(result.familyCount).toBe(6);
    expect(result.levelCount).toBe(18);
    expect(result.issues).toEqual([]);
  });

  it("builds a one-job pilot queue before the full pack", () => {
    const pilot = contract.buildHyperfocusNatureGenerationQueue({ phase: "pilot" });
    const full = contract.buildHyperfocusNatureGenerationQueue({ phase: "full" });
    expect(pilot.ok).toBe(true);
    expect(pilot.phase).toBe("pilot");
    expect(pilot.jobCount).toBe(1);
    expect(pilot.requiresAcceptedPilot).toBe(false);
    expect(pilot.jobs[0]).toMatchObject({ id: "fireplace:soft", fileName: "hyperfocus-fireplace-soft.mp3" });
    expect(full.ok).toBe(true);
    expect(full.phase).toBe("full-pack-after-accepted-pilot");
    expect(full.jobCount).toBe(18);
    expect(full.requiresAcceptedPilot).toBe(true);
  });

  it("rejects shipped root-level underwater and thunderstorm audio files", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-nature-legacy-audio-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "public/sounds"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-nature-soundscape-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-nature-soundscape-spec.json"),
    );
    writeFileSync(join(rootDir, "public/sounds/mixkit-underwater-transmitter-hum-2135.mp3"), "legacy-underwater-audio");
    writeFileSync(join(rootDir, "public/sounds/mixkit-calm-thunderstorm-in-the-jungle-2415.mp3"), "legacy-thunderstorm-audio");

    const result = contract.validateHyperfocusNatureSoundscapeSpec({ rootDir });

    expect(result.ok).toBe(false);
    expect(result.legacyAudioScan?.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "forbidden-legacy-root-audio", relativePath: "public/sounds/mixkit-underwater-transmitter-hum-2135.mp3" }),
        expect.objectContaining({ code: "forbidden-legacy-root-audio", relativePath: "public/sounds/mixkit-calm-thunderstorm-in-the-jungle-2415.mp3" }),
      ]),
    );
  });

  it("rejects prompts that steer Lyria toward songs, pop, or celebrity-style music", () => {
    const badSpec = {
      modelPolicy: { requiredProvider: "Google Gemini/Lyria family only", preferredPilotModel: "lyria-3-clip", fallbackProvidersAllowed: false },
      generationGate: { requiredPilotVariant: "fireplace:soft" },
      families: [{
        id: "fireplace",
        kind: "nature",
        levels: [
          {
            id: "soft",
            fileName: "hyperfocus-fireplace-soft.mp3",
            prompt: "Create a catchy BTS-style pop song about a fireplace with vocals, chorus, and melody.",
            rejectIf: ["vocals or lyrics", "melody or tune", "beat, drums, or percussion", "instruments or synth", "song structure, chorus, verse, or drop", "pop or commercial music soundtrack", "bad loop seam", "clipping, harsh transient, or click"],
          },
          {
            id: "deep",
            fileName: "hyperfocus-fireplace-deep.mp3",
            prompt: "Create a 30-second seamless loop field-recording environmental soundscape for concentration, nature fireplace crackle, steady from first second to last second, no vocals, no lyrics, no melody, no beat, no drums, no instruments, no song structure.",
            rejectIf: ["vocals or lyrics", "melody or tune", "beat, drums, or percussion", "instruments or synth", "song structure, chorus, verse, or drop", "pop or commercial music soundtrack", "bad loop seam", "clipping, harsh transient, or click"],
          },
          {
            id: "intense",
            fileName: "hyperfocus-fireplace-intense.mp3",
            prompt: "Create a 30-second seamless loop field-recording environmental soundscape for concentration, nature fireplace crackle, steady from first second to last second, no vocals, no lyrics, no melody, no beat, no drums, no instruments, no song structure.",
            rejectIf: ["vocals or lyrics", "melody or tune", "beat, drums, or percussion", "instruments or synth", "song structure, chorus, verse, or drop", "pop or commercial music soundtrack", "bad loop seam", "clipping, harsh transient, or click"],
          },
        ],
      }],
    };
    const result = contract.validateHyperfocusNatureSoundscapeSpec({ spec: badSpec });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("music-positive-drift");
  });

  it("rejects fireplace variants that drift into campfire, bonfire, or night-wind cues", () => {
    const badSpec = JSON.parse(readFileSync("docs/audio/hyperfocus-nature-soundscape-spec.json", "utf8"));
    const fireplace = badSpec.families.find((family: { id?: string }) => family.id === "fireplace");

    fireplace.levels[0].source = "Campfire burning crackles";
    fireplace.levels[1].prompt = fireplace.levels[1].prompt.replace("steady hearth fire", "steady campfire");
    fireplace.levels[2].label = "Bonfire";
    fireplace.levels[2].prompt = fireplace.levels[2].prompt.replace("outdoor bonfire texture", "outdoor bonfire texture with night wind");

    const result = contract.validateHyperfocusNatureSoundscapeSpec({ spec: badSpec });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "fireplace-context-drift", familyId: "fireplace" }),
      ]),
    );
  });

  it("rejects spec paths that resolve outside the project root", () => {
    const result = contract.validateHyperfocusNatureSoundscapeSpec({
      rootDir: "/tmp/zenflow-audio-contract-root",
      specPath: "../outside-spec.json",
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "unsafe-spec-path",
      }),
    );
  });
});
