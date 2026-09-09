import type { OutputBundle } from "rolldown";
import type { Plugin } from "vite";
import type { ManifestEntry, ManifestTransform } from "workbox-build";

export function collectDiaryOfflineAssets(
  bundle: OutputBundle,
  options: { root: string },
): Array<ManifestEntry & { size: number }>;

export function createDiaryOfflinePrecache(options: { root: string }): {
  plugin: Plugin;
  manifestTransform: ManifestTransform;
};
