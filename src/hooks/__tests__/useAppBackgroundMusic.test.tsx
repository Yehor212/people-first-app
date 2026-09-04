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

function Harness({
  canPlay = true,
  blockedMaster,
  volume = 0.18,
}: {
  canPlay?: boolean;
  blockedMaster?: string;
  volume?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const music = useAppBackgroundMusic({
    audioRef,
    canPlay,
    canPlayMaster: (id) => id !== blockedMaster,
    canPlayMasterRevision: blockedMaster ?? "",
    volume,
  });
  const collectionMusic = music as typeof music & {
    activeMasterId?: string;
    handleMediaEnded?: () => void;
    handleMediaTimeUpdate?: () => void;
  };

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        data-testid="music-audio"
        onError={music.handleMediaError}
        onEnded={collectionMusic.handleMediaEnded}
        onTimeUpdate={collectionMusic.handleMediaTimeUpdate}
      />
      <output data-testid="music-state">{music.state}</output>
      <output data-testid="music-enabled">{String(music.enabled)}</output>
      <output data-testid="music-master">{collectionMusic.activeMasterId}</output>
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

  it("requests only the current and next full bodies when the user explicitly enables music", async () => {
    render(<Harness />);
    expect(intentCache.request).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));

    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    expect(intentCache.request).toHaveBeenCalledTimes(2);
    expect(intentCache.request).toHaveBeenCalledWith("sounds/cloudlight-evening-loop.mp3");
    expect(intentCache.request).toHaveBeenCalledWith("sounds/music/lantern-air.mp3");
  });

  it("advances from Cloudlight to Lantern Air with the same long-audio owner", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    expect(screen.getByTestId("music-master")).toHaveTextContent("cloudlight-evening-loop");
    fireEvent.ended(screen.getByTestId("music-audio"));

    await waitFor(() => expect(screen.getByTestId("music-master")).toHaveTextContent("lantern-air"));
    expect(localStorage.getItem("zenflow-app-background-music-cursor")).toBe('"lantern-air"');
    expect(getActiveLongAudioOwner()).toBe("global-cloudlight");
  });

  it("pauses instead of bypassing a per-master audio-comfort exclusion", async () => {
    render(<Harness blockedMaster="rain-on-paper" />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    fireEvent.ended(screen.getByTestId("music-audio"));
    await waitFor(() => expect(screen.getByTestId("music-master")).toHaveTextContent("lantern-air"));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    fireEvent.ended(screen.getByTestId("music-audio"));
    await waitFor(() => expect(screen.getByTestId("music-master")).toHaveTextContent("rain-on-paper"));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("paused"));
  });

  it("softens the final 600 ms before advancing without adding a second player", async () => {
    render(<Harness volume={0.2} />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    const audio = screen.getByTestId<HTMLAudioElement>("music-audio");
    Object.defineProperty(audio, "duration", { configurable: true, value: 150 });
    Object.defineProperty(audio, "currentTime", { configurable: true, value: 149.7 });
    fireEvent.timeUpdate(audio);
    expect(screen.getByTestId("music-state")).toHaveTextContent("fading");
    expect(audio.volume).toBeCloseTo(0.1, 2);
    expect(screen.getAllByTestId("music-audio")).toHaveLength(1);
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

  it("resumes when WebView visibility becomes visible after an earlier native resume race", async () => {
    localStorage.setItem("zenflow-app-background-music-enabled", "true");
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByTestId("music-state")).toHaveTextContent("paused");

    media.play.mockClear();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    expect(media.play).toHaveBeenCalledTimes(1);
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

  it("skips each failing master once, then surfaces a bounded collection error", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    const expectedAfterEachFailure = [
      "lantern-air",
      "rain-on-paper",
      "indigo-dusk",
      "quiet-courtyard",
      "moonlit-water",
      "cedar-mist",
      "glass-bell-dawn",
      "moss-garden",
      "after-rain",
    ];
    for (const expectedMaster of expectedAfterEachFailure) {
      fireEvent.error(screen.getByTestId("music-audio"));
      await waitFor(() =>
        expect(screen.getByTestId("music-master")).toHaveTextContent(expectedMaster),
      );
      await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    }

    fireEvent.error(screen.getByTestId("music-audio"));
    expect(screen.getByTestId("music-state")).toHaveTextContent("error");

    const loadCountBeforeRetry = media.load.mock.calls.length;
    media.play.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    expect(media.load).toHaveBeenCalledTimes(loadCountBeforeRetry + 1);
  });
});
