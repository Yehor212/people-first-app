import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BUFFER_CAP,
  captureOrBuffer,
  clearBufferedDiagnostics,
  setCaptureSink,
  __bufferSize,
  __resetForTests,
} from "../errorBuffer";
import { resetAccountBoundaryRuntimeState } from "@/storage/accountBoundaryRuntime";

describe("errorBuffer", () => {
  afterEach(() => {
    __resetForTests();
  });

  it("buffers errors before sink is registered", () => {
    const err = new Error("pre-sink");
    captureOrBuffer(err, { source: "boot" });
    expect(__bufferSize()).toBe(1);
  });

  it("flushes buffered errors when sink is registered", () => {
    const sink = vi.fn();
    captureOrBuffer(new Error("a"), { source: "boot" });
    captureOrBuffer(new Error("b"), { source: "react" });
    expect(__bufferSize()).toBe(2);

    setCaptureSink(sink);

    expect(sink).toHaveBeenCalledTimes(2);
    expect(sink).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ message: "ZF_RUNTIME_ERROR" }),
      { source: "boot", buffered: true },
    );
    expect(sink).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ message: "ZF_RUNTIME_ERROR" }),
      { source: "react", buffered: true },
    );
    expect(__bufferSize()).toBe(0);
  });

  it("forwards immediately once sink is registered", () => {
    const sink = vi.fn();
    setCaptureSink(sink);

    const err = new Error("post-sink");
    captureOrBuffer(err, { type: "runtime" });

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ message: "ZF_RUNTIME_ERROR" }),
      { type: "runtime" },
    );
    expect(__bufferSize()).toBe(0);
  });

  it("does not retain or forward private Error messages, causes, or context", () => {
    const sink = vi.fn();
    const diaryCanary = "ZF_T172_DIARY_7H2K9Q4M6P8R";
    const authCanary = "ZF_T172_AUTH_9B6W3J8S2F5K";
    const identityCanary = "ZF_T172_IDENTITY_5M7R2Q9T4C8P";

    const privateError = new Error(diaryCanary) as Error & { cause?: unknown };
    privateError.cause = new Error(authCanary);
    captureOrBuffer(privateError, {
      type: "uncaught",
      userId: identityCanary,
    });
    setCaptureSink(sink);

    const [forwardedError, context] = sink.mock.calls[0] as [Error, Record<string, unknown>];
    const serialized = JSON.stringify({
      message: forwardedError.message,
      stack: forwardedError.stack,
      cause: (forwardedError as Error & { cause?: unknown }).cause,
      context,
    });
    for (const canary of [diaryCanary, authCanary, identityCanary]) {
      expect(serialized).not.toContain(canary);
    }
    expect(context).toMatchObject({ type: "uncaught", buffered: true });
  });

  it("tags flushed errors with buffered: true", () => {
    const sink = vi.fn();
    captureOrBuffer(new Error("x"), { seq: 1 });
    setCaptureSink(sink);

    expect(sink).toHaveBeenCalledWith(expect.any(Error), { seq: 1, buffered: true });
  });

  it("does NOT tag immediate errors with buffered: true", () => {
    const sink = vi.fn();
    setCaptureSink(sink);
    captureOrBuffer(new Error("y"), { seq: 2 });

    expect(sink).toHaveBeenCalledWith(expect.any(Error), { seq: 2 });
    // Ensure no buffered flag leaks.
    const [, ctx] = sink.mock.calls[0];
    expect(ctx).not.toHaveProperty("buffered");
  });

  it("caps the buffer at BUFFER_CAP entries", () => {
    for (let i = 0; i < BUFFER_CAP + 10; i++) {
      captureOrBuffer(new Error(`e${i}`));
    }
    expect(__bufferSize()).toBe(BUFFER_CAP);
  });

  it("clears all current-runtime diagnostics at a privacy boundary", () => {
    captureOrBuffer(new Error("private"), { source: "boot" });
    expect(__bufferSize()).toBe(1);

    clearBufferedDiagnostics();

    expect(__bufferSize()).toBe(0);
  });

  it("clears a private canary through the registered production account-boundary reset", () => {
    const sink = vi.fn();
    captureOrBuffer(new Error("ZF_T172_ACCOUNT_BUFFER_7H2K9Q4M6P8R"), {
      source: "boot",
    });
    expect(__bufferSize()).toBe(1);

    resetAccountBoundaryRuntimeState();
    setCaptureSink(sink);

    expect(__bufferSize()).toBe(0);
    expect(sink).not.toHaveBeenCalled();
  });

  it("keeps the first BUFFER_CAP errors (FIFO drop policy)", () => {
    const sink = vi.fn();
    for (let i = 0; i < BUFFER_CAP + 5; i++) {
      captureOrBuffer(new Error(`msg-${i}`), { seq: i });
    }
    setCaptureSink(sink);

    expect(sink).toHaveBeenCalledTimes(BUFFER_CAP);
    expect((sink.mock.calls[0][1] as Record<string, unknown>).seq).toBe(0);
    expect((sink.mock.calls[BUFFER_CAP - 1][1] as Record<string, unknown>).seq).toBe(
      BUFFER_CAP - 1,
    );
  });

  it("uses empty object as default context", () => {
    const sink = vi.fn();
    setCaptureSink(sink);
    captureOrBuffer(new Error("no-ctx"));

    expect(sink).toHaveBeenCalledWith(expect.any(Error), {});
  });

  it("survives a sink that throws (flush loop does not abort)", () => {
    const failing = vi.fn((_e: Error, _c?: Record<string, unknown>) => {
      throw new Error("sink-broken");
    });
    captureOrBuffer(new Error("1"));
    captureOrBuffer(new Error("2"));
    captureOrBuffer(new Error("3"));

    expect(() => setCaptureSink(failing)).not.toThrow();
    expect(failing).toHaveBeenCalledTimes(3);
  });

  it("replacing the sink does not re-flush already-delivered errors", () => {
    const first = vi.fn();
    captureOrBuffer(new Error("once"));
    setCaptureSink(first);
    expect(first).toHaveBeenCalledTimes(1);

    const second = vi.fn();
    setCaptureSink(second);
    expect(second).not.toHaveBeenCalled();

    // New errors go to the new sink.
    captureOrBuffer(new Error("post"));
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });
});
