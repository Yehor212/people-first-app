import { beforeEach, describe, expect, it, vi } from "vitest";

describe("long audio playback coordinator", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("pauses the previous owner when a new long ambience claims playback", async () => {
    const { claimLongAudio, getActiveLongAudioOwner } = await import(
      "../audioPlaybackCoordinator"
    );
    const pauseGlobal = vi.fn();
    const pauseOrb = vi.fn();

    const releaseGlobal = claimLongAudio("global-cloudlight", pauseGlobal);
    const releaseOrb = claimLongAudio("orb-water", pauseOrb);

    expect(pauseGlobal).toHaveBeenCalledTimes(1);
    expect(pauseOrb).not.toHaveBeenCalled();
    expect(getActiveLongAudioOwner()).toBe("orb-water");

    releaseOrb();
    releaseGlobal();
  });

  it("does not let a stale release clear the newer owner", async () => {
    const { claimLongAudio, getActiveLongAudioOwner } = await import(
      "../audioPlaybackCoordinator"
    );
    const releaseGlobal = claimLongAudio("global-cloudlight", vi.fn());
    const releaseDiary = claimLongAudio("diary-rain", vi.fn());

    releaseGlobal();
    expect(getActiveLongAudioOwner()).toBe("diary-rain");

    releaseDiary();
    expect(getActiveLongAudioOwner()).toBeNull();
  });

  it("refreshes a same-owner claim without pausing that owner", async () => {
    const { claimLongAudio, getActiveLongAudioOwner } = await import(
      "../audioPlaybackCoordinator"
    );
    const firstPause = vi.fn();
    const secondPause = vi.fn();
    const releaseFirst = claimLongAudio("hyperfocus", firstPause);
    const releaseSecond = claimLongAudio("hyperfocus", secondPause);

    expect(firstPause).not.toHaveBeenCalled();
    expect(secondPause).not.toHaveBeenCalled();
    expect(getActiveLongAudioOwner()).toBe("hyperfocus");

    releaseFirst();
    expect(getActiveLongAudioOwner()).toBe("hyperfocus");
    releaseSecond();
    expect(getActiveLongAudioOwner()).toBeNull();
  });

  it("publishes exact owner transitions and stops after unsubscribe", async () => {
    const { claimLongAudio, subscribeLongAudioOwner } = await import(
      "../audioPlaybackCoordinator"
    );
    const listener = vi.fn();
    const unsubscribe = subscribeLongAudioOwner(listener);
    const release = claimLongAudio("auth-soft-air", vi.fn());

    expect(listener).toHaveBeenNthCalledWith(1, "auth-soft-air");
    release();
    expect(listener).toHaveBeenNthCalledWith(2, null);

    unsubscribe();
    const releaseAfterUnsubscribe = claimLongAudio("orb-water", vi.fn());
    expect(listener).toHaveBeenCalledTimes(2);
    releaseAfterUnsubscribe();
  });
});
