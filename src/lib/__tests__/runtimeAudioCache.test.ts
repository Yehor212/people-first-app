import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import * as runtimeAudioCacheModule from "../runtimeAudioCache";

import {
  APP_AUDIO_SW_CACHE_PATHS,
  isRuntimeAudioPath,
  RETIRED_RUNTIME_AUDIO_CACHE_NAMES,
  RUNTIME_AUDIO_CACHE_NAME,
  selectRetiredRuntimeAudioCaches,
} from "../runtimeAudioCache";
import { APP_AUDIO_ASSETS } from "../appAudioAssets";

const shojiRainBytes = new Uint8Array(readFileSync("public/sounds/music/r7-shoji-rain.mp3"));

function makeValidR7Response(): Response {
  return new Response(shojiRainBytes, {
    status: 200,
    headers: {
      "content-length": String(shojiRainBytes.byteLength),
      "content-type": "audio/mpeg",
    },
  });
}

describe("runtime audio cache contract", () => {
  it.each(runtimeAudioCacheModule.APP_AUDIO_INTENT_CACHE_PATHS)(
    "verifies the complete original bytes before admitting %s",
    async (publicPath) => {
      const bytes = new Uint8Array(readFileSync(`public/${publicPath}`));
      const put = vi.fn();
      const open = vi.fn().mockResolvedValue({ match: vi.fn(), delete: vi.fn(), put });
      await expect(
        runtimeAudioCacheModule.cacheRuntimeAudioOnIntent(publicPath, {
          cacheStorage: { open },
          fetcher: vi.fn().mockResolvedValue(
            new Response(bytes, {
              status: 200,
              headers: { "content-type": "audio/mpeg" },
            })
          ),
          scope: "https://example.test/people-first-app/",
        })
      ).resolves.toBe(true);
      expect(put).toHaveBeenCalledTimes(1);
    }
  );

  it.each(["changed-byte", "partial-206"])(
    "rejects %s music without caching it",
    async (defect) => {
      const bytes = new Uint8Array(shojiRainBytes);
      if (defect === "changed-byte") bytes[100] ^= 1;
      const put = vi.fn();
      const open = vi.fn().mockResolvedValue({ match: vi.fn(), delete: vi.fn(), put });
      await expect(
        runtimeAudioCacheModule.cacheRuntimeAudioOnIntent("sounds/music/r7-shoji-rain.mp3", {
          cacheStorage: { open },
          fetcher: vi.fn().mockResolvedValue(
            new Response(bytes, {
              status: defect === "partial-206" ? 206 : 200,
              headers: { "content-type": "audio/mpeg", "content-length": String(bytes.length) },
            })
          ),
          scope: "https://example.test/people-first-app/",
        })
      ).rejects.toThrow();
      expect(put).not.toHaveBeenCalled();
    }
  );

  it("admits all ten music masters only through request-time integrity caching", () => {
    const intentPaths = (
      runtimeAudioCacheModule as typeof runtimeAudioCacheModule & {
        APP_AUDIO_INTENT_CACHE_PATHS?: readonly string[];
      }
    ).APP_AUDIO_INTENT_CACHE_PATHS;

    expect(intentPaths).toHaveLength(10);
    expect(intentPaths).toContain("sounds/music/r7-shoji-rain.mp3");
    expect(intentPaths).toContain("sounds/music/r7-home-beneath-clouds.mp3");
    expect(new Set(intentPaths).size).toBe(10);
    for (const path of intentPaths ?? []) {
      expect(APP_AUDIO_SW_CACHE_PATHS).not.toContain(path);
    }
  });

  it("moves changed audio bytes to a new cache namespace", () => {
    expect(RUNTIME_AUDIO_CACHE_NAME).toBe("zenflow-runtime-audio-v5");
    expect(RETIRED_RUNTIME_AUDIO_CACHE_NAMES).toEqual([
      "zenflow-runtime-audio",
      "zenflow-runtime-audio-v2",
      "zenflow-runtime-audio-v3",
      "zenflow-runtime-audio-v4",
    ]);
    expect(RETIRED_RUNTIME_AUDIO_CACHE_NAMES).not.toContain(RUNTIME_AUDIO_CACHE_NAME);
  });

  it("selects only the exact retired audio cache and preserves unrelated caches", () => {
    expect(
      selectRetiredRuntimeAudioCaches([
        "zenflow-runtime-audio",
        "zenflow-runtime-audio-v1",
        "zenflow-runtime-audio-v2",
        "zenflow-runtime-audio-v3",
        "zenflow-runtime-audio-v4",
        "zenflow-runtime-audio-v5",
        "zenflow-runtime-assets",
        "third-party-cache",
      ])
    ).toEqual([
      "zenflow-runtime-audio",
      "zenflow-runtime-audio-v2",
      "zenflow-runtime-audio-v3",
      "zenflow-runtime-audio-v4",
    ]);
  });

  it("warms every opted-in app asset without eagerly downloading Shoji Rain", () => {
    expect(APP_AUDIO_SW_CACHE_PATHS).toHaveLength(26);
    expect(new Set(APP_AUDIO_SW_CACHE_PATHS).size).toBe(APP_AUDIO_SW_CACHE_PATHS.length);
    expect(APP_AUDIO_SW_CACHE_PATHS).not.toContain("sounds/music/r7-shoji-rain.mp3");
    for (const asset of APP_AUDIO_ASSETS.filter((entry) => entry.warmCacheOnStartup)) {
      expect(APP_AUDIO_SW_CACHE_PATHS).toContain(asset.publicPath);
    }
    expect(APP_AUDIO_SW_CACHE_PATHS).toContain("sounds/soft-air-veil.mp3");
    expect(APP_AUDIO_SW_CACHE_PATHS).toContain("sounds/feedback/feedback-success.mp3");
    expect(APP_AUDIO_SW_CACHE_PATHS).toContain("sounds/hyperfocus/hyperfocus-fireplace-soft.mp3");
    expect(APP_AUDIO_SW_CACHE_PATHS).toContain("sounds/hyperfocus/hyperfocus-wind-intense.mp3");
  });

  it("keeps Shoji Rain eligible for same-origin request-time audio caching", () => {
    expect(isRuntimeAudioPath("/sounds/music/r7-shoji-rain.mp3")).toBe(true);
    expect(isRuntimeAudioPath("/people-first-app/sounds/music/r7-shoji-rain.mp3")).toBe(true);
    expect(isRuntimeAudioPath("/people-first-app/sounds/future-local-audio.ogg", "audio")).toBe(
      true
    );
    expect(isRuntimeAudioPath("/people-first-app/assets/r7-shoji-rain.mp3")).toBe(false);
  });

  it("requests an exact Shoji Rain full-body cache fill only after explicit intent", async () => {
    const requestRuntimeAudioCacheOnIntent = (
      runtimeAudioCacheModule as {
        requestRuntimeAudioCacheOnIntent?: (
          publicPath: string,
          serviceWorker: {
            controller: { postMessage: (message: unknown) => void } | null;
            ready: Promise<{ active: { postMessage: (message: unknown) => void } | null }>;
          }
        ) => Promise<boolean>;
      }
    ).requestRuntimeAudioCacheOnIntent;
    expect(requestRuntimeAudioCacheOnIntent).toEqual(expect.any(Function));
    if (!requestRuntimeAudioCacheOnIntent) return;

    const postMessage = vi.fn();
    const serviceWorker = {
      controller: { postMessage },
      ready: Promise.resolve({ active: { postMessage } }),
    };

    await expect(
      requestRuntimeAudioCacheOnIntent("sounds/music/r7-shoji-rain.mp3", serviceWorker)
    ).resolves.toBe(true);
    expect(postMessage).toHaveBeenCalledWith({
      type: "CACHE_RUNTIME_AUDIO",
      publicPath: "sounds/music/r7-shoji-rain.mp3",
    });

    postMessage.mockClear();
    await expect(
      requestRuntimeAudioCacheOnIntent("sounds/soft-air-veil.mp3", serviceWorker)
    ).resolves.toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("fills the runtime cache from a full 200 request without carrying a Range header", async () => {
    const cacheRuntimeAudioOnIntent = (
      runtimeAudioCacheModule as {
        cacheRuntimeAudioOnIntent?: (
          publicPath: string,
          environment: {
            cacheStorage: {
              open: (name: string) => Promise<{
                delete: typeof remove;
                match: typeof match;
                put: typeof put;
              }>;
            };
            fetcher: (request: Request) => Promise<Response>;
            scope: string;
          }
        ) => Promise<boolean>;
      }
    ).cacheRuntimeAudioOnIntent;
    expect(cacheRuntimeAudioOnIntent).toEqual(expect.any(Function));
    if (!cacheRuntimeAudioOnIntent) return;

    const match = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(true);
    const put = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue({ delete: remove, match, put });
    const fetcher = vi.fn(async (request: Request) => {
      expect(request.url).toBe(
        "https://example.test/people-first-app/sounds/music/r7-shoji-rain.mp3"
      );
      expect(request.headers.get("Range")).toBeNull();
      return makeValidR7Response();
    });

    await expect(
      cacheRuntimeAudioOnIntent("sounds/music/r7-shoji-rain.mp3", {
        cacheStorage: { open },
        fetcher,
        scope: "https://example.test/people-first-app/",
      })
    ).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith(RUNTIME_AUDIO_CACHE_NAME);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(expect.any(Request), expect.objectContaining({ status: 200 }));
  });

  it("rejects a same-origin 200 response whose MIME, size, or hash does not match Shoji Rain", async () => {
    const cacheRuntimeAudioOnIntent = (
      runtimeAudioCacheModule as {
        cacheRuntimeAudioOnIntent?: (
          publicPath: string,
          environment: {
            cacheStorage: {
              open: (name: string) => Promise<{
                delete: typeof remove;
                match: typeof match;
                put: typeof put;
              }>;
            };
            fetcher: (request: Request) => Promise<Response>;
            scope: string;
          }
        ) => Promise<boolean>;
      }
    ).cacheRuntimeAudioOnIntent;
    expect(cacheRuntimeAudioOnIntent).toEqual(expect.any(Function));
    if (!cacheRuntimeAudioOnIntent) return;

    const match = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(true);
    const put = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue({ delete: remove, match, put });
    const fetcher = vi.fn().mockResolvedValue(
      new Response("<!doctype html><title>fallback</title>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    );

    await expect(
      cacheRuntimeAudioOnIntent("sounds/music/r7-shoji-rain.mp3", {
        cacheStorage: { open },
        fetcher,
        scope: "https://example.test/people-first-app/",
      })
    ).rejects.toThrow(/integrity/i);
    expect(put).not.toHaveBeenCalled();
  });

  it("deletes an invalid cached body and replaces it with the exact full asset", async () => {
    const cacheRuntimeAudioOnIntent = (
      runtimeAudioCacheModule as {
        cacheRuntimeAudioOnIntent?: (
          publicPath: string,
          environment: {
            cacheStorage: {
              open: (name: string) => Promise<{
                delete: typeof remove;
                match: typeof match;
                put: typeof put;
              }>;
            };
            fetcher: (request: Request) => Promise<Response>;
            scope: string;
          }
        ) => Promise<boolean>;
      }
    ).cacheRuntimeAudioOnIntent;
    expect(cacheRuntimeAudioOnIntent).toEqual(expect.any(Function));
    if (!cacheRuntimeAudioOnIntent) return;

    const invalidCached = new Response("not audio", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
    const match = vi.fn().mockResolvedValue(invalidCached);
    const remove = vi.fn().mockResolvedValue(true);
    const put = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue({ delete: remove, match, put });
    const fetcher = vi.fn().mockResolvedValue(makeValidR7Response());

    await expect(
      cacheRuntimeAudioOnIntent("sounds/music/r7-shoji-rain.mp3", {
        cacheStorage: { open },
        fetcher,
        scope: "https://example.test/people-first-app/",
      })
    ).resolves.toBe(true);
    expect(remove).toHaveBeenCalledWith(expect.any(Request));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
  });
});
