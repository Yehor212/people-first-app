import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  getAppBackgroundMusicEnabled,
  getAppBackgroundMusicCursor,
  subscribeAppBackgroundMusicPreference,
  trySetAppBackgroundMusicEnabled,
  trySetAppBackgroundMusicCursor,
} from "@/lib/appBackgroundMusicPreference";
import {
  APP_BACKGROUND_MUSIC_COLLECTION,
  getAppAudioAsset,
  getNextBackgroundMusicAsset,
  getPreviousBackgroundMusicAsset,
  type AppBackgroundMusicAssetId,
} from "@/lib/appAudioAssets";
import {
  registerAudioBackgroundPauseHandler,
  registerAudioForegroundResumeHandler,
} from "@/lib/audioLifecycle";
import { clearAppAudioMediaSession, setAppAudioMediaSession } from "@/lib/audioMediaSession";
import {
  claimLongAudio,
  getActiveLongAudioOwner,
  subscribeLongAudioOwner,
} from "@/lib/audioPlaybackCoordinator";
import { logger } from "@/lib/logger";
import { requestRuntimeAudioCacheOnIntent } from "@/lib/runtimeAudioCache";

export type AppBackgroundMusicState =
  | "off"
  | "blocked"
  | "loading"
  | "playing"
  | "fading"
  | "paused"
  | "recovering"
  | "error";

interface UseAppBackgroundMusicOptions {
  audioRef: RefObject<HTMLAudioElement | null>;
  canPlay: boolean;
  canPlayMaster?: (id: AppBackgroundMusicAssetId) => boolean;
  canPlayMasterRevision?: string;
  volume: number;
}

export interface AppBackgroundMusicControl {
  enabled: boolean;
  state: AppBackgroundMusicState;
  activeMasterId: AppBackgroundMusicAssetId;
  sourceMasterId: AppBackgroundMusicAssetId;
  toggle: () => void;
  retry: () => void;
  previous: () => void;
  next: () => void;
  handleMediaError: () => void;
  handleMediaEnded: () => void;
  handleMediaTimeUpdate: () => void;
}

const PLAYBACK_OWNER = "global-cloudlight" as const;
const AUTOPLAY_GESTURES = ["pointerdown", "touchstart", "touchend", "keydown"] as const;
const BACKGROUND_MUSIC_CONTROL_SELECTOR = "[data-app-background-music-control]";
type PlaybackStartIntent = "automatic" | "explicit";

function isDocumentHidden(): boolean {
  return typeof document !== "undefined" && document.hidden;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function isAutoplayRejection(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "NotAllowedError"
  );
}

export function useAppBackgroundMusic({
  audioRef,
  canPlay,
  canPlayMaster,
  canPlayMasterRevision,
  volume,
}: UseAppBackgroundMusicOptions): AppBackgroundMusicControl {
  const [enabled, setEnabled] = useState(() => getAppBackgroundMusicEnabled());
  const [activeMasterId, setActiveMasterId] = useState<AppBackgroundMusicAssetId>(() =>
    getAppBackgroundMusicCursor()
  );
  const [state, setState] = useState<AppBackgroundMusicState>(() =>
    getAppBackgroundMusicEnabled() && !canPlay ? "paused" : "off"
  );
  const [sourceMasterId, setSourceMasterId] = useState(activeMasterId);
  const [sourceRevision, setSourceRevision] = useState(0);
  const mountedRef = useRef(true);
  const enabledRef = useRef(enabled);
  const activeMasterIdRef = useRef(activeMasterId);
  const canPlayRef = useRef(canPlay);
  const canPlayMasterRef = useRef(canPlayMaster);
  const stateRef = useRef(state);
  const requestIdRef = useRef(0);
  const activeAttemptRef = useRef<number | null>(null);
  const releaseOwnershipRef = useRef<(() => void) | null>(null);
  const gestureCleanupRef = useRef<(() => void) | null>(null);
  const allowOwnerReleaseResumeRef = useRef(true);
  const foregroundRef = useRef(!isDocumentHidden());
  const pendingTrackStartRef = useRef(false);
  const failedMasterIdsRef = useRef(new Set<AppBackgroundMusicAssetId>());
  const explicitPauseRef = useRef(false);
  const trackChangePendingRef = useRef(false);
  const fadeFrameRef = useRef<number | null>(null);
  const fadeGenerationRef = useRef(0);
  const fadeInRef = useRef(false);
  const volumeRef = useRef(volume);
  const selectManuallyRef = useRef<((direction: -1 | 1) => void) | null>(null);

  enabledRef.current = enabled;
  canPlayRef.current = canPlay;
  canPlayMasterRef.current = canPlayMaster;
  volumeRef.current = volume;

  const canPlayActiveMaster = useCallback(
    () => canPlayRef.current && (canPlayMasterRef.current?.(activeMasterIdRef.current) ?? true),
    []
  );

  const cacheCurrentAndNext = useCallback(() => {
    const current = getAppAudioAsset(activeMasterIdRef.current);
    const next = getNextBackgroundMusicAsset(activeMasterIdRef.current);
    for (const asset of [current, next]) {
      if (!asset) continue;
      void requestRuntimeAudioCacheOnIntent(asset.publicPath).catch((error) =>
        logger.warn("[AppBackgroundMusic] Intent cache request failed:", error)
      );
    }
  }, []);

  const transition = useCallback((nextState: AppBackgroundMusicState) => {
    stateRef.current = nextState;
    if (mountedRef.current) setState(nextState);
  }, []);

  const clearGestureRetry = useCallback(() => {
    gestureCleanupRef.current?.();
    gestureCleanupRef.current = null;
  }, []);

  const cancelFade = useCallback(() => {
    fadeGenerationRef.current += 1;
    if (fadeFrameRef.current !== null) cancelAnimationFrame(fadeFrameRef.current);
    fadeFrameRef.current = null;
  }, []);

  const fadeVolumeTo = useCallback(
    (target: number, duration: number, complete?: () => void) => {
      cancelFade();
      const audio = audioRef.current;
      if (!audio) return;
      const generation = fadeGenerationRef.current;
      const from = audio.volume;
      const to = clampVolume(target);
      let started: number | null = null;
      const tick = (now: number) => {
        if (!mountedRef.current || generation !== fadeGenerationRef.current) return;
        // Use the frame clock for both ends; embedding/test hosts may expose a
        // different performance.now origin from the document's frame timestamp.
        started ??= now;
        const progress = Math.min(1, Math.max(0, (now - started) / duration));
        audio.volume = clampVolume(from + (to - from) * progress);
        if (progress < 1) {
          fadeFrameRef.current = requestAnimationFrame(tick);
        } else {
          fadeFrameRef.current = null;
          complete?.();
        }
      };
      fadeFrameRef.current = requestAnimationFrame(tick);
    },
    [audioRef, cancelFade]
  );

  const commitSelectedSource = useCallback((shouldStart: boolean) => {
    trackChangePendingRef.current = false;
    pendingTrackStartRef.current = shouldStart;
    setSourceMasterId(activeMasterIdRef.current);
    // A full cycle can select the same ID; its explicit restart still needs a boundary.
    setSourceRevision((revision) => revision + 1);
  }, []);

  const releaseOwnership = useCallback(() => {
    const release = releaseOwnershipRef.current;
    if (!release) return;

    const releasesActiveGlobalOwner = getActiveLongAudioOwner() === PLAYBACK_OWNER;
    if (releasesActiveGlobalOwner) allowOwnerReleaseResumeRef.current = false;
    releaseOwnershipRef.current = null;
    release();
    if (releasesActiveGlobalOwner) {
      queueMicrotask(() => {
        allowOwnerReleaseResumeRef.current = true;
      });
    }
  }, []);

  const pausePlayback = useCallback(
    (nextState: AppBackgroundMusicState) => {
      requestIdRef.current += 1;
      activeAttemptRef.current = null;
      cancelFade();
      fadeInRef.current = false;
      pendingTrackStartRef.current = false;
      if (trackChangePendingRef.current) commitSelectedSource(false);
      clearGestureRetry();
      transition(nextState);
      audioRef.current?.pause();
      const owner = getActiveLongAudioOwner();
      releaseOwnership();
      if (owner === PLAYBACK_OWNER || owner === null) clearAppAudioMediaSession();
    },
    [audioRef, cancelFade, clearGestureRetry, commitSelectedSource, releaseOwnership, transition]
  );

  const startPlayback = useCallback(
    async (intent: PlaybackStartIntent = "automatic"): Promise<void> => {
      const audio = audioRef.current;
      if (!audio || !enabledRef.current) {
        transition("off");
        return;
      }
      if (intent === "explicit") {
        explicitPauseRef.current = false;
        cacheCurrentAndNext();
      }
      if (trackChangePendingRef.current) return;
      if (explicitPauseRef.current && intent === "automatic") return;
      if (!foregroundRef.current || isDocumentHidden()) {
        pausePlayback("paused");
        return;
      }
      if (!canPlayActiveMaster()) {
        pausePlayback("paused");
        return;
      }
      if (activeAttemptRef.current !== null) return;
      if (stateRef.current === "playing" && releaseOwnershipRef.current) return;

      const activeOwner = getActiveLongAudioOwner();
      if (
        intent === "automatic" &&
        activeOwner &&
        (activeOwner !== PLAYBACK_OWNER || !releaseOwnershipRef.current)
      ) {
        transition("paused");
        return;
      }

      clearGestureRetry();
      audio.volume = fadeInRef.current ? 0 : clampVolume(volumeRef.current);

      if (!releaseOwnershipRef.current) {
        releaseOwnershipRef.current = claimLongAudio(PLAYBACK_OWNER, () => {
          pausePlayback(enabledRef.current ? "paused" : "off");
        });
      }

      const requestId = ++requestIdRef.current;
      activeAttemptRef.current = requestId;
      transition("loading");

      try {
        await Promise.resolve(audio.play());
        // A new request owns this element now. Pausing here would stop the NEW track.
        if (requestIdRef.current !== requestId) return;
        if (
          !enabledRef.current ||
          !foregroundRef.current ||
          !canPlayActiveMaster() ||
          getActiveLongAudioOwner() !== PLAYBACK_OWNER
        ) {
          audio.pause();
          return;
        }

        activeAttemptRef.current = null;
        transition("playing");
        if (fadeInRef.current) {
          fadeInRef.current = false;
          fadeVolumeTo(volumeRef.current, 120);
        }
        setAppAudioMediaSession({
          title: getAppAudioAsset(activeMasterIdRef.current)?.fallbackLabel ?? "ZenFlow",
          artist: "ZenFlow",
          onPlay: () => {
            void startPlayback("explicit");
          },
          onPause: () => {
            explicitPauseRef.current = true;
            pausePlayback(enabledRef.current ? "paused" : "off");
          },
          onStop: () => {
            explicitPauseRef.current = true;
            pausePlayback(enabledRef.current ? "paused" : "off");
          },
          onPrevious: () => {
            if (getActiveLongAudioOwner() === PLAYBACK_OWNER) selectManuallyRef.current?.(-1);
          },
          onNext: () => {
            if (getActiveLongAudioOwner() === PLAYBACK_OWNER) selectManuallyRef.current?.(1);
          },
        });
      } catch (error) {
        if (requestIdRef.current !== requestId) return;

        activeAttemptRef.current = null;
        clearAppAudioMediaSession();
        if (isAutoplayRejection(error)) {
          transition("blocked");
          releaseOwnership();

          let active = true;
          const retryFromGesture = (event: Event) => {
            if (!active) return;
            if (
              event.target instanceof Element &&
              event.target.closest(BACKGROUND_MUSIC_CONTROL_SELECTOR)
            ) {
              return;
            }
            clearGestureRetry();
            void startPlayback("explicit");
          };
          gestureCleanupRef.current = () => {
            if (!active) return;
            active = false;
            for (const eventName of AUTOPLAY_GESTURES) {
              document.removeEventListener(eventName, retryFromGesture, true);
            }
          };
          for (const eventName of AUTOPLAY_GESTURES) {
            document.addEventListener(eventName, retryFromGesture, {
              capture: true,
              passive: true,
            });
          }
          return;
        }

        transition("error");
        releaseOwnership();
        logger.warn("[AppBackgroundMusic] Playback failed:", error);
      }
    },
    [
      audioRef,
      cacheCurrentAndNext,
      canPlayActiveMaster,
      clearGestureRetry,
      fadeVolumeTo,
      pausePlayback,
      releaseOwnership,
      transition,
    ]
  );

  const applyEnabled = useCallback(
    (nextEnabled: boolean, intent: PlaybackStartIntent = "automatic") => {
      enabledRef.current = nextEnabled;
      setEnabled(nextEnabled);
      if (!nextEnabled) {
        explicitPauseRef.current = false;
        pausePlayback("off");
        return;
      }
      if (!canPlayActiveMaster()) {
        pausePlayback("paused");
        return;
      }
      void startPlayback(intent);
    },
    [canPlayActiveMaster, pausePlayback, startPlayback]
  );

  const toggle = useCallback(() => {
    const result = trySetAppBackgroundMusicEnabled(!enabledRef.current);
    if (!result.ok) {
      logger.warn("[AppBackgroundMusic] Failed to persist the playback preference");
      return;
    }
    applyEnabled(result.enabled, "explicit");
  }, [applyEnabled]);

  const retry = useCallback(() => {
    if (!enabledRef.current) return;
    failedMasterIdsRef.current.clear();
    if (stateRef.current === "error" && activeAttemptRef.current === null) {
      try {
        audioRef.current?.load();
      } catch (error) {
        logger.warn("[AppBackgroundMusic] Media reload failed:", error);
      }
    }
    void startPlayback("explicit");
  }, [audioRef, startPlayback]);

  const selectMaster = useCallback(
    (direction: -1 | 1, reason: "manual" | "ended" | "error") => {
      const previousState = stateRef.current;
      const next =
        direction === 1
          ? getNextBackgroundMusicAsset(activeMasterIdRef.current)
          : getPreviousBackgroundMusicAsset(activeMasterIdRef.current);
      const persisted = trySetAppBackgroundMusicCursor(next.id);
      if (!persisted.ok) {
        pausePlayback("error");
        logger.warn("[AppBackgroundMusic] Failed to persist the collection cursor");
        return;
      }
      requestIdRef.current += 1;
      activeAttemptRef.current = null;
      cancelFade();
      clearGestureRetry();
      if (reason === "manual") failedMasterIdsRef.current.clear();
      activeMasterIdRef.current = persisted.cursor;
      setActiveMasterId(persisted.cursor);
      const owner = getActiveLongAudioOwner();
      const shouldStart =
        enabledRef.current &&
        !explicitPauseRef.current &&
        canPlayActiveMaster() &&
        foregroundRef.current &&
        !isDocumentHidden() &&
        (owner === null || owner === PLAYBACK_OWNER) &&
        (reason !== "manual" ||
          ["playing", "fading", "loading", "recovering"].includes(previousState));
      fadeInRef.current = shouldStart;
      trackChangePendingRef.current = true;
      if (!shouldStart) {
        pausePlayback(
          !enabledRef.current
            ? "off"
            : previousState === "blocked" || previousState === "error"
              ? previousState
              : "paused"
        );
        return;
      }
      const commit = () => {
        audioRef.current?.pause();
        commitSelectedSource(shouldStart);
      };
      if (reason === "manual" && ["playing", "fading"].includes(previousState)) {
        transition("fading");
        fadeVolumeTo(0, 80, commit);
      } else {
        transition(reason === "error" ? "recovering" : "loading");
        commit();
      }
    },
    [
      audioRef,
      cancelFade,
      canPlayActiveMaster,
      clearGestureRetry,
      commitSelectedSource,
      fadeVolumeTo,
      pausePlayback,
      transition,
    ]
  );

  const previous = useCallback(() => selectMaster(-1, "manual"), [selectMaster]);
  const next = useCallback(() => selectMaster(1, "manual"), [selectMaster]);
  selectManuallyRef.current = (direction) => selectMaster(direction, "manual");

  const advanceToNextMaster = useCallback(
    (nextState: "loading" | "recovering") => {
      if (trackChangePendingRef.current || explicitPauseRef.current) return;
      if (
        !enabledRef.current ||
        !canPlayActiveMaster() ||
        !foregroundRef.current ||
        isDocumentHidden()
      ) {
        pausePlayback(enabledRef.current ? "paused" : "off");
        return;
      }
      selectMaster(1, nextState === "recovering" ? "error" : "ended");
    },
    [canPlayActiveMaster, pausePlayback, selectMaster]
  );

  const handleMediaError = useCallback(() => {
    if (
      !enabledRef.current ||
      trackChangePendingRef.current ||
      explicitPauseRef.current ||
      ["off", "paused", "blocked"].includes(stateRef.current)
    )
      return;
    failedMasterIdsRef.current.add(activeMasterIdRef.current);
    if (failedMasterIdsRef.current.size >= APP_BACKGROUND_MUSIC_COLLECTION.length) {
      pausePlayback("error");
      return;
    }
    advanceToNextMaster("recovering");
  }, [advanceToNextMaster, pausePlayback]);

  const handleMediaEnded = useCallback(() => {
    failedMasterIdsRef.current.clear();
    advanceToNextMaster("loading");
  }, [advanceToNextMaster]);

  const handleMediaTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (
      !audio ||
      trackChangePendingRef.current ||
      !["playing", "fading"].includes(stateRef.current)
    )
      return;
    if (!Number.isFinite(audio.duration) || !Number.isFinite(audio.currentTime)) return;
    const remaining = audio.duration - audio.currentTime;
    if (remaining <= 0 || remaining > 0.6) return;
    transition("fading");
    audio.volume = clampVolume(volume * (remaining / 0.6));
  }, [audioRef, transition, volume]);

  useEffect(() => {
    mountedRef.current = true;
    const audio = audioRef.current;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      activeAttemptRef.current = null;
      cancelFade();
      clearGestureRetry();
      if (["loading", "playing", "fading", "recovering"].includes(stateRef.current)) {
        audio?.pause();
      }
      const owner = getActiveLongAudioOwner();
      releaseOwnership();
      if (owner === PLAYBACK_OWNER || owner === null) clearAppAudioMediaSession();
    };
  }, [audioRef, cancelFade, clearGestureRetry, releaseOwnership]);

  useEffect(() => {
    if (!pendingTrackStartRef.current) return;
    pendingTrackStartRef.current = false;
    const audio = audioRef.current;
    if (!audio) {
      transition("error");
      return;
    }
    audio.volume = 0;
    try {
      audio.load();
    } catch (error) {
      logger.warn("[AppBackgroundMusic] Next media load failed:", error);
    }
    cacheCurrentAndNext();
    void startPlayback();
  }, [sourceMasterId, sourceRevision, audioRef, cacheCurrentAndNext, startPlayback, transition]);

  useEffect(
    () => subscribeAppBackgroundMusicPreference((nextEnabled) => applyEnabled(nextEnabled)),
    [applyEnabled]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && !trackChangePendingRef.current) {
      cancelFade();
      audio.volume = clampVolume(volume);
    }

    if (!enabledRef.current) return;
    if (!canPlayActiveMaster()) {
      pausePlayback("paused");
      return;
    }
    void startPlayback();
  }, [
    audioRef,
    cancelFade,
    canPlay,
    canPlayMasterRevision,
    canPlayActiveMaster,
    pausePlayback,
    startPlayback,
    volume,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      foregroundRef.current = !isDocumentHidden();
      if (isDocumentHidden()) {
        pausePlayback(enabledRef.current ? "paused" : "off");
        return;
      }
      if (enabledRef.current && canPlayActiveMaster()) void startPlayback();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [canPlayActiveMaster, pausePlayback, startPlayback]);

  useEffect(() => {
    const unregisterPause = registerAudioBackgroundPauseHandler(() => {
      foregroundRef.current = false;
      pausePlayback(enabledRef.current ? "paused" : "off");
    });
    const unregisterResume = registerAudioForegroundResumeHandler(() => {
      foregroundRef.current = true;
      return startPlayback();
    });
    return () => {
      unregisterPause();
      unregisterResume();
    };
  }, [pausePlayback, startPlayback]);

  useEffect(
    () =>
      subscribeLongAudioOwner((ownerId) => {
        if (
          ownerId !== null ||
          !allowOwnerReleaseResumeRef.current ||
          !enabledRef.current ||
          !foregroundRef.current ||
          isDocumentHidden() ||
          !canPlayActiveMaster() ||
          stateRef.current !== "paused"
        ) {
          return;
        }

        queueMicrotask(() => {
          if (
            mountedRef.current &&
            allowOwnerReleaseResumeRef.current &&
            foregroundRef.current &&
            !isDocumentHidden() &&
            getActiveLongAudioOwner() === null
          ) {
            void startPlayback();
          }
        });
      }),
    [canPlayActiveMaster, startPlayback]
  );

  return {
    enabled,
    state,
    activeMasterId,
    sourceMasterId,
    toggle,
    retry,
    previous,
    next,
    handleMediaError,
    handleMediaEnded,
    handleMediaTimeUpdate,
  };
}
