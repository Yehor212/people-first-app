import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recordError } from "@/lib/crashReporting";
import { createOrbWebGPUAsync } from "../orbWebGpu";

vi.mock("@/lib/crashReporting", () => ({
  recordError: vi.fn(),
}));

const originalGpuDescriptor = Object.getOwnPropertyDescriptor(navigator, "gpu");

beforeEach(() => {
  vi.mocked(recordError).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalGpuDescriptor) {
    Object.defineProperty(navigator, "gpu", originalGpuDescriptor);
  } else {
    delete (navigator as Navigator & { gpu?: unknown }).gpu;
  }
});

describe("createOrbWebGPUAsync resource cleanup", () => {
  it("removes its abort listener when adapter acquisition times out", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const removeEventListener = vi.spyOn(controller.signal, "removeEventListener");
    const gpu = {
      requestAdapter: vi.fn(() => new Promise(() => {})),
      getPreferredCanvasFormat: vi.fn(() => "bgra8unorm"),
    };
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: gpu,
    });
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockImplementation(((contextId: string) => {
      return contextId === "webgpu" ? {} : null;
    }) as HTMLCanvasElement["getContext"]);

    const resultPromise = createOrbWebGPUAsync(canvas, {
      signal: controller.signal,
      timeoutMs: 10,
    });
    await vi.advanceTimersByTimeAsync(11);

    await expect(resultPromise).resolves.toBeNull();
    expect(removeEventListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("does not propagate implementation-defined WebGPU loss messages", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/components/state-of-mind/orbWebGpu.ts"),
      "utf8",
    );

    expect(source).not.toContain("info?.message");
  });

  it.each([
    {
      adapter: {
        info: { architecture: "swiftshader", vendor: "google" },
        isFallbackAdapter: false,
      },
      label: "SwiftShader",
    },
    {
      adapter: {
        info: { architecture: "metal", vendor: "apple" },
        isFallbackAdapter: true,
      },
      label: "an implementation-declared fallback adapter",
    },
  ])("rejects $label before requesting a device", async ({ adapter }) => {
    const requestDevice = vi.fn();
    const gpu = {
      requestAdapter: vi.fn(async () => ({ ...adapter, requestDevice })),
      getPreferredCanvasFormat: vi.fn(() => "bgra8unorm"),
    };
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: gpu,
    });
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockImplementation(((contextId: string) => {
      return contextId === "webgpu" ? {} : null;
    }) as HTMLCanvasElement["getContext"]);

    await expect(createOrbWebGPUAsync(canvas, { timeoutMs: 100 })).resolves.toBeNull();
    expect(requestDevice).not.toHaveBeenCalled();
  });

  it("does not forward a rejected adapter's raw message to crash reporting", async () => {
    const sentinel = "SENTINEL_DRIVER_TEXT";
    const gpu = {
      requestAdapter: vi.fn(async () => {
        throw new Error(sentinel);
      }),
      getPreferredCanvasFormat: vi.fn(() => "bgra8unorm"),
    };
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: gpu,
    });
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockImplementation(((contextId: string) => {
      return contextId === "webgpu" ? {} : null;
    }) as HTMLCanvasElement["getContext"]);

    await expect(createOrbWebGPUAsync(canvas, { timeoutMs: 100 })).resolves.toBeNull();

    expect(recordError).toHaveBeenCalled();
    const reportedMessages = vi.mocked(recordError).mock.calls.map(([error]) =>
      error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error)
    );
    expect(reportedMessages.join("\n")).not.toContain(sentinel);
  });

  it("destroys an acquired device when setup throws after requestDevice", async () => {
    const destroy = vi.fn();
    const device = {
      queue: {
        writeBuffer: vi.fn(),
        submit: vi.fn(),
      },
      createShaderModule: vi.fn(),
      createRenderPipelineAsync: vi.fn(),
      createBuffer: vi.fn(),
      createBindGroup: vi.fn(),
      createCommandEncoder: vi.fn(),
      destroy,
      lost: new Promise(() => {}),
    };
    const context = {
      configure: vi.fn(() => {
        throw new Error("configure failed after device acquisition");
      }),
      getCurrentTexture: vi.fn(),
    };
    const requestDevice = vi.fn(async () => device);
    const gpu = {
      requestAdapter: vi.fn(async () => ({ requestDevice })),
      getPreferredCanvasFormat: vi.fn(() => "bgra8unorm"),
    };
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: gpu,
    });
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockImplementation(((contextId: string) => {
      return contextId === "webgpu" ? context : null;
    }) as HTMLCanvasElement["getContext"]);

    const result = await createOrbWebGPUAsync(canvas, { timeoutMs: 100 });

    expect(result).toBeNull();
    expect(requestDevice).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("rejects a device that is already lost before the renderer is published", async () => {
    const destroy = vi.fn();
    const pipeline = { getBindGroupLayout: vi.fn(() => ({})) };
    const device = {
      queue: {
        writeBuffer: vi.fn(),
        submit: vi.fn(),
      },
      createShaderModule: vi.fn(() => ({})),
      createRenderPipelineAsync: vi.fn(async () => pipeline),
      createBuffer: vi.fn(() => ({})),
      createBindGroup: vi.fn(() => ({})),
      createCommandEncoder: vi.fn(),
      destroy,
      lost: Promise.resolve({ reason: "unknown", message: "lost before publication" }),
    };
    const context = {
      configure: vi.fn(),
      getCurrentTexture: vi.fn(),
    };
    const gpu = {
      requestAdapter: vi.fn(async () => ({ requestDevice: vi.fn(async () => device) })),
      getPreferredCanvasFormat: vi.fn(() => "bgra8unorm"),
    };
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: gpu,
    });
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockImplementation(((contextId: string) => {
      return contextId === "webgpu" ? context : null;
    }) as HTMLCanvasElement["getContext"]);
    const onContextLost = vi.fn();

    const result = await createOrbWebGPUAsync(canvas, {
      timeoutMs: 100,
      onContextLost,
    });

    expect(result).toBeNull();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(onContextLost).not.toHaveBeenCalled();
  });

  it("throws from a published renderer after device loss so the caller can recover", async () => {
    let resolveDeviceLost!: (info: { reason: string }) => void;
    const deviceLost = new Promise<{ reason: string }>((resolve) => {
      resolveDeviceLost = resolve;
    });
    const pipeline = { getBindGroupLayout: vi.fn(() => ({})) };
    const device = {
      queue: {
        writeBuffer: vi.fn(),
        submit: vi.fn(),
      },
      createShaderModule: vi.fn(() => ({})),
      createRenderPipelineAsync: vi.fn(async () => pipeline),
      createBuffer: vi.fn(() => ({})),
      createBindGroup: vi.fn(() => ({})),
      createCommandEncoder: vi.fn(),
      destroy: vi.fn(),
      lost: deviceLost,
    };
    const context = {
      configure: vi.fn(),
      getCurrentTexture: vi.fn(),
    };
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: {
        requestAdapter: vi.fn(async () => ({ requestDevice: vi.fn(async () => device) })),
        getPreferredCanvasFormat: vi.fn(() => "bgra8unorm"),
      },
    });
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockImplementation(((contextId: string) => {
      return contextId === "webgpu" ? context : null;
    }) as HTMLCanvasElement["getContext"]);
    const onContextLost = vi.fn();

    const result = await createOrbWebGPUAsync(canvas, {
      timeoutMs: 100,
      onContextLost,
    });
    expect(result).not.toBeNull();

    resolveDeviceLost({ reason: "unknown" });
    await Promise.resolve();
    await Promise.resolve();

    expect(onContextLost).not.toHaveBeenCalled();
    expect(result?.renderer.isContextLost()).toBe(true);
    expect(() => result?.renderer.render({
      valence: 0,
      time: 0,
      organicTime: 0,
      paletteTime: 0,
      motionPhase: 0,
      noisePhase: 0,
      pulsePhase: 0,
      breathPhase: 0,
      size: 240,
      dpr: 1,
      isDark: false,
      color: { h: 0, s: 0, l: 0 },
      shape: { m: 2, n1: 1, n2: 1, n3: 1 },
      particles: [],
      genesis: 1,
      touch: { x: 0, y: 0, age: 0 },
      shimmer: 0,
    })).toThrow("WebGPU device is lost");
  });

  it.each([
    {
      label: "accepts clean scopes with visible pixels",
      scopeResults: [null, null],
      visibleReadback: true,
      expected: true,
    },
    {
      label: "rejects a captured GPU error",
      scopeResults: [{}, null],
      visibleReadback: true,
      expected: false,
    },
    {
      label: "rejects a transparent readback",
      scopeResults: [null, null],
      visibleReadback: false,
      expected: false,
    },
  ])(
    "keeps the first presentation pending, then $label",
    async ({ scopeResults, visibleReadback, expected }) => {
      let resolveSubmittedWork!: () => void;
      const submittedWork = new Promise<void>((resolve) => {
        resolveSubmittedWork = resolve;
      });
      const pass = {
        setPipeline: vi.fn(),
        setBindGroup: vi.fn(),
        draw: vi.fn(),
        end: vi.fn(),
      };
      const pipeline = { getBindGroupLayout: vi.fn(() => ({})) };
      const queuedScopeResults: Array<unknown | null> = [...scopeResults];
      const popErrorScope = vi.fn(async () => queuedScopeResults.shift() ?? null);
      const pushErrorScope = vi.fn();
      const bytesPerRow = 1024;
      const readbackBytes = new Uint8Array(bytesPerRow * 240);
      if (visibleReadback) {
        for (let pixel = 0; pixel < 64; pixel += 1) {
          readbackBytes[pixel * 4 + 3] = 255;
        }
      }
      const readbackBuffer = {
        mapAsync: vi.fn(async () => undefined),
        getMappedRange: vi.fn(() => readbackBytes.buffer),
        unmap: vi.fn(),
        destroy: vi.fn(),
      };
      const copyTextureToBuffer = vi.fn();
      const createBuffer = vi.fn()
        .mockReturnValueOnce({})
        .mockReturnValueOnce(readbackBuffer);
      const device = {
        queue: {
          writeBuffer: vi.fn(),
          submit: vi.fn(),
          onSubmittedWorkDone: vi.fn(() => submittedWork),
        },
        createShaderModule: vi.fn(() => ({})),
        createRenderPipelineAsync: vi.fn(async () => pipeline),
        createBuffer,
        createBindGroup: vi.fn(() => ({})),
        createCommandEncoder: vi.fn(() => ({
          beginRenderPass: vi.fn(() => pass),
          copyTextureToBuffer,
          finish: vi.fn(() => ({})),
        })),
        pushErrorScope,
        popErrorScope,
        destroy: vi.fn(),
        lost: new Promise(() => {}),
      };
      const context = {
        configure: vi.fn(),
        getCurrentTexture: vi.fn(() => ({ createView: vi.fn(() => ({})) })),
      };
      Object.defineProperty(navigator, "gpu", {
        configurable: true,
        value: {
          requestAdapter: vi.fn(async () => ({ requestDevice: vi.fn(async () => device) })),
          getPreferredCanvasFormat: vi.fn(() => "bgra8unorm"),
        },
      });
      const canvas = document.createElement("canvas");
      vi.spyOn(canvas, "getContext").mockImplementation(((contextId: string) => {
        return contextId === "webgpu" ? context : null;
      }) as HTMLCanvasElement["getContext"]);

      const result = await createOrbWebGPUAsync(canvas, { timeoutMs: 100 });
      expect(result).not.toBeNull();
      result?.renderer.render({
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
      });

      const waitForFirstPresentation = (
        result?.renderer as NonNullable<typeof result>["renderer"] & {
          waitForFirstPresentation?: () => Promise<boolean>;
        }
      )?.waitForFirstPresentation;
      expect(waitForFirstPresentation).toBeTypeOf("function");
      if (!waitForFirstPresentation) return;

      let settled = false;
      const presentation = waitForFirstPresentation().then((value) => {
        settled = true;
        return value;
      });
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(pushErrorScope).toHaveBeenCalled();

      resolveSubmittedWork();
      await expect(presentation).resolves.toBe(expected);
      expect(context.configure).toHaveBeenCalledWith(expect.objectContaining({ usage: 0x11 }));
      expect(copyTextureToBuffer).toHaveBeenCalledTimes(1);
      const cleanScopes = scopeResults.every((scopeResult) => scopeResult === null);
      expect(readbackBuffer.mapAsync).toHaveBeenCalledTimes(cleanScopes ? 1 : 0);
      if (cleanScopes) {
        expect(readbackBuffer.mapAsync).toHaveBeenCalledWith(0x0001);
      }
      expect(readbackBuffer.unmap).toHaveBeenCalledTimes(cleanScopes ? 1 : 0);
      expect(readbackBuffer.destroy).toHaveBeenCalledTimes(1);
      expect(popErrorScope).toHaveBeenCalledTimes(pushErrorScope.mock.calls.length);
    },
  );
});
