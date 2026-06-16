import { beforeEach, describe, expect, it, vi } from "vitest";

const addListener = vi.fn();
const getLaunchUrl = vi.fn();

vi.mock("@capacitor/app", () => ({
  App: {
    addListener,
    getLaunchUrl,
  },
}));

vi.mock("@/lib/platform", () => ({ isNative: true }));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

describe("Android diary deep links", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getLaunchUrl.mockResolvedValue({ url: "zenflow://diary/editor" });
    addListener.mockResolvedValue({ remove: vi.fn() });
  });

  it("replays a cold-start diary launch URL to the first subscriber", async () => {
    const { setupDeepLinks, subscribeToDeepLinks } = await import("../deepLinks");

    setupDeepLinks();
    await Promise.resolve();
    await Promise.resolve();

    const callback = vi.fn();
    const cleanup = subscribeToDeepLinks(callback);

    expect(callback).toHaveBeenCalledWith({ type: "diary", route: "editor" });

    cleanup();
  });

  it("dedupes the same cold-start diary URL before replay", async () => {
    const { setupDeepLinks, subscribeToDeepLinks } = await import("../deepLinks");

    setupDeepLinks();
    const listener = addListener.mock.calls[0]?.[1];
    expect(listener).toBeTypeOf("function");
    listener({ url: "zenflow://diary/editor" });
    await Promise.resolve();
    await Promise.resolve();

    const callback = vi.fn();
    const cleanup = subscribeToDeepLinks(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ type: "diary", route: "editor" });

    cleanup();
  });
});
