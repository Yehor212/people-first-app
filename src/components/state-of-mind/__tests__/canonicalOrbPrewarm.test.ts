import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const platformControl = vi.hoisted(() => ({ isAndroid: false }));

vi.mock("@/lib/platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform")>();
  return {
    ...actual,
    get isAndroid() {
      return platformControl.isAndroid;
    },
  };
});

describe("canonical orb WebGL prewarm lifecycle", () => {
  beforeEach(() => {
    platformControl.isAndroid = false;
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

  it("preserves immediate worker termination outside Android", async () => {
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
    const resultPromise = prewarmCanonicalOrbWebGL("test-non-android-timeout");

    await vi.advanceTimersByTimeAsync(CANONICAL_ORB_PREWARM_TIMEOUT_MS + 1);

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      reason: "timeout",
    });
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "dispose" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("lets an Android prewarm worker acknowledge disposal after its bounded timeout", async () => {
    platformControl.isAndroid = true;
    class WorkerStub {
      onmessage: ((event: MessageEvent<{ type: "disposed" }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();
      acknowledgeDispose() {
        this.onmessage?.({
          data: { type: "disposed" },
        } as MessageEvent<{ type: "disposed" }>);
      }
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
    const settled = vi.fn();
    void resultPromise.then(settled);
    await vi.advanceTimersByTimeAsync(CANONICAL_ORB_PREWARM_TIMEOUT_MS + 1);

    expect(worker.postMessage).toHaveBeenCalledWith({ type: "dispose" });
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(settled).not.toHaveBeenCalled();

    worker.acknowledgeDispose();

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      reason: "timeout",
    });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("force-terminates a prewarm worker when the dispose acknowledgement is silent", async () => {
    platformControl.isAndroid = true;
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
      CANONICAL_ORB_PREWARM_DISPOSE_ACK_TIMEOUT_MS,
      CANONICAL_ORB_PREWARM_TIMEOUT_MS,
      prewarmCanonicalOrbWebGL,
    } = await import("../canonicalOrbPrewarm");
    const resultPromise = prewarmCanonicalOrbWebGL("test-dispose-timeout");

    await vi.advanceTimersByTimeAsync(CANONICAL_ORB_PREWARM_TIMEOUT_MS + 1);
    expect(worker.terminate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(CANONICAL_ORB_PREWARM_DISPOSE_ACK_TIMEOUT_MS + 1);

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      reason: "timeout",
    });
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
