/**
 * Sync Integrity Verification — post-sync data consistency check.
 *
 * After each sync cycle, compares local entity counts with remote.
 * If divergence exceeds 5%, flags for full reconciliation.
 * Like Telegram's session hash verification for data integrity.
 */

import { db } from "@/storage/db";
import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import { logger } from "@/lib/logger";

export interface IntegrityReport {
  timestamp: number;
  localCounts: Record<string, number>;
  remoteCounts: Record<string, number>;
  divergence: Record<string, number>;
  maxDivergence: number;
  needsReconciliation: boolean;
}

const DIVERGENCE_THRESHOLD = 0.05; // 5% — trigger reconciliation above this

/** Count all local entities in IndexedDB */
async function getLocalCounts(): Promise<Record<string, number>> {
  try {
    const [moods, habits, focusSessions, gratitude, journal] = await Promise.all([
      db.moods.count(),
      db.habits.count(),
      db.focusSessions.count(),
      db.gratitudeEntries.count(),
      db.journalEntries.count(),
    ]);
    return { moods, habits, focusSessions, gratitude, journal };
  } catch (err) {
    logger.error("[SyncIntegrity] Failed to count local entities:", err);
    return { moods: 0, habits: 0, focusSessions: 0, gratitude: 0, journal: 0 };
  }
}

/** Count all remote entities in Supabase */
async function getRemoteCounts(userId: string): Promise<Record<string, number>> {
  if (!supabase) return { moods: 0, habits: 0, focusSessions: 0, gratitude: 0, journal: 0 };

  try {
    const [moods, habits, focus, gratitude, journal] = await Promise.all([
      supabase.from("moods").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("habits").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("focus_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("gratitude_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("journal_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    return {
      moods: moods.count ?? 0,
      habits: habits.count ?? 0,
      focusSessions: focus.count ?? 0,
      gratitude: gratitude.count ?? 0,
      journal: journal.count ?? 0,
    };
  } catch (err) {
    logger.error("[SyncIntegrity] Failed to count remote entities:", err);
    return { moods: 0, habits: 0, focusSessions: 0, gratitude: 0, journal: 0 };
  }
}

/** Calculate divergence ratio between two counts (0 = identical, 1 = completely different) */
function calcDivergence(local: number, remote: number): number {
  const max = Math.max(local, remote);
  if (max === 0) return 0;
  return Math.abs(local - remote) / max;
}

/**
 * Run integrity check — compare local vs remote entity counts.
 * Returns report with per-entity divergence and reconciliation recommendation.
 */
export async function verifySyncIntegrity(): Promise<IntegrityReport | null> {
  const userId = await getCurrentUserId();
  if (!userId || !supabase) {
    logger.log("[SyncIntegrity] Skipped — not authenticated");
    return null;
  }

  const [localCounts, remoteCounts] = await Promise.all([
    getLocalCounts(),
    getRemoteCounts(userId),
  ]);

  const divergence: Record<string, number> = {};
  let maxDivergence = 0;

  for (const key of Object.keys(localCounts)) {
    const div = calcDivergence(localCounts[key], remoteCounts[key]);
    divergence[key] = Math.round(div * 100);
    maxDivergence = Math.max(maxDivergence, div);
  }

  const needsReconciliation = maxDivergence > DIVERGENCE_THRESHOLD;

  const report: IntegrityReport = {
    timestamp: Date.now(),
    localCounts,
    remoteCounts,
    divergence,
    maxDivergence: Math.round(maxDivergence * 100),
    needsReconciliation,
  };

  if (needsReconciliation) {
    logger.warn("[SyncIntegrity] Divergence detected:", report);
  } else {
    logger.log("[SyncIntegrity] Data consistent:", report);
  }

  return report;
}
