import { createHash } from "node:crypto";
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const require = createRequire(import.meta.url);

type CloudlightR3SourceModule = {
  loadCloudlightR3Source: (rootDir: string) => Record<string, unknown>;
  validateCloudlightR3Source: (source: unknown) => string[];
  encodeCloudlightR3Midi: (source: unknown) => Buffer;
  writeCloudlightR3SourcePack: (input: {
    rootDir: string;
    outputDir: string;
  }) => {
    midiPath: string;
    automationPath: string;
    manifestPath: string;
    readmePath: string;
    manifest: {
      midiSha256: string;
      automationSha256: string;
      trackNames: string[];
      statuses: string[];
    };
    summary: Record<string, unknown>;
  };
};

const nativeFs = require("node:fs") as typeof import("node:fs");
const {
  loadCloudlightR3Source,
  validateCloudlightR3Source,
  encodeCloudlightR3Midi,
  writeCloudlightR3SourcePack,
} = require("../cloudlight-evening-r3-source.cjs") as CloudlightR3SourceModule;

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

function cloneSource<T>(source: T): T {
  return JSON.parse(JSON.stringify(source)) as T;
}

type SmfEvent = {
  tick: number;
  kind: "meta" | "channel" | "sysex";
  status: number;
  data: Buffer;
};

type SmfTrack = { events: SmfEvent[] };

function parseVlq(buffer: Buffer, offset: number): { value: number; next: number } {
  let value = 0;
  let next = offset;

  for (let count = 0; count < 4; count += 1) {
    expect(next).toBeLessThan(buffer.length);
    const byte = buffer[next];
    next += 1;
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next };
  }

  throw new Error("SMF VLQ exceeds four bytes");
}

function parseSmf(buffer: Buffer): { format: number; ppq: number; tracks: SmfTrack[] } {
  expect(buffer.subarray(0, 4).toString("ascii")).toBe("MThd");
  expect(buffer.readUInt32BE(4)).toBe(6);
  const format = buffer.readUInt16BE(8);
  const trackCount = buffer.readUInt16BE(10);
  const ppq = buffer.readUInt16BE(12);
  const tracks: SmfTrack[] = [];
  let offset = 14;

  while (offset < buffer.length) {
    expect(buffer.subarray(offset, offset + 4).toString("ascii")).toBe("MTrk");
    const length = buffer.readUInt32BE(offset + 4);
    const end = offset + 8 + length;
    expect(end).toBeLessThanOrEqual(buffer.length);
    const events: SmfEvent[] = [];
    let eventOffset = offset + 8;
    let tick = 0;

    while (eventOffset < end) {
      const delta = parseVlq(buffer, eventOffset);
      tick += delta.value;
      eventOffset = delta.next;
      const status = buffer[eventOffset];
      eventOffset += 1;

      if (status === 0xff) {
        const type = buffer[eventOffset];
        eventOffset += 1;
        const lengthValue = parseVlq(buffer, eventOffset);
        eventOffset = lengthValue.next;
        const data = buffer.subarray(eventOffset, eventOffset + lengthValue.value);
        eventOffset += lengthValue.value;
        events.push({ tick, kind: "meta", status: type, data });
      } else if (status === 0xf0 || status === 0xf7) {
        const lengthValue = parseVlq(buffer, eventOffset);
        eventOffset = lengthValue.next + lengthValue.value;
        events.push({ tick, kind: "sysex", status, data: Buffer.alloc(0) });
      } else {
        const messageType = status & 0xf0;
        const dataLength = messageType === 0xc0 || messageType === 0xd0 ? 1 : 2;
        const data = buffer.subarray(eventOffset, eventOffset + dataLength);
        eventOffset += dataLength;
        events.push({ tick, kind: "channel", status, data });
      }
    }

    expect(eventOffset).toBe(end);
    tracks.push({ events });
    offset = end;
  }

  expect(offset).toBe(buffer.length);
  expect(tracks).toHaveLength(trackCount);
  return { format, ppq, tracks };
}

type NormalizedSmfEvent = {
  tick: number;
  kind: "meta" | "channel" | "sysex";
  status: number;
  data: number[];
};

type LiteralMidiEvent = NormalizedSmfEvent & { order: number };

const LITERAL_TICKS_PER_SECOND = 896;

function literalTick(seconds: number): number {
  return Math.round(seconds * LITERAL_TICKS_PER_SECOND);
}

function literalNoteEvents(
  start: number,
  duration: number,
  midi: number,
  velocity: number
): LiteralMidiEvent[] {
  return [
    { tick: literalTick(start), kind: "channel", status: 0x90, data: [midi, velocity], order: 2 },
    { tick: literalTick(start + duration), kind: "channel", status: 0x80, data: [midi, 0], order: 0 },
  ];
}

function literalTrack(
  name: string,
  events: LiteralMidiEvent[],
  includeTempo = false
): NormalizedSmfEvent[] {
  const tempoEvent: LiteralMidiEvent[] = includeTempo
    ? [{ tick: 0, kind: "meta", status: 0x51, data: [0x10, 0x59, 0x45], order: -1 }]
    : [];
  const trackNameEvent: LiteralMidiEvent = {
    tick: 0,
    kind: "meta",
    status: 0x03,
    data: [...Buffer.from(name, "ascii")],
    order: -2,
  };
  const named: LiteralMidiEvent[] = [
    trackNameEvent,
    ...tempoEvent,
    ...events,
  ].sort((left, right) => left.tick - right.tick || left.order - right.order);
  const endTick = named.at(-1)?.tick ?? 0;
  return [
    ...named.map(({ tick, kind, status, data }) => ({ tick, kind, status, data })),
    { tick: endTick, kind: "meta", status: 0x2f, data: [] },
  ];
}

function canonicalSmfEventStreams(): NormalizedSmfEvent[][] {
  const padEvents = HARMONIC_FIELDS.flatMap((field) =>
    field.padMidi.flatMap((midi) => literalNoteEvents(field.start, field.end - field.start, midi, 42))
  );
  const droneEvents = HARMONIC_FIELDS.flatMap((field) =>
    field.droneMidi.flatMap((midi) => literalNoteEvents(field.start, field.end - field.start, midi, 34))
  );
  const shimmerEvents = (side: "left" | "right") =>
    SHIMMER_EVENTS.filter((event) => event.side === side).flatMap((event) =>
      literalNoteEvents(event.start, event.duration, event.midi, event.velocity)
    );
  const pianoEvents = PIANO_CLUSTERS.flatMap((cluster) =>
    cluster.notes.flatMap((note) =>
      literalNoteEvents(cluster.start + note.offset, note.duration, note.midi, note.velocity)
    )
  );

  return [
    literalTrack("Pad", padEvents, true),
    literalTrack("Drone", droneEvents),
    literalTrack("Shimmer L", [
      { tick: 0, kind: "channel", status: 0xb0, data: [10, 42], order: 1 },
      ...shimmerEvents("left"),
    ]),
    literalTrack("Shimmer R", [
      { tick: 0, kind: "channel", status: 0xb0, data: [10, 86], order: 1 },
      ...shimmerEvents("right"),
    ]),
    literalTrack("Piano", pianoEvents),
    literalTrack("Linear Fade", [
      { tick: 134400, kind: "channel", status: 0xb0, data: [11, 127], order: 1 },
      { tick: 148736, kind: "channel", status: 0xb0, data: [11, 0], order: 1 },
    ]),
  ];
}

function normalizeSmfTrack(track: SmfTrack): NormalizedSmfEvent[] {
  return track.events.map((event) => ({
    tick: event.tick,
    kind: event.kind,
    status: event.status,
    data: [...event.data],
  }));
}

function sourceFixtureRoot(source: unknown): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "cloudlight-evening-r3-fixture-"));
  mkdirSync(join(fixtureRoot, "config/audio"), { recursive: true });
  writeFileSync(
    join(fixtureRoot, "config/audio/cloudlight-evening-r3-source.json"),
    `${JSON.stringify(source, null, 2)}\n`
  );
  return fixtureRoot;
}

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
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

  it("writes the same private MIDI and automation source pack twice", () => {
    const tempRoot = mkdtempSync(
      join(rootDir, "output/private/cloudlight-evening-r3-source-test-")
    );
    const outsideRoot = mkdtempSync(join(tmpdir(), "cloudlight-evening-r3-outside-"));

    try {
      const first = writeCloudlightR3SourcePack({
        rootDir,
        outputDir: join(tempRoot, "output/private/r3-a"),
      });
      const second = writeCloudlightR3SourcePack({
        rootDir,
        outputDir: join(tempRoot, "output/private/r3-b"),
      });

      const midi = readFileSync(first.midiPath);
      expect(midi.subarray(0, 4).toString("ascii")).toBe("MThd");
      expect(midi.readUInt16BE(8)).toBe(1);
      expect(midi.readUInt16BE(10)).toBe(6);
      expect(midi.readUInt16BE(12)).toBe(960);
      expect(midi.includes(Buffer.from([0xff, 0x51, 0x03, 0x10, 0x59, 0x45]))).toBe(true);
      expect(first.manifest.midiSha256).toBe(second.manifest.midiSha256);
      expect(first.manifest.automationSha256).toBe(second.manifest.automationSha256);
      expect(first.manifest.trackNames).toEqual([
        "Pad",
        "Drone",
        "Shimmer L",
        "Shimmer R",
        "Piano",
        "Linear Fade",
      ]);
      expect(first.manifest.statuses).toEqual([
        "NOT_RENDERED",
        "OWNER_ARTISTIC_UNVERIFIED",
        "RUNTIME_PROMOTION_NOT_ALLOWED",
      ]);
      expect(readFileSync(first.automationPath, "utf8")).toBe(
        readFileSync(second.automationPath, "utf8")
      );
      expect(readFileSync(first.manifestPath, "utf8")).toBe(
        readFileSync(second.manifestPath, "utf8")
      );
      expect(readFileSync(first.readmePath, "utf8")).toContain("GarageBand");
      expect(() =>
        writeCloudlightR3SourcePack({ rootDir, outputDir: join(rootDir, "public/sounds/r3") })
      ).toThrow("must stay under <root>/output/private");
      expect(() =>
        writeCloudlightR3SourcePack({
          rootDir,
          outputDir: join(rootDir, "output/private-collision/r3"),
        })
      ).toThrow("must stay under <root>/output/private");
      const symlinkEscape = join(tempRoot, "symlink-escape");
      symlinkSync(outsideRoot, symlinkEscape, "dir");
      expect(() =>
        writeCloudlightR3SourcePack({ rootDir, outputDir: join(symlinkEscape, "r3") })
      ).toThrow("must stay under <root>/output/private");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it("rejects unsafe MIDI inputs and source-boundary violations before encoding", () => {
    const canonical = loadCloudlightR3Source(rootDir) as {
      harmonicFields: Array<{ start: number; end: number }>;
      shimmerEvents: Array<{ start: number; duration: number }>;
      pianoClusters: Array<{ start: number; notes: Array<{ offset: number; duration: number }> }>;
      candidates: Array<{ id: string; mix: Record<string, number> }>;
    };
    const invalidSources: Array<{ violation: string; source: unknown }> = [];

    const sysEx = cloneSource(canonical) as typeof canonical & { sysExEvents: unknown[] };
    sysEx.sysExEvents = [{ tick: 0, data: "F0" }];
    invalidSources.push({ violation: "sys_ex_not_allowed", source: sysEx });

    const program = cloneSource(canonical) as typeof canonical & { programChanges: unknown[] };
    program.programChanges = [{ track: "Pad", program: 89 }];
    invalidSources.push({ violation: "undeclared_program_data", source: program });

    const lateEvent = cloneSource(canonical);
    lateEvent.shimmerEvents[0] = { start: 165, duration: 2 };
    invalidSources.push({ violation: "event_after_review_duration", source: lateEvent });

    const latePiano = cloneSource(canonical);
    latePiano.pianoClusters[1].notes[3].duration = 4;
    invalidSources.push({ violation: "piano_note_after_dry_boundary", source: latePiano });

    const duplicateCandidate = cloneSource(canonical);
    duplicateCandidate.candidates[2].id = "candidate-02";
    invalidSources.push({ violation: "duplicate_candidate_id", source: duplicateCandidate });

    const unexpectedMixDifference = cloneSource(canonical);
    unexpectedMixDifference.candidates[1].mix.padDb = -11;
    invalidSources.push({ violation: "candidate_mix_difference_not_allowed", source: unexpectedMixDifference });

    for (const { violation, source } of invalidSources) {
      expect(validateCloudlightR3Source(source)).toContain(violation);
      expect(() => encodeCloudlightR3Midi(source)).toThrow(violation);
    }
  });

  it("returns named violations for malformed nested source data and refuses to create output", () => {
    const canonical = loadCloudlightR3Source(rootDir);
    const malformed: Array<{ violation: string; source: unknown }> = [];

    const invalidFields = cloneSource(canonical) as Record<string, unknown>;
    invalidFields.harmonicFields = { start: 0 };
    malformed.push({ violation: "invalid_harmonic_fields", source: invalidFields });

    const invalidPad = cloneSource(canonical) as {
      harmonicFields: Array<{ padMidi: unknown; droneMidi: unknown }>;
    };
    invalidPad.harmonicFields[0].padMidi = "50";
    invalidPad.harmonicFields[0].droneMidi = [];
    malformed.push({ violation: "invalid_pad_midi", source: invalidPad });

    const emptyPiano = cloneSource(canonical) as { pianoClusters: unknown[] };
    emptyPiano.pianoClusters = [];
    malformed.push({ violation: "empty_piano_clusters", source: emptyPiano });

    const negativeTimeline = cloneSource(canonical) as {
      shimmerEvents: Array<{ start: number }>;
    };
    negativeTimeline.shimmerEvents[0].start = -1;
    malformed.push({ violation: "negative_event_time", source: negativeTimeline });

    const invalidAuthorship = cloneSource(canonical) as { humanAuthorship: unknown };
    invalidAuthorship.humanAuthorship = { compositionDirection: "", implementation: 1, aiRole: null };
    malformed.push({ violation: "invalid_human_authorship", source: invalidAuthorship });

    const invalidRights = cloneSource(canonical) as { rights: unknown };
    invalidRights.rights = { referenceResearch: { title: 1 } };
    malformed.push({ violation: "invalid_rights", source: invalidRights });

    const retainedReferenceAudio = cloneSource(canonical) as {
      rights: { referenceResearch: { audioRetained: boolean } };
    };
    retainedReferenceAudio.rights.referenceResearch.audioRetained = true;
    malformed.push({ violation: "invalid_rights", source: retainedReferenceAudio });

    const invalidGarageBand = cloneSource(canonical) as { garageBand: unknown };
    invalidGarageBand.garageBand = { pianoInstrument: "", reverb: { decaySeconds: -1 } };
    malformed.push({ violation: "invalid_garageband", source: invalidGarageBand });

    for (const { violation, source } of malformed) {
      expect(() => validateCloudlightR3Source(source)).not.toThrow();
      expect(validateCloudlightR3Source(source)).toContain(violation);
      expect(() => encodeCloudlightR3Midi(source)).toThrow(violation);
    }

    const fixtureRoot = sourceFixtureRoot(malformed[0].source);
    const outputDir = join(fixtureRoot, "output/private/pack");
    try {
      expect(() => writeCloudlightR3SourcePack({ rootDir: fixtureRoot, outputDir })).toThrow(
        "invalid_harmonic_fields"
      );
      expect(existsSync(join(fixtureRoot, "output"))).toBe(false);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects every noncanonical candidate mix shape and value before encoding", () => {
    const canonical = loadCloudlightR3Source(rootDir) as {
      candidates: Array<{ mix: Record<string, number> }>;
    };
    const invalidCandidates: Array<{ violation: string; source: unknown }> = [];

    const identical = cloneSource(canonical);
    identical.candidates[1].mix = { ...identical.candidates[0].mix };
    invalidCandidates.push({ violation: "candidate_mix_values_not_canonical", source: identical });

    const missing = cloneSource(canonical);
    delete missing.candidates[1].mix.shimmerPanPercent;
    invalidCandidates.push({ violation: "candidate_mix_keys_not_canonical", source: missing });

    const extra = cloneSource(canonical) as typeof canonical & {
      candidates: Array<{ mix: Record<string, number> & { extraDb?: number } }>;
    };
    extra.candidates[1].mix.extraDb = 0;
    invalidCandidates.push({ violation: "candidate_mix_keys_not_canonical", source: extra });

    const stringValue = cloneSource(canonical) as unknown as {
      candidates: Array<{ mix: Record<string, number | string> }>;
    };
    stringValue.candidates[1].mix.shimmerDb = "-27.8";
    invalidCandidates.push({ violation: "candidate_mix_values_not_canonical", source: stringValue });

    const nanValue = cloneSource(canonical);
    nanValue.candidates[2].mix.pianoDb = Number.NaN;
    invalidCandidates.push({ violation: "candidate_mix_values_not_canonical", source: nanValue });

    const wrongAllowedValue = cloneSource(canonical);
    wrongAllowedValue.candidates[1].mix.shimmerDb = -28;
    invalidCandidates.push({ violation: "candidate_mix_values_not_canonical", source: wrongAllowedValue });

    for (const { violation, source } of invalidCandidates) {
      expect(validateCloudlightR3Source(source)).toContain(violation);
      expect(() => encodeCloudlightR3Midi(source)).toThrow(violation);
    }
  });

  it("never writes through a non-directory ancestor or unsafe output leaf", () => {
    const canonical = loadCloudlightR3Source(rootDir);
    const fixtureRoot = sourceFixtureRoot(canonical);
    const outsideRoot = mkdtempSync(join(tmpdir(), "cloudlight-evening-r3-write-outside-"));
    const outsidePath = join(outsideRoot, "outside.txt");
    writeFileSync(outsidePath, "OUTSIDE_BYTES\n");

    try {
      writeFileSync(join(fixtureRoot, "output"), "not a directory\n");
      expect(() =>
        writeCloudlightR3SourcePack({
          rootDir: fixtureRoot,
          outputDir: join(fixtureRoot, "output/private/pack"),
        })
      ).toThrow("must be a directory");
      expect(readFileSync(join(fixtureRoot, "output"), "utf8")).toBe("not a directory\n");
      unlinkSync(join(fixtureRoot, "output"));

      symlinkSync(outsideRoot, join(fixtureRoot, "output"), "dir");
      expect(() =>
        writeCloudlightR3SourcePack({
          rootDir: fixtureRoot,
          outputDir: join(fixtureRoot, "output/private/pack"),
        })
      ).toThrow("must stay under <root>/output/private");
      expect(existsSync(join(outsideRoot, "private/pack"))).toBe(false);
      unlinkSync(join(fixtureRoot, "output"));

      const outputDir = join(fixtureRoot, "output/private/pack");
      const first = writeCloudlightR3SourcePack({ rootDir: fixtureRoot, outputDir });

      unlinkSync(first.midiPath);
      symlinkSync(outsidePath, first.midiPath);
      const symlinkRewrite = writeCloudlightR3SourcePack({ rootDir: fixtureRoot, outputDir });
      expect(readFileSync(outsidePath, "utf8")).toBe("OUTSIDE_BYTES\n");
      expect(lstatSync(symlinkRewrite.midiPath).isFile()).toBe(true);

      unlinkSync(symlinkRewrite.midiPath);
      linkSync(outsidePath, symlinkRewrite.midiPath);
      const hardlinkRewrite = writeCloudlightR3SourcePack({ rootDir: fixtureRoot, outputDir });
      expect(readFileSync(outsidePath, "utf8")).toBe("OUTSIDE_BYTES\n");
      expect(lstatSync(hardlinkRewrite.midiPath).nlink).toBe(1);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it("binds the Task 4 render, evidence, and bilateral-pan inventory in the runbook", () => {
    const runbook = readFileSync(
      join(rootDir, "docs/audio/cloudlight-evening-r3-production-runbook.md"),
      "utf8"
    );
    expect(runbook).toContain("renders/candidate-01-linear.wav");
    expect(runbook).toContain("renders/candidate-02-linear.wav");
    expect(runbook).toContain("renders/candidate-03-linear.wav");
    expect(runbook).toContain("renders/candidate-01-linear-rerender.wav");
    expect(runbook).toContain("evidence/garageband/");
    expect(runbook).toContain("±35%");
    expect(runbook).toContain("±45%");
  });

  it("independently parses the exact SMF chunks, events, hashes, and source-pack inventory", () => {
    const tempRoot = mkdtempSync(join(rootDir, "output/private/cloudlight-evening-r3-smf-test-"));
    try {
      const receipt = writeCloudlightR3SourcePack({
        rootDir,
        outputDir: join(tempRoot, "pack"),
      });
      const midi = readFileSync(receipt.midiPath);
      const smf = parseSmf(midi);
      const manifest = JSON.parse(readFileSync(receipt.manifestPath, "utf8")) as Record<string, unknown>;
      const names = smf.tracks.map((track) =>
        track.events.find((event) => event.kind === "meta" && event.status === 0x03)?.data.toString("ascii")
      );
      const endTicks = smf.tracks.map((track) => track.events.at(-1)?.tick);

      expect(smf.format).toBe(1);
      expect(smf.ppq).toBe(960);
      expect(names).toEqual(["Pad", "Drone", "Shimmer L", "Shimmer R", "Piano", "Linear Fade"]);
      expect(endTicks).toEqual([148736, 148736, 89510, 109222, 122304, 148736]);
      expect(smf.tracks.every((track) => {
        const eot = track.events.at(-1);
        return (
          eot?.kind === "meta" &&
          eot.status === 0x2f &&
          eot.data.length === 0 &&
          track.events.filter((event) => event.kind === "meta" && event.status === 0x2f).length === 1
        );
      })).toBe(true);
      expect(smf.tracks.flatMap((track) => track.events).some((event) => event.kind === "sysex")).toBe(false);
      expect(smf.tracks.flatMap((track) => track.events).some((event) => (event.status & 0xf0) === 0xc0)).toBe(false);
      const tempoEvents = smf.tracks
        .flatMap((track) => track.events)
        .filter((event) => event.kind === "meta" && event.status === 0x51);
      expect(tempoEvents).toHaveLength(1);
      expect(tempoEvents[0].data.readUIntBE(0, 3)).toBe(1_071_429);
      expect(smf.tracks.map(normalizeSmfTrack)).toEqual(canonicalSmfEventStreams());

      for (const track of smf.tracks) {
        const balances = new Map<number, number>();
        const simultaneous = new Map<number, number[]>();
        for (const event of track.events) {
          if (event.kind !== "channel") continue;
          const type = event.status & 0xf0;
          expect([0x80, 0x90, 0xb0]).toContain(type);
          if (type === 0xb0) expect([10, 11]).toContain(event.data[0]);
          if (type === 0x90) balances.set(event.data[0], (balances.get(event.data[0]) ?? 0) + 1);
          if (type === 0x80) balances.set(event.data[0], (balances.get(event.data[0]) ?? 0) - 1);
          const rank = type === 0x80 ? 0 : type === 0xb0 ? 1 : 2;
          simultaneous.set(event.tick, [...(simultaneous.get(event.tick) ?? []), rank]);
        }
        expect([...balances.values()].every((balance) => balance === 0)).toBe(true);
        expect([...simultaneous.values()].every((ranks) => ranks.every((rank, index) => index === 0 || ranks[index - 1] <= rank))).toBe(true);
      }

      const inventory = readdirSync(join(tempRoot, "pack"), { withFileTypes: true });
      expect(inventory.map((entry) => entry.name).sort()).toEqual([
        "README.md",
        "automation.json",
        "cloudlight-evening-r3.mid",
        "source-manifest.json",
      ]);
      expect(inventory.every((entry) => entry.isFile())).toBe(true);
      expect(manifest.midiSha256).toBe(sha256(receipt.midiPath));
      expect(manifest.automationSha256).toBe(sha256(receipt.automationPath));
      const sourceConfigPath = join(rootDir, "config/audio/cloudlight-evening-r3-source.json");
      expect(manifest.sourceConfigSha256).toBe(sha256(sourceConfigPath));
      expect(manifest.sourceConfigBytes).toBe(readFileSync(sourceConfigPath).length);
      expect((receipt.summary as { sourceManifestSha256: string }).sourceManifestSha256).toBe(
        sha256(receipt.manifestPath)
      );
      expect(manifest.midiBytes).toBe(midi.length);
      expect(manifest.automationBytes).toBe(readFileSync(receipt.automationPath).length);
      expect(manifest.trackNames).toEqual(names);
      expect(manifest.eventCounts).toEqual(
        Object.fromEntries(names.map((name, index) => [name, smf.tracks[index].events.length]))
      );
      expect(manifest.outputInventory).toEqual([
        "cloudlight-evening-r3.mid",
        "automation.json",
        "source-manifest.json",
        "README.md",
      ]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("returns named violations for BigInt and cyclic loop-pad input without throwing", () => {
    const canonical = loadCloudlightR3Source(rootDir) as {
      harmonicFields: Array<{ padMidi: unknown[]; droneMidi: unknown[] }>;
    };
    const bigintSource = cloneSource(canonical);
    bigintSource.harmonicFields[0].padMidi[0] = BigInt(50);
    const cyclicSource = cloneSource(canonical);
    const cyclicPad: unknown[] = [];
    cyclicPad.push(cyclicPad);
    cyclicSource.harmonicFields[0].padMidi = cyclicPad;

    for (const source of [bigintSource, cyclicSource]) {
      expect(() => validateCloudlightR3Source(source)).not.toThrow();
      expect(validateCloudlightR3Source(source)).toContain("invalid_pad_midi");
      expect(() => encodeCloudlightR3Midi(source)).toThrow("invalid_pad_midi");
    }
  });

  it("cleans injected write and close failures, then rejects a swapped parent before writing", () => {
    const canonical = loadCloudlightR3Source(rootDir);
    const fixtureRoot = sourceFixtureRoot(canonical);
    const outsideRoot = mkdtempSync(join(tmpdir(), "cloudlight-evening-r3-swap-outside-"));
    const outputDir = join(fixtureRoot, "output/private/pack");
    const originalWriteFileSync = nativeFs.writeFileSync;
    const originalCloseSync = nativeFs.closeSync;
    const originalOpenSync = nativeFs.openSync;
    try {
      let injectedDescriptor: number | null = null;
      let closeFailuresRemaining = 1;
      nativeFs.writeFileSync = ((target: Parameters<typeof writeFileSync>[0], ...args: unknown[]) => {
        if (typeof target === "number") {
          injectedDescriptor = target;
          throw new Error("injected write failure");
        }
        return (originalWriteFileSync as (...arguments_: unknown[]) => unknown)(target, ...args);
      }) as typeof nativeFs.writeFileSync;
      nativeFs.closeSync = ((descriptor: number) => {
        if (descriptor === injectedDescriptor && closeFailuresRemaining > 0) {
          closeFailuresRemaining -= 1;
          throw new Error("injected close failure");
        }
        return originalCloseSync(descriptor);
      }) as typeof nativeFs.closeSync;
      expect(() => writeCloudlightR3SourcePack({ rootDir: fixtureRoot, outputDir })).toThrow(
        "injected write failure"
      );
      expect(readdirSync(outputDir).filter((name) => name.includes(".stage"))).toEqual([]);
      nativeFs.writeFileSync = originalWriteFileSync;
      nativeFs.closeSync = originalCloseSync;
      writeCloudlightR3SourcePack({ rootDir: fixtureRoot, outputDir });
      expect(readdirSync(outputDir).sort()).toEqual([
        "README.md",
        "automation.json",
        "cloudlight-evening-r3.mid",
        "source-manifest.json",
      ]);

      const outputPath = join(fixtureRoot, "output");
      const savedOutputPath = join(fixtureRoot, "saved-output");
      mkdirSync(join(outsideRoot, "private/pack"), { recursive: true });
      writeFileSync(join(outsideRoot, "sentinel.txt"), "OUTSIDE_SENTINEL\n");
      renameSync(outputPath, savedOutputPath);
      nativeFs.openSync = ((filePath: Parameters<typeof openSync>[0], ...args: unknown[]) => {
        if (typeof filePath === "string" && filePath.endsWith(".stage")) {
          rmSync(outputPath, { recursive: true, force: true });
          symlinkSync(outsideRoot, outputPath, "dir");
          const descriptor = (originalOpenSync as (...arguments_: unknown[]) => number)(filePath, ...args);
          unlinkSync(outputPath);
          renameSync(savedOutputPath, outputPath);
          return descriptor;
        }
        return (originalOpenSync as (...arguments_: unknown[]) => number)(filePath, ...args);
      }) as typeof nativeFs.openSync;
      expect(() => writeCloudlightR3SourcePack({ rootDir: fixtureRoot, outputDir })).toThrow(
        "unsafe opened descriptor path"
      );
      nativeFs.openSync = originalOpenSync;
      expect(readFileSync(join(outsideRoot, "sentinel.txt"), "utf8")).toBe("OUTSIDE_SENTINEL\n");
      expect(readdirSync(join(outsideRoot, "private/pack"))).toEqual([]);
      expect(readdirSync(outputDir).filter((name) => name.includes(".stage"))).toEqual([]);
    } finally {
      nativeFs.writeFileSync = originalWriteFileSync;
      nativeFs.closeSync = originalCloseSync;
      nativeFs.openSync = originalOpenSync;
      rmSync(fixtureRoot, { recursive: true, force: true });
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });
});
