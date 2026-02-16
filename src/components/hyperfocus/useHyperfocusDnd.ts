import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { checkDndActive, setDndEnabled, checkPolicyAccess } from '@/hooks/useDnd';
import { logger } from '@/lib/logger';

export function useHyperfocusDnd() {
  const [dndEnabled, setDndEnabledState] = useState(false);
  const [dndPreviousState, setDndPreviousState] = useState(false);
  const [showDndPermission, setShowDndPermission] = useState(false);
  const [dndError, setDndError] = useState(false);
  const [dndSettingsError, setDndSettingsError] = useState(false);
  const dndErrorTimerRef = useRef<number | null>(null);

  // Persistent refs for unmount cleanup
  const dndEnabledRef = useRef(false);
  const dndPreviousRef = useRef(false);
  dndEnabledRef.current = dndEnabled;
  dndPreviousRef.current = dndPreviousState;

  // Restore DND on unmount if we enabled it
  useEffect(() => {
    return () => {
      if (dndEnabledRef.current && !dndPreviousRef.current) {
        void setDndEnabled(false);
        logger.log('[HyperfocusMode] DND restored on unmount');
      }
      if (dndErrorTimerRef.current) window.clearTimeout(dndErrorTimerRef.current);
    };
  }, []);

  // Re-check permission when returning from system settings
  useEffect(() => {
    if (!showDndPermission) return;

    const checkAndEnable = async () => {
      const hasAccess = await checkPolicyAccess();
      if (hasAccess) {
        setShowDndPermission(false);
        const currentlyActive = await checkDndActive();
        setDndPreviousState(currentlyActive);
        const success = await setDndEnabled(true);
        if (success) setDndEnabledState(true);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkAndEnable();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let appListener: { remove: () => Promise<void> } | null = null;
    if (Capacitor.isNativePlatform()) {
      void App.addListener('resume', () => {
        void checkAndEnable();
      }).then(handle => { appListener = handle; });
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (appListener) {
        void appListener.remove();
      }
    };
  }, [showDndPermission]);

  const handleDndToggle = async () => {
    if (dndEnabled) {
      await setDndEnabled(false);
      setDndEnabledState(false);
      return;
    }
    const hasAccess = await checkPolicyAccess();
    if (!hasAccess) {
      setShowDndPermission(true);
      return;
    }
    const currentlyActive = await checkDndActive();
    setDndPreviousState(currentlyActive);
    const success = await setDndEnabled(true);
    if (success) {
      setDndEnabledState(true);
      setDndError(false);
    } else {
      setDndError(true);
      if (dndErrorTimerRef.current) window.clearTimeout(dndErrorTimerRef.current);
      dndErrorTimerRef.current = window.setTimeout(() => setDndError(false), 3000);
    }
  };

  return {
    dndEnabled,
    showDndPermission,
    dndError,
    dndSettingsError,
    handleDndToggle,
    setShowDndPermission,
    setDndSettingsError,
    setDndEnabledState,
    setDndPreviousState,
  };
}
