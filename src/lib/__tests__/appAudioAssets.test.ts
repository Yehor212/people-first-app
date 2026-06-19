import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_AUDIO_ACTION_EVENTS,
  APP_AUDIO_ASSETS,
  APP_AUDIO_FEEDBACK_EVENTS,
  APP_AUDIO_PLATFORMS,
  getAppAudioAsset,
  getAppAudioAssetSrc,
} from "../appAudioAssets";

const expectedAssetIds = [
  "measured-breath",
  "orb-ambience",
  "diary-reflection-loop",
  "focus-underwater",
  "focus-thunderstorm",
  "focus-ocean",
  "focus-river",
  "focus-cafe",
  "focus-fireplace",
];

describe("app audio asset manifest", () => {
  it("registers every shipped app-owned audio file once", () => {
    const ids = APP_AUDIO_ASSETS.map((asset) => asset.id);

    expect(ids).toEqual(expectedAssetIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every audio asset local, tap-started, and available to every target platform", () => {
    for (const asset of APP_AUDIO_ASSETS) {
      expect(asset.publicPath, asset.id).toMatch(/^sounds\/.+\.mp3$/);
      expect(existsSync(join(process.cwd(), "public", asset.publicPath)), asset.id).toBe(true);
      expect(asset.platforms, asset.id).toEqual(APP_AUDIO_PLATFORMS);
      expect(asset.startsOnUserGesture, asset.id).toBe(true);
      expect(asset.respectsMasterVolume, asset.id).toBe(true);
    }
  });

  it("exposes base-url-safe source URLs for routed web, PWA, native, and desktop shells", () => {
    expect(getAppAudioAssetSrc("measured-breath")).toContain("/sounds/measured-breath.mp3");
    expect(getAppAudioAssetSrc("orb-ambience")).toContain("/sounds/polished-stone-and-paper.mp3");
    expect(getAppAudioAssetSrc("diary-reflection-loop")).toContain("/sounds/v2-diary-reflection-loop.mp3");
    expect(getAppAudioAsset("focus-cafe")?.publicPath).toBe("sounds/cafe-noise-32940.mp3");
  });

  it("keeps routed ambience consumers wired to the shared manifest helper", () => {
    const orbSource = readFileSync(
      join(process.cwd(), "src/pages/nav-v2/OrbPage.tsx"),
      "utf8",
    );
    const diarySource = readFileSync(
      join(process.cwd(), "src/pages/nav-v2/DiaryPage.tsx"),
      "utf8",
    );

    expect(orbSource).toContain('getAppAudioAssetSrc("orb-ambience")');
    expect(orbSource).not.toContain("sounds/polished-stone-and-paper.mp3");
    expect(diarySource).toContain('getAppAudioAssetSrc("diary-reflection-loop")');
    expect(diarySource).not.toContain("sounds/v2-diary-reflection-loop.mp3");
  });

  it("documents generated feedback sounds separately from shipped MP3 assets", () => {
    expect(APP_AUDIO_FEEDBACK_EVENTS.map((event) => event.id)).toEqual([
      "success",
      "complete",
      "streak",
      "levelUp",
      "notification",
    ]);
    for (const event of APP_AUDIO_FEEDBACK_EVENTS) {
      expect(event.platforms).toEqual(APP_AUDIO_PLATFORMS);
      expect(event.respectsMasterVolume).toBe(true);
    }
  });

  it("documents the governed action sound map without adding tap noise", () => {
    expect(APP_AUDIO_ACTION_EVENTS.map((event) => event.id)).toEqual([
      "moodSaved",
      "habitCompleted",
      "journalSaved",
      "focusCompleted",
      "gratitudeSaved",
      "breathingCompleted",
      "achievementUnlocked",
      "streakMilestone",
      "levelUp",
      "notification",
    ]);

    for (const event of APP_AUDIO_ACTION_EVENTS) {
      expect(event.platforms, event.id).toEqual(APP_AUDIO_PLATFORMS);
      expect(event.respectsMasterVolume, event.id).toBe(true);
      expect(event.startsOnUserGesture, event.id).toBe(true);
      expect(["success", "complete", "streak", "levelUp", "notification"]).toContain(event.soundType);
    }

    expect(APP_AUDIO_ACTION_EVENTS.some((event) => event.id.toLowerCase().includes("tap"))).toBe(false);
  });
});
