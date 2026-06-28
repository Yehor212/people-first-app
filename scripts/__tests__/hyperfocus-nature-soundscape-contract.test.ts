import { describe, expect, it } from "vitest";

const contract = require("../check-hyperfocus-nature-soundscape-contract.cjs") as {
  validateHyperfocusNatureSoundscapeSpec: (options?: { rootDir?: string; spec?: unknown; specPath?: string }) => {
    ok: boolean;
    familyCount: number;
    levelCount: number;
    issues: Array<{ code: string; familyId?: string; levelId?: string }>;
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
