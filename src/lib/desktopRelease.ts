const GITHUB_RELEASE_ASSET_PREFIX =
  "https://github.com/Yehor212/people-first-app/releases/download/";

const WINDOWS_SETUP_ASSET_RE = /^ZenFlow_[0-9A-Za-z._-]+_x64-setup\.exe$/;
const SHA256_RE = /^[a-f0-9]{64}$/i;

type DesktopReleaseEnv = Record<string, unknown>;

function envString(env: DesktopReleaseEnv, key: string): string {
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
}

export type DesktopReleaseState = {
  downloadUrl: string;
  sha256: string;
  signatureStatus: string;
  ready: boolean;
};

export function isTrustedDesktopReleaseUrl(value: string): boolean {
  if (!value.startsWith(GITHUB_RELEASE_ASSET_PREFIX)) return false;

  try {
    const url = new URL(value);
    if (url.hostname !== "github.com") return false;

    const assetName = url.pathname.split("/").pop() || "";
    return WINDOWS_SETUP_ASSET_RE.test(assetName);
  } catch {
    return false;
  }
}

export function resolveDesktopRelease(env: DesktopReleaseEnv): DesktopReleaseState {
  const downloadUrl = envString(env, "VITE_DESKTOP_SIGNED_RELEASE_URL");
  const sha256 = envString(env, "VITE_DESKTOP_SIGNED_RELEASE_SHA256").toUpperCase();
  const signatureStatus = envString(env, "VITE_DESKTOP_SIGNED_RELEASE_AUTHENTICODE");
  const ready =
    isTrustedDesktopReleaseUrl(downloadUrl) &&
    SHA256_RE.test(sha256) &&
    signatureStatus.toLowerCase() === "valid";

  return {
    downloadUrl: ready ? downloadUrl : "",
    sha256: ready ? sha256 : "",
    signatureStatus: ready ? "Valid" : signatureStatus || "Pending",
    ready,
  };
}

export function getDesktopReleaseState(): DesktopReleaseState {
  return resolveDesktopRelease(import.meta.env);
}
