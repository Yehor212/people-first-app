import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAppAudioMediaSession, setAppAudioMediaSession } from "../audioMediaSession";

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

describe("owner-bound media transport", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "mediaSession");
  const session = { metadata: null, playbackState: "none", setActionHandler: vi.fn() };
  beforeEach(() => {
    session.setActionHandler.mockReset();
    Object.defineProperty(navigator, "mediaSession", { configurable: true, value: session });
  });
  afterEach(() => {
    if (original) Object.defineProperty(navigator, "mediaSession", original);
    else Reflect.deleteProperty(navigator, "mediaSession");
  });

  it("binds music previous and next actions", () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const options = { title: "Shoji Rain", onPrevious, onNext };
    setAppAudioMediaSession(options);
    expect(session.setActionHandler).toHaveBeenCalledWith("previoustrack", onPrevious);
    expect(session.setActionHandler).toHaveBeenCalledWith("nexttrack", onNext);
  });

  it("replaces music callbacks with null when nature owns the session", () => {
    const options = { title: "Shoji Rain", onPrevious: vi.fn(), onNext: vi.fn() };
    setAppAudioMediaSession(options);
    session.setActionHandler.mockClear();
    setAppAudioMediaSession({ title: "Forest" });
    expect(session.setActionHandler).toHaveBeenCalledWith("previoustrack", null);
    expect(session.setActionHandler).toHaveBeenCalledWith("nexttrack", null);
  });

  it("clears all supported transport callbacks on release", () => {
    clearAppAudioMediaSession();
    for (const action of ["play", "pause", "stop", "previoustrack", "nexttrack"]) {
      expect(session.setActionHandler).toHaveBeenCalledWith(action, null);
    }
    expect(session.playbackState).toBe("none");
    expect(session.metadata).toBeNull();
  });

  it("does not crash or abandon remaining actions when an action is unsupported", () => {
    session.setActionHandler.mockImplementation((action: string) => {
      if (action === "previoustrack") throw new Error("Unsupported action");
    });
    expect(() => setAppAudioMediaSession({ title: "Shoji Rain" })).not.toThrow();
    expect(session.setActionHandler).toHaveBeenCalledWith("nexttrack", null);
  });

  it("is safe when Media Session is unavailable", () => {
    Reflect.deleteProperty(navigator, "mediaSession");
    expect(() => setAppAudioMediaSession({ title: "Shoji Rain" })).not.toThrow();
    expect(() => clearAppAudioMediaSession()).not.toThrow();
    expect(session.setActionHandler).not.toHaveBeenCalled();
  });
});
