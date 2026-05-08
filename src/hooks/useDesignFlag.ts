/**
 * useDesignFlag — Phase 2-B
 *
 * Hook for reading a single design-system rollout flag. Evaluates (in order):
 *   1. killswitch active      → false (admin kill)
 *   2. flag not in cache      → false (unknown flag = default off)
 *   3. enabled=false          → false
 *   4. rollout_percent = 100  → true
 *   5. rollout_percent = 0    → false
 *   6. 1..99                  → deterministic hash(userId + key) % 100 < rollout_percent
 *
 * Rollout hash is DETERMINISTIC per (userId, key) pair so the same user always
 * sees the same state (no flicker between sessions). Anonymous users get a
 * stable random identifier persisted in localStorage.
 *
 * For non-React contexts (e.g. animationUtils, audioManager), use the static
 * variant isDesignFlagEnabledStatic().
 */

import { useEffect, useMemo, useState } from "react";
import { useDesignFlagStore } from "@/stores/designFlagStore";
import { supabase } from "@/lib/supabaseClient";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

/**
 * Lightweight deterministic hash (djb2 variant).
 * Not cryptographic — only used for stable 0-99 bucket assignment.
 */
function bucketHash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 100;
}

/**
 * Returns a stable identifier for rollout bucketing.
 * - Authenticated: Supabase user UUID
 * - Anonymous: random nanoid-like string persisted in localStorage
 * - SSR / no window: 'anon' (same bucket every time, deterministic for tests)
 */
function getBucketId(userId: string | null | undefined): string {
  if (userId) return userId;
  if (typeof window === "undefined") return "anon";

  const cached = storageGetRaw(SK.ANON_ID, "");
  if (cached.length > 0) return cached;
  const fresh =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  storageSetRaw(SK.ANON_ID, fresh);
  return fresh;
}

/**
 * Evaluate a design-flag row against a bucket ID.
 * Exported for testability without a React tree.
 */
export function evaluateDesignFlag(
  flag: { enabled: boolean; rollout_percent: number; killswitch: boolean } | undefined,
  bucketId: string,
  key: string,
): boolean {
  if (!flag) return false;
  if (flag.killswitch) return false;
  if (!flag.enabled) return false;
  if (flag.rollout_percent >= 100) return true;
  if (flag.rollout_percent <= 0) return false;
  return bucketHash(bucketId + ":" + key) < flag.rollout_percent;
}

export function useDesignFlag(key: string): boolean {
  const flag = useDesignFlagStore((s) => s.flags[key]);
  const [userId, setUserId] = useState<string | null>(null);

  // Async-resolve the user ID without re-subscribing (auth changes are rare; a
  // stale bucket never flips from true→false mid-session because the hash is
  // deterministic per userId — the user can only transition anon→authenticated
  // once per app lifetime, and the re-bucketing is an intended consequence).
  useEffect(() => {
    let cancelled = false;
    if (!supabase) {
      setUserId(null);
      return;
    }
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!cancelled) setUserId(data.user?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setUserId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const bucketId = getBucketId(userId);
    return evaluateDesignFlag(flag, bucketId, key);
  }, [flag, userId, key]);
}

/**
 * Static variant for non-React contexts. Reads store state imperatively.
 * Does not subscribe to updates — callers must re-check periodically.
 */
export function isDesignFlagEnabledStatic(key: string, userId?: string | null): boolean {
  const flag = useDesignFlagStore.getState().flags[key];
  const bucketId = getBucketId(userId ?? null);
  return evaluateDesignFlag(flag, bucketId, key);
}
