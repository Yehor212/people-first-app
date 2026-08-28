import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

const HUMAN_AUTHORSHIP = {
  compositionDirection: "Yehor212 / ZenFlow",
  implementation: "deterministic first-party MIDI and automation",
  aiRole: "planning, code assistance, and diagnostic audit only",
} as const;

const RIGHTS = {
  referenceResearch: {
    title: "Cloudbound Evening",
    use: "high-level mood and functional production grammar only",
    audioRetained: false,
    melodyHarmonyArrangementTranscribed: false,
  },
} as const;

const HARMONIC_FIELDS = [
  { start: 0, end: 30, padMidi: [50, 57, 64, 71], droneMidi: [45, 52] },
  { start: 30, end: 55, padMidi: [49, 57, 64, 71], droneMidi: [45, 52] },
  { start: 55, end: 80, padMidi: [43, 50, 57, 64], droneMidi: [43, 50] },
  { start: 80, end: 105, padMidi: [47, 54, 61, 69], droneMidi: [47, 54] },
  { start: 105, end: 126, padMidi: [40, 47, 50, 57], droneMidi: [47, 52] },
  { start: 126, end: 138, padMidi: [45, 52, 59, 66], droneMidi: [45, 52] },
  { start: 138, end: 166, padMidi: [50, 57, 64, 71], droneMidi: [45, 52] },
] as const;

const SHIMMER_EVENTS = [
  { start: 58.4, duration: 8.2, midi: 86, velocity: 19, side: "left" },
  { start: 73.6, duration: 9.4, midi: 81, velocity: 22, side: "right" },
  { start: 92.1, duration: 7.8, midi: 88, velocity: 18, side: "left" },
  { start: 111.8, duration: 10.1, midi: 83, velocity: 20, side: "right" },
] as const;

const PIANO_CLUSTERS = [
  {
    start: 125.2,
    notes: [
      { offset: 0, duration: 3.6, midi: 69, velocity: 24 },
      { offset: 0.42, duration: 3.1, midi: 76, velocity: 20 },
      { offset: 0.96, duration: 2.8, midi: 74, velocity: 18 },
    ],
  },
  {
    start: 133.1,
    notes: [
      { offset: 0, duration: 3.4, midi: 71, velocity: 22 },
      { offset: 0.38, duration: 3, midi: 78, velocity: 18 },
      { offset: 0.84, duration: 2.5, midi: 73, velocity: 19 },
      { offset: 1.28, duration: 2.1, midi: 69, velocity: 17 },
    ],
  },
] as const;

const LINEAR_FADE = { start: 150, end: 166, fromCc11: 127, toCc11: 0 } as const;

const GARAGE_BAND = {
  pianoInstrument:
    "/Library/Application Support/Logic/Sampler Instruments/01 Acoustic Pianos/Steinway Grand Piano 2.exs",
  pianoSamples:
    "/Library/Application Support/Logic/EXS Factory Samples/01 Acoustic Pianos/Steinway Piano_consolidated.caf",
  padPreset:
    "/Applications/GarageBand.app/Contents/Resources/Plug-In Settings/Sculpture/02 Modeled Pads/Ambient Pad.pst",
  dronePreset:
    "/Applications/GarageBand.app/Contents/Resources/Plug-In Settings/Retro Synth/02 Synth Pads/Dark Swell Pad.pst",
  shimmerPreset:
    "/Applications/GarageBand.app/Contents/Resources/Plug-In Settings/Sculpture/02 Modeled Pads/Ambient Overtones.pst",
  reverbPreset:
    "/Applications/GarageBand.app/Contents/Resources/Plug-In Settings/ChromaVerb/Synth Reverbs/Clean Ambient Tail .pst",
  reverb: { decaySeconds: 7.5, preDelayMs: 12, lowCutHz: 120, dampingHz: 4800 },
} as const;

const CANDIDATES = [
  {
    id: "candidate-01",
    mix: { padDb: -12, droneDb: -21, shimmerDb: -29, shimmerPanPercent: 35, pianoDb: -27 },
  },
  {
    id: "candidate-02",
    mix: { padDb: -12, droneDb: -21, shimmerDb: -27.8, shimmerPanPercent: 45, pianoDb: -27 },
  },
  {
    id: "candidate-03",
    mix: { padDb: -12, droneDb: -21, shimmerDb: -29, shimmerPanPercent: 35, pianoDb: -25.8 },
  },
] as const;

const EXPECTED_SOURCE = {
  schemaVersion: 1,
  id: "cloudlight-evening-r3",
  tempoBpm: 56,
  ppq: 960,
  reviewDurationSeconds: 166,
  runtimeLoopDurationSeconds: 150,
  sourceAudioInputs: [],
  appleLoopsUsed: false,
  humanAuthorship: HUMAN_AUTHORSHIP,
  rights: RIGHTS,
  harmonicFields: HARMONIC_FIELDS,
  shimmerEvents: SHIMMER_EVENTS,
  pianoClusters: PIANO_CLUSTERS,
  linearFade: LINEAR_FADE,
  garageBand: GARAGE_BAND,
  candidates: CANDIDATES,
} as const;

type JsonValue = JsonObject | JsonValue[] | string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue };

function stringLeaves(value: JsonValue, path = ""): Array<{ path: string; value: string }> {
  if (typeof value === "string") {
    return [{ path, value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => stringLeaves(item, `${path}[${index}]`));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      stringLeaves(item, path ? `${path}.${key}` : key)
    );
  }

  return [];
}

function differingMixKeys(baseline: Record<string, number>, candidate: Record<string, number>): string[] {
  return Object.keys(baseline).filter((key) => baseline[key] !== candidate[key]);
}

function expectCanonicalSource(source: unknown): void {
  expect(source).toEqual(EXPECTED_SOURCE);
}

function cloneExpectedSource(): {
  candidates: Array<{ id: string; mix: Record<string, number> }>;
  harmonicFields: Array<{ padMidi: number[] }>;
} {
  return JSON.parse(JSON.stringify(EXPECTED_SOURCE)) as {
    candidates: Array<{ id: string; mix: Record<string, number> }>;
    harmonicFields: Array<{ padMidi: number[] }>;
  };
}

describe("Cloudlight Evening R3 source contract", () => {
  it("keeps the complete canonical composition and three constrained review mixes", () => {
    const source = JSON.parse(
      readFileSync(join(rootDir, "config/audio/cloudlight-evening-r3-source.json"), "utf8")
    ) as typeof EXPECTED_SOURCE;

    expectCanonicalSource(source);
    expect(source.humanAuthorship).toEqual(HUMAN_AUTHORSHIP);
    expect(source.rights).toEqual(RIGHTS);
    expect(source.harmonicFields).toEqual(HARMONIC_FIELDS);
    expect(source.shimmerEvents).toEqual(SHIMMER_EVENTS);
    expect(source.pianoClusters).toEqual(PIANO_CLUSTERS);
    expect(source.linearFade).toEqual(LINEAR_FADE);
    expect(source.garageBand).toEqual(GARAGE_BAND);
    expect(source.candidates).toEqual(CANDIDATES);

    expect(source.candidates.map((row) => row.id)).toEqual([
      "candidate-01",
      "candidate-02",
      "candidate-03",
    ]);
    const pianoClusters =
      source.pianoClusters as ReadonlyArray<{
        start: number;
        notes: ReadonlyArray<{ offset: number; duration: number }>;
      }>;
    expect(pianoClusters.flatMap((cluster) => cluster.notes)).toHaveLength(7);

    const pianoNoteEnds = pianoClusters.flatMap((cluster) =>
      cluster.notes.map((note) => cluster.start + note.offset + note.duration)
    );
    expect(Math.max(...pianoNoteEnds)).toBeLessThanOrEqual(138);
    expect(source.harmonicFields.at(-1)?.padMidi).toEqual(source.harmonicFields[0].padMidi);

    const [candidate01, candidate02, candidate03] = source.candidates;
    expect(candidate02).not.toEqual(candidate01);
    expect(candidate03).not.toEqual(candidate01);
    expect(differingMixKeys(candidate01.mix, candidate02.mix)).toEqual([
      "shimmerDb",
      "shimmerPanPercent",
    ]);
    expect(differingMixKeys(candidate01.mix, candidate03.mix)).toEqual(["pianoDb"]);
    expect(candidate02.mix).toEqual({
      padDb: -12,
      droneDb: -21,
      shimmerDb: -27.8,
      shimmerPanPercent: 45,
      pianoDb: -27,
    });
    expect(candidate03.mix).toEqual({
      padDb: -12,
      droneDb: -21,
      shimmerDb: -29,
      shimmerPanPercent: 35,
      pianoDb: -25.8,
    });

    const referenceTitle = source.rights.referenceResearch.title;
    expect(
      stringLeaves(source as unknown as JsonValue).filter(
        (leaf) => leaf.path !== "rights.referenceResearch.title" && leaf.value.includes(referenceTitle)
      )
    ).toEqual([]);
  });

  it("rejects representative forbidden candidate and composition mutations", () => {
    const candidateMutation = cloneExpectedSource();
    candidateMutation.candidates[1].mix = { ...candidateMutation.candidates[0].mix };
    expect(() => expectCanonicalSource(candidateMutation)).toThrow();

    const compositionMutation = cloneExpectedSource();
    compositionMutation.harmonicFields[1].padMidi[0] = 50;
    expect(() => expectCanonicalSource(compositionMutation)).toThrow();
  });
});
