import { describe, expect, it } from "vitest";

import {
  APP_AUDIO_SW_CACHE_PATHS,
  RETIRED_RUNTIME_AUDIO_CACHE_NAMES,
  RUNTIME_AUDIO_CACHE_NAME,
  selectRetiredRuntimeAudioCaches,
} from "../runtimeAudioCache";

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

  it("builds one unique warm-cache path for every shipped app-audio asset", () => {
    expect(APP_AUDIO_SW_CACHE_PATHS).toHaveLength(26);
    expect(new Set(APP_AUDIO_SW_CACHE_PATHS).size).toBe(APP_AUDIO_SW_CACHE_PATHS.length);
    expect(APP_AUDIO_SW_CACHE_PATHS).toContain("sounds/soft-air-veil.mp3");
    expect(APP_AUDIO_SW_CACHE_PATHS).toContain("sounds/feedback/feedback-success.mp3");
    expect(APP_AUDIO_SW_CACHE_PATHS).toContain(
      "sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
    );
    expect(APP_AUDIO_SW_CACHE_PATHS).toContain(
      "sounds/hyperfocus/hyperfocus-wind-intense.mp3",
    );
  });
});
