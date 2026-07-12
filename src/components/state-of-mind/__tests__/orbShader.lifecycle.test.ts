import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { recordError } from "@/lib/crashReporting";
import { createOrbGL, createOrbGL2Async, createOrbGLAsync } from "../orbShader";

vi.mock("@/lib/crashReporting", () => ({
  recordError: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

function createWorkerWebGlContext(
  buffer: object | null,
  errors: number[] = [0],
  visibleFirstPixel = true,
) {
  const queuedErrors = [...errors];
  return {
    ARRAY_BUFFER: 0x8892,
    BLEND: 0x0be2,
    COLOR_BUFFER_BIT: 0x4000,
    COMPILE_STATUS: 0x8b81,
    FLOAT: 0x1406,
    FRAGMENT_SHADER: 0x8b30,
    LINK_STATUS: 0x8b82,
    NO_ERROR: 0,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    RGBA: 0x1908,
    STATIC_DRAW: 0x88e4,
    TRIANGLES: 0x0004,
    UNSIGNED_BYTE: 0x1401,
    VERTEX_SHADER: 0x8b31,
    attachShader: vi.fn(),
    bindBuffer: vi.fn(),
    blendFunc: vi.fn(),
    bufferData: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    compileShader: vi.fn(),
    createBuffer: vi.fn(() => buffer),
    createProgram: vi.fn(() => ({})),
    createShader: vi.fn(() => ({})),
    deleteBuffer: vi.fn(),
    deleteProgram: vi.fn(),
    deleteShader: vi.fn(),
    drawArrays: vi.fn(),
    enable: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    getError: vi.fn(() => queuedErrors.shift() ?? 0),
    getExtension: vi.fn(() => null),
    getProgramParameter: vi.fn(() => true),
    getShaderParameter: vi.fn(() => true),
    getUniformLocation: vi.fn(() => ({})),
    isContextLost: vi.fn(() => false),
    linkProgram: vi.fn(),
    readPixels: vi.fn((
      _x: number,
      _y: number,
      _width: number,
      _height: number,
      _format: number,
      _type: number,
      pixels: Uint8Array,
    ) => {
      pixels.set(visibleFirstPixel ? [24, 48, 72, 255] : [0, 0, 0, 0]);
    }),
    shaderSource: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4fv: vi.fn(),
    useProgram: vi.fn(),
    vertexAttribPointer: vi.fn(),
    viewport: vi.fn(),
  };
}

async function loadOrbWorkerWithCanvas(canvas: { getContext: ReturnType<typeof vi.fn> }) {
  const postMessage = vi.fn();
  const workerScope = {
    close: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null,
    postMessage,
    setTimeout: window.setTimeout.bind(window),
  };
  vi.stubGlobal("self", workerScope);
  await import("../orbWorker");

  workerScope.onmessage?.({
    data: { type: "init", canvas, size: 240, dpr: 1 },
  } as unknown as MessageEvent);
  return { canvas, postMessage, workerScope };
}

async function loadOrbWorkerWithContext(context: ReturnType<typeof createWorkerWebGlContext>) {
  return loadOrbWorkerWithCanvas({
    getContext: vi.fn((contextId: string) => contextId === "webgl" ? context : null),
  });
}

const workerRenderPayload = {
  valence: 0,
  time: 1.2,
  organicTime: 1.2,
  paletteTime: 1.2,
  motionPhase: 0,
  noisePhase: 0,
  pulsePhase: 0.18,
  breathPhase: 0.1,
  size: 240,
  dpr: 1,
  isDark: false,
  color: { h: 200, s: 50, l: 50 },
  shape: { m: 2, n1: 1, n2: 1, n3: 1 },
  particles: [],
  genesis: 1,
  touch: { x: 0, y: 0, age: 0 },
  shimmer: 0,
};

describe("orb WebGL candidate lifecycle", () => {
  it.each(["compile", "link"] as const)(
    "does not forward raw WebGL %s logs to crash reporting",
    (failureStage) => {
      const sentinel = "SENTINEL_DRIVER_TEXT";
      vi.mocked(recordError).mockReset();
      const context = {
        COMPILE_STATUS: 0x8b81,
        FRAGMENT_SHADER: 0x8b30,
        LINK_STATUS: 0x8b82,
        VERTEX_SHADER: 0x8b31,
        attachShader: vi.fn(),
        compileShader: vi.fn(),
        createProgram: vi.fn(() => ({})),
        createShader: vi.fn(() => ({})),
        deleteProgram: vi.fn(),
        deleteShader: vi.fn(),
        getExtension: vi.fn(() => null),
        getProgramInfoLog: vi.fn(() => sentinel),
        getProgramParameter: vi.fn(() => failureStage !== "link"),
        getShaderInfoLog: vi.fn(() => sentinel),
        getShaderParameter: vi.fn(() => failureStage !== "compile"),
        linkProgram: vi.fn(),
        shaderSource: vi.fn(),
      };
      const canvas = document.createElement("canvas");
      vi.spyOn(canvas, "getContext").mockImplementation(((requested: string) => {
        return requested === "webgl" ? context : null;
      }) as HTMLCanvasElement["getContext"]);

      expect(createOrbGL(canvas)).toBeNull();
      expect(recordError).toHaveBeenCalled();
      const reportedMessages = vi.mocked(recordError).mock.calls.map(([error]) =>
        error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error)
      );
      expect(reportedMessages.join("\n")).not.toContain(sentinel);
    },
  );

  it.each([
    { failure: "vertex-buffer allocation", buffer: null, setupError: 0 },
    { failure: "vertex-buffer upload", buffer: {}, setupError: 0x0505 },
  ])("rejects a renderer after $failure failure", ({ buffer, setupError }) => {
    const loseContext = vi.fn();
    const context = {
      ARRAY_BUFFER: 0x8892,
      COMPILE_STATUS: 0x8b81,
      FRAGMENT_SHADER: 0x8b30,
      LINK_STATUS: 0x8b82,
      NO_ERROR: 0,
      STATIC_DRAW: 0x88e4,
      VERTEX_SHADER: 0x8b31,
      attachShader: vi.fn(),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      compileShader: vi.fn(),
      createBuffer: vi.fn(() => buffer),
      createProgram: vi.fn(() => ({})),
      createShader: vi.fn(() => ({})),
      deleteBuffer: vi.fn(),
      deleteProgram: vi.fn(),
      deleteShader: vi.fn(),
      getAttribLocation: vi.fn(() => 0),
      getError: vi.fn(() => setupError),
      getExtension: vi.fn((name: string) =>
        name === "WEBGL_lose_context" ? { loseContext } : null
      ),
      getProgramParameter: vi.fn(() => true),
      getShaderParameter: vi.fn(() => true),
      getUniformLocation: vi.fn(() => ({})),
      isContextLost: vi.fn(() => false),
      linkProgram: vi.fn(),
      shaderSource: vi.fn(),
    };
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockImplementation(((requested: string) => {
      return requested === "webgl" ? context : null;
    }) as HTMLCanvasElement["getContext"]);

    expect(createOrbGL(canvas)).toBeNull();
    expect(context.deleteProgram).toHaveBeenCalledTimes(1);
    expect(context.deleteShader).toHaveBeenCalledTimes(2);
    expect(context.deleteBuffer).toHaveBeenCalledTimes(buffer ? 1 : 0);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it("rejects the first WebGL presentation when the draw reports an error", () => {
    const context = {
      ARRAY_BUFFER: 0x8892,
      BLEND: 0x0be2,
      COLOR_BUFFER_BIT: 0x4000,
      COMPILE_STATUS: 0x8b81,
      FLOAT: 0x1406,
      FRAGMENT_SHADER: 0x8b30,
      LINK_STATUS: 0x8b82,
      NO_ERROR: 0,
      ONE: 1,
      ONE_MINUS_SRC_ALPHA: 0x0303,
      RGBA: 0x1908,
      STATIC_DRAW: 0x88e4,
      TRIANGLES: 0x0004,
      UNSIGNED_BYTE: 0x1401,
      VERTEX_SHADER: 0x8b31,
      attachShader: vi.fn(),
      bindBuffer: vi.fn(),
      blendFunc: vi.fn(),
      bufferData: vi.fn(),
      clear: vi.fn(),
      clearColor: vi.fn(),
      compileShader: vi.fn(),
      createBuffer: vi.fn(() => ({})),
      createProgram: vi.fn(() => ({})),
      createShader: vi.fn(() => ({})),
      deleteBuffer: vi.fn(),
      deleteProgram: vi.fn(),
      deleteShader: vi.fn(),
      drawArrays: vi.fn(),
      enable: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      getAttribLocation: vi.fn(() => 0),
      getError: vi.fn()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0x0505),
      getExtension: vi.fn(() => null),
      getProgramParameter: vi.fn(() => true),
      getShaderParameter: vi.fn(() => true),
      getUniformLocation: vi.fn(() => ({})),
      isContextLost: vi.fn(() => false),
      linkProgram: vi.fn(),
      readPixels: vi.fn((
        _x: number,
        _y: number,
        _width: number,
        _height: number,
        _format: number,
        _type: number,
        pixels: Uint8Array,
      ) => pixels.set([24, 48, 72, 255])),
      shaderSource: vi.fn(),
      uniform1f: vi.fn(),
      uniform2f: vi.fn(),
      uniform3f: vi.fn(),
      uniform4fv: vi.fn(),
      useProgram: vi.fn(),
      vertexAttribPointer: vi.fn(),
      viewport: vi.fn(),
    };
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockImplementation(((requested: string) => {
      return requested === "webgl" ? context : null;
    }) as HTMLCanvasElement["getContext"]);
    const renderer = createOrbGL(canvas);

    expect(renderer).not.toBeNull();
    expect(() => renderer?.render({
      valence: 0,
      time: 1.2,
      organicTime: 1.2,
      paletteTime: 1.2,
      motionPhase: 0,
      noisePhase: 0,
      pulsePhase: 0.18,
      breathPhase: 0.1,
      size: 240,
      dpr: 1,
      isDark: false,
      color: { h: 200, s: 50, l: 50 },
      shape: { m: 2, n1: 1, n2: 1, n3: 1 },
      particles: [],
      genesis: 1,
      touch: { x: 0, y: 0, age: 0 },
      shimmer: 0,
    })).toThrow("WebGL first presentation failed");
  });

  it("keeps a WebGL first presentation pending while genesis is transparent", () => {
    const context = createWorkerWebGlContext({}, [0, 0], false);
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockImplementation(((requested: string) => {
      return requested === "webgl" ? context : null;
    }) as HTMLCanvasElement["getContext"]);
    const renderer = createOrbGL(canvas);

    expect(renderer).not.toBeNull();
    expect(renderer?.render({ ...workerRenderPayload, genesis: 0 })).toBe(false);
    expect(context.readPixels).not.toHaveBeenCalled();
  });

  it("reports worker render exceptions instead of leaving an unhandled rejection", () => {
    const workerSource = readFileSync(
      path.resolve(process.cwd(), "src/components/state-of-mind/orbWorker.ts"),
      "utf8",
    );

    expect(workerSource).toContain("handleWorkerMessage(event.data).catch");
    expect(workerSource).toContain("type: 'failed'");
    expect(workerSource).toContain("Worker WebGL renderer operation failed");
    expect(workerSource).not.toContain("error instanceof Error ? error.message : String(error)");
  });

  it("guards Worker vertex setup and first presentation before acknowledging a frame", () => {
    const workerSource = readFileSync(
      path.resolve(process.cwd(), "src/components/state-of-mind/orbWorker.ts"),
      "utf8",
    );

    expect(workerSource).toContain("if (!vbo)");
    expect(workerSource).toContain("gl.getError() !== gl.NO_ERROR");
    expect(workerSource).toContain("gl.readPixels(");
    expect(workerSource).toContain("let firstPresentationPending = true");
    expect(workerSource).toContain("if (params.genesis <= 0.15) return false");
    expect(workerSource).toContain("class WorkerPresentationError extends Error");
    expect(workerSource).toContain("first-presentation-readback-error");
    expect(workerSource).toContain("first-presentation-transparent");
    expect(workerSource.indexOf("renderer.render(message.payload)")).toBeLessThan(
      workerSource.indexOf("type: 'rendered'"),
    );
  });

  it("reports a Worker vertex-buffer allocation failure without publishing readiness", async () => {
    const { postMessage } = await loadOrbWorkerWithContext(
      createWorkerWebGlContext(null),
    );

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({
        type: "failed",
        reason: "WebGL worker renderer unavailable",
      });
    });
    const messageTypes = postMessage.mock.calls.map(([message]) => message.type);
    expect(messageTypes).not.toContain("ready");
    expect(messageTypes).not.toContain("rendered");
  });

  it("does not request WebGL2 after WebGL1 has bound the Worker OffscreenCanvas", async () => {
    const webGl1 = createWorkerWebGlContext(null);
    const webGl2 = createWorkerWebGlContext({});
    const canvas = {
      getContext: vi.fn((contextId: string) => {
        if (contextId === "webgl") return webGl1;
        if (contextId === "webgl2") return webGl2;
        return null;
      }),
    };
    const { postMessage } = await loadOrbWorkerWithCanvas(canvas);

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalled();
    });
    expect(postMessage).toHaveBeenCalledWith({
      type: "failed",
      reason: "WebGL worker renderer unavailable",
    });
    expect(canvas.getContext).not.toHaveBeenCalledWith("webgl2", expect.anything());
  });

  it("reports a Worker vertex-buffer upload failure without publishing readiness", async () => {
    const { postMessage } = await loadOrbWorkerWithContext(
      createWorkerWebGlContext({}, [0x0505]),
    );

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({
        type: "failed",
        reason: "WebGL worker renderer unavailable",
      });
    });
    const messageTypes = postMessage.mock.calls.map(([message]) => message.type);
    expect(messageTypes).not.toContain("ready");
    expect(messageTypes).not.toContain("rendered");
  });

  it("checks Worker GL errors only during setup and the first presentation", async () => {
    const context = createWorkerWebGlContext({}, [0, 0, 0x0505]);
    const { postMessage, workerScope } = await loadOrbWorkerWithContext(context);
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({ type: "ready" });
    });

    workerScope.onmessage?.({
      data: { type: "render", requestId: 11, payload: workerRenderPayload },
    } as unknown as MessageEvent);
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({ type: "rendered", requestId: 11 });
    });
    workerScope.onmessage?.({
      data: { type: "render", requestId: 12, payload: workerRenderPayload },
    } as unknown as MessageEvent);
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({ type: "rendered", requestId: 12 });
    });

    expect(context.getError).toHaveBeenCalledTimes(2);
  });

  it("reports a Worker first-draw failure without acknowledging the frame", async () => {
    const { postMessage, workerScope } = await loadOrbWorkerWithContext(
      createWorkerWebGlContext({}, [0, 0x0505]),
    );
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({ type: "ready" });
    });

    workerScope.onmessage?.({
      data: {
        type: "render",
        requestId: 7,
        payload: {
          valence: 0,
          time: 1.2,
          organicTime: 1.2,
          paletteTime: 1.2,
          motionPhase: 0,
          noisePhase: 0,
          pulsePhase: 0.18,
          breathPhase: 0.1,
          size: 240,
          dpr: 1,
          isDark: false,
          color: { h: 200, s: 50, l: 50 },
          shape: { m: 2, n1: 1, n2: 1, n3: 1 },
          particles: [],
          genesis: 1,
          touch: { x: 0, y: 0, age: 0 },
          shimmer: 0,
        },
      },
    } as unknown as MessageEvent);

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({
        type: "failed",
        reason: "Worker WebGL renderer operation failed",
        code: "first-presentation-readback-error",
      });
    });
    expect(postMessage).not.toHaveBeenCalledWith({ type: "rendered", requestId: 7 });
  });

  it("keeps a Worker frame pending until a visible pixel can be read back", async () => {
    const context = createWorkerWebGlContext({}, [0, 0], false);
    const { postMessage, workerScope } = await loadOrbWorkerWithContext(context);
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({ type: "ready" });
    });

    workerScope.onmessage?.({
      data: {
        type: "render",
        requestId: 17,
        payload: { ...workerRenderPayload, genesis: 0 },
      },
    } as unknown as MessageEvent);

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({
        type: "unpresented",
        requestId: 17,
      });
    });
    expect(context.readPixels).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalledWith({ type: "rendered", requestId: 17 });

    context.readPixels.mockImplementation((
      _x: number,
      _y: number,
      _width: number,
      _height: number,
      _format: number,
      _type: number,
      pixels: Uint8Array,
    ) => pixels.set([24, 48, 72, 255]));
    workerScope.onmessage?.({
      data: { type: "render", requestId: 18, payload: workerRenderPayload },
    } as unknown as MessageEvent);
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({ type: "rendered", requestId: 18 });
    });
  });

  it("settles an aborted parallel compile while animation frames are suspended", async () => {
    const completionStatus = 0x91b1;
    const loseContext = vi.fn();
    const context = {
      ARRAY_BUFFER: 0x8892,
      COMPILE_STATUS: 0x8b81,
      FRAGMENT_SHADER: 0x8b30,
      LINK_STATUS: 0x8b82,
      STATIC_DRAW: 0x88e4,
      VERTEX_SHADER: 0x8b31,
      attachShader: vi.fn(),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      compileShader: vi.fn(),
      createBuffer: vi.fn(() => ({})),
      createProgram: vi.fn(() => ({})),
      createShader: vi.fn(() => ({})),
      deleteBuffer: vi.fn(),
      deleteProgram: vi.fn(),
      deleteShader: vi.fn(),
      getAttribLocation: vi.fn(() => 0),
      getExtension: vi.fn((name: string) => {
        if (name === "KHR_parallel_shader_compile") {
          return { COMPLETION_STATUS_KHR: completionStatus };
        }
        if (name === "WEBGL_lose_context") return { loseContext };
        return null;
      }),
      getProgramParameter: vi.fn((_program: unknown, parameter: number) => {
        if (parameter === completionStatus) return false;
        return true;
      }),
      getUniformLocation: vi.fn(() => ({})),
      isContextLost: vi.fn(() => false),
      linkProgram: vi.fn(),
      shaderSource: vi.fn(),
    };
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockImplementation(((requested: string) => {
      return requested === "webgl" ? context : null;
    }) as HTMLCanvasElement["getContext"]);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const controller = new AbortController();

    const resultPromise = createOrbGLAsync(canvas, {
      signal: controller.signal,
      timeoutMs: 10_000,
    });
    controller.abort();
    const outcome = await Promise.race([
      resultPromise.then(() => "settled"),
      new Promise<string>((resolve) => window.setTimeout(() => resolve("pending"), 0)),
    ]);

    expect(outcome).toBe("settled");
    await expect(resultPromise).resolves.toBeNull();
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it.each(["webgl", "webgl2"] as const)(
    "releases an abandoned %s context when async compilation is unsupported",
    async (contextId) => {
      const loseContext = vi.fn();
      const context = {
        getExtension: vi.fn((name: string) => {
          if (name === "WEBGL_lose_context") return { loseContext };
          return null;
        }),
        isContextLost: vi.fn(() => false),
      };
      const canvas = document.createElement("canvas");
      vi.spyOn(canvas, "getContext").mockImplementation(((requested: string) => {
        return requested === contextId ? context : null;
      }) as HTMLCanvasElement["getContext"]);

      const result = contextId === "webgl"
        ? await createOrbGLAsync(canvas, { timeoutMs: 10 })
        : await createOrbGL2Async(canvas, { timeoutMs: 10 });

      expect(result).toBeNull();
      expect(loseContext).toHaveBeenCalledTimes(1);
    },
  );
});
