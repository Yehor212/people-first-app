import { isNative, platform } from "@/lib/platform";

export type AppUpdateCapability =
  | { kind: "android-store" }
  | { kind: "web-reload" }
  | { kind: "unavailable" };

export interface AppUpdateRuntime {
  native: boolean;
  platform: "android" | "ios" | "web";
  tauri: boolean;
}

export function resolveAppUpdateCapability(
  runtime: AppUpdateRuntime,
): AppUpdateCapability {
  if (runtime.native && runtime.platform === "android") {
    return { kind: "android-store" };
  }
  if (!runtime.native && !runtime.tauri) {
    return { kind: "web-reload" };
  }
  return { kind: "unavailable" };
}

function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const runtimeWindow = window as typeof window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return Boolean(runtimeWindow.__TAURI__ || runtimeWindow.__TAURI_INTERNALS__);
}

export function getAppUpdateCapability(): AppUpdateCapability {
  return resolveAppUpdateCapability({
    native: isNative,
    platform,
    tauri: isTauriRuntime(),
  });
}
