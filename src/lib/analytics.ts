import type {
  InsightSeverity,
  InsightType,
  MoodType,
  PrivacySettings,
} from "@/types";
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

const ANALYTICS_EVENTS = new Set([
  "page_view",
  "sign_in",
  "sign_out",
  "habit_created",
  "habit_completed",
  "habit_detail_opened",
  "insight_strip_rendered",
  "mood_tracked",
  "focus_session",
  "achievement_unlocked",
  "data_exported",
  "data_imported",
]);

const PAGE_NAMES = new Set(["home", "diary", "habits", "focus", "settings", "stats"]);
const HABIT_CREATE_SOURCES = new Set<HabitCreateSource>(["custom", "template", "quick-pick"]);
const MOODS = new Set<MoodType>(["great", "good", "okay", "bad", "terrible"]);
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

function boundedInteger(value: unknown, maximum = 1_000_000): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maximum
    ? value
    : null;
}

function analyticsPayload(
  event: string,
  properties?: Record<string, unknown>,
): Record<string, unknown> | undefined | null {
  if (!ANALYTICS_EVENTS.has(event)) return null;
  const input = properties ?? {};

  switch (event) {
    case "sign_in":
    case "sign_out":
    case "data_exported":
      return undefined;
    case "page_view":
      return typeof input.page === "string" && PAGE_NAMES.has(input.page)
        ? { page: input.page }
        : null;
    case "habit_created": {
      const total = boundedInteger(input.total_habits, 10_000);
      if (
        typeof input.source !== "string" ||
        !HABIT_CREATE_SOURCES.has(input.source as HabitCreateSource) ||
        total === null ||
        typeof input.ever_first !== "boolean" ||
        typeof input.session_first !== "boolean"
      ) return null;
      return {
        source: input.source,
        total_habits: total,
        ever_first: input.ever_first,
        session_first: input.session_first,
      };
    }
    case "habit_completed": {
      const total = input.total_habits === undefined
        ? undefined
        : boundedInteger(input.total_habits, 10_000);
      if (total === null) return null;
      return total === undefined ? undefined : { total_habits: total };
    }
    case "habit_detail_opened": {
      const total = boundedInteger(input.total_habits, 10_000);
      return total === null ? null : { total_habits: total };
    }
    case "insight_strip_rendered":
      return (
        typeof input.insight_type === "string" &&
        INSIGHT_TYPES.has(input.insight_type as InsightType) &&
        typeof input.insight_severity === "string" &&
        INSIGHT_SEVERITIES.has(input.insight_severity as InsightSeverity)
      )
        ? { insight_type: input.insight_type, insight_severity: input.insight_severity }
        : null;
    case "mood_tracked":
      return typeof input.mood === "string" && MOODS.has(input.mood as MoodType)
        ? { mood: input.mood }
        : null;
    case "focus_session": {
      const duration = boundedInteger(input.duration_minutes, 24 * 60);
      return duration === null ? null : { duration_minutes: duration };
    }
    case "achievement_unlocked":
      return typeof input.achievement === "string" &&
        ACHIEVEMENT_IDS.has(input.achievement as AchievementId)
        ? { achievement: input.achievement }
        : null;
    case "data_imported": {
      const count = boundedInteger(input.entry_count);
      return count === null ? null : { entry_count: count };
    }
    default:
      return null;
  }
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

    const safeProperties = analyticsPayload(event, properties);
    if (safeProperties === null) {
      logger.warn("[AnalyticsBoundary]");
      return;
    }

    // Only log to console in development
    if (IS_DEV) {
      logger.log("[Analytics]", { event });
    }

    // In production, send to your analytics service
    // Example: Google Analytics, Mixpanel, etc.
    try {
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", event, safeProperties);
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

  habitCompleted(_habitName: string, totalHabits?: number) {
    // Habit content and content-derived metadata never enter analytics.
    const payload: Record<string, unknown> = {};
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
  insightStripRendered(insightType: InsightType, insightSeverity: InsightSeverity) {
    this.track("insight_strip_rendered", {
      insight_type: insightType,
      insight_severity: insightSeverity,
    });
  }

  moodTracked(mood: MoodType) {
    this.track("mood_tracked", { mood });
  }

  focusSessionCompleted(minutes: number) {
    this.track("focus_session", { duration_minutes: minutes });
  }

  achievementUnlocked(achievementId: AchievementId) {
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
