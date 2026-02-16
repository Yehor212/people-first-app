import { useState, useCallback } from 'react';
import { SK } from '@/lib/storageKeys';
import { storageGetRaw, storageSetRaw, storageRemove } from '@/lib/safeJson';

export function useDemoMode() {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    return storageGetRaw(SK.DEMO_MODE) === 'true';
  });

  const enableDemoMode = useCallback(() => {
    storageSetRaw(SK.DEMO_MODE, 'true');
    setIsDemoMode(true);
  }, []);

  const disableDemoMode = useCallback(() => {
    storageRemove(SK.DEMO_MODE);
    setIsDemoMode(false);
  }, []);

  const toggleDemoMode = useCallback(() => {
    if (isDemoMode) disableDemoMode();
    else enableDemoMode();
  }, [isDemoMode, enableDemoMode, disableDemoMode]);

  return { isDemoMode, enableDemoMode, disableDemoMode, toggleDemoMode };
}

export function isDemoModeEnabled(): boolean {
  return storageGetRaw(SK.DEMO_MODE) === 'true';
}
