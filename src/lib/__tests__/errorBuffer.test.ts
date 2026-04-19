import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BUFFER_CAP,
  captureOrBuffer,
  setCaptureSink,
  __bufferSize,
  __resetForTests,
} from "../errorBuffer";

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
    captureOrBuffer(new Error("a"), { k: "v1" });
    captureOrBuffer(new Error("b"), { k: "v2" });
    expect(__bufferSize()).toBe(2);

    setCaptureSink(sink);

    expect(sink).toHaveBeenCalledTimes(2);
    expect(sink).toHaveBeenNthCalledWith(1, expect.any(Error), { k: "v1", buffered: true });
    expect(sink).toHaveBeenNthCalledWith(2, expect.any(Error), { k: "v2", buffered: true });
    expect(__bufferSize()).toBe(0);
  });

  it("forwards immediately once sink is registered", () => {
    const sink = vi.fn();
    setCaptureSink(sink);

    const err = new Error("post-sink");
    captureOrBuffer(err, { type: "runtime" });

    expect(sink).toHaveBeenCalledWith(err, { type: "runtime" });
    expect(__bufferSize()).toBe(0);
  });

  it("tags flushed errors with buffered: true", () => {
    const sink = vi.fn();
    captureOrBuffer(new Error("x"), { original: 1 });
    setCaptureSink(sink);

    expect(sink).toHaveBeenCalledWith(expect.any(Error), { original: 1, buffered: true });
  });

  it("does NOT tag immediate errors with buffered: true", () => {
    const sink = vi.fn();
    setCaptureSink(sink);
    captureOrBuffer(new Error("y"), { original: 2 });

    expect(sink).toHaveBeenCalledWith(expect.any(Error), { original: 2 });
    // Ensure no buffered flag leaks.
    const [, ctx] = sink.mock.calls[0];
    expect(ctx).not.toHaveProperty("buffered");
  });

  it("caps the buffer at BUFFER_CAP entries (silently drops overflow)", () => {
    for (let i = 0; i < BUFFER_CAP + 10; i++) {
      captureOrBuffer(new Error(`e${i}`));
    }
    expect(__bufferSize()).toBe(BUFFER_CAP);
  });

  it("keeps the first BUFFER_CAP errors (FIFO drop policy)", () => {
    const sink = vi.fn();
    for (let i = 0; i < BUFFER_CAP + 5; i++) {
      captureOrBuffer(new Error(`msg-${i}`));
    }
    setCaptureSink(sink);

    expect(sink).toHaveBeenCalledTimes(BUFFER_CAP);
    const firstMsg = (sink.mock.calls[0][0] as Error).message;
    const lastMsg = (sink.mock.calls[BUFFER_CAP - 1][0] as Error).message;
    expect(firstMsg).toBe("msg-0");
    expect(lastMsg).toBe(`msg-${BUFFER_CAP - 1}`);
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
