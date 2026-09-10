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
    previous?: () => void;
    next?: () => void;
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
      <button
        type="button"
        data-app-background-music-control="true"
        onClick={collectionMusic.previous}
      >
        previous
      </button>
      <button type="button" data-app-background-music-control="true" onClick={collectionMusic.next}>
        next
      </button>
    </>
  );
}

describe("useAppBackgroundMusic", () => {
  it("uses one animation-frame clock even when its origin differs from performance.now", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    const callbacks: FrameRequestCallback[] = [];
    const frames = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: "next" }));
      expect(callbacks).toHaveLength(1);
      await act(async () => {
        callbacks[0](0);
        callbacks[1](80);
      });
      expect(screen.getByTestId("music-state")).toHaveTextContent("playing");
      expect(screen.getByTestId("music-master")).toHaveTextContent("r7-moss-garden");
    } finally {
      frames.mockRestore();
    }
  });
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

  it("selects next and previous cyclically while off without enabling or prefetching music", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "previous" }));
    expect(screen.getByTestId("music-master")).toHaveTextContent("r7-home-beneath-clouds");
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("music-master")).toHaveTextContent("r7-shoji-rain");
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("music-master")).toHaveTextContent("r7-moss-garden");
    expect(screen.getByTestId("music-enabled")).toHaveTextContent("false");
    expect(screen.getByTestId("music-state")).toHaveTextContent("off");
    expect(localStorage.getItem("zenflow-app-background-music-cursor")).toBe('"r7-moss-garden"');
    expect(media.play).not.toHaveBeenCalled();
    expect(intentCache.request).not.toHaveBeenCalled();
  });

  it("changes a muted selection silently and respects the saved opt-in", async () => {
    localStorage.setItem("zenflow-app-background-music-enabled", "true");
    render(<Harness canPlay={false} volume={0} />);
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("music-master")).toHaveTextContent("r7-moss-garden");
    expect(media.play).not.toHaveBeenCalled();
    expect(screen.getByTestId("music-enabled")).toHaveTextContent("true");
  });

  it("releases music ownership when a manually selected master is comfort-blocked", async () => {
    render(<Harness blockedMaster="r7-moss-garden" />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("music-master")).toHaveTextContent("r7-moss-garden");
    expect(screen.getByTestId("music-state")).toHaveTextContent("paused");
    expect(getActiveLongAudioOwner()).toBeNull();
    expect(clearAppAudioMediaSession).toHaveBeenCalled();
  });

  it("keeps a failed cursor write from changing the selected track or playing on", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    const original = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value
    ) {
      if (key === "zenflow-app-background-music-cursor")
        throw new DOMException("Fixture quota", "QuotaExceededError");
      original.call(this, key, value);
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: "next" }));
      expect(screen.getByTestId("music-master")).toHaveTextContent("r7-shoji-rain");
      expect(screen.getByTestId("music-state")).toHaveTextContent("error");
      expect(getActiveLongAudioOwner()).toBeNull();
    } finally {
      write.mockRestore();
    }
  });

  it("cancels transport and fade work on unmount", async () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    unmount();
    const count = media.play.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(media.play).toHaveBeenCalledTimes(count);
    expect(getActiveLongAudioOwner()).toBeNull();
  });

  it("never steals Hyperfocus ownership when selecting a different track", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    let release!: () => void;
    const stopNature = vi.fn();
    act(() => {
      release = claimLongAudio("hyperfocus", stopNature);
    });
    media.play.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("music-master")).toHaveTextContent("r7-moss-garden");
    expect(getActiveLongAudioOwner()).toBe("hyperfocus");
    expect(stopNature).not.toHaveBeenCalled();
    expect(media.play).not.toHaveBeenCalled();
    act(() => release());
  });

  it("retains an explicit Media Session pause during selection and resumes deliberately", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    act(() => vi.mocked(setAppAudioMediaSession).mock.calls.at(-1)?.[0].onPause?.());
    media.play.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("music-master")).toHaveTextContent("r7-moss-garden");
    expect(screen.getByTestId("music-state")).toHaveTextContent("paused");
    expect(media.play).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
  });

  it("accumulates rapid requests from the latest cursor including a full-cycle return", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    media.play.mockClear();
    act(() => {
      for (let i = 0; i < 10; i += 1) screen.getByRole("button", { name: "next" }).click();
    });
    expect(screen.getByTestId("music-master")).toHaveTextContent("r7-shoji-rain");
    await waitFor(() => expect(media.play).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("music-state")).toHaveTextContent("playing");
    expect(document.querySelectorAll("audio")).toHaveLength(1);
  });

  it("does not let an older play result pause the newly selected playing track", async () => {
    const old = createDeferred();
    media.play.mockImplementationOnce(() => old.promise).mockResolvedValue(undefined);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("music-state")).toHaveTextContent("loading");
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    expect(screen.getByTestId("music-master")).toHaveTextContent("r7-moss-garden");
    const pauses = media.pause.mock.calls.length;
    await act(async () => old.resolve());
    expect(media.pause).toHaveBeenCalledTimes(pauses);
    expect(screen.getByTestId("music-state")).toHaveTextContent("playing");
  });

  it("cancels a pending transport boundary when music is disabled", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    act(() => {
      screen.getByRole("button", { name: "next" }).click();
      screen.getByRole("button", { name: "toggle" }).click();
    });
    const starts = media.play.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(screen.getByTestId("music-master")).toHaveTextContent("r7-moss-garden");
    expect(screen.getByTestId("music-state")).toHaveTextContent("off");
    expect(media.play).toHaveBeenCalledTimes(starts);
  });

  it("requests only the current and next full bodies when the user explicitly enables music", async () => {
    render(<Harness />);
    expect(intentCache.request).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));

    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));
    expect(intentCache.request).toHaveBeenCalledTimes(2);
    expect(intentCache.request).toHaveBeenCalledWith("sounds/music/r7-shoji-rain.mp3");
    expect(intentCache.request).toHaveBeenCalledWith("sounds/music/r7-moss-garden.mp3");
  });

  it("advances from Shoji Rain to Moss Garden with the same long-audio owner", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    expect(screen.getByTestId("music-master")).toHaveTextContent("r7-shoji-rain");
    fireEvent.ended(screen.getByTestId("music-audio"));

    await waitFor(() =>
      expect(screen.getByTestId("music-master")).toHaveTextContent("r7-moss-garden")
    );
    expect(localStorage.getItem("zenflow-app-background-music-cursor")).toBe('"r7-moss-garden"');
    expect(getActiveLongAudioOwner()).toBe("global-cloudlight");
  });

  it("pauses instead of bypassing a per-master audio-comfort exclusion", async () => {
    render(<Harness blockedMaster="r7-lantern-reflection" />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    fireEvent.ended(screen.getByTestId("music-audio"));
    await waitFor(() =>
      expect(screen.getByTestId("music-master")).toHaveTextContent("r7-moss-garden")
    );
    await waitFor(() => expect(screen.getByTestId("music-state")).toHaveTextContent("playing"));

    fireEvent.ended(screen.getByTestId("music-audio"));
    await waitFor(() =>
      expect(screen.getByTestId("music-master")).toHaveTextContent("r7-lantern-reflection")
    );
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
      expect.objectContaining({ title: "Shoji Rain", artist: "ZenFlow" })
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

  it("lets an explicit Shoji Rain toggle replace the current ambience owner", async () => {
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
      "r7-moss-garden",
      "r7-lantern-reflection",
      "r7-snow-over-cedar",
      "r7-paper-cranes",
      "r7-tea-room-dawn",
      "r7-river-stones",
      "r7-camellia-evening",
      "r7-temple-path",
      "r7-home-beneath-clouds",
    ];
    for (const expectedMaster of expectedAfterEachFailure) {
      fireEvent.error(screen.getByTestId("music-audio"));
      await waitFor(() =>
        expect(screen.getByTestId("music-master")).toHaveTextContent(expectedMaster)
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
