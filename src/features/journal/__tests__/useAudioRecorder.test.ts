import { renderHook, act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { useAudioRecorder } from "../useAudioRecorder";
import { MAX_AUDIO_DURATION_SEC } from "../types";

const source = readFileSync("src/features/journal/useAudioRecorder.ts", "utf8");

describe("useAudioRecorder", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects start when microphone permission is denied", async () => {
    const denied = new DOMException("Denied", "NotAllowedError");
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(denied) },
    });
    vi.stubGlobal("MediaRecorder", class {
      static isTypeSupported() {
        return true;
      }
    });

    const { result } = renderHook(() => useAudioRecorder());

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.start();
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBe(denied);
    expect(result.current.error).toBe("Microphone access denied");
    expect(result.current.isRecording).toBe(false);
  });

  it("stops the opened stream if MediaRecorder setup fails", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
    };
    const setupError = new DOMException("Unsupported", "NotSupportedError");
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }

        constructor() {
          throw setupError;
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.start();
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBe(setupError);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
  });

  it("preserves an active recording when iOS backgrounds the page", async () => {
    const stopTrack = vi.fn();
    const stopRecorder = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    };

    class AsyncFileReader {
      result = "data:audio/webm;base64,aGlkZGVuLXZvaWNl";
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL() {
        setTimeout(() => this.onloadend?.(), 10);
      }
    }

    vi.stubGlobal("FileReader", AsyncFileReader);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });

    vi.stubGlobal(
      "MediaRecorder",
      class {
        state = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;

        static isTypeSupported() {
          return true;
        }

        start() {
          this.state = "recording";
        }

        stop() {
          stopRecorder();
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["voice"], { type: "audio/webm" }) });
          this.onstop?.();
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.isRecording).toBe(true);

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(stopRecorder).toHaveBeenCalledTimes(1);
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    await waitFor(() => {
      expect(result.current.audioData).toBe("data:audio/webm;base64,aGlkZGVuLXZvaWNl");
    });
  });

  it("preserves an active recording when iOS fires pagehide", async () => {
    const stopTrack = vi.fn();
    const stopRecorder = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    };

    class AsyncFileReader {
      result = "data:audio/webm;base64,cGFnZWhpZGU=";
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL() {
        setTimeout(() => this.onloadend?.(), 10);
      }
    }

    vi.stubGlobal("FileReader", AsyncFileReader);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });

    vi.stubGlobal(
      "MediaRecorder",
      class {
        state = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;

        static isTypeSupported() {
          return true;
        }

        start() {
          this.state = "recording";
        }

        stop() {
          stopRecorder();
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["voice"], { type: "audio/webm" }) });
          this.onstop?.();
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.isRecording).toBe(true);

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(stopRecorder).toHaveBeenCalledTimes(1);
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    await waitFor(() => {
      expect(result.current.audioData).toBe("data:audio/webm;base64,cGFnZWhpZGU=");
    });
  });

  it("preserves an active recording when the native iOS app pause event fires", async () => {
    vi.resetModules();
    const nativeListeners = new Map<string, () => void>();
    vi.doMock("@/lib/platform", () => ({ isNative: true }));
    vi.doMock("@capacitor/app", () => ({
      App: {
        addListener: vi.fn((event: string, callback: () => void) => {
          nativeListeners.set(event, callback);
          return Promise.resolve({ remove: vi.fn() });
        }),
      },
    }));

    const { useAudioRecorder: useNativeAudioRecorder } = await import("../useAudioRecorder");
    const stopTrack = vi.fn();
    const stopRecorder = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    };

    class AsyncFileReader {
      result = "data:audio/webm;base64,bmF0aXZlLXBhdXNl";
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL() {
        setTimeout(() => this.onloadend?.(), 10);
      }
    }

    vi.stubGlobal("FileReader", AsyncFileReader);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });

    vi.stubGlobal(
      "MediaRecorder",
      class {
        state = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;

        static isTypeSupported() {
          return true;
        }

        start() {
          this.state = "recording";
        }

        stop() {
          stopRecorder();
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["voice"], { type: "audio/webm" }) });
          this.onstop?.();
        }
      },
    );

    const { result } = renderHook(() => useNativeAudioRecorder());
    await waitFor(() => expect(nativeListeners.get("pause")).toBeTypeOf("function"));

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.isRecording).toBe(true);

    await act(async () => {
      nativeListeners.get("pause")?.();
    });

    expect(stopRecorder).toHaveBeenCalledTimes(1);
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    await waitFor(() => {
      expect(result.current.audioData).toBe("data:audio/webm;base64,bmF0aXZlLXBhdXNl");
    });
  });

  it("discards an active recording without producing audio data", async () => {
    const stopTrack = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    };

    class AsyncFileReader {
      result = "data:audio/webm;base64,dm9pY2U=";
      onloadend: (() => void) | null = null;

      readAsDataURL() {
        setTimeout(() => this.onloadend?.(), 10);
      }
    }

    vi.stubGlobal("FileReader", AsyncFileReader);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });

    vi.stubGlobal(
      "MediaRecorder",
      class {
        state = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;

        static isTypeSupported() {
          return true;
        }

        start() {
          this.state = "recording";
        }

        stop() {
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["voice"], { type: "audio/webm" }) });
          this.onstop?.();
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    let capture: Awaited<ReturnType<typeof result.current.discard>> | undefined;
    await act(async () => {
      capture = await result.current.discard();
    });

    expect(capture).toBeNull();
    expect(result.current.audioData).toBeNull();
    expect(stopTrack).toHaveBeenCalled();
  });

  it("returns the captured audio when stop is awaited", async () => {
    const stopTrack = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    };

    class AsyncFileReader {
      result = "data:audio/webm;base64,dm9pY2U=";
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL() {
        setTimeout(() => this.onloadend?.(), 10);
      }
    }

    vi.stubGlobal("FileReader", AsyncFileReader);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });

    vi.stubGlobal(
      "MediaRecorder",
      class {
        state = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;

        static isTypeSupported() {
          return true;
        }

        start() {
          this.state = "recording";
        }

        stop() {
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["voice"], { type: "audio/webm" }) });
          this.onstop?.();
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    let capture: Awaited<ReturnType<typeof result.current.stop>> | null = null;
    await act(async () => {
      capture = await result.current.stop();
    });

    expect(capture).toEqual(
      expect.objectContaining({
        data: "data:audio/webm;base64,dm9pY2U=",
        mimeType: "audio/webm",
      }),
    );
    expect(stopTrack).toHaveBeenCalled();
  });

  it("keeps an auto-stopped max-duration capture available for immediate save", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const stopTrack = vi.fn();
    const stopRecorder = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    };

    class AsyncFileReader {
      result = "data:audio/webm;base64,YXV0bw==";
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL() {
        setTimeout(() => this.onloadend?.(), 10);
      }
    }

    vi.stubGlobal("FileReader", AsyncFileReader);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });

    vi.stubGlobal(
      "MediaRecorder",
      class {
        state = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;

        static isTypeSupported() {
          return true;
        }

        start() {
          this.state = "recording";
        }

        stop() {
          stopRecorder();
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["auto"], { type: "audio/webm" }) });
          this.onstop?.();
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    vi.setSystemTime(MAX_AUDIO_DURATION_SEC * 1000);
    await act(async () => {
      vi.advanceTimersByTime(MAX_AUDIO_DURATION_SEC * 1000);
      await vi.runOnlyPendingTimersAsync();
    });

    let capture: Awaited<ReturnType<typeof result.current.stop>> | null = null;
    await act(async () => {
      capture = await result.current.stop();
    });

    expect(stopRecorder).toHaveBeenCalledTimes(1);
    expect(capture).toEqual(
      expect.objectContaining({
        data: "data:audio/webm;base64,YXV0bw==",
        mimeType: "audio/webm",
      }),
    );
    expect(stopTrack).toHaveBeenCalled();
  });

  it("clears raw audio chunks after stop, reset, and unmount paths", () => {
    expect(source).toContain("finally {\n          chunksRef.current = [];");
    expect(source).toContain("const reset = useCallback(() => {\n    setAudioData(null);\n    setDuration(0);\n    setError(null);");
    expect(source).toContain("pendingCaptureRef.current = null;\n    lastCompletedCaptureRef.current = null;\n    chunksRef.current = [];");
    expect(source).toContain("void stopActiveRecording({ discard: true });\n      if (timerRef.current) clearInterval(timerRef.current);\n      chunksRef.current = [];");
  });
});
