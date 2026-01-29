import { WebPlugin } from '@capacitor/core';
import type { WidgetPlugin, WidgetData } from './widgetTypes';
import { logger } from '@/lib/logger';
import { safeJsonParse } from '@/lib/safeJson';

export class WidgetWeb extends WebPlugin implements WidgetPlugin {
  async updateWidget(data: WidgetData): Promise<void> {
    logger.log('[Widget] update (web platform - no-op):', data);
    // On web, we don't have native widgets
    // Store in localStorage for future use
    localStorage.setItem('zenflow-widget-data', JSON.stringify(data));
  }

  async getWidgetData(): Promise<WidgetData> {
    const defaultData: WidgetData = {
      streak: 0,
      habitsToday: 0,
      habitsTotalToday: 0,
      focusMinutes: 0,
      habits: [],
    };

    const stored = localStorage.getItem('zenflow-widget-data');
    return safeJsonParse(stored, defaultData);
  }

  async isSupported(): Promise<{ supported: boolean }> {
    // Widgets are not supported on web
    return { supported: false };
  }
}
