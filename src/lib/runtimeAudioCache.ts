import { APP_AUDIO_ASSETS, APP_AUDIO_FEEDBACK_EVENTS } from "@/lib/appAudioAssets";
import { HYPERFOCUS_GENERATED_AUDIO_MANIFEST } from "@/lib/hyperfocusGeneratedAudioManifest";

export const RUNTIME_AUDIO_CACHE_NAME = "zenflow-runtime-audio-v2";
export const RETIRED_RUNTIME_AUDIO_CACHE_NAMES = ["zenflow-runtime-audio"] as const;
const APP_AUDIO_INTENT_CACHE_CONTRACTS = Object.freeze({
  "sounds/cloudlight-evening-loop.mp3": Object.freeze({
    byteLength: 2_400_757,
    contentType: "audio/mpeg",
    sha256: "d096c668ef6471f855b49c93bc5509ccbd63ac1fb93dc9af96ba3c7c9e65be40",
  }),
});

export const APP_AUDIO_INTENT_CACHE_PATHS = Object.freeze(
  Object.keys(APP_AUDIO_INTENT_CACHE_CONTRACTS),
);

interface RuntimeAudioCacheLike {
  delete(request: Request): Promise<boolean>;
  match(request: Request, options?: CacheQueryOptions): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

interface RuntimeAudioCacheStorageLike {
  open(cacheName: string): Promise<RuntimeAudioCacheLike>;
}

interface RuntimeAudioIntentCacheEnvironment {
  cacheStorage: RuntimeAudioCacheStorageLike;
  fetcher: (request: Request) => Promise<Response>;
  scope: string;
}

interface ServiceWorkerMessageTargetLike {
  postMessage(message: unknown): void;
}

interface ServiceWorkerContainerLike {
  controller: ServiceWorkerMessageTargetLike | null;
  ready: Promise<{ active: ServiceWorkerMessageTargetLike | null }>;
}

const intentCachePaths = new Set<string>(APP_AUDIO_INTENT_CACHE_PATHS);

function getIntentCacheContract(publicPath: string) {
  return APP_AUDIO_INTENT_CACHE_CONTRACTS[
    publicPath as keyof typeof APP_AUDIO_INTENT_CACHE_CONTRACTS
  ];
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Runtime audio integrity validation requires SubtleCrypto");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function responseMatchesIntentCacheContract(
  publicPath: string,
  response: Response,
): Promise<boolean> {
  const contract = getIntentCacheContract(publicPath);
  if (!contract || response.status !== 200) return false;

  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== contract.contentType) return false;

  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) !== contract.byteLength) return false;

  try {
    const bytes = await response.clone().arrayBuffer();
    if (bytes.byteLength !== contract.byteLength) return false;
    return await sha256Hex(bytes) === contract.sha256;
  } catch {
    return false;
  }
}

export function isIntentRuntimeAudioPath(publicPath: string): boolean {
  return intentCachePaths.has(publicPath);
}

export async function requestRuntimeAudioCacheOnIntent(
  publicPath: string,
  serviceWorkerContainer?: ServiceWorkerContainerLike,
): Promise<boolean> {
  if (!isIntentRuntimeAudioPath(publicPath)) return false;

  const serviceWorker = serviceWorkerContainer ?? (
    typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? navigator.serviceWorker
      : null
  );
  if (!serviceWorker) return false;

  const message = { type: "CACHE_RUNTIME_AUDIO", publicPath } as const;
  if (serviceWorker.controller) {
    serviceWorker.controller.postMessage(message);
    return true;
  }

  const registration = await serviceWorker.ready;
  if (!registration.active) return false;
  registration.active.postMessage(message);
  return true;
}

export async function cacheRuntimeAudioOnIntent(
  publicPath: string,
  { cacheStorage, fetcher, scope }: RuntimeAudioIntentCacheEnvironment,
): Promise<boolean> {
  if (!isIntentRuntimeAudioPath(publicPath)) {
    throw new Error("Runtime audio path is not allowed for intent caching: " + publicPath);
  }

  const request = new Request(new URL(publicPath, scope).toString(), {
    cache: "reload",
    credentials: "same-origin",
    mode: "same-origin",
  });
  const cache = await cacheStorage.open(RUNTIME_AUDIO_CACHE_NAME);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) {
    if (await responseMatchesIntentCacheContract(publicPath, cached)) return false;
    await cache.delete(request);
  }

  const response = await fetcher(request);
  if (!(await responseMatchesIntentCacheContract(publicPath, response))) {
    throw new Error("Runtime audio integrity check failed: " + publicPath);
  }

  await cache.put(request, response);
  return true;
}

export function isRuntimeAudioPath(pathname: string, destination = ""): boolean {
  const localPath = pathname.split(/[?#]/, 1)[0];
  const isSoundsPath = localPath.startsWith("sounds/") || localPath.includes("/sounds/");
  return isSoundsPath && (destination === "audio" || /\.mp3$/i.test(localPath));
}

const shippedAudioPaths = [
  ...APP_AUDIO_ASSETS.filter((asset) => asset.warmCacheOnStartup).map(
    (asset) => asset.publicPath,
  ),
  ...APP_AUDIO_FEEDBACK_EVENTS.map((event) => event.publicPath),
  ...Object.values(HYPERFOCUS_GENERATED_AUDIO_MANIFEST).map((entry) => entry.publicPath),
];

export const APP_AUDIO_SW_CACHE_PATHS: readonly string[] = Object.freeze(
  [...new Set(shippedAudioPaths)].sort(),
);

const retiredRuntimeAudioCacheNames = new Set<string>(RETIRED_RUNTIME_AUDIO_CACHE_NAMES);

export function selectRetiredRuntimeAudioCaches(cacheNames: readonly string[]): string[] {
  return cacheNames.filter(
    (cacheName) =>
      cacheName !== RUNTIME_AUDIO_CACHE_NAME && retiredRuntimeAudioCacheNames.has(cacheName),
  );
}
