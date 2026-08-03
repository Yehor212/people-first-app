import type { AnimationItem } from "lottie-web";

import { JOURNAL_SAVE_CEREMONY_ASSETS } from "./journalSaveCeremonyAssets";
import type { JournalSaveCeremonyVariant } from "./journalSaveCeremonyContract";

interface JournalSaveCeremonyAnimationData {
  w: number;
  h: number;
  fr: number;
  ip: number;
  op: number;
  layers: unknown[];
  [key: string]: unknown;
}

export interface JournalSaveCeremonyPlayback {
  destroy: () => void;
  ready: Promise<void>;
}

interface StartJournalSaveCeremonyOptions {
  container: Element;
  variant: JournalSaveCeremonyVariant;
  onComplete: () => void;
  onError: () => void;
  signal?: AbortSignal;
}

let runtimePreload: Promise<void> | null = null;
let runtimePreloaded = false;
let sessionCircuitOpen = false;
const animationDataCache = new Map<
  JournalSaveCeremonyVariant,
  JournalSaveCeremonyAnimationData
>();

function importRuntime(): Promise<void> {
  return Promise.all([
    import("lottie-web/build/player/lottie_light"),
    import("fflate"),
  ]).then(() => undefined);
}

export function preloadJournalSaveCeremonyRuntime(): Promise<void> {
  if (sessionCircuitOpen) return Promise.resolve();
  runtimePreload ??= importRuntime()
    .then(() => {
      runtimePreloaded = true;
    })
    .catch((error: unknown) => {
      sessionCircuitOpen = true;
      throw error;
    });
  return runtimePreload;
}

export function isJournalSaveCeremonyRuntimePreloaded(): boolean {
  return runtimePreloaded && !sessionCircuitOpen;
}

export function isJournalSaveCeremonyCircuitOpen(): boolean {
  return sessionCircuitOpen;
}

function assertApprovedAnimationShape(
  value: unknown,
): asserts value is JournalSaveCeremonyAnimationData {
  if (!value || typeof value !== "object") throw new Error("invalid-animation");
  const animation = value as Partial<JournalSaveCeremonyAnimationData>;
  if (
    animation.w !== 512 ||
    animation.h !== 512 ||
    animation.fr !== 60 ||
    animation.ip !== 0 ||
    animation.op !== 180 ||
    !Array.isArray(animation.layers)
  ) {
    throw new Error("invalid-animation-contract");
  }
}

async function loadAnimationData(
  variant: JournalSaveCeremonyVariant,
  signal?: AbortSignal,
): Promise<JournalSaveCeremonyAnimationData> {
  if (signal?.aborted) throw createAbortError();
  const cached = animationDataCache.get(variant);
  if (cached) return cached;

  const response = await fetch(JOURNAL_SAVE_CEREMONY_ASSETS[variant].tgs, {
    credentials: "same-origin",
    cache: "force-cache",
    signal,
  });
  if (!response.ok) throw new Error("asset-fetch-failed");

  const [{ gunzipSync }] = await Promise.all([import("fflate")]);
  const compressed = new Uint8Array(await response.arrayBuffer());
  const animation = JSON.parse(
    new TextDecoder().decode(gunzipSync(compressed)),
  ) as unknown;
  assertApprovedAnimationShape(animation);
  animationDataCache.set(variant, animation);
  return animation;
}

function createAbortError(): Error {
  if (typeof DOMException === "function") {
    return new DOMException("Journal save ceremony was cancelled", "AbortError");
  }
  const error = new Error("Journal save ceremony was cancelled");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export async function startJournalSaveCeremony({
  container,
  variant,
  onComplete,
  onError,
  signal,
}: StartJournalSaveCeremonyOptions): Promise<JournalSaveCeremonyPlayback> {
  if (sessionCircuitOpen) throw new Error("runtime-circuit-open");
  if (signal?.aborted) throw createAbortError();

  try {
    const [lottieModule, animationData] = await Promise.all([
      import("lottie-web/build/player/lottie_light"),
      loadAnimationData(variant, signal),
    ]);
    if (signal?.aborted) throw createAbortError();
    const lottie = lottieModule.default;
    const rendererSettings = {
      preserveAspectRatio: "xMidYMid meet",
      progressiveLoad: false,
      runExpressions: false,
    };
    const animation: AnimationItem = lottie.loadAnimation({
      container,
      renderer: "svg",
      loop: false,
      autoplay: false,
      animationData,
      rendererSettings,
    });
    let destroyed = false;
    let readySettled = false;
    let resolveReady!: () => void;
    let rejectReady!: (error: Error) => void;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });

    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      animation.removeEventListener("DOMLoaded", handleDomLoaded);
      animation.removeEventListener("complete", handleComplete);
      animation.removeEventListener("data_failed", handleError);
      animation.removeEventListener("error", handleError);
      signal?.removeEventListener("abort", handleAbort);
      animation.destroy();
      container.replaceChildren();
      if (!readySettled) {
        readySettled = true;
        rejectReady(new Error("animation-destroyed-before-ready"));
      }
    };
    const handleDomLoaded = () => {
      if (destroyed || readySettled) return;
      readySettled = true;
      animation.play();
      resolveReady();
    };
    const handleComplete = () => {
      if (destroyed) return;
      onComplete();
    };
    const handleError = () => {
      if (destroyed) return;
      sessionCircuitOpen = true;
      if (!readySettled) {
        readySettled = true;
        rejectReady(new Error("animation-renderer-failed"));
      }
      onError();
      destroy();
    };
    const handleAbort = () => {
      destroy();
    };

    animation.addEventListener("DOMLoaded", handleDomLoaded);
    animation.addEventListener("complete", handleComplete);
    animation.addEventListener("data_failed", handleError);
    animation.addEventListener("error", handleError);
    signal?.addEventListener("abort", handleAbort, { once: true });

    if (animation.isLoaded) {
      queueMicrotask(handleDomLoaded);
    }

    return { destroy, ready };
  } catch (error) {
    if (isAbortError(error, signal)) throw error;
    sessionCircuitOpen = true;
    onError();
    throw error;
  }
}
