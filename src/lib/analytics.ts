import type { InsightSeverity, InsightType, PrivacySettings } from "@/types";
import type { AchievementId } from "@/lib/gamification";
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

const HABIT_CREATE_SOURCES = new Set<HabitCreateSource>(["custom", "template", "quick-pick"]);
const INSIGHT_TYPES = new Set<InsightType>([
  "mood-habit-correlation",
  "focus-pattern",
  "habit-timing",
  "mood-tag",
  "energy-pattern",
]);
const INSIGHT_SEVERITIES = new Set<InsightSeverity>([
  "info",
  "tip",
  "warning",
  "celebration",
]);
const ACHIEVEMENT_IDS = new Set<AchievementId>([
  "first_mood",
  "first_habit",
  "first_focus",
  "first_gratitude",
  "streak_3",
  "streak_7",
  "streak_30",
  "streak_100",
  "habit_master",
  "focus_warrior",
  "grateful_heart",
  "mood_tracker",
  "perfect_week",
  "zen_master",
  "productivity_beast",
  "consistency_king",
  "wellness_warrior",
]);

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

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
 * and the event is silently dropped at the private event boundary.
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

  #track(event: string, properties?: Record<string, unknown>) {
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

  // Common events
  signIn() {
    this.#track("sign_in");
  }

  signOut() {
    this.#track("sign_out");
  }

  /**
   * Habits spec §15 — activation funnel.
   * Emits the creation channel, the post-create total, and two one-shot flags
   * (`ever_first` = first-ever habit for this device, `session_first` = first
   * habit in the current tab/app session). Storage writes are best-effort —
   * a quota/private-mode failure simply degrades the flags to `false`.
   */
  habitCreated(source: HabitCreateSource, totalHabits: number) {
    if (!this.enabled || !HABIT_CREATE_SOURCES.has(source) || !isFiniteNonNegative(totalHabits)) {
      return;
    }
    const everFirst = readFlagOnce(safeStorage("local"), SK.HABITS_EVER_CREATED);
    const sessionFirst = readFlagOnce(safeStorage("session"), SSK.HABITS_SESSION_CREATED);
    this.#track("habit_created", {
      source,
      total_habits: totalHabits,
      ever_first: everFirst,
      session_first: sessionFirst,
    });
  }

  habitCompleted(totalHabits?: number) {
    // FR-031: the method cannot accept a habit name or other private content.
    // The optional aggregate count is operational metadata only.
    this.#track(
      "habit_completed",
      typeof totalHabits === "number" && isFiniteNonNegative(totalHabits)
        ? { total_habits: totalHabits }
        : undefined,
    );
  }

  /** Habits spec §15 — depth metric. Long-press → detail sheet is the discovery signal. */
  habitDetailOpened(totalHabits: number) {
    if (!isFiniteNonNegative(totalHabits)) return;
    this.#track("habit_detail_opened", { total_habits: totalHabits });
  }

  /**
   * Habits spec §15 — cross-habit signal.
   * `insightType` / `insightSeverity` are finite enums from the V1 insights engine;
   * no user-typed text is ever emitted.
   */
  insightStripRendered(insightType: InsightType, insightSeverity: InsightSeverity) {
    if (!INSIGHT_TYPES.has(insightType) || !INSIGHT_SEVERITIES.has(insightSeverity)) return;
    this.#track("insight_strip_rendered", {
      insight_type: insightType,
      insight_severity: insightSeverity,
    });
  }

  moodTracked() {
    // FR-031: emotional values and notes remain inside the app boundary.
    this.#track("mood_tracked");
  }

  focusSessionCompleted(minutes: number) {
    if (!isFiniteNonNegative(minutes)) return;
    this.#track("focus_session", { duration_minutes: minutes });
  }

  achievementUnlocked(achievementId: AchievementId) {
    if (!ACHIEVEMENT_IDS.has(achievementId)) return;
    this.#track("achievement_unlocked", { achievement: achievementId });
  }

  dataExported() {
    this.#track("data_exported");
  }

  dataImported(entryCount: number) {
    if (!isFiniteNonNegative(entryCount)) return;
    this.#track("data_imported", { entry_count: entryCount });
  }
}

export const analytics = new Analytics();
