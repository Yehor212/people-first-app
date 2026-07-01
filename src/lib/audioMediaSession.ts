import { logger } from "@/lib/logger";

interface AudioMediaSessionOptions {
  title: string;
  artist?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
}

function setActionHandler(action: MediaSessionAction, handler: (() => void) | null): void {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch (error) {
    logger.warn("[AudioMediaSession] Failed to set action handler:", action, error);
  }
}

export function setAppAudioMediaSession(options: AudioMediaSessionOptions): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

  try {
    if (typeof MediaMetadata !== "undefined") {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: options.title,
        artist: options.artist ?? "ZenFlow",
      });
    }
    navigator.mediaSession.playbackState = "playing";
    setActionHandler("play", options.onPlay ?? null);
    setActionHandler("pause", options.onPause ?? null);
    setActionHandler("stop", options.onStop ?? options.onPause ?? null);
  } catch (error) {
    logger.warn("[AudioMediaSession] Failed to update media session:", error);
  }
}

export function clearAppAudioMediaSession(): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

  try {
    navigator.mediaSession.playbackState = "none";
    navigator.mediaSession.metadata = null;
    setActionHandler("play", null);
    setActionHandler("pause", null);
    setActionHandler("stop", null);
  } catch (error) {
    logger.warn("[AudioMediaSession] Failed to clear media session:", error);
  }
}
