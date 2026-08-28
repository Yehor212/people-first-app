"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const CONFIG_RELATIVE_PATH = "config/audio/cloudlight-evening-r3-source.json";
const SOURCE_PACK_FILES = {
  midi: "cloudlight-evening-r3.mid",
  automation: "automation.json",
  manifest: "source-manifest.json",
  readme: "README.md",
};
const TRACK_NAMES = ["Pad", "Drone", "Shimmer L", "Shimmer R", "Piano", "Linear Fade"];
const REVIEW_STATUSES = [
  "NOT_RENDERED",
  "OWNER_ARTISTIC_UNVERIFIED",
  "RUNTIME_PROMOTION_NOT_ALLOWED",
];
const TEMPO_MICROSECONDS_PER_QUARTER = 1_071_429;
const ALLOWED_SOURCE_KEYS = new Set([
  "schemaVersion",
  "id",
  "tempoBpm",
  "ppq",
  "reviewDurationSeconds",
  "runtimeLoopDurationSeconds",
  "sourceAudioInputs",
  "appleLoopsUsed",
  "humanAuthorship",
  "rights",
  "harmonicFields",
  "shimmerEvents",
  "pianoClusters",
  "linearFade",
  "garageBand",
  "candidates",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function secondsToTicks(seconds, tempoBpm, ppq) {
  return Math.round(seconds * (tempoBpm / 60) * ppq);
}

function validateTopLevelIdentity(source) {
  const violations = [];

  if (!isObject(source)) {
    return ["source_not_an_object"];
  }

  if (
    source.schemaVersion !== 1 ||
    source.id !== "cloudlight-evening-r3" ||
    source.tempoBpm !== 56 ||
    source.ppq !== 960 ||
    source.reviewDurationSeconds !== 166 ||
    source.runtimeLoopDurationSeconds !== 150
  ) {
    violations.push("invalid_top_level_identity");
  }

  for (const key of Object.keys(source)) {
    if (key === "sysExEvents") {
      violations.push("sys_ex_not_allowed");
    } else if (key === "programChanges") {
      violations.push("undeclared_program_data");
    } else if (!ALLOWED_SOURCE_KEYS.has(key)) {
      violations.push(`unsupported_source_property:${key}`);
    }
  }

  return violations;
}

function validateMidiValue(value, violation, violations) {
  if (!Number.isInteger(value) || value < 0 || value > 127) {
    violations.push(violation);
  }
}

function validateTimeline(source) {
  const violations = [];
  const duration = source.reviewDurationSeconds;
  const fields = source.harmonicFields;

  if (!Array.isArray(fields) || fields.length === 0) {
    violations.push("missing_harmonic_fields");
  } else {
    let expectedStart = 0;
    for (const field of fields) {
      if (!isObject(field) || !isFiniteNumber(field.start) || !isFiniteNumber(field.end)) {
        violations.push("invalid_harmonic_field");
        continue;
      }
      if (field.start !== expectedStart || field.end <= field.start) {
        violations.push("harmonic_timeline_not_contiguous");
      }
      if (field.end > duration) {
        violations.push("event_after_review_duration");
      }
      expectedStart = field.end;
      for (const note of [...(Array.isArray(field.padMidi) ? field.padMidi : []), ...(Array.isArray(field.droneMidi) ? field.droneMidi : [])]) {
        validateMidiValue(note, "invalid_harmonic_midi", violations);
      }
    }
    if (expectedStart !== duration) {
      violations.push("harmonic_timeline_not_review_duration");
    }
  }

  if (!Array.isArray(source.shimmerEvents)) {
    violations.push("missing_shimmer_events");
  } else {
    for (const event of source.shimmerEvents) {
      if (!isObject(event) || !isFiniteNumber(event.start) || !isFiniteNumber(event.duration)) {
        violations.push("invalid_shimmer_event");
        continue;
      }
      if (event.start < 0 || event.duration <= 0 || event.start + event.duration > duration) {
        violations.push("event_after_review_duration");
      }
      validateMidiValue(event.midi, "invalid_shimmer_midi", violations);
      validateMidiValue(event.velocity, "invalid_shimmer_velocity", violations);
      if (event.side !== "left" && event.side !== "right") {
        violations.push("invalid_shimmer_side");
      }
    }
  }

  if (!isObject(source.linearFade)) {
    violations.push("missing_linear_fade");
  } else if (
    source.linearFade.start !== 150 ||
    source.linearFade.end !== duration ||
    source.linearFade.fromCc11 !== 127 ||
    source.linearFade.toCc11 !== 0
  ) {
    violations.push("invalid_linear_fade");
  }

  return violations;
}

function validatePianoBoundary(source, dryBoundarySeconds) {
  const violations = [];

  if (!Array.isArray(source.pianoClusters)) {
    return ["missing_piano_clusters"];
  }

  for (const cluster of source.pianoClusters) {
    if (!isObject(cluster) || !isFiniteNumber(cluster.start) || !Array.isArray(cluster.notes)) {
      violations.push("invalid_piano_cluster");
      continue;
    }
    for (const note of cluster.notes) {
      if (!isObject(note) || !isFiniteNumber(note.offset) || !isFiniteNumber(note.duration)) {
        violations.push("invalid_piano_note");
        continue;
      }
      if (note.offset < 0 || note.duration <= 0 || cluster.start + note.offset + note.duration > dryBoundarySeconds) {
        violations.push("piano_note_after_dry_boundary");
      }
      validateMidiValue(note.midi, "invalid_piano_midi", violations);
      validateMidiValue(note.velocity, "invalid_piano_velocity", violations);
    }
  }

  return violations;
}

function validateLoopCompatiblePad(firstField, lastField) {
  if (!isObject(firstField) || !isObject(lastField) || !Array.isArray(firstField.padMidi) || !Array.isArray(lastField.padMidi)) {
    return ["missing_loop_compatible_pad"];
  }

  return JSON.stringify(firstField.padMidi) === JSON.stringify(lastField.padMidi)
    ? []
    : ["loop_incompatible_pad"];
}

function validateCandidateDiffs(candidates, allowedDifferences) {
  const violations = [];

  if (!Array.isArray(candidates) || candidates.length !== 3) {
    return ["invalid_candidate_count"];
  }

  const ids = candidates.map((candidate) => candidate && candidate.id);
  if (new Set(ids).size !== ids.length) {
    violations.push("duplicate_candidate_id");
  }
  if (JSON.stringify(ids) !== JSON.stringify(["candidate-01", "candidate-02", "candidate-03"])) {
    violations.push("invalid_candidate_ids");
  }

  const baseline = candidates[0] && candidates[0].mix;
  if (!isObject(baseline)) {
    return [...violations, "invalid_candidate_mix"];
  }

  for (const candidate of candidates) {
    if (!isObject(candidate) || !isObject(candidate.mix)) {
      violations.push("invalid_candidate_mix");
    }
  }

  for (const [candidateId, allowedKeys] of Object.entries(allowedDifferences)) {
    const candidate = candidates.find((row) => row && row.id === candidateId);
    if (!candidate || !isObject(candidate.mix)) {
      continue;
    }
    const keys = new Set([...Object.keys(baseline), ...Object.keys(candidate.mix)]);
    const unexpectedDifference = [...keys].some(
      (key) => baseline[key] !== candidate.mix[key] && !allowedKeys.includes(key)
    );
    if (unexpectedDifference) {
      violations.push("candidate_mix_difference_not_allowed");
    }
  }

  return violations;
}

function validateNoExternalAudioInputs(source) {
  const violations = [];
  if (!Array.isArray(source.sourceAudioInputs) || source.sourceAudioInputs.length !== 0) {
    violations.push("external_audio_inputs_not_allowed");
  }
  if (source.appleLoopsUsed !== false) {
    violations.push("apple_loops_not_allowed");
  }
  return violations;
}

function validateCloudlightR3Source(source) {
  if (!isObject(source)) {
    return ["source_not_an_object"];
  }

  return [
    ...validateTopLevelIdentity(source),
    ...validateTimeline(source),
    ...validatePianoBoundary(source, 138),
    ...validateLoopCompatiblePad(source.harmonicFields && source.harmonicFields[0], source.harmonicFields && source.harmonicFields.at(-1)),
    ...validateCandidateDiffs(source.candidates, {
      "candidate-02": ["shimmerDb", "shimmerPanPercent"],
      "candidate-03": ["pianoDb"],
    }),
    ...validateNoExternalAudioInputs(source),
  ];
}

function assertValidSource(source) {
  const violations = [...new Set(validateCloudlightR3Source(source))];
  if (violations.length > 0) {
    throw new Error(`Invalid Cloudlight R3 source: ${violations.join(", ")}`);
  }
}

function loadCloudlightR3Source(rootDir) {
  const configPath = path.join(path.resolve(rootDir), CONFIG_RELATIVE_PATH);
  const source = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assertValidSource(source);
  return source;
}

function encodeVariableLength(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0x0fffffff) {
    throw new Error(`MIDI delta time is out of range: ${value}`);
  }
  const bytes = [value & 0x7f];
  let remaining = value >>> 7;
  while (remaining > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }
  return Buffer.from(bytes);
}

function midiEvent(tick, order, bytes) {
  return { tick, order, bytes: Buffer.from(bytes) };
}

function noteEvents(start, duration, midi, velocity, source) {
  const startTick = secondsToTicks(start, source.tempoBpm, source.ppq);
  const endTick = secondsToTicks(start + duration, source.tempoBpm, source.ppq);
  return [
    midiEvent(startTick, 2, [0x90, midi, velocity]),
    midiEvent(endTick, 0, [0x80, midi, 0]),
  ];
}

function controllerEvent(seconds, controller, value, source) {
  return midiEvent(secondsToTicks(seconds, source.tempoBpm, source.ppq), 1, [0xb0, controller, value]);
}

function buildMidiTracks(source) {
  const tracks = new Map(TRACK_NAMES.map((name) => [name, []]));
  const pad = tracks.get("Pad");
  const drone = tracks.get("Drone");
  const shimmerLeft = tracks.get("Shimmer L");
  const shimmerRight = tracks.get("Shimmer R");
  const piano = tracks.get("Piano");
  const fade = tracks.get("Linear Fade");

  pad.push(midiEvent(0, -2, [0xff, 0x03, 0x03, ...Buffer.from("Pad", "ascii")]));
  pad.push(midiEvent(0, -1, [0xff, 0x51, 0x03, 0x10, 0x59, 0x45]));
  drone.push(midiEvent(0, -2, [0xff, 0x03, 0x05, ...Buffer.from("Drone", "ascii")]));
  shimmerLeft.push(midiEvent(0, -2, [0xff, 0x03, 0x09, ...Buffer.from("Shimmer L", "ascii")]));
  shimmerRight.push(midiEvent(0, -2, [0xff, 0x03, 0x09, ...Buffer.from("Shimmer R", "ascii")]));
  piano.push(midiEvent(0, -2, [0xff, 0x03, 0x05, ...Buffer.from("Piano", "ascii")]));
  fade.push(midiEvent(0, -2, [0xff, 0x03, 0x0b, ...Buffer.from("Linear Fade", "ascii")]));

  for (const field of source.harmonicFields) {
    for (const note of field.padMidi) {
      pad.push(...noteEvents(field.start, field.end - field.start, note, 42, source));
    }
    for (const note of field.droneMidi) {
      drone.push(...noteEvents(field.start, field.end - field.start, note, 34, source));
    }
  }

  shimmerLeft.push(controllerEvent(0, 10, 42, source));
  shimmerRight.push(controllerEvent(0, 10, 86, source));
  for (const event of source.shimmerEvents) {
    const track = event.side === "left" ? shimmerLeft : shimmerRight;
    track.push(...noteEvents(event.start, event.duration, event.midi, event.velocity, source));
  }

  for (const cluster of source.pianoClusters) {
    for (const note of cluster.notes) {
      piano.push(...noteEvents(cluster.start + note.offset, note.duration, note.midi, note.velocity, source));
    }
  }

  fade.push(controllerEvent(source.linearFade.start, 11, source.linearFade.fromCc11, source));
  fade.push(controllerEvent(source.linearFade.end, 11, source.linearFade.toCc11, source));

  return TRACK_NAMES.map((name) => ({ name, events: tracks.get(name) }));
}

function encodeTrack(events) {
  const sorted = [...events].sort((left, right) => left.tick - right.tick || left.order - right.order);
  let previousTick = 0;
  const chunks = [];
  for (const event of sorted) {
    chunks.push(encodeVariableLength(event.tick - previousTick), event.bytes);
    previousTick = event.tick;
  }
  chunks.push(encodeVariableLength(0), Buffer.from([0xff, 0x2f, 0x00]));
  const payload = Buffer.concat(chunks);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  return Buffer.concat([Buffer.from("MTrk", "ascii"), length, payload]);
}

function encodeCloudlightR3Midi(source) {
  assertValidSource(source);
  const header = Buffer.alloc(14);
  header.write("MThd", 0, "ascii");
  header.writeUInt32BE(6, 4);
  header.writeUInt16BE(1, 8);
  header.writeUInt16BE(TRACK_NAMES.length, 10);
  header.writeUInt16BE(source.ppq, 12);
  return Buffer.concat([header, ...buildMidiTracks(source).map((track) => encodeTrack(track.events))]);
}

function buildAutomation(source) {
  return {
    schemaVersion: 1,
    id: source.id,
    tempoBpm: source.tempoBpm,
    ppq: source.ppq,
    reviewDurationSeconds: source.reviewDurationSeconds,
    tracks: [
      {
        name: "Pad",
        harmonicFields: source.harmonicFields.map((field) => ({
          start: field.start,
          end: field.end,
          midi: field.padMidi,
          velocity: 42,
        })),
      },
      {
        name: "Drone",
        harmonicFields: source.harmonicFields.map((field) => ({
          start: field.start,
          end: field.end,
          midi: field.droneMidi,
          velocity: 34,
        })),
      },
      { name: "Shimmer L", cc10Pan: 42, events: source.shimmerEvents.filter((event) => event.side === "left") },
      { name: "Shimmer R", cc10Pan: 86, events: source.shimmerEvents.filter((event) => event.side === "right") },
      { name: "Piano", clusters: source.pianoClusters },
      {
        name: "Linear Fade",
        controller: 11,
        points: [
          { seconds: source.linearFade.start, value: source.linearFade.fromCc11 },
          { seconds: source.linearFade.end, value: source.linearFade.toCc11 },
        ],
      },
    ],
    candidates: source.candidates,
  };
}

function buildReadme(source) {
  return `# Cloudlight Evening R3 source pack\n\nThis private pack is deterministic first-party MIDI and automation for GarageBand review. It contains no audio regions, external audio inputs, Apple Loops, render, or runtime asset.\n\n- Source config: \`${CONFIG_RELATIVE_PATH}\`\n- MIDI: \`${SOURCE_PACK_FILES.midi}\` (type 1, PPQ ${source.ppq}, ${source.tempoBpm} BPM)\n- Automation: \`${SOURCE_PACK_FILES.automation}\`\n- Duration: ${source.reviewDurationSeconds} seconds\n- Tracks: ${TRACK_NAMES.join(", ")}\n\nUse the tracked production runbook for GarageBand import, candidate faders, export, and private receipt capture. Candidate selection and runtime promotion remain owner-controlled.\n`;
}

function assertPrivateOutputPath(rootDir, outputDir) {
  const privateRoot = path.resolve(rootDir, "output", "private");
  const resolvedOutput = path.resolve(outputDir);
  const relative = path.relative(privateRoot, resolvedOutput);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error("Cloudlight R3 source output must stay under <root>/output/private");
  }

  fs.mkdirSync(privateRoot, { recursive: true });
  if (fs.lstatSync(privateRoot).isSymbolicLink()) {
    throw new Error("Cloudlight R3 source output must stay under <root>/output/private");
  }

  const realPrivateRoot = fs.realpathSync.native(privateRoot);
  let currentPath = privateRoot;
  for (const segment of relative.split(path.sep)) {
    currentPath = path.join(currentPath, segment);
    if (fs.existsSync(currentPath)) {
      if (fs.lstatSync(currentPath).isSymbolicLink()) {
        throw new Error("Cloudlight R3 source output must stay under <root>/output/private");
      }
    } else {
      fs.mkdirSync(currentPath);
    }

    const realCurrentPath = fs.realpathSync.native(currentPath);
    if (
      realCurrentPath !== realPrivateRoot &&
      !realCurrentPath.startsWith(`${realPrivateRoot}${path.sep}`)
    ) {
      throw new Error("Cloudlight R3 source output must stay under <root>/output/private");
    }
  }

  return resolvedOutput;
}

function writeCloudlightR3SourcePack({ rootDir, outputDir }) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedOutput = assertPrivateOutputPath(resolvedRoot, outputDir);
  const source = loadCloudlightR3Source(resolvedRoot);
  const midi = encodeCloudlightR3Midi(source);
  const automation = Buffer.from(`${JSON.stringify(buildAutomation(source), null, 2)}\n`);
  const sourceConfigPath = path.join(resolvedRoot, CONFIG_RELATIVE_PATH);
  const sourceConfig = fs.readFileSync(sourceConfigPath);
  const tracks = buildMidiTracks(source);

  const manifest = {
    schemaVersion: 1,
    sourceId: source.id,
    sourceConfigPath: CONFIG_RELATIVE_PATH,
    sourceConfigSha256: hashBuffer(sourceConfig),
    sourceConfigBytes: sourceConfig.length,
    sourceAudioInputs: source.sourceAudioInputs,
    appleLoopsUsed: source.appleLoopsUsed,
    durationSeconds: source.reviewDurationSeconds,
    runtimeLoopDurationSeconds: source.runtimeLoopDurationSeconds,
    midiType: 1,
    ppq: source.ppq,
    tempoMicrosecondsPerQuarter: TEMPO_MICROSECONDS_PER_QUARTER,
    midiSha256: hashBuffer(midi),
    midiBytes: midi.length,
    automationSha256: hashBuffer(automation),
    automationBytes: automation.length,
    trackNames: TRACK_NAMES,
    trackCount: TRACK_NAMES.length,
    eventCounts: Object.fromEntries(tracks.map((track) => [track.name, track.events.length + 1])),
    sourceLicensePaths: {
      pianoInstrument: source.garageBand.pianoInstrument,
      pianoSamples: source.garageBand.pianoSamples,
      padPreset: source.garageBand.padPreset,
      dronePreset: source.garageBand.dronePreset,
      shimmerPreset: source.garageBand.shimmerPreset,
      reverbPreset: source.garageBand.reverbPreset,
    },
    statuses: REVIEW_STATUSES,
  };
  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const readme = Buffer.from(buildReadme(source));

  const midiPath = path.join(resolvedOutput, SOURCE_PACK_FILES.midi);
  const automationPath = path.join(resolvedOutput, SOURCE_PACK_FILES.automation);
  const manifestPath = path.join(resolvedOutput, SOURCE_PACK_FILES.manifest);
  const readmePath = path.join(resolvedOutput, SOURCE_PACK_FILES.readme);
  fs.writeFileSync(midiPath, midi);
  fs.writeFileSync(automationPath, automation);
  fs.writeFileSync(manifestPath, manifestBuffer);
  fs.writeFileSync(readmePath, readme);

  return {
    midiPath,
    automationPath,
    manifestPath,
    readmePath,
    manifest,
    summary: {
      sourceId: source.id,
      outputDir: resolvedOutput,
      files: SOURCE_PACK_FILES,
      midiSha256: manifest.midiSha256,
      automationSha256: manifest.automationSha256,
      sourceManifestSha256: hashBuffer(manifestBuffer),
    },
  };
}

module.exports = {
  TRACK_NAMES,
  REVIEW_STATUSES,
  secondsToTicks,
  loadCloudlightR3Source,
  validateCloudlightR3Source,
  encodeCloudlightR3Midi,
  writeCloudlightR3SourcePack,
};
