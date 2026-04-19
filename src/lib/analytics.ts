import { PrivacySettings } from "@/types";
import { logger } from "./logger";
import { IS_DEV } from "@/lib/env";
import { SK, SSK } from "@/lib/storageKeys";

// Google Analytics gtag type declaration
declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: Record<string, unknown>) => void;
  }
}

/** Channel through which a habit was added — PII-free enum for §15 activation funnel. */
export type HabitCreateSource = "custom" | "template" | "quick-pick";

/**
 * Read-and-claim a one-shot flag. Returns `true` the first time the key is
 * missing (and writes `"1"` so the next call returns `false`).
 *
 * Null-check is deliberate: `getItem` returns `null` for a missing key and an
 * empty string for a previously-written `""`. The previous `if (raw)` was
 * falsy for both, which would treat an empty-string flag as "unclaimed" and
 * mis-report `ever_first=true` on a reset device. `raw !== null` is the only
 * correct test for "has this key ever been written".
 *
 * Never throws — private-browsing Safari and quota-full Android can reject
 * writes; we degrade to `false` rather than failing the caller.
 */
function readFlagOnce(storage: Storage | undefined, key: string): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(key);
    if (raw !== null) return false;
    storage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

function safeStorage(kind: "local" | "session"): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * Simple analytics wrapper that respects user privacy settings.
 *
 * ### Init ordering invariant
 * `analytics.init(privacy)` is called from `src/pages/Index.tsx` inside a
 * `useEffect` keyed on the privacy slice of `useUserDataStore`. React runs
 * child effects BEFORE parent effects on mount, so child components that
 * emit inside a mount-effect (today: only `HeroInsightStrip`) can fire
 * BEFORE `init` runs. In that window `enabled` is still the default `false`
 * and the event is silently dropped at `track()`.
 *
 * Operational impact: one-time miss per app launch IF the user already has
 * ≥30-day data AND lands directly on the Habits tab. All user-interaction
 * emitters (create / complete / detail-open) fire on input events long after
 * the initial render cycle and are therefore unaffected.
 *
 * A buffer-and-flush design would close the window at the cost of complexity
 * (pending queue, order preservation, privacy-opt-out drop semantics). Given
 * the miss is transient and bounded, we accept the drop and document the
 * invariant rather than over-engineering. Revisit if server-side aggregation
 * shows meaningful §15 cross-habit signal under-counting.
 */
class Analytics {
  private enabled = false;

  init(privacy: PrivacySettings) {
    this.enabled = privacy.analytics && !privacy.noTracking;
  }

  track(event: string, properties?: Record<string, unknown>) {
    if (!this.enabled) return;

    // Only log to console in development
    if (IS_DEV) {
      logger.log("[Analytics]", event, properties);
    }

    // In production, send to your analytics service
    // Example: Google Analytics, Mixpanel, etc.
    try {
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", event, properties);
      }
    } catch (error) {
      logger.error("[Analytics] Error:", error);
    }
  }

  page(pageName: string) {
    this.track("page_view", { page: pageName });
  }

  // Common events
  signIn() {
    this.track("sign_in");
  }

  signOut() {
    this.track("sign_out");
  }

  /**
   * Habits spec §15 — activation funnel.
   * Emits the creation channel, the post-create total, and two one-shot flags
   * (`ever_first` = first-ever habit for this device, `session_first` = first
   * habit in the current tab/app session). Storage writes are best-effort —
   * a quota/private-mode failure simply degrades the flags to `false`.
   */
  habitCreated(source: HabitCreateSource, totalHabits: number) {
    if (!this.enabled) return;
    const everFirst = readFlagOnce(safeStorage("local"), SK.HABITS_EVER_CREATED);
    const sessionFirst = readFlagOnce(safeStorage("session"), SSK.HABITS_SESSION_CREATED);
    this.track("habit_created", {
      source,
      total_habits: totalHabits,
      ever_first: everFirst,
      session_first: sessionFirst,
    });
  }

  habitCompleted(habitName: string, totalHabits?: number) {
    // SECURITY: Only send the length — habit names are user-typed and may contain PII
    const payload: Record<string, unknown> = { habit_length: habitName.length };
    if (typeof totalHabits === "number") {
      // §15 retention cohort — aggregators filter ≥3 to compute 7-day completion rate
      payload.total_habits = totalHabits;
    }
    this.track("habit_completed", payload);
  }

  /** Habits spec §15 — depth metric. Long-press → detail sheet is the discovery signal. */
  habitDetailOpened(totalHabits: number) {
    this.track("habit_detail_opened", { total_habits: totalHabits });
  }

  /**
   * Habits spec §15 — cross-habit signal.
   * `insightType` / `insightSeverity` are finite enums from the V1 insights engine;
   * no user-typed text is ever emitted.
   */
  insightStripRendered(insightType: string, insightSeverity: string) {
    this.track("insight_strip_rendered", {
      insight_type: insightType,
      insight_severity: insightSeverity,
    });
  }

  moodTracked(mood: string) {
    this.track("mood_tracked", { mood });
  }

  focusSessionCompleted(minutes: number) {
    this.track("focus_session", { duration_minutes: minutes });
  }

  achievementUnlocked(achievementId: string) {
    this.track("achievement_unlocked", { achievement: achievementId });
  }

  dataExported() {
    this.track("data_exported");
  }

  dataImported(entryCount: number) {
    this.track("data_imported", { entry_count: entryCount });
  }
}

export const analytics = new Analytics();
