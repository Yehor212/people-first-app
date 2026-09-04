import { APP_AUDIO_ASSETS, APP_AUDIO_FEEDBACK_EVENTS } from "@/lib/appAudioAssets";
import { HYPERFOCUS_GENERATED_AUDIO_MANIFEST } from "@/lib/hyperfocusGeneratedAudioManifest";

export const RUNTIME_AUDIO_CACHE_NAME = "zenflow-runtime-audio-v3";
export const RETIRED_RUNTIME_AUDIO_CACHE_NAMES = [
  "zenflow-runtime-audio",
  "zenflow-runtime-audio-v2",
] as const;
const APP_AUDIO_INTENT_CACHE_CONTRACTS = Object.freeze({
  "sounds/cloudlight-evening-loop.mp3": Object.freeze({
    byteLength: 2_400_757,
    contentType: "audio/mpeg",
    sha256: "d096c668ef6471f855b49c93bc5509ccbd63ac1fb93dc9af96ba3c7c9e65be40",
  }),
  "sounds/music/lantern-air.mp3": Object.freeze({
    byteLength: 2_400_757,
    contentType: "audio/mpeg",
    sha256: "b72b8e7a47c8a2c56fadd03de6470aa7d8f567be0792ba7ccd39f29e53848168",
  }),
  "sounds/music/rain-on-paper.mp3": Object.freeze({
    byteLength: 2_400_757,
    contentType: "audio/mpeg",
    sha256: "5b78c3674aa643bcc26c8c9ae2efba3fac7a2cb38907ac4e48e580df01680eba",
  }),
  "sounds/music/indigo-dusk.mp3": Object.freeze({
    byteLength: 2_400_757,
    contentType: "audio/mpeg",
    sha256: "6335e90b6adec58946db66243ada162d40b632808f20871308d7a9ea2efea579",
  }),
  "sounds/music/quiet-courtyard.mp3": Object.freeze({
    byteLength: 2_400_757,
    contentType: "audio/mpeg",
    sha256: "634f710879be32e3b0cf95d539762edb8842d5841f308eef9b9d0ec334f5242c",
  }),
  "sounds/music/moonlit-water.mp3": Object.freeze({
    byteLength: 2_400_757,
    contentType: "audio/mpeg",
    sha256: "4a380298374bd3231da2b26c5fa75c0a6cbb1625d0f52f6c021973a0c6d67440",
  }),
  "sounds/music/cedar-mist.mp3": Object.freeze({
    byteLength: 2_400_757,
    contentType: "audio/mpeg",
    sha256: "9175323a5b4df1e0d61f5043136cac65c58679546947d4bc9111756b74924577",
  }),
  "sounds/music/glass-bell-dawn.mp3": Object.freeze({
    byteLength: 2_400_757,
    contentType: "audio/mpeg",
    sha256: "aac2561e87aca90bd29955300319d1ed3238d771d3a170b78bb1531e8ce5a286",
  }),
  "sounds/music/moss-garden.mp3": Object.freeze({
    byteLength: 2_400_757,
    contentType: "audio/mpeg",
    sha256: "ab40608611ac63726424fcb343cd7f0fc5a77b69e779cd3f2baa1651877e8982",
  }),
  "sounds/music/after-rain.mp3": Object.freeze({
    byteLength: 2_400_757,
    contentType: "audio/mpeg",
    sha256: "e63e2a8c274673eafae8b4d44061f6ae83a4a0d6374456d1230fac4f52e39a28",
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
