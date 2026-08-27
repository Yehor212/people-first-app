import { describe, expect, it } from "vitest";

import {
  APP_AUDIO_SW_CACHE_PATHS,
  isRuntimeAudioPath,
  RETIRED_RUNTIME_AUDIO_CACHE_NAMES,
  RUNTIME_AUDIO_CACHE_NAME,
  selectRetiredRuntimeAudioCaches,
} from "../runtimeAudioCache";
import { APP_AUDIO_ASSETS } from "../appAudioAssets";

describe("runtime audio cache contract", () => {
  it("moves changed audio bytes to a new cache namespace", () => {
    expect(RUNTIME_AUDIO_CACHE_NAME).toBe("zenflow-runtime-audio-v2");
    expect(RETIRED_RUNTIME_AUDIO_CACHE_NAMES).toEqual(["zenflow-runtime-audio"]);
    expect(RETIRED_RUNTIME_AUDIO_CACHE_NAMES).not.toContain(RUNTIME_AUDIO_CACHE_NAME);
  });

  it("selects only the exact retired audio cache and preserves unrelated caches", () => {
    expect(
      selectRetiredRuntimeAudioCaches([
        "zenflow-runtime-audio",
        "zenflow-runtime-audio-v1",
        "zenflow-runtime-audio-v2",
        "zenflow-runtime-assets",
        "third-party-cache",
      ]),
    ).toEqual(["zenflow-runtime-audio"]);
  });

  it("warms every opted-in app asset without eagerly downloading Cloudlight", () => {
    expect(APP_AUDIO_SW_CACHE_PATHS).toHaveLength(26);
    expect(new Set(APP_AUDIO_SW_CACHE_PATHS).size).toBe(APP_AUDIO_SW_CACHE_PATHS.length);
    expect(APP_AUDIO_SW_CACHE_PATHS).not.toContain("sounds/cloudlight-evening-loop.mp3");
    for (const asset of APP_AUDIO_ASSETS.filter((entry) => entry.warmCacheOnStartup)) {
      expect(APP_AUDIO_SW_CACHE_PATHS).toContain(asset.publicPath);
    }
    expect(APP_AUDIO_SW_CACHE_PATHS).toContain("sounds/soft-air-veil.mp3");
    expect(APP_AUDIO_SW_CACHE_PATHS).toContain("sounds/feedback/feedback-success.mp3");
    expect(APP_AUDIO_SW_CACHE_PATHS).toContain(
      "sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
    );
    expect(APP_AUDIO_SW_CACHE_PATHS).toContain(
      "sounds/hyperfocus/hyperfocus-wind-intense.mp3",
    );
  });

  it("keeps Cloudlight eligible for same-origin request-time audio caching", () => {
    expect(isRuntimeAudioPath("/sounds/cloudlight-evening-loop.mp3")).toBe(true);
    expect(
      isRuntimeAudioPath("/people-first-app/sounds/cloudlight-evening-loop.mp3"),
    ).toBe(true);
    expect(isRuntimeAudioPath("/people-first-app/sounds/future-local-audio.ogg", "audio")).toBe(
      true,
    );
    expect(isRuntimeAudioPath("/people-first-app/assets/cloudlight-evening-loop.mp3")).toBe(
      false,
    );
  });
});
