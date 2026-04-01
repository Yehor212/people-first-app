import { PrivacySettings } from "@/types";
import { logger } from "./logger";
import { IS_DEV } from "@/lib/env";

// Google Analytics gtag type declaration
declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: Record<string, unknown>) => void;
  }
}

// Simple analytics wrapper that respects user privacy settings
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

  habitCompleted(habitName: string) {
    // SECURITY: Only send the length — habit names are user-typed and may contain PII
    this.track("habit_completed", { habit_length: habitName.length });
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
