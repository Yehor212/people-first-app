import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_AUDIO_ACTION_EVENTS,
  APP_AUDIO_ASSETS,
  APP_AUDIO_FEEDBACK_EVENTS,
  APP_AUDIO_NON_HYPERFOCUS_ASSET_IDS,
  APP_AUDIO_FORBIDDEN_ACTIONS,
  APP_AUDIO_PLATFORMS,
  getAppAudioAsset,
  getAppAudioAssetSrc,
  resolveAppAudioAssetSrc,
} from "../appAudioAssets";

const expectedAssetIds = [
  "soft-air-veil",
  "orb-ambience",
  "diary-reflection-loop",
  "focus-forest",
  "focus-rain",
  "focus-ocean",
  "focus-fireplace",
  "focus-river",
  "focus-wind",
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
      expect((asset as { comfortTexture?: string }).comfortTexture, asset.id).toMatch(
        /air|water|rain|forest|fire|river|wind/,
      );
      expect((asset as { offlineStrategy?: string }).offlineStrategy, asset.id).toBe("runtime-cache");
    }
  });

  it("exposes base-url-safe source URLs for routed web, PWA, native, and desktop shells", () => {
    expect(resolveAppAudioAssetSrc("sounds/soft-rain-veil.mp3", "./")).toBe("/sounds/soft-rain-veil.mp3");
    expect(resolveAppAudioAssetSrc("/sounds/soft-rain-veil.mp3", "./")).toBe("/sounds/soft-rain-veil.mp3");
    expect(resolveAppAudioAssetSrc("sounds/soft-rain-veil.mp3", "/people-first-app/")).toBe(
      "/people-first-app/sounds/soft-rain-veil.mp3",
    );
    expect(getAppAudioAssetSrc("soft-air-veil")).toContain("/sounds/soft-air-veil.mp3");
    expect(getAppAudioAssetSrc("orb-ambience")).toContain("/sounds/gentle-water-bed.mp3");
    expect(getAppAudioAssetSrc("diary-reflection-loop")).toContain("/sounds/soft-rain-veil.mp3");
    expect(getAppAudioAsset("focus-forest")?.publicPath).toBe("sounds/hyperfocus/hyperfocus-forest-deep.mp3");
    expect(getAppAudioAsset("focus-rain")?.publicPath).toBe("sounds/hyperfocus/hyperfocus-rain-deep.mp3");
    expect(getAppAudioAsset("focus-ocean")?.publicPath).toBe("sounds/hyperfocus/hyperfocus-ocean-deep.mp3");
    expect(getAppAudioAsset("focus-fireplace")?.publicPath).toBe("sounds/hyperfocus/hyperfocus-fireplace-deep.mp3");
    expect(getAppAudioAsset("focus-river")?.publicPath).toBe("sounds/hyperfocus/hyperfocus-river-deep.mp3");
    expect(getAppAudioAsset("focus-wind")?.publicPath).toBe("sounds/hyperfocus/hyperfocus-wind-deep.mp3");
    expect(APP_AUDIO_ASSETS.map((asset) => asset.id)).not.toContain("focus-cafe");
  });

  it("keeps routed ambience consumers wired to the shared manifest helper", () => {
    const orbSource = readFileSync(
      join(process.cwd(), "src/pages/nav-v2/OrbPage.tsx"),
      "utf8",
    );
    const diarySource = readFileSync(
      join(process.cwd(), "src/features/journal/JournalAmbienceSetting.tsx"),
      "utf8",
    );

    expect(orbSource).toContain('getAppAudioAssetSrc("orb-ambience")');
    expect(orbSource).not.toContain("sounds/polished-stone-and-paper.mp3");
    expect(diarySource).toContain('getAppAudioAssetSrc("diary-reflection-loop")');
    expect(diarySource).not.toContain("sounds/v2-diary-reflection-loop.mp3");
  });

  it("presents only the approved Hyperfocus V2 families as current focus assets", () => {
    const focusAssets = APP_AUDIO_ASSETS.filter((asset) => asset.family === "focus");

    expect(focusAssets.map((asset) => asset.id)).toEqual([
      "focus-forest",
      "focus-rain",
      "focus-ocean",
      "focus-fireplace",
      "focus-river",
      "focus-wind",
    ]);
    expect(focusAssets.every((asset) => asset.publicPath.startsWith("sounds/hyperfocus/"))).toBe(true);
    expect(focusAssets.some((asset) => asset.publicPath.includes("cafe"))).toBe(false);
  });

  it("documents generated feedback sounds separately from shipped MP3 assets", () => {
    expect(APP_AUDIO_FEEDBACK_EVENTS.map((event) => event.id)).toEqual([
      "success",
      "complete",
      "streak",
      "milestone",
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
      "majorProgressMilestone",
      "notification",
    ]);

    for (const event of APP_AUDIO_ACTION_EVENTS) {
      expect(event.platforms, event.id).toEqual(APP_AUDIO_PLATFORMS);
      expect(event.respectsMasterVolume, event.id).toBe(true);
      expect(event.startsOnUserGesture, event.id).toBe(true);
      expect(["success", "complete", "streak", "milestone", "notification"]).toContain(event.soundType);
    }

    expect(APP_AUDIO_ACTION_EVENTS.some((event) => event.id.toLowerCase().includes("tap"))).toBe(false);
    expect(APP_AUDIO_ACTION_EVENTS.map((event) => event.id)).not.toContain("levelUp");
    expect(APP_AUDIO_ACTION_EVENTS.some((event) => String(event.soundType) === "levelUp")).toBe(false);
    expect(
      APP_AUDIO_ACTION_EVENTS.find((event) => event.id === "majorProgressMilestone")?.rationale,
    ).toContain("does not introduce current V2 XP behavior");
  });

  it("separates non-Hyperfocus ambience from the Hyperfocus focus library", () => {
    expect(APP_AUDIO_NON_HYPERFOCUS_ASSET_IDS).toEqual([
      "soft-air-veil",
      "orb-ambience",
      "diary-reflection-loop",
    ]);
    for (const id of APP_AUDIO_NON_HYPERFOCUS_ASSET_IDS) {
      const asset = getAppAudioAsset(id);
      expect(asset?.family, id).not.toBe("focus");
      expect(asset?.publicPath, id).not.toContain("hyperfocus/");
      expect(asset?.startsOnUserGesture, id).toBe(true);
      expect(asset?.respectsMasterVolume, id).toBe(true);
    }
  });

  it("keeps every approved action sound paired with non-audio feedback and a calm trigger policy", () => {
    for (const event of APP_AUDIO_ACTION_EVENTS) {
      expect(event.nonAudioFeedback, event.id).toMatch(/visual/);
      expect(event.allowedTrigger, event.id).toMatch(/completion|milestone|preview/);
      expect(event.rationale, event.id).not.toMatch(/tap|navigation|picker/i);
      expect(event.startsOnUserGesture, event.id).toBe(true);
      expect(event.respectsMasterVolume, event.id).toBe(true);
    }
  });

  it("codifies routine interactions that must stay silent", () => {
    expect(APP_AUDIO_FORBIDDEN_ACTIONS.map((event) => event.id)).toEqual([
      "routineTap",
      "tabChange",
      "pickerMovement",
      "drawerOpen",
      "validationError",
    ]);
    for (const event of APP_AUDIO_FORBIDDEN_ACTIONS) {
      expect(event.soundType, event.id).toBeNull();
      expect(event.fallbackFeedback, event.id).toMatch(/visual|haptic/);
      expect(event.reason, event.id).not.toHaveLength(0);
    }
  });
});
