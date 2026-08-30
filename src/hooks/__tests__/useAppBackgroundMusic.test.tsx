import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useAppBackgroundMusic } from "../useAppBackgroundMusic";
import { clearAppAudioMediaSession, setAppAudioMediaSession } from "@/lib/audioMediaSession";
import { claimLongAudio, getActiveLongAudioOwner } from "@/lib/audioPlaybackCoordinator";

const lifecycle = vi.hoisted(() => ({
  pause: null as null | (() => void),
  resume: null as null | (() => void | Promise<void>),
}));

const intentCache = vi.hoisted(() => ({
  request: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/audioLifecycle", () => ({
  registerAudioBackgroundPauseHandler: vi.fn((handler: () => void) => {
    lifecycle.pause = handler;
    return () => {
      if (lifecycle.pause === handler) lifecycle.pause = null;
    };
  }),
  registerAudioForegroundResumeHandler: vi.fn((handler: () => void | Promise<void>) => {
    lifecycle.resume = handler;
    return () => {
      if (lifecycle.resume === handler) lifecycle.resume = null;
    };
  }),
}));

vi.mock("@/lib/audioMediaSession", () => ({
  clearAppAudioMediaSession: vi.fn(),
  setAppAudioMediaSession: vi.fn(),
}));

vi.mock("@/lib/runtimeAudioCache", () => ({
  requestRuntimeAudioCacheOnIntent: intentCache.request,
}));

const media = vi.hoisted(() => ({
  play: vi.fn<() => Promise<void>>(),
  pause: vi.fn(),
  load: vi.fn(),
}));

function createDeferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function Harness({ canPlay = true, volume = 0.18 }: { canPlay?: boolean; volume?: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const music = useAppBackgroundMusic({ audioRef, canPlay, volume });

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} data-testid="music-audio" onError={music.handleMediaError} />
      <output data-testid="music-state">{music.state}</output>
      <output data-testid="music-enabled">{String(music.enabled)}</output>
      <button type="button" onClick={music.toggle}>
        toggle
      </button>
      <button type="button" onClick={music.retry}>
        retry
      </button>
    </>
  );
}

describe("useAppBackgroundMusic", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    lifecycle.pause = null;
    lifecycle.resume = null;
    media.play.mockReset().mockResolvedValue(undefined);
    media.pause.mockReset();
    media.load.mockReset();
    intentCache.request.mockClear();
    vi.mocked(clearAppAudioMediaSession).mockClear();
    vi.mocked(setAppAudioMediaSession).mockClear();
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: media.play,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: media.pause,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: media.load,
    });
  });

  it("keeps first-ever playback off without touching the media element", () => {
    render(<Harness />);

    expect(screen.getByTestId("music-enabled")).toHaveTextContent("false");
    expect(screen.getByTestId("music-state")).toHaveTextContent("off");
    expect(media.play).not.toHaveBeenCalled();
    expect(intentCache.request).not.toHaveBeenCalled();
  });

  it("requests a full runtime cache body only when the user explicitly enables Cloudlight", async () => {
    render(<Harness />);
    expect(intentCache.request).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));

    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    expect(intentCache.request).toHaveBeenCalledTimes(1);
    expect(intentCache.request).toHaveBeenCalledWith("sounds/cloudlight-evening-loop.mp3");
  });

  it("starts a saved opt-in on entry when the platform permits playback", async () => {
    localStorage.setItem("zenflow-app-background-music-enabled", "true");
    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    expect(media.play).toHaveBeenCalledTimes(1);
    expect(setAppAudioMediaSession).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Cloudlight Evening", artist: "ZenFlow" })
    );
  });

  it("turns autoplay rejection into blocked state and resumes on the first eligible gesture", async () => {
    localStorage.setItem("zenflow-app-background-music-enabled", "true");
    media.play
      .mockRejectedValueOnce(new DOMException("gesture required", "NotAllowedError"))
      .mockResolvedValueOnce(undefined);
    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("blocked"));
    document.dispatchEvent(new Event("pointerdown"));

    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    expect(media.play).toHaveBeenCalledTimes(2);
  });

  it("does not let a stale play promise revive music after the user turns it off", async () => {
    const deferred = createDeferred();
    media.play.mockReturnValueOnce(deferred.promise);
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("music-state")).toHaveTextContent("loading");

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("music-state")).toHaveTextContent("off");
    expect(media.pause).toHaveBeenCalled();

    deferred.resolve();
    await act(async () => deferred.promise);
    expect(screen.getByTestId("music-state")).toHaveTextContent("off");
    expect(setAppAudioMediaSession).not.toHaveBeenCalled();
  });

  it("keeps the opt-in paused while master or comfort playback is unavailable", async () => {
    localStorage.setItem("zenflow-app-background-music-enabled", "true");
    const view = render(<Harness canPlay={false} />);

    expect(screen.getByTestId("music-enabled")).toHaveTextContent("true");
    expect(screen.getByTestId("music-state")).toHaveTextContent("paused");
    expect(media.play).not.toHaveBeenCalled();

    view.rerender(<Harness canPlay />);
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
  });

  it("pauses in background and retries foreground playback through the lifecycle handlers", async () => {
    localStorage.setItem("zenflow-app-background-music-enabled", "true");
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    act(() => lifecycle.pause?.());
    expect(screen.getByTestId("music-state")).toHaveTextContent("paused");
    expect(media.pause).toHaveBeenCalled();

    await act(async () => {
      await lifecycle.resume?.();
    });
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
  });

  it("stays paused when another owner releases after the app enters the background", async () => {
    localStorage.setItem("zenflow-app-background-music-enabled", "true");
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    let releaseHyperfocus: () => void = () => undefined;
    act(() => {
      releaseHyperfocus = claimLongAudio("hyperfocus", vi.fn());
    });
    expect(screen.getByTestId("music-state")).toHaveTextContent("paused");

    media.play.mockClear();
    act(() => {
      lifecycle.pause?.();
      releaseHyperfocus();
    });
    await act(async () => Promise.resolve());

    expect(screen.getByTestId("music-state")).toHaveTextContent("paused");
    expect(media.play).not.toHaveBeenCalled();

    await act(async () => {
      await lifecycle.resume?.();
    });
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
  });

  it("does not reclaim ownership when visibility hides before the lifecycle pause task", async () => {
    localStorage.setItem("zenflow-app-background-music-enabled", "true");
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    let releaseDiary: () => void = () => undefined;
    act(() => {
      releaseDiary = claimLongAudio("diary-rain", vi.fn());
    });
    expect(screen.getByTestId("music-state")).toHaveTextContent("paused");

    media.play.mockClear();
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      releaseDiary();
    });
    await act(async () => Promise.resolve());

    expect(screen.getByTestId("music-state")).toHaveTextContent("paused");
    expect(media.play).not.toHaveBeenCalled();
  });

  it("yields to explicit ambience and reclaims playback after that owner releases", async () => {
    localStorage.setItem("zenflow-app-background-music-enabled", "true");
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    media.pause.mockClear();
    let releaseAmbience: () => void = () => undefined;
    act(() => {
      releaseAmbience = claimLongAudio("orb-water", vi.fn());
    });

    expect(screen.getByTestId("music-state")).toHaveTextContent("paused");
    expect(media.pause).toHaveBeenCalledTimes(1);

    media.play.mockClear();
    act(() => releaseAmbience());

    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    expect(media.play).toHaveBeenCalledTimes(1);
  });

  it("lets an explicit Cloudlight toggle replace the current ambience owner", async () => {
    const pauseOrb = vi.fn();
    const releaseOrb = claimLongAudio("orb-water", pauseOrb);
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));

    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    expect(pauseOrb).toHaveBeenCalledTimes(1);
    expect(media.play).toHaveBeenCalledTimes(1);
    expect(getActiveLongAudioOwner()).toBe("global-cloudlight");
    releaseOrb();
  });

  it("surfaces a media error and supports an explicit retry", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    fireEvent.error(screen.getByTestId("music-audio"));
    expect(screen.getByTestId("music-state")).toHaveTextContent("error");

    media.play.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    expect(media.load).toHaveBeenCalledTimes(1);
  });
});
