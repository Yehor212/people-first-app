/**
 * Widget type definitions
 * Separated to avoid circular dependencies between WidgetPlugin and WidgetWeb
 */

export interface WidgetData {
  streak: number;
  habitsToday: number;
  habitsTotalToday: number;
  focusMinutes: number;
  lastBadge?: string;
  currentMood?: string;    // Mood emoji character (e.g. "😊")
  moodLabel?: string;      // Translated mood name (e.g. "Happy")
  habits: Array<{
    name: string;
    completed: boolean;
  }>;
}

export interface WidgetPlugin {
  /**
   * Update widget data
   * @param data - Widget data to display
   */
  updateWidget(data: WidgetData): Promise<void>;

  /** Remove all account-owned widget data and refresh every installed widget. */
  clearAccountData(): Promise<void>;

  /**
   * Get current widget data
   */
  getWidgetData(): Promise<WidgetData>;

  /**
   * Check if widgets are supported on this platform
   */
  isSupported(): Promise<{ supported: boolean }>;
}
