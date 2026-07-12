import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("canonical orb WebGL prewarm lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    window.sessionStorage.clear();
    vi.stubGlobal(
      "OffscreenCanvas",
      class OffscreenCanvasStub {
        constructor(
          public width: number,
          public height: number,
        ) {}
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("terminates a prewarm worker after its bounded timeout", async () => {
    class WorkerStub {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();
    }
    const worker = new WorkerStub();
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() {
      return worker;
    }));

    const {
      CANONICAL_ORB_PREWARM_TIMEOUT_MS,
      prewarmCanonicalOrbWebGL,
    } = await import("../canonicalOrbPrewarm");
    const resultPromise = prewarmCanonicalOrbWebGL("test-timeout");
    await vi.advanceTimersByTimeAsync(CANONICAL_ORB_PREWARM_TIMEOUT_MS + 1);

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      reason: "timeout",
    });
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "dispose" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("returns a bounded failure when worker construction throws", async () => {
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() {
      throw new Error("worker construction failed");
    }));

    const { prewarmCanonicalOrbWebGL } = await import("../canonicalOrbPrewarm");

    await expect(prewarmCanonicalOrbWebGL("test-constructor")).resolves.toMatchObject({
      ok: false,
      reason: "worker-construction-failed",
    });
  });

  it("terminates the worker when the initialization message throws", async () => {
    class WorkerStub {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn(() => {
        throw new Error("worker init send failed");
      });
      terminate = vi.fn();
    }
    const worker = new WorkerStub();
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() {
      return worker;
    }));

    const { prewarmCanonicalOrbWebGL } = await import("../canonicalOrbPrewarm");

    await expect(prewarmCanonicalOrbWebGL("test-init-send")).resolves.toMatchObject({
      ok: false,
      reason: "worker-init-failed",
    });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
