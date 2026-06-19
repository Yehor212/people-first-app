import { afterEach, describe, expect, it, vi } from "vitest";

describe("hyperfocus audio catalog generated manifest", () => {
  afterEach(() => {
    vi.doUnmock("../hyperfocusGeneratedAudioManifest");
    vi.resetModules();
  });

  it("marks manifest-backed variants generated and exposes their runtime public path", async () => {
    vi.resetModules();
    vi.doMock("../hyperfocusGeneratedAudioManifest", () => ({
      HYPERFOCUS_GENERATED_AUDIO_MANIFEST: {
        "fireplace:soft": {
          publicPath: "sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
          sha256: "0123456789abcdef",
          bytes: 720000,
          generatedAt: "2026-06-19T00:00:00.000Z",
        },
      },
    }));

    const catalog = await import("../hyperfocusAudioCatalog");

    expect(catalog.getHyperfocusAudioVariant("fireplace:soft")).toMatchObject({
      id: "fireplace:soft",
      generated: true,
      runtimePublicPath: "sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
    });
  });
});
