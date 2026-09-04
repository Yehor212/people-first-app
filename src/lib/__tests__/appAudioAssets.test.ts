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
  getAppAudioFeedbackEvent,
  getAppAudioFeedbackEventSrc,
  resolveAppAudioAssetSrc,
} from "../appAudioAssets";
import * as appAudioAssetsModule from "../appAudioAssets";

const expectedAssetIds = [
  "soft-air-veil",
  "cloudlight-evening-loop",
  "lantern-air",
  "rain-on-paper",
  "indigo-dusk",
  "quiet-courtyard",
  "moonlit-water",
  "cedar-mist",
  "glass-bell-dawn",
  "moss-garden",
  "after-rain",
  "orb-ambience",
  "diary-reflection-loop",
  "focus-forest",
  "focus-rain",
  "focus-ocean",
  "focus-fireplace",
  "focus-river",
  "focus-wind",
];

const expectedBackgroundMusicIds = [
  "cloudlight-evening-loop",
  "lantern-air",
  "rain-on-paper",
  "indigo-dusk",
  "quiet-courtyard",
  "moonlit-water",
  "cedar-mist",
  "glass-bell-dawn",
  "moss-garden",
  "after-rain",
] as const;

describe("app audio asset manifest", () => {
  it("registers the exact ten-master evening music collection", () => {
    const expectedIds = new Set<string>(expectedBackgroundMusicIds);
    const musicAssets = APP_AUDIO_ASSETS.filter((asset) => expectedIds.has(asset.id));

    expect(musicAssets.map((asset) => asset.id)).toEqual(expectedBackgroundMusicIds);
    expect(musicAssets).toHaveLength(10);
    expect(new Set(musicAssets.map((asset) => asset.publicPath)).size).toBe(10);
    expect(musicAssets.every((asset) => asset.family === "entry")).toBe(true);
    expect(musicAssets.every((asset) => asset.warmCacheOnStartup === false)).toBe(true);
  });

  it("advances the evening collection in a stable circular order", () => {
    const catalog = appAudioAssetsModule as typeof appAudioAssetsModule & {
      APP_BACKGROUND_MUSIC_COLLECTION?: ReadonlyArray<{ id: string }>;
      getNextBackgroundMusicAsset?: (id: string) => { id: string };
      normalizeBackgroundMusicAssetId?: (value: unknown) => string;
    };

    expect(catalog.APP_BACKGROUND_MUSIC_COLLECTION).toHaveLength(10);
    expect(catalog.getNextBackgroundMusicAsset).toEqual(expect.any(Function));
    expect(catalog.normalizeBackgroundMusicAssetId).toEqual(expect.any(Function));
    if (!catalog.getNextBackgroundMusicAsset || !catalog.normalizeBackgroundMusicAssetId) return;

    expect(catalog.getNextBackgroundMusicAsset("cloudlight-evening-loop").id).toBe("lantern-air");
    expect(catalog.getNextBackgroundMusicAsset("after-rain").id).toBe("cloudlight-evening-loop");
    expect(catalog.normalizeBackgroundMusicAssetId("missing")).toBe("cloudlight-evening-loop");
  });

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
      expect(typeof (asset as { warmCacheOnStartup?: unknown }).warmCacheOnStartup, asset.id).toBe(
        "boolean",
      );
    }
  });

  it("exposes base-url-safe source URLs for routed web, PWA, native, and desktop shells", () => {
    expect(resolveAppAudioAssetSrc("sounds/soft-rain-veil.mp3", "./")).toBe("/sounds/soft-rain-veil.mp3");
    expect(resolveAppAudioAssetSrc("/sounds/soft-rain-veil.mp3", "./")).toBe("/sounds/soft-rain-veil.mp3");
    expect(resolveAppAudioAssetSrc("sounds/soft-rain-veil.mp3", "/people-first-app/")).toBe(
      "/people-first-app/sounds/soft-rain-veil.mp3",
    );
    expect(getAppAudioAssetSrc("soft-air-veil")).toContain("/sounds/soft-air-veil.mp3");
    expect(getAppAudioAssetSrc("cloudlight-evening-loop")).toContain(
      "/sounds/cloudlight-evening-loop.mp3",
    );
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

  it("registers first-party feedback cues as local, scoped, offline-ready assets", () => {
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
      expect(event.startsOnUserGesture).toBe(true);
      expect(event.offlineStrategy).toBe("runtime-cache");
      expect(event.publicPath).toBe(`sounds/feedback/feedback-${event.id}.mp3`);
      expect(existsSync(join(process.cwd(), "public", event.publicPath)), event.id).toBe(true);
      expect(existsSync(join(process.cwd(), "docs", event.publicPath)), event.id).toBe(true);
      expect(event.src).toBe(resolveAppAudioAssetSrc(event.publicPath));
    }

    expect(getAppAudioFeedbackEvent("success")?.publicPath).toBe(
      "sounds/feedback/feedback-success.mp3",
    );
    expect(getAppAudioFeedbackEventSrc("milestone", "./")).toBe(
      "/sounds/feedback/feedback-milestone.mp3",
    );
    expect(getAppAudioFeedbackEventSrc("notification", "/people-first-app/")).toBe(
      "/people-first-app/sounds/feedback/feedback-notification.mp3",
    );
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
      "cloudlight-evening-loop",
      "lantern-air",
      "rain-on-paper",
      "indigo-dusk",
      "quiet-courtyard",
      "moonlit-water",
      "cedar-mist",
      "glass-bell-dawn",
      "moss-garden",
      "after-rain",
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

  it("keeps the long Cloudlight loop local and out of startup cache warming", () => {
    expect(getAppAudioAsset("cloudlight-evening-loop")).toMatchObject({
      family: "entry",
      publicPath: "sounds/cloudlight-evening-loop.mp3",
      startsOnUserGesture: true,
      respectsMasterVolume: true,
      warmCacheOnStartup: false,
      comfortTexture: "air",
      offlineStrategy: "runtime-cache",
      platforms: APP_AUDIO_PLATFORMS,
    });
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
