import { logger } from "@/lib/logger";

export type LongAudioOwnerId =
  | "global-cloudlight"
  | "auth-soft-air"
  | "orb-water"
  | "diary-rain"
  | "hyperfocus";

interface ActiveLongAudioOwner {
  ownerId: LongAudioOwnerId;
  pause: () => void;
  token: symbol;
}

let activeOwner: ActiveLongAudioOwner | null = null;
const listeners = new Set<(ownerId: LongAudioOwnerId | null) => void>();

function emitOwnerChange(): void {
  for (const listener of [...listeners]) {
    listener(activeOwner?.ownerId ?? null);
  }
}

export function claimLongAudio(
  ownerId: LongAudioOwnerId,
  pause: () => void,
): () => void {
  const previous = activeOwner;
  const token = Symbol(ownerId);
  const ownerChanged = previous?.ownerId !== ownerId;
  activeOwner = { ownerId, pause, token };
  if (ownerChanged) emitOwnerChange();

  if (previous && previous.ownerId !== ownerId) {
    try {
      previous.pause();
    } catch (error) {
      logger.warn("[AudioPlaybackCoordinator] Previous owner pause failed:", error);
    }
  }

  return () => {
    if (activeOwner?.token !== token) return;
    activeOwner = null;
    emitOwnerChange();
  };
}

export function getActiveLongAudioOwner(): LongAudioOwnerId | null {
  return activeOwner?.ownerId ?? null;
}

export function subscribeLongAudioOwner(
  listener: (ownerId: LongAudioOwnerId | null) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
