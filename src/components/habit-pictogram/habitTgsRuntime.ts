import type { AnimationItem } from "lottie-web";

import { logger } from "@/lib/logger";
import { isAndroid } from "@/lib/platform";
import type { V2HabitPictogramId } from "@/lib/v2HabitPictograms";
import {
  getHabitCelebrationAssetUrl,
  type HabitCelebrationVariant,
} from "./habitCelebrationAssets";

interface HabitTgsAnimationData {
  w: number;
  h: number;
  fr: number;
  ip: number;
  op: number;
  layers: unknown[];
  assets?: Array<Record<string, unknown>>;
  chars?: unknown;
  fonts?: unknown;
  [key: string]: unknown;
}

export interface HabitCelebrationPlayback {
  destroy: () => void;
  ready: Promise<void>;
}

interface StartHabitCelebrationOptions {
  container: Element;
  pictogramId: V2HabitPictogramId;
  variant: HabitCelebrationVariant;
  onReady: () => void;
  onComplete: () => void;
  onError: () => void;
  signal?: AbortSignal;
}

const MAX_TGS_BYTES = 64 * 1024;
const animationDataCache = new Map<string, HabitTgsAnimationData>();
const failedAssetUrls = new Set<string>();
let runtimeImport: Promise<void> | null = null;
let runtimeUnavailable = false;

export async function readCompressedHabitTgsAsset(
  assetUrl: string,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (signal?.aborted) throw createAbortError();

  if (assetUrl.startsWith("data:")) {
    const separatorIndex = assetUrl.indexOf(",");
    const metadata = separatorIndex >= 0 ? assetUrl.slice(0, separatorIndex) : "";
    const encoded = separatorIndex >= 0 ? assetUrl.slice(separatorIndex + 1) : "";
    if (!metadata.endsWith(";base64") || encoded.length === 0) {
      throw new Error("invalid-habit-tgs-data-url");
    }
    if (encoded.length > Math.ceil(MAX_TGS_BYTES / 3) * 4 + 4) {
      throw new Error("habit-tgs-too-large");
    }
    const decoded = atob(encoded);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  }

  const response = await fetch(assetUrl, {
    credentials: "same-origin",
    cache: "force-cache",
    signal,
  });
  if (!response.ok) throw new Error("habit-tgs-fetch-failed");
  return new Uint8Array(await response.arrayBuffer());
}

function importRuntime(): Promise<void> {
  if (runtimeUnavailable) return Promise.reject(new Error("habit-tgs-runtime-unavailable"));
  runtimeImport ??= Promise.all([
    import("lottie-web/build/player/lottie_light"),
    import("fflate"),
  ])
    .then(() => undefined)
    .catch((error: unknown) => {
      runtimeUnavailable = true;
      throw error;
    });
  return runtimeImport;
}

function containsUnsupportedTgsFeature(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsUnsupportedTgsFeature);
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.ef) && record.ef.length > 0) return true;
  if (Array.isArray(record.masksProperties) && record.masksProperties.length > 0) return true;
  if (record.ty === 2 || record.ty === 5) return true;
  if (typeof record.x === "string" && record.x.trim().length > 0) return true;
  return Object.values(record).some(containsUnsupportedTgsFeature);
}

function assertApprovedAnimationShape(
  value: unknown,
): asserts value is HabitTgsAnimationData {
  if (!value || typeof value !== "object") throw new Error("invalid-habit-tgs");
  const animation = value as Partial<HabitTgsAnimationData>;
  const hasEmbeddedImage = animation.assets?.some(
    (asset) => typeof asset.p === "string" && asset.p.length > 0,
  );
  if (
    animation.w !== 512 ||
    animation.h !== 512 ||
    animation.fr !== 60 ||
    animation.ip !== 0 ||
    animation.op !== 180 ||
    !Array.isArray(animation.layers) ||
    animation.layers.length === 0 ||
    animation.chars !== undefined ||
    animation.fonts !== undefined ||
    hasEmbeddedImage ||
    containsUnsupportedTgsFeature(animation)
  ) {
    throw new Error("invalid-habit-tgs-contract");
  }
}

function createAbortError(): Error {
  if (typeof DOMException === "function") {
    return new DOMException("Habit celebration was cancelled", "AbortError");
  }
  const error = new Error("Habit celebration was cancelled");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (error instanceof Error && error.name === "AbortError");
}

async function loadAnimationData(
  assetUrl: string,
  signal?: AbortSignal,
): Promise<HabitTgsAnimationData> {
  if (signal?.aborted) throw createAbortError();
  if (failedAssetUrls.has(assetUrl)) throw new Error("habit-tgs-asset-circuit-open");
  const cached = animationDataCache.get(assetUrl);
  if (cached) return cached;

  try {
    const compressed = await readCompressedHabitTgsAsset(assetUrl, signal);
    if (compressed.byteLength > MAX_TGS_BYTES) throw new Error("habit-tgs-too-large");
    const { gunzipSync } = await import("fflate");
    const animation = JSON.parse(
      new TextDecoder().decode(gunzipSync(compressed)),
    ) as unknown;
    assertApprovedAnimationShape(animation);
    animationDataCache.set(assetUrl, animation);
    return animation;
  } catch (error) {
    if (!isAbortError(error, signal)) failedAssetUrls.add(assetUrl);
    throw error;
  }
}

export async function preloadHabitCelebrationAnimation(
  pictogramId: V2HabitPictogramId,
  variant: HabitCelebrationVariant,
): Promise<void> {
  if (!isAndroid) return;
  const assetUrl = getHabitCelebrationAssetUrl(pictogramId, variant);
  if (!assetUrl || failedAssetUrls.has(assetUrl) || runtimeUnavailable) return;
  try {
    await Promise.all([importRuntime(), loadAnimationData(assetUrl)]);
  } catch (error) {
    logger.warn("[HabitCelebration] preload unavailable", {
      code: "habit_tgs_preload_unavailable",
      pictogramId,
      variant,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function startHabitCelebrationAnimation({
  container,
  pictogramId,
  variant,
  onReady,
  onComplete,
  onError,
  signal,
}: StartHabitCelebrationOptions): Promise<HabitCelebrationPlayback> {
  if (!isAndroid) throw new Error("habit-tgs-android-only");
  if (signal?.aborted) throw createAbortError();
  const assetUrl = getHabitCelebrationAssetUrl(pictogramId, variant);
  if (!assetUrl) throw new Error("habit-tgs-asset-unavailable");

  try {
    const [lottieModule, animationData] = await Promise.all([
      import("lottie-web/build/player/lottie_light"),
      loadAnimationData(assetUrl, signal),
    ]);
    if (signal?.aborted) throw createAbortError();
    const rendererSettings = {
      preserveAspectRatio: "xMidYMid meet",
      progressiveLoad: false,
      runExpressions: false,
    };
    const animation: AnimationItem = lottieModule.default.loadAnimation({
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
        rejectReady(new Error("habit-tgs-destroyed-before-ready"));
      }
    };
    const handleDomLoaded = () => {
      if (destroyed || readySettled) return;
      readySettled = true;
      onReady();
      animation.play();
      resolveReady();
    };
    const handleComplete = () => {
      if (!destroyed) onComplete();
    };
    const handleError = () => {
      if (destroyed) return;
      failedAssetUrls.add(assetUrl);
      if (!readySettled) {
        readySettled = true;
        rejectReady(new Error("habit-tgs-renderer-failed"));
      }
      onError();
      destroy();
    };
    const handleAbort = () => destroy();

    animation.addEventListener("DOMLoaded", handleDomLoaded);
    animation.addEventListener("complete", handleComplete);
    animation.addEventListener("data_failed", handleError);
    animation.addEventListener("error", handleError);
    signal?.addEventListener("abort", handleAbort, { once: true });
    if (animation.isLoaded) queueMicrotask(handleDomLoaded);

    return { destroy, ready };
  } catch (error) {
    if (isAbortError(error, signal)) throw error;
    failedAssetUrls.add(assetUrl);
    onError();
    throw error;
  }
}
