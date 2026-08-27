import { APP_AUDIO_ASSETS, APP_AUDIO_FEEDBACK_EVENTS } from "@/lib/appAudioAssets";
import { HYPERFOCUS_GENERATED_AUDIO_MANIFEST } from "@/lib/hyperfocusGeneratedAudioManifest";

export const RUNTIME_AUDIO_CACHE_NAME = "zenflow-runtime-audio-v2";
export const RETIRED_RUNTIME_AUDIO_CACHE_NAMES = ["zenflow-runtime-audio"] as const;

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
