/**
 * Hook to enable/disable screenshot blocking when journal is open.
 * Uses FLAG_SECURE on Android. No-op on web.
 */

import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { db } from '@/storage/db';

const SETTINGS_KEY = 'journal_screenshot_block';

export function useScreenSecurity(journalOpen: boolean) {
  const [enabled, setEnabledState] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  // Load setting
  useEffect(() => {
    db.settings.get(SETTINGS_KEY).then(entry => {
      if (entry?.value) setEnabledState(true);
    }).catch(() => {});
  }, []);

  // Apply FLAG_SECURE when journal is open and setting enabled
  useEffect(() => {
    if (!isNative || !enabled || !journalOpen) return;

    let cleanup = false;

    void import('@/plugins/ScreenSecurityPlugin').then(({ default: ScreenSecurity }) => {
      if (!cleanup) void ScreenSecurity.enable();
    }).catch(() => {});

    return () => {
      cleanup = true;
      void import('@/plugins/ScreenSecurityPlugin').then(({ default: ScreenSecurity }) => {
        void ScreenSecurity.disable();
      }).catch(() => {});
    };
  }, [isNative, enabled, journalOpen]);

  const setEnabled = useCallback(async (value: boolean) => {
    setEnabledState(value);
    await db.settings.put({ key: SETTINGS_KEY, value });

    if (isNative && !value) {
      const { default: ScreenSecurity } = await import('@/plugins/ScreenSecurityPlugin');
      await ScreenSecurity.disable();
    }
  }, [isNative]);

  return { enabled, setEnabled, isNative };
}
