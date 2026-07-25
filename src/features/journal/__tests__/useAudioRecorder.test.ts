import { renderHook, act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { useAudioRecorder, type RecordedAudioCapture } from "../useAudioRecorder";
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

  it("cancels a pending microphone request and stops a stream granted after dismissal", async () => {
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] };
    let grantMicrophone!: (value: typeof stream) => void;
    const getUserMedia = vi.fn(
      () => new Promise<typeof stream>((resolve) => {
        grantMicrophone = resolve;
      }),
    );
    const constructRecorder = vi.fn();

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }

        constructor() {
          constructRecorder();
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());
    let startRequest!: Promise<void>;
    act(() => {
      startRequest = result.current.start();
    });
    await waitFor(() => expect(result.current.isRequestingPermission).toBe(true));

    await act(async () => {
      await result.current.discard();
    });
    expect(result.current.isRequestingPermission).toBe(false);

    await act(async () => {
      grantMicrophone(stream);
      await startRequest;
    });

    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(constructRecorder).not.toHaveBeenCalled();
    expect(result.current.isRecording).toBe(false);
    expect(result.current.error).toBeNull();
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

  it("lets MediaRecorder choose its default encoder when explicit MIME candidates are unsupported", async () => {
    const stopTrack = vi.fn();
    const constructorOptions = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] };

    class FileReaderMock {
      result = "data:audio/ogg;base64,dm9pY2U=";
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.onloadend?.();
      }
    }

    vi.stubGlobal("FileReader", FileReaderMock);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        state = "inactive";
        mimeType = "audio/ogg;codecs=opus";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;

        static isTypeSupported() {
          return false;
        }

        constructor(_stream: unknown, options: MediaRecorderOptions) {
          constructorOptions(options);
        }

        start() {
          this.state = "recording";
        }

        stop() {
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["voice"], { type: this.mimeType }) });
          this.onstop?.();
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());

    let capture: Awaited<ReturnType<typeof result.current.stop>> | null = null;
    await act(async () => {
      capture = await result.current.stop();
    });

    expect(constructorOptions).toHaveBeenCalledWith({ audioBitsPerSecond: 64_000 });
    expect((capture as RecordedAudioCapture | null)?.mimeType).toBe("audio/ogg");
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  it("pauses and resumes without counting paused time toward the recording duration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
    const stopTrack = vi.fn();
    const pauseRecorder = vi.fn();
    const resumeRecorder = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] };

    class FileReaderMock {
      result = "data:audio/webm;base64,dm9pY2U=";
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.onloadend?.();
      }
    }

    vi.stubGlobal("FileReader", FileReaderMock);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        state: RecordingState = "inactive";
        mimeType = "audio/webm";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;

        static isTypeSupported() {
          return true;
        }

        start() {
          this.state = "recording";
        }

        pause() {
          pauseRecorder();
          this.state = "paused";
        }

        resume() {
          resumeRecorder();
          this.state = "recording";
        }

        stop() {
          this.state = "inactive";
          this.ondataavailable?.({ data: new Blob(["voice"], { type: this.mimeType }) });
          this.onstop?.();
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.duration).toBe(2);

    act(() => result.current.pause());
    expect(result.current.isPaused).toBe(true);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.duration).toBe(2);

    act(() => result.current.resume());
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(result.current.duration).toBe(4);

    let capture: RecordedAudioCapture | null = null;
    await act(async () => {
      capture = await result.current.stop();
    });

    expect((capture as RecordedAudioCapture | null)?.duration).toBe(4);
    expect(pauseRecorder).toHaveBeenCalledTimes(1);
    expect(resumeRecorder).toHaveBeenCalledTimes(1);
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  it("rejects a stopped recording when the browser produced no audio bytes", async () => {
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] };
    const fileReader = vi.fn();

    vi.stubGlobal("FileReader", fileReader);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        state = "inactive";
        mimeType = "audio/webm";
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
          this.onstop?.();
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());

    await act(async () => {
      await expect(result.current.stop()).rejects.toThrow(/no audio/i);
    });

    expect(result.current.audioData).toBeNull();
    expect(result.current.error).toBe("Recording failed");
    expect(fileReader).not.toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalledTimes(1);
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

  it("lets discard win while a stopped recording is still being encoded", async () => {
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] };
    let finishEncoding: (() => void) | undefined;

    class DeferredFileReader {
      result = "data:audio/webm;base64,dm9pY2U=";
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL() {
        finishEncoding = () => this.onloadend?.();
      }
    }

    vi.stubGlobal("FileReader", DeferredFileReader);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        state = "inactive";
        mimeType = "audio/webm";
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
          this.ondataavailable?.({ data: new Blob(["voice"], { type: this.mimeType }) });
          this.onstop?.();
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());

    let stopped: Promise<RecordedAudioCapture | null> | undefined;
    act(() => {
      stopped = result.current.stop();
    });
    await waitFor(() => expect(finishEncoding).toBeTypeOf("function"));

    await act(async () => {
      await expect(result.current.discard()).resolves.toBeNull();
      finishEncoding?.();
      await expect(stopped).resolves.toBeNull();
    });

    expect(result.current.audioData).toBeNull();
    expect(stopTrack).toHaveBeenCalledTimes(1);
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

    await act(async () => {
      vi.advanceTimersByTime(MAX_AUDIO_DURATION_SEC * 1000);
      await vi.advanceTimersByTimeAsync(20);
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

  it("rejects a finalization that never receives a terminal recorder event", async () => {
    vi.useFakeTimers();
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] };

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
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());

    let finalization!: Promise<RecordedAudioCapture | null>;
    act(() => {
      finalization = result.current.stop();
    });
    const rejectedFinalization = expect(finalization).rejects.toThrow("timed out");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    await rejectedFinalization;
    expect(result.current.isFinalizing).toBe(false);
    expect(result.current.audioData).toBeNull();
    expect(stopTrack).toHaveBeenCalled();
  });

  it("caps capture metadata when a stalled timer observes the stop after five minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const stream = { getTracks: () => [{ stop: vi.fn() }] };

    class FileReaderMock {
      result = "data:audio/webm;base64,bGF0ZQ==";
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.onloadend?.();
      }
    }

    vi.stubGlobal("FileReader", FileReaderMock);
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
          this.ondataavailable?.({ data: new Blob(["late"], { type: "audio/webm" }) });
          this.onstop?.();
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => result.current.start());
    vi.setSystemTime((MAX_AUDIO_DURATION_SEC + 5) * 1000);

    let capture: RecordedAudioCapture | null = null;
    await act(async () => {
      capture = await result.current.stop();
    });

    expect(capture).toEqual(
      expect.objectContaining({ duration: MAX_AUDIO_DURATION_SEC }),
    );
  });

  it("clears raw chunks after completion/reset while preserving active teardown capture", () => {
    expect(source).toContain("finally {\n          chunksRef.current = [];");
    expect(source).toContain("const reset = useCallback(() => {\n    cancelPendingStart();\n    setAudioData(null);\n    setDuration(0);\n    setIsPaused(false);\n    setError(null);");
    expect(source).toContain("pendingCaptureRef.current = null;\n    lastCompletedCaptureRef.current = null;\n    chunksRef.current = [];");
    expect(source).toContain("mediaRecorderRef.current?.state === 'recording' ||\n        mediaRecorderRef.current?.state === 'paused'");
    expect(source).toContain("void stopActiveRecording();");
    expect(source).toContain("} else {\n        chunksRef.current = [];");
  });
});
