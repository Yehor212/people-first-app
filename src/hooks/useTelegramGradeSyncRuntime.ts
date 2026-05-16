import { useDeltaSyncEffects } from "@/hooks/useDeltaSyncEffects";

/**
 * Shared Telegram-grade sync runtime.
 *
 * V1 and V2 are one product state. Any shell that can be the app entry point
 * must mount this hook so ordered `sync_events.seq` deltas, tombstones, resume,
 * online/offline, and BroadcastChannel wake-ups behave the same everywhere.
 */
export function useTelegramGradeSyncRuntime(): void {
  useDeltaSyncEffects();
}
