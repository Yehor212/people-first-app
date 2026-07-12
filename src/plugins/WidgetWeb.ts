import { WebPlugin } from '@capacitor/core';
import type { WidgetPlugin, WidgetData } from './widgetTypes';
import { logger } from '@/lib/logger';
import { safeLocalStorageGet, safeLocalStorageSet, storageRemove } from '@/lib/safeJson';
import { SK } from '@/lib/storageKeys';

export class WidgetWeb extends WebPlugin implements WidgetPlugin {
  async clearAccountData(): Promise<void> {
    storageRemove(SK.WIDGET_DATA);
  }

  async updateWidget(data: WidgetData): Promise<void> {
    logger.log('[Widget] update (web platform - no-op):', data);
    // On web, we don't have native widgets
    // Store in localStorage for future use
    safeLocalStorageSet(SK.WIDGET_DATA, data);
  }

  async getWidgetData(): Promise<WidgetData> {
    const defaultData: WidgetData = {
      streak: 0,
      habitsToday: 0,
      habitsTotalToday: 0,
      focusMinutes: 0,
      habits: [],
    };

    return safeLocalStorageGet<WidgetData>(SK.WIDGET_DATA, defaultData);
  }

  async isSupported(): Promise<{ supported: boolean }> {
    // Widgets are not supported on web
    return { supported: false };
  }
}
