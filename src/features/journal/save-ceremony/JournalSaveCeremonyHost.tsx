import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { logger } from "@/lib/logger";
import { platform } from "@/lib/platform";

import { JOURNAL_SAVE_CEREMONY_ASSETS } from "./journalSaveCeremonyAssets";
import {
  isJournalSaveCommitReceiptFresh,
  type JournalSaveCommitReceipt,
} from "./journalSaveCeremonyContract";
import {
  isJournalSaveCeremonyCircuitOpen,
  isJournalSaveCeremonyRuntimePreloaded,
  startJournalSaveCeremony,
  type JournalSaveCeremonyPlayback,
} from "./journalSaveCeremonyRuntime";
import {
  JOURNAL_SAVE_CEREMONY_CANCEL_EVENT,
  mayPresentJournalSaveCeremony,
  type JournalSaveCeremonyLifecycleToken,
} from "./journalSaveCeremonyLifecycle";
import "./journalSaveCeremony.css";

const STATIC_FALLBACK_DURATION_MS = 800;
const PLAYER_READY_DEADLINE_MS = 750;
const LOTTIE_SAFETY_TIMEOUT_MS = 3_500;
const PHONE_BREAKPOINT_PX = 768;
const PHONE_MINIMUM_LOTTIE_SIZE_PX = 240;
const LARGE_MINIMUM_LOTTIE_SIZE_PX = 304;
const MAX_REMEMBERED_RECEIPTS = 32;

type PlaybackDecision = {
  nonce: string;
  mode: "lottie" | "static";
};

interface JournalSaveCeremonyHostProps {
  receipt: JournalSaveCommitReceipt | null;
  lifecycleToken: JournalSaveCeremonyLifecycleToken | null;
  eligible: boolean;
  onConsume: (nonce: string) => void;
}

interface PlayerLayout {
  minimum: number;
  size: number;
}

function readInset(style: CSSStyleDeclaration | null, name: string): number {
  let raw = style?.getPropertyValue(name).trim() ?? "";
  if (!raw && typeof document !== "undefined") {
    raw = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function resolvePlayerLayout(
  width: number,
  height: number,
  style: CSSStyleDeclaration | null = null,
): PlayerLayout {
  const safeWidth = Math.max(
    0,
    width -
      readInset(style, "--safe-inline-start") -
      readInset(style, "--safe-inline-end"),
  );
  const safeHeight = Math.max(
    0,
    height -
      readInset(style, "--safe-top") -
      readInset(style, "--safe-bottom"),
  );
  const isPhone = safeWidth < PHONE_BREAKPOINT_PX;
  const available = Math.max(0, Math.min(safeWidth, safeHeight) - 32);
  return {
    minimum: isPhone
      ? PHONE_MINIMUM_LOTTIE_SIZE_PX
      : LARGE_MINIMUM_LOTTIE_SIZE_PX,
    size: Math.min(isPhone ? 320 : 352, available),
  };
}

export function JournalSaveCeremonyHost({
  receipt,
  lifecycleToken,
  eligible,
  onConsume,
}: JournalSaveCeremonyHostProps) {
  const shouldAnimate = useShouldAnimate();
  const [activeReceipt, setActiveReceipt] =
    useState<JournalSaveCommitReceipt | null>(null);
  const [playbackDecision, setPlaybackDecision] =
    useState<PlaybackDecision | null>(null);
  const [playerLayout, setPlayerLayout] = useState<PlayerLayout>(() =>
    typeof window === "undefined"
      ? { minimum: PHONE_MINIMUM_LOTTIE_SIZE_PX, size: 0 }
      : resolvePlayerLayout(window.innerWidth, window.innerHeight),
  );
  const [measuredNonce, setMeasuredNonce] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const playbackRef = useRef<JournalSaveCeremonyPlayback | null>(null);
  const seenNoncesRef = useRef(new Set<string>());
  const receiptRef = useRef(receipt);
  const onConsumeRef = useRef(onConsume);
  const cancelCurrentRef = useRef<() => void>(() => {});

  receiptRef.current = receipt;
  onConsumeRef.current = onConsume;

  const rememberReceipt = useCallback((nonce: string): boolean => {
    const remembered = seenNoncesRef.current;
    if (remembered.has(nonce)) return false;
    remembered.add(nonce);
    while (remembered.size > MAX_REMEMBERED_RECEIPTS) {
      const oldest = remembered.values().next().value;
      if (!oldest) break;
      remembered.delete(oldest);
    }
    return true;
  }, []);

  const finish = useCallback(() => {
    playbackRef.current?.destroy();
    playbackRef.current = null;
    setActiveReceipt(null);
    setPlaybackDecision(null);
  }, []);
  cancelCurrentRef.current = () => {
    const pendingReceipt = receiptRef.current;
    if (pendingReceipt && rememberReceipt(pendingReceipt.nonce)) {
      onConsumeRef.current(pendingReceipt.nonce);
    }
    finish();
  };

  useEffect(() => {
    if (!receipt || seenNoncesRef.current.has(receipt.nonce)) return;
    if (
      !lifecycleToken ||
      !mayPresentJournalSaveCeremony(lifecycleToken)
    ) {
      rememberReceipt(receipt.nonce);
      onConsume(receipt.nonce);
      finish();
      return;
    }
    if (!eligible) return;
    rememberReceipt(receipt.nonce);
    onConsume(receipt.nonce);
    if (!isJournalSaveCommitReceiptFresh(receipt)) return;
    playbackRef.current?.destroy();
    playbackRef.current = null;
    setPlaybackDecision(null);
    setActiveReceipt(receipt);
  }, [
    eligible,
    finish,
    lifecycleToken,
    onConsume,
    receipt,
    rememberReceipt,
  ]);

  useLayoutEffect(() => {
    const measure = () => {
      const parent = hostRef.current?.parentElement;
      const rect = parent?.getBoundingClientRect();
      const width = rect?.width || window.innerWidth;
      const height = rect?.height || window.innerHeight;
      const style = parent ? window.getComputedStyle(parent) : null;
      setPlayerLayout(resolvePlayerLayout(width, height, style));
      setMeasuredNonce(activeReceipt?.nonce ?? null);
    };
    measure();

    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (observer && hostRef.current?.parentElement) {
      observer.observe(hostRef.current.parentElement);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [activeReceipt?.nonce]);

  useEffect(() => {
    const cancelForLifecycle = () => cancelCurrentRef.current();
    window.addEventListener(
      JOURNAL_SAVE_CEREMONY_CANCEL_EVENT,
      cancelForLifecycle,
    );
    window.addEventListener("keydown", cancelForLifecycle, { capture: true });
    window.addEventListener("pointerdown", cancelForLifecycle, {
      capture: true,
    });
    window.addEventListener("wheel", cancelForLifecycle, {
      capture: true,
      passive: true,
    });

    return () => {
      window.removeEventListener(
        JOURNAL_SAVE_CEREMONY_CANCEL_EVENT,
        cancelForLifecycle,
      );
      window.removeEventListener("keydown", cancelForLifecycle, {
        capture: true,
      });
      window.removeEventListener("pointerdown", cancelForLifecycle, {
        capture: true,
      });
      window.removeEventListener("wheel", cancelForLifecycle, {
        capture: true,
      });
      cancelForLifecycle();
    };
  }, []);

  const fallbackRequired =
    !shouldAnimate ||
    playerLayout.size < playerLayout.minimum ||
    !isJournalSaveCeremonyRuntimePreloaded() ||
    isJournalSaveCeremonyCircuitOpen();

  useEffect(() => {
    if (!activeReceipt || measuredNonce !== activeReceipt.nonce) return;
    setPlaybackDecision((current) => {
      if (current?.nonce === activeReceipt.nonce) {
        if (current.mode === "lottie" && fallbackRequired) {
          return { nonce: activeReceipt.nonce, mode: "static" };
        }
        return current;
      }
      return {
        nonce: activeReceipt.nonce,
        mode: fallbackRequired ? "static" : "lottie",
      };
    });
  }, [activeReceipt, fallbackRequired, measuredNonce]);

  let playbackMode: "pending" | "lottie" | "static" = "pending";
  if (
    playbackDecision &&
    activeReceipt &&
    playbackDecision.nonce === activeReceipt.nonce
  ) {
    playbackMode = playbackDecision.mode;
  }
  const useStaticFallback = playbackMode === "static";

  useEffect(() => {
    if (
      !activeReceipt ||
      measuredNonce !== activeReceipt.nonce ||
      playbackDecision?.nonce !== activeReceipt.nonce
    ) {
      return;
    }
    if (useStaticFallback) {
      const timer = window.setTimeout(finish, STATIC_FALLBACK_DURATION_MS);
      return () => window.clearTimeout(timer);
    }

    const container = playerRef.current;
    if (!container) return;
    let cancelled = false;
    const abortController = new AbortController();
    let safetyTimer: number | null = null;
    const readyTimer = window.setTimeout(() => {
      if (!cancelled) {
        setPlaybackDecision({
          nonce: activeReceipt.nonce,
          mode: "static",
        });
      }
    }, PLAYER_READY_DEADLINE_MS);
    void startJournalSaveCeremony({
      container,
      variant: activeReceipt.variant,
      signal: abortController.signal,
      onComplete: finish,
      onError: () => {
        if (!cancelled) {
          logger.warn("[JournalSaveCeremony] player unavailable", {
            code: "journal_save_ceremony_player_error",
            platform,
            variant: activeReceipt.variant,
          });
          setPlaybackDecision({
            nonce: activeReceipt.nonce,
            mode: "static",
          });
        }
      },
    })
      .then((playback) => {
        if (cancelled) {
          void playback.ready.catch(() => undefined);
          playback.destroy();
          return;
        }
        playbackRef.current = playback;
        void playback.ready
          .then(() => {
            if (cancelled) return;
            window.clearTimeout(readyTimer);
            safetyTimer = window.setTimeout(
              finish,
              LOTTIE_SAFETY_TIMEOUT_MS,
            );
          })
          .catch(() => {
            if (!cancelled) {
              setPlaybackDecision({
                nonce: activeReceipt.nonce,
                mode: "static",
              });
            }
          });
      })
      .catch(() => {
        if (!cancelled) {
          setPlaybackDecision({
            nonce: activeReceipt.nonce,
            mode: "static",
          });
        }
      });

    return () => {
      cancelled = true;
      abortController.abort();
      window.clearTimeout(readyTimer);
      if (safetyTimer !== null) window.clearTimeout(safetyTimer);
      void playbackRef.current?.ready.catch(() => undefined);
      playbackRef.current?.destroy();
      playbackRef.current = null;
    };
  }, [
    activeReceipt,
    finish,
    measuredNonce,
    playbackDecision,
    useStaticFallback,
  ]);

  const asset = useMemo(
    () =>
      activeReceipt
        ? JOURNAL_SAVE_CEREMONY_ASSETS[activeReceipt.variant]
        : null,
    [activeReceipt],
  );

  if (!activeReceipt || !asset || playerLayout.size <= 0) return null;

  return (
    <div
      ref={hostRef}
      data-testid="journal-save-ceremony"
      data-variant={activeReceipt.variant}
      data-playback={playbackMode}
      aria-hidden="true"
      className="journal-save-ceremony pointer-events-none absolute z-40 flex items-center justify-center overflow-hidden"
      dir="ltr"
    >
      <div
        data-testid="journal-save-ceremony-veil"
        data-tone={activeReceipt.variant}
        data-motion={shouldAnimate ? "animated" : "static"}
        className="journal-save-ceremony-veil"
      />
      <div
        className="relative z-10"
        style={{
          width: playerLayout.size,
          height: playerLayout.size,
          direction: "ltr",
        }}
      >
        {playbackMode === "static" ? (
          <img
            src={asset.reduced}
            alt=""
            draggable={false}
            data-testid="journal-save-ceremony-static"
            className="h-full w-full object-contain"
          />
        ) : playbackMode === "lottie" ? (
          <div ref={playerRef} className="h-full w-full" />
        ) : null}
      </div>
    </div>
  );
}
