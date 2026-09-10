import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_BACKGROUND_MUSIC_COLLECTION,
  normalizeBackgroundMusicAssetId,
} from "../appAudioAssets";
import { APP_AUDIO_INTENT_CACHE_PATHS, APP_AUDIO_SW_CACHE_PATHS } from "../runtimeAudioCache";

// Independent receipt: owner-selected R7 review MP3s, created 2026-08-28.
// These digests must not be regenerated from the runtime catalog under test.
const originals = [
  [
    "r7-shoji-rain",
    "Shoji Rain",
    6721964,
    "f49b48fcdff7dada76be14de52a1213f03ce8e277a74a10e55136031a36af71a",
  ],
  [
    "r7-moss-garden",
    "Moss Garden",
    6642284,
    "ea4578bef4a22af13afbe2f0c7d44f715cf7b37e3df675c35375fee5adf3029a",
  ],
  [
    "r7-lantern-reflection",
    "Lantern Reflection",
    6802604,
    "9cdbd5cc947cd87a580a82a5cccf951b4a59e4fe359f9981073f6fba303bb55d",
  ],
  [
    "r7-snow-over-cedar",
    "Snow Over Cedar",
    6562604,
    "91b2b1254e4a2e95176a1b54bd99e722ee2a1ccff5384ed23e9c8ecf1cb7a5fd",
  ],
  [
    "r7-paper-cranes",
    "Paper Cranes",
    6721964,
    "7602f5ff552b83f118be3c2d34c452dddc679472f415bfca0486c6b2fe949d36",
  ],
  [
    "r7-tea-room-dawn",
    "Tea Room Dawn",
    6642284,
    "f94cde5ef5a319678f63c49723dbf8505e7122a88d3fd6756ae5679c7dd7a044",
  ],
  [
    "r7-river-stones",
    "River Stones",
    6802604,
    "7ca1c3d4a232b483caeb456e1fe5a552e571ce4916b935df3060c68805900e0e",
  ],
  [
    "r7-camellia-evening",
    "Camellia Evening",
    6601964,
    "b0badde8553553e50e67b8b65e359c67d3a6424a67c0346052bf1f1c4f9fb35f",
  ],
  [
    "r7-temple-path",
    "Temple Path",
    6721964,
    "51298b29ceaece2e2f96e8a0c5bbe7706e6c1e1d642d754afa270d76e95f7acf",
  ],
  [
    "r7-home-beneath-clouds",
    "Home Beneath Clouds",
    6802604,
    "f47aeab0fff78f27003ed3f1b91b0477d88dd28b4039aaf495f4b357c5bd81cb",
  ],
] as const;

describe("owner-selected R7 music restoration", () => {
  it("plays the exact ten originals in their review order, not ten substitute pieces", () => {
    expect(APP_BACKGROUND_MUSIC_COLLECTION.map((asset) => [asset.id, asset.fallbackLabel])).toEqual(
      originals.map(([id, title]) => [id, title])
    );
    for (const [id, , bytes, sha256] of originals) {
      const asset = APP_BACKGROUND_MUSIC_COLLECTION.find((candidate) => candidate.id === id);
      expect(asset?.publicPath).toBe(`sounds/music/${id}.mp3`);
      for (const root of ["public", "docs"]) {
        const mp3 = readFileSync(join(process.cwd(), root, `sounds/music/${id}.mp3`));
        expect(mp3.length, `${root}/${id}`).toBe(bytes);
        expect(createHash("sha256").update(mp3).digest("hex"), `${root}/${id}`).toBe(sha256);
      }
    }
  });

  it("ships only the originals and binds all ten to intent-only caching", () => {
    const paths = originals.map(([id]) => `sounds/music/${id}.mp3`);
    expect([...APP_AUDIO_INTENT_CACHE_PATHS].sort()).toEqual([...paths].sort());
    for (const root of ["public", "docs"]) {
      const files = readdirSync(join(process.cwd(), root, "sounds/music"));
      expect(files.sort()).toEqual(originals.map(([id]) => `${id}.mp3`).sort());
    }
    expect(APP_AUDIO_SW_CACHE_PATHS.some((path) => paths.includes(path))).toBe(false);
  });

  it("resumes a removed collection cursor at the first original without changing the opt-in", () => {
    for (const oldCursor of ["cloudlight-evening-loop", "moss-garden", "lantern-air", null]) {
      expect(normalizeBackgroundMusicAssetId(oldCursor)).toBe("r7-shoji-rain");
    }
  });
});
