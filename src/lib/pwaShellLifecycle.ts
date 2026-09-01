export type AppRuntimeSurface = "browser" | "installed-pwa" | "capacitor" | "tauri";

export type PwaInstallState =
  | "installed"
  | "promptable"
  | "manual"
  | "unavailable"
  | "prompting"
  | "dismissed"
  | "error";

export type PwaUpdatePhase = "idle" | "waiting" | "preparing" | "blocked" | "activating" | "error";

export interface AppRuntimeProbe {
  native: boolean;
  standalone: boolean;
  tauri: boolean;
}

const ZENFLOW_OWNED_CACHE_NAMES = new Set([
  "zenflow-lang-chunks",
  "zenflow-runtime-assets",
  "zenflow-runtime-audio",
  "supabase-storage",
  "fluent-emoji-stickers",
  "google-fonts-stylesheets",
  "google-fonts-webfonts",
]);

export function resolveAppRuntimeSurface({ native, standalone, tauri }: AppRuntimeProbe): AppRuntimeSurface {
  if (tauri) return "tauri";
  if (native) return "capacitor";
  return standalone ? "installed-pwa" : "browser";
}

export function canUsePwaShellLifecycle(surface: AppRuntimeSurface): boolean {
  return surface === "browser" || surface === "installed-pwa";
}

export function isZenflowOwnedCacheName(name: string): boolean {
  return ZENFLOW_OWNED_CACHE_NAMES.has(name) || /^zenflow-(?:precache|runtime)-v1$/.test(name);
}

export function sanitizePwaLifecycleRoute(value: string, basePath = "/"): string {
  try {
    const url = new URL(value, "https://zenflow.invalid");
    const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
    if (!url.pathname.startsWith(normalizedBase)) return normalizedBase;
    return url.pathname;
  } catch {
    return basePath.endsWith("/") ? basePath : `${basePath}/`;
  }
}
