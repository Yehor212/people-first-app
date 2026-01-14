import { WebPlugin } from '@capacitor/core';
import type { WidgetPlugin, WidgetData } from './WidgetPlugin';

export class WidgetWeb extends WebPlugin implements WidgetPlugin {
  async updateWidget(data: WidgetData): Promise<void> {
    console.log('Widget update (web platform - no-op):', data);
    // On web, we don't have native widgets
    // Store in localStorage for future use
    localStorage.setItem('zenflow-widget-data', JSON.stringify(data));
  }

  async getWidgetData(): Promise<WidgetData> {
    const stored = localStorage.getItem('zenflow-widget-data');
    if (stored) {
      return JSON.parse(stored);
    }

    // Return default data
    return {
      streak: 0,
      habitsToday: 0,
      habitsTotalToday: 0,
      focusMinutes: 0,
      habits: [],
    };
  }

  async isSupported(): Promise<{ supported: boolean }> {
    // Widgets are not supported on web
    return { supported: false };
  }
}
