import { afterEach, describe, expect, it, vi } from "vitest";

function createRenderPayload(size: number, dpr: number) {
  return {
    valence: 0.25,
    time: 1,
    organicTime: 1,
    paletteTime: 1,
    motionPhase: 0.5,
    noisePhase: 0.25,
    pulsePhase: 0.75,
    breathPhase: 0.4,
    size,
    dpr,
    isDark: false,
    color: { h: 160, s: 60, l: 50 },
    shape: { m: 5, n1: 1, n2: 1, n3: 1 },
    particles: [],
    genesis: 1,
    touch: { x: 0, y: 0, age: 0 },
    shimmer: 0,
  };
}

function createWebGLStub(calls: string[]) {
  const gl = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    NO_ERROR: 0,
    COLOR_BUFFER_BIT: 0x4000,
    BLEND: 0x0be2,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    deleteProgram: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    deleteBuffer: vi.fn(),
    getError: vi.fn(() => 0),
    isContextLost: vi.fn(() => false),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({})),
    viewport: vi.fn((x: number, y: number, width: number, height: number) => {
      calls.push(`viewport:${x}:${y}:${width}:${height}`);
    }),
    clearColor: vi.fn(),
    clear: vi.fn(),
    useProgram: vi.fn(),
    enable: vi.fn(),
    blendFunc: vi.fn(),
    uniform2f: vi.fn(),
    uniform1f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4fv: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    drawArrays: vi.fn(() => {
      calls.push("draw");
    }),
    readPixels: vi.fn(
      (
        _x: number,
        _y: number,
        _width: number,
        _height: number,
        _format: number,
        _type: number,
        pixels: Uint8Array,
      ) => {
        pixels[3] = 255;
      },
    ),
    getExtension: vi.fn(() => null),
  };

  return gl;
}

describe("canonical orb worker lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("acknowledges disposal before closing the worker scope", async () => {
    const calls: string[] = [];
    const workerScope = {
      onmessage: null as null | ((event: MessageEvent<{ type: "dispose" }>) => void),
      postMessage: vi.fn((message: { type: string }) => {
        calls.push(`post:${message.type}`);
      }),
      close: vi.fn(() => {
        calls.push("close");
      }),
    };
    vi.stubGlobal("self", workerScope);

    await import("../orbWorker");
    expect(workerScope.onmessage).toBeTypeOf("function");

    workerScope.onmessage?.({
      data: { type: "dispose" },
    } as MessageEvent<{ type: "dispose" }>);
    await Promise.resolve();
    await Promise.resolve();

    expect(workerScope.postMessage).toHaveBeenCalledWith({ type: "disposed" });
    expect(workerScope.close).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["post:disposed", "close"]);
  });

  it("resizes the same OffscreenCanvas before drawing and acknowledging the next frame", async () => {
    const calls: string[] = [];
    const gl = createWebGLStub(calls);
    const offscreen = {
      width: 480,
      height: 480,
      getContext: vi.fn(() => gl),
    } as unknown as OffscreenCanvas;
    const workerScope = {
      onmessage: null as null | ((event: MessageEvent<unknown>) => void),
      postMessage: vi.fn((message: { type: string; requestId?: number }) => {
        calls.push(`post:${message.type}:${message.requestId ?? "none"}`);
      }),
      close: vi.fn(() => {
        calls.push("close");
      }),
      setTimeout,
    };
    vi.stubGlobal("self", workerScope);

    await import("../orbWorker");
    expect(workerScope.onmessage).toBeTypeOf("function");

    workerScope.onmessage?.({
      data: { type: "init", canvas: offscreen, size: 240, dpr: 2 },
    } as MessageEvent<unknown>);
    await Promise.resolve();
    await Promise.resolve();

    workerScope.onmessage?.({
      data: {
        type: "render",
        requestId: 1,
        payload: createRenderPayload(240, 2),
      },
    } as MessageEvent<unknown>);
    await Promise.resolve();

    workerScope.onmessage?.({
      data: {
        type: "render",
        requestId: 2,
        payload: createRenderPayload(120, 2),
      },
    } as MessageEvent<unknown>);
    await Promise.resolve();

    expect(offscreen.width).toBe(240);
    expect(offscreen.height).toBe(240);
    expect(gl.viewport).toHaveBeenLastCalledWith(0, 0, 240, 240);
    expect(calls.lastIndexOf("draw")).toBeLessThan(
      calls.lastIndexOf("post:rendered:2"),
    );
    expect(workerScope.postMessage).not.toHaveBeenCalledWith({ type: "disposed" });
    expect(workerScope.close).not.toHaveBeenCalled();
  });
});
