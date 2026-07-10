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

interface VerifiedIntegrityReport {
  status: "verified";
  timestamp: number;
  localCounts: Record<string, number>;
  remoteCounts: Record<string, number>;
  divergence: Record<string, number>;
  maxDivergence: number;
  needsReconciliation: boolean;
}

interface UnavailableIntegrityReport {
  status: "unavailable";
  timestamp: number;
  localCounts: null;
  remoteCounts: null;
  divergence: Record<string, never>;
  maxDivergence: null;
  needsReconciliation: false;
  failureCode: "count-read-failed";
}

export type IntegrityReport = VerifiedIntegrityReport | UnavailableIntegrityReport;

const DIVERGENCE_THRESHOLD = 0.05; // 5% — trigger reconciliation above this

/** Count all local entities in IndexedDB */
async function getLocalCounts(): Promise<Record<string, number>> {
  const [moods, habits, focusSessions, gratitude, journal] = await Promise.all([
    db.moods.count(),
    db.habits.count(),
    db.focusSessions.count(),
    db.gratitudeEntries.count(),
    db.journalEntries.count(),
  ]);
  return { moods, habits, focusSessions, gratitude, journal };
}

/** Count all remote entities in Supabase */
async function getRemoteCounts(userId: string): Promise<Record<string, number>> {
  if (!supabase) throw new Error("Supabase client is unavailable");

  const results = await Promise.all([
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
  const keys = ["moods", "habits", "focusSessions", "gratitude", "journal"] as const;
  const counts: Record<string, number> = {};
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (result.error) throw new Error(`Remote ${keys[index]} count failed`);
    if (!Number.isInteger(result.count) || (result.count ?? -1) < 0) {
      throw new Error(`Remote ${keys[index]} count is unavailable`);
    }
    counts[keys[index]] = result.count as number;
  }
  return counts;
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

  let localCounts: Record<string, number>;
  let remoteCounts: Record<string, number>;
  try {
    [localCounts, remoteCounts] = await Promise.all([
      getLocalCounts(),
      getRemoteCounts(userId),
    ]);
  } catch (error) {
    logger.error("[SyncIntegrity] Failed to read integrity counts:", error);
    const unavailable: UnavailableIntegrityReport = {
      status: "unavailable",
      timestamp: Date.now(),
      localCounts: null,
      remoteCounts: null,
      divergence: {},
      maxDivergence: null,
      needsReconciliation: false,
      failureCode: "count-read-failed",
    };
    logger.warn("[SyncIntegrity] Verification unavailable:", unavailable);
    return unavailable;
  }

  const divergence: Record<string, number> = {};
  let maxDivergence = 0;

  for (const key of Object.keys(localCounts)) {
    const div = calcDivergence(localCounts[key], remoteCounts[key]);
    divergence[key] = Math.round(div * 100);
    maxDivergence = Math.max(maxDivergence, div);
  }

  const needsReconciliation = maxDivergence > DIVERGENCE_THRESHOLD;

  const report: IntegrityReport = {
    status: "verified",
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
