import { useState, useCallback } from 'react';

const DEMO_MODE_KEY = 'zenflow-demo-mode';

export function useDemoMode() {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    return localStorage.getItem(DEMO_MODE_KEY) === 'true';
  });

  const enableDemoMode = useCallback(() => {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    setIsDemoMode(true);
  }, []);

  const disableDemoMode = useCallback(() => {
    localStorage.removeItem(DEMO_MODE_KEY);
    setIsDemoMode(false);
  }, []);

  const toggleDemoMode = useCallback(() => {
    if (isDemoMode) disableDemoMode();
    else enableDemoMode();
  }, [isDemoMode, enableDemoMode, disableDemoMode]);

  return { isDemoMode, enableDemoMode, disableDemoMode, toggleDemoMode };
}

export function isDemoModeEnabled(): boolean {
  return localStorage.getItem(DEMO_MODE_KEY) === 'true';
}
