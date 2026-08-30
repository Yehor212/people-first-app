import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  APPROVED_HABIT_CELEBRATION_IDS,
  getHabitCelebrationAsset,
} from "../habitCelebrationAssets";

const sourceAssets = [
  ["drink-water", "src/assets/habit-icons/v2/drink-water/completion.tgs", "5fde1c49da6cbc405fdd28237254fc6acb07d79a39e7ba38ad31c768f9a4ac38", "src/assets/habit-icons/v2/drink-water/completion-first-frame.svg", "cbe3f30f1e3c55052a1be72c787b4697b903f21ef285e54aa901a0254e937ce2"],
  ["walk-distance", "src/assets/habit-icons/v2/walk-distance/completion.tgs", "5376a1b4e4ab900174fab284a300e3413db6ae10254d4992ec8c9920f2aa997f", "src/assets/habit-icons/v2/walk-distance/completion-first-frame.svg", "d30f50a1ff72ad695b1c5d1f55c9b05320a4e5758ac11a262a3a65966e78c83a"],
  ["meditate", "src/assets/habit-icons/v2/meditate/completion.tgs", "647952aeb200b76027cd8185e3780f6fc501e42cbe0323ea91395abca3d814f1", "src/assets/habit-icons/v2/meditate/completion-first-frame.svg", "9e8ac70f6008781f2601fc5b4e0b353573ddf0eb7cbdd2e4645765fa3ab56c74"],
  ["tidy-room", "src/assets/habit-icons/v2/tidy-room/completion.tgs", "f308f68449d1964d16866cdefc6ddd55935e13288f53fd064d10f81cf9bd5f1a", "src/assets/habit-icons/v2/tidy-room/completion-first-frame.svg", "fabfc6411fd603df24ad594b8fc5b84b6a7fbd6c4be50306bf6b3d920df76356"],
  ["quit-smoking", "src/assets/habit-icons/v2/quit-smoking/completion.tgs", "1cd1405cb69ea8ed1a821d7d5c2f7545400377d99d395f8f577858cc1585ca20", "src/assets/habit-icons/v2/quit-smoking/completion-first-frame.svg", "4c67da2d5d13cc87923399c2455ebdbe11b5421145dfd4323f589faa16b9f640"],
  ["journal-night", "src/assets/habit-icons/v2/journal/completion-night.tgs", "e83a865aa23eb9296b8958d3cee3939fd6561bdb21b2b13caa0424390c2a3475", "src/assets/habit-icons/v2/journal/completion-night-first-frame.svg", "bde248d650a0b33103dbf3bb6d3a26037bdb81bfd61ea168b5965dcdb475d07d"],
  ["journal-day", "src/assets/journal/save-ceremony/atelier-v12-3-day.tgs", "a55c998596f8210664d51f8eb51eb40a090dbc4dc76d8ea7109cdd30098d1170", "src/assets/journal/save-ceremony/atelier-v12-3-day-first-frame.svg", "a19eef5891ab135cc8ca22f3d2ac6f0a2da6aacf7a0e04576e5e220ef3fd9f6f"],
] as const;

function containsUnsupportedFeature(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsUnsupportedFeature);
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.ef) && record.ef.length > 0) return true;
  if (Array.isArray(record.masksProperties) && record.masksProperties.length > 0) return true;
  if (record.ty === 2 || record.ty === 5) return true;
  if (typeof record.x === "string" && record.x.trim()) return true;
  return Object.values(record).some(containsUnsupportedFeature);
}

describe("Android habit celebration TGS assets", () => {
  it("maps only the six user-approved habit meanings and gives Diary day/night variants", () => {
    expect([...APPROVED_HABIT_CELEBRATION_IDS].sort()).toEqual([
      "drink-water",
      "journal",
      "meditate",
      "quit-smoking",
      "tidy-room",
      "walk-distance",
    ]);
    expect(getHabitCelebrationAsset("drink-water")?.day).toContain("completion.tgs");
    expect(getHabitCelebrationAsset("walk-distance")?.day).toContain("completion.tgs");
    expect(getHabitCelebrationAsset("journal")?.day).toContain("atelier-v12-3-day.tgs");
    expect(getHabitCelebrationAsset("journal")?.night).toContain("completion-night.tgs");
    expect(getHabitCelebrationAsset("drink-water")?.poster.day).toContain(
      "completion-first-frame.svg"
    );
    expect(getHabitCelebrationAsset("journal")?.poster.day).toContain(
      "atelier-v12-3-day-first-frame.svg"
    );
    expect(getHabitCelebrationAsset("journal")?.poster.night).toContain(
      "completion-night-first-frame.svg"
    );
    expect(getHabitCelebrationAsset("read")).toBeUndefined();
  });

  it.each(sourceAssets)("ships a hash-bound vector frame-0 poster for %s", (name, _tgsPath, _tgsSha256, posterSourcePath, posterSha256) => {
    const id = name === "journal-day" || name === "journal-night" ? "journal" : name;
    const asset = getHabitCelebrationAsset(id);
    const variant = name === "journal-night" ? "night" : "day";
    const posterPath = asset?.poster[variant];
    const posterSource = readFileSync(posterSourcePath, "utf8");

    expect(posterPath).toMatch(/first-frame\.svg/);
    expect(asset?.posterSha256[variant]).toBe(posterSha256);
    expect(createHash("sha256").update(posterSource).digest("hex")).toBe(posterSha256);
    expect(posterSource).toContain('viewBox="0 0 512 512"');
    expect(posterSource).not.toMatch(/<script|<foreignObject|<image|href="https?:/i);
  });

  it.each(sourceAssets)("keeps %s hash-bound and Telegram-safe", (_name, path, sha256) => {
    const compressed = readFileSync(path);
    const animation = JSON.parse(gunzipSync(compressed).toString("utf8")) as {
      w?: number;
      h?: number;
      fr?: number;
      ip?: number;
      op?: number;
      layers?: unknown[];
      assets?: Array<Record<string, unknown>>;
      chars?: unknown;
      fonts?: unknown;
    };

    expect(createHash("sha256").update(compressed).digest("hex")).toBe(sha256);
    expect(compressed.byteLength).toBeLessThanOrEqual(64 * 1024);
    expect(animation).toMatchObject({ w: 512, h: 512, fr: 60, ip: 0, op: 180 });
    expect(animation.layers?.length).toBeGreaterThan(0);
    expect(animation.chars).toBeUndefined();
    expect(animation.fonts).toBeUndefined();
    expect(animation.assets?.some((asset) => typeof asset.p === "string")).not.toBe(true);
    expect(containsUnsupportedFeature(animation)).toBe(false);
  });
});
