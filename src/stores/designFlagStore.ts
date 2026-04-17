/**
 * Design Flag Store — Phase 2-B
 *
 * Zustand store for design-system rollout flags (OKLCH migration, paper theme,
 * motion verb adoption). Backed by the Supabase `public.design_flags` table.
 *
 * DISTINCT from FeatureFlagsContext which handles USER-facing feature toggles
 * (focusTimer, gratitudeJournal, etc) in localStorage. This store handles
 * DESIGN-SYSTEM rollout gates controlled by admins.
 *
 * Architecture (per plan §14 Q12 FREE STACK):
 *   - Zustand + persist middleware → offline-first cache in localStorage
 *   - Fetch from Supabase on app boot + periodic refresh (5 min)
 *   - On fetch failure → silently keep cached values (offline-first, Law 25)
 *   - Deterministic hash(userId + key) % 100 for rollout % gating in useDesignFlag
 *
 * Reads are free (public RLS policy). Writes are restricted to service_role —
 * client-side never writes this table (admins use Supabase Dashboard).
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { supabase } from "@/lib/supabaseClient";
import { logger } from "@/lib/logger";
import { IS_DEV } from "@/lib/env";

export interface DesignFlag {
  key: string;
  enabled: boolean;
  rollout_percent: number;
  killswitch: boolean;
  description?: string | null;
}

export interface DesignFlagState {
  flags: Record<string, DesignFlag>;
  lastFetch: number | null;
  isLoading: boolean;
  fetchFlags: () => Promise<void>;
  /** Test/admin helper — seeds flags without hitting the network. Not exported for production use. */
  _setFlagsForTest: (flags: Record<string, DesignFlag>) => void;
}

// 5 minutes — matches Q12 refresh interval
const FETCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * SSR-safe storage factory. Returns localStorage on web, no-op on non-browser.
 * Prevents hydration errors during Vitest/SSR.
 */
const safeStorage = () => {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    } as Storage;
  }
  return window.localStorage;
};

export const useDesignFlagStore = create<DesignFlagState>()(
  persist(
    (set, get) => ({
      flags: {},
      lastFetch: null,
      isLoading: false,

      fetchFlags: async () => {
        // Skip if Supabase not configured (local-only dev mode) — cached values still work
        if (!supabase) {
          if (IS_DEV) {
            logger.warn("[designFlagStore] Supabase not configured — keeping cached flags");
          }
          return;
        }

        // Debounce: skip if fetched within last FETCH_INTERVAL_MS
        const { lastFetch } = get();
        if (lastFetch !== null && Date.now() - lastFetch < FETCH_INTERVAL_MS) {
          return;
        }

        set({ isLoading: true });

        try {
          const { data, error } = await supabase
            .from("design_flags")
            .select("key, enabled, rollout_percent, killswitch, description");

          if (error) throw error;

          const flags: Record<string, DesignFlag> = {};
          for (const row of data ?? []) {
            flags[row.key] = {
              key: row.key,
              enabled: row.enabled,
              rollout_percent: row.rollout_percent,
              killswitch: row.killswitch,
              description: row.description,
            };
          }

          set({ flags, lastFetch: Date.now(), isLoading: false });
        } catch (err) {
          // Offline or network error — keep cached flags (persist middleware already
          // rehydrated them). Loud failure (Law 5): log, but don't throw; degraded
          // mode is preferable to hard failure for rollout gates.
          if (IS_DEV) {
            logger.warn("[designFlagStore] Fetch failed, keeping cached flags:", err);
          }
          set({ isLoading: false });
        }
      },

      _setFlagsForTest: (flags) => {
        set({ flags, lastFetch: Date.now(), isLoading: false });
      },
    }),
    {
      name: "zen-design-flags",
      version: 1,
      storage: createJSONStorage(safeStorage),
      partialize: (state) => ({ flags: state.flags, lastFetch: state.lastFetch }),
    },
  ),
);
