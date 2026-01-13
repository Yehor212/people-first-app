import { PrivacySettings } from '@/types';

// Simple analytics wrapper that respects user privacy settings
class Analytics {
  private enabled = false;

  init(privacy: PrivacySettings) {
    this.enabled = privacy.analytics && !privacy.noTracking;
  }

  track(event: string, properties?: Record<string, any>) {
    if (!this.enabled) return;

    // Only log to console in development
    if (import.meta.env.DEV) {
      console.log('[Analytics]', event, properties);
    }

    // In production, send to your analytics service
    // Example: Google Analytics, Mixpanel, etc.
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', event, properties);
      }
    } catch (error) {
      console.error('Analytics error:', error);
    }
  }

  page(pageName: string) {
    this.track('page_view', { page: pageName });
  }

  // Common events
  signIn() {
    this.track('sign_in');
  }

  signOut() {
    this.track('sign_out');
  }

  habitCompleted(habitName: string) {
    this.track('habit_completed', { habit: habitName });
  }

  moodTracked(mood: string) {
    this.track('mood_tracked', { mood });
  }

  focusSessionCompleted(minutes: number) {
    this.track('focus_session', { duration_minutes: minutes });
  }

  achievementUnlocked(achievementId: string) {
    this.track('achievement_unlocked', { achievement: achievementId });
  }
}

export const analytics = new Analytics();
