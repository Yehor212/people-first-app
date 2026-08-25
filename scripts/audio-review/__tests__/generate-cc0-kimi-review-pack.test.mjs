import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  buildSourceLoop,
  decodeAudio,
  probeAudio,
} from "../cc0-kimi-audio-ffmpeg.mjs";
import { measureDecoded } from "../cc0-kimi-audio-core.mjs";

const modulePath = path.resolve(
  "scripts/audio-review/generate-cc0-kimi-review-pack.mjs"
);

async function loadGenerator() {
  return import(`${pathToFileURL(modulePath).href}?test=${Date.now()}-${Math.random()}`);
}

function pcmHash(audio) {
  return crypto
    .createHash("sha256")
    .update(Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength))
    .digest("hex");
}

test("generator declares the exact 26-file role inventory", async () => {
  assert.equal(fs.existsSync(modulePath), true);
  const generator = await loadGenerator();

  assert.equal(generator.STATUS, "SOURCE_RIGHTS_DOCUMENTED_REVIEW_ONLY");
  assert.equal(generator.EXPECTED_FILE_NAMES.length, 26);
  assert.equal(generator.ASSET_DEFINITIONS.length, 26);
  assert.deepEqual(
    generator.ASSET_DEFINITIONS.map((definition) => definition.fileName),
    generator.EXPECTED_FILE_NAMES
  );

  assert.equal(
    generator.ASSET_DEFINITIONS.filter(
      (definition) => definition.sourceType === "CC0-derived-field-recording"
    ).length,
    20
  );
  assert.equal(
    generator.ASSET_DEFINITIONS.filter(
      (definition) =>
        definition.sourceType === "first-party-deterministic-procedural-synthesis"
    ).length,
    6
  );
});

test("every field-recording definition is bound to an official CC0 source and a valid source span", async () => {
  const generator = await loadGenerator();
  const sourceEntries = Object.entries(generator.SOURCE_MANIFEST);
  assert.equal(sourceEntries.length, 17);

  for (const [key, source] of sourceEntries) {
    assert.match(key, /^[A-Za-z][A-Za-z0-9]+$/);
    assert.equal(source.license, "CC0-1.0 / public-domain equivalent");
    assert.equal(source.licenseUrl, "https://bigsoundbank.com/licenses.html");
    assert.match(source.pageUrl, /^https:\/\/bigsoundbank\.com\/[a-z0-9-]+\.html$/);
    assert.equal(
      source.mp3Url,
      `https://bigsoundbank.com/UPLOAD/mp3/${String(source.soundNumber).padStart(4, "0")}.mp3`
    );
    assert.ok(Number.isInteger(source.durationSeconds) && source.durationSeconds >= 32);
    assert.ok(source.author.length > 0);
  }

  const rainSoft = generator.ASSET_DEFINITIONS.find((candidate) => candidate.id === "rain:soft");
  assert.ok(rainSoft);
  assert.equal(rainSoft.sourceStartSeconds, 0);
  assert.equal(rainSoft.overlapSeconds, 0.5);
  const rainDeep = generator.ASSET_DEFINITIONS.find((candidate) => candidate.id === "rain:deep");
  assert.ok(rainDeep);
  assert.equal(rainDeep.sourceStartSeconds, 30);
  assert.equal(rainDeep.overlapSeconds, 1);

  for (const definition of generator.ASSET_DEFINITIONS.filter(
    (candidate) => candidate.sourceType === "CC0-derived-field-recording"
  )) {
    const source = generator.SOURCE_MANIFEST[definition.sourceKey];
    assert.ok(source, definition.id);
    assert.ok(definition.sourceStartSeconds >= 0, definition.id);
    assert.ok(definition.overlapSeconds > 0, definition.id);
    assert.ok(
      definition.sourceStartSeconds +
        definition.durationSeconds +
        definition.overlapSeconds <=
        source.durationSeconds,
      `${definition.id} exceeds source ${definition.sourceKey}`
    );
  }
});

test("first-party procedural PCM is deterministic and fixed to reviewed hashes", async () => {
  const generator = await loadGenerator();
  const expected = new Map([
    ["soft-air-veil", "d6281c6f91ac7290b537aa86e1e0338015ee3fd58368786dfb9ca42643e91700"],
    ["feedback-success", "5f10b28e4d40d86baa7b088c0652bd8b980060d2039a860650bdf308e77f5874"],
  ]);

  for (const [id, hash] of expected) {
    const definition = generator.ASSET_DEFINITIONS.find((candidate) => candidate.id === id);
    assert.ok(definition, id);
    assert.equal(pcmHash(generator.renderFirstPartyAsset(definition)), hash, id);
  }
});

test("generator modules are isolated from runtime audio paths", () => {
  const sources = [
    modulePath,
    path.resolve("scripts/audio-review/cc0-kimi-audio-config.mjs"),
    path.resolve("scripts/audio-review/cc0-kimi-audio-core.mjs"),
    path.resolve("scripts/audio-review/cc0-kimi-audio-ffmpeg.mjs"),
  ].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  for (const forbidden of [
    "public/sounds",
    "docs/sounds",
    "android/app/src/main/assets",
    "ios/App/App/public",
    "src-tauri",
    "src/sw.ts",
  ]) {
    assert.equal(sources.includes(forbidden), false, forbidden);
  }
});

test("source-loop mastering preserves the exact 30-second decoded contract", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "zenflow-cc0-loop-"));
  const source = path.join(temporary, "source.mp3");
  const output = path.join(temporary, "output.mp3");
  try {
    const generated = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "anoisesrc=color=pink:amplitude=0.2:sample_rate=48000:d=40",
        "-filter_complex",
        "[0:a]asplit=2[left][right];[right]adelay=7|7[delayed];[left][delayed]amerge=inputs=2[stereo]",
        "-map",
        "[stereo]",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "192k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-y",
        source,
      ],
      { encoding: "utf8" }
    );
    assert.equal(generated.status, 0, generated.stderr);

    buildSourceLoop({
      definition: {
        id: "forest:soft",
        fileName: "hyperfocus-forest-soft.mp3",
        category: "hyperfocus",
        sourceKey: "synthetic-test-source",
        durationSeconds: 30,
        overlapSeconds: 1,
        sourceStartSeconds: 2,
        targetLoudnessLufs: -34,
        truePeakDbfs: -3.5,
        filters: "highpass=f=70,lowpass=f=6800,equalizer=f=220:t=q:w=1.1:g=-1.5",
        looped: true,
      },
      sourceFile: source,
      outputFile: output,
      ffmpeg: "ffmpeg",
    });

    const probe = probeAudio(output, "ffprobe");
    const metrics = measureDecoded(decodeAudio(output, "ffmpeg"));
    assert.equal(Number(probe.streams[0].sample_rate), 48_000);
    assert.equal(Number(probe.streams[0].channels), 2);
    assert.ok(
      Math.abs(metrics.durationSeconds - 30) <= 0.16,
      `decoded duration was ${metrics.durationSeconds}`
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
