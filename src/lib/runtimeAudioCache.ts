import { APP_AUDIO_ASSETS, APP_AUDIO_FEEDBACK_EVENTS } from "@/lib/appAudioAssets";
import { HYPERFOCUS_GENERATED_AUDIO_MANIFEST } from "@/lib/hyperfocusGeneratedAudioManifest";

export const RUNTIME_AUDIO_CACHE_NAME = "zenflow-runtime-audio-v5";
export const RETIRED_RUNTIME_AUDIO_CACHE_NAMES = [
  "zenflow-runtime-audio",
  "zenflow-runtime-audio-v2",
  "zenflow-runtime-audio-v3",
  "zenflow-runtime-audio-v4",
] as const;
const APP_AUDIO_INTENT_CACHE_CONTRACTS = Object.freeze({
  "sounds/music/r7-shoji-rain.mp3": Object.freeze({
    byteLength: 6721964,
    contentType: "audio/mpeg",
    sha256: "f49b48fcdff7dada76be14de52a1213f03ce8e277a74a10e55136031a36af71a",
  }),
  "sounds/music/r7-moss-garden.mp3": Object.freeze({
    byteLength: 6642284,
    contentType: "audio/mpeg",
    sha256: "ea4578bef4a22af13afbe2f0c7d44f715cf7b37e3df675c35375fee5adf3029a",
  }),
  "sounds/music/r7-lantern-reflection.mp3": Object.freeze({
    byteLength: 6802604,
    contentType: "audio/mpeg",
    sha256: "9cdbd5cc947cd87a580a82a5cccf951b4a59e4fe359f9981073f6fba303bb55d",
  }),
  "sounds/music/r7-snow-over-cedar.mp3": Object.freeze({
    byteLength: 6562604,
    contentType: "audio/mpeg",
    sha256: "91b2b1254e4a2e95176a1b54bd99e722ee2a1ccff5384ed23e9c8ecf1cb7a5fd",
  }),
  "sounds/music/r7-paper-cranes.mp3": Object.freeze({
    byteLength: 6721964,
    contentType: "audio/mpeg",
    sha256: "7602f5ff552b83f118be3c2d34c452dddc679472f415bfca0486c6b2fe949d36",
  }),
  "sounds/music/r7-tea-room-dawn.mp3": Object.freeze({
    byteLength: 6642284,
    contentType: "audio/mpeg",
    sha256: "f94cde5ef5a319678f63c49723dbf8505e7122a88d3fd6756ae5679c7dd7a044",
  }),
  "sounds/music/r7-river-stones.mp3": Object.freeze({
    byteLength: 6802604,
    contentType: "audio/mpeg",
    sha256: "7ca1c3d4a232b483caeb456e1fe5a552e571ce4916b935df3060c68805900e0e",
  }),
  "sounds/music/r7-camellia-evening.mp3": Object.freeze({
    byteLength: 6601964,
    contentType: "audio/mpeg",
    sha256: "b0badde8553553e50e67b8b65e359c67d3a6424a67c0346052bf1f1c4f9fb35f",
  }),
  "sounds/music/r7-temple-path.mp3": Object.freeze({
    byteLength: 6721964,
    contentType: "audio/mpeg",
    sha256: "51298b29ceaece2e2f96e8a0c5bbe7706e6c1e1d642d754afa270d76e95f7acf",
  }),
  "sounds/music/r7-home-beneath-clouds.mp3": Object.freeze({
    byteLength: 6802604,
    contentType: "audio/mpeg",
    sha256: "f47aeab0fff78f27003ed3f1b91b0477d88dd28b4039aaf495f4b357c5bd81cb",
  }),
});

export const APP_AUDIO_INTENT_CACHE_PATHS = Object.freeze(
  Object.keys(APP_AUDIO_INTENT_CACHE_CONTRACTS)
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
  response: Response
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
    return (await sha256Hex(bytes)) === contract.sha256;
  } catch {
    return false;
  }
}

export function isIntentRuntimeAudioPath(publicPath: string): boolean {
  return intentCachePaths.has(publicPath);
}

export async function requestRuntimeAudioCacheOnIntent(
  publicPath: string,
  serviceWorkerContainer?: ServiceWorkerContainerLike
): Promise<boolean> {
  if (!isIntentRuntimeAudioPath(publicPath)) return false;

  const serviceWorker =
    serviceWorkerContainer ??
    (typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? navigator.serviceWorker
      : null);
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
  { cacheStorage, fetcher, scope }: RuntimeAudioIntentCacheEnvironment
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
  ...APP_AUDIO_ASSETS.filter((asset) => asset.warmCacheOnStartup).map((asset) => asset.publicPath),
  ...APP_AUDIO_FEEDBACK_EVENTS.map((event) => event.publicPath),
  ...Object.values(HYPERFOCUS_GENERATED_AUDIO_MANIFEST).map((entry) => entry.publicPath),
];

export const APP_AUDIO_SW_CACHE_PATHS: readonly string[] = Object.freeze(
  [...new Set(shippedAudioPaths)].sort()
);

const retiredRuntimeAudioCacheNames = new Set<string>(RETIRED_RUNTIME_AUDIO_CACHE_NAMES);

export function selectRetiredRuntimeAudioCaches(cacheNames: readonly string[]): string[] {
  return cacheNames.filter(
    (cacheName) =>
      cacheName !== RUNTIME_AUDIO_CACHE_NAME && retiredRuntimeAudioCacheNames.has(cacheName)
  );
}
