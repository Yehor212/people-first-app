/**
 * Storage Error Banner
 * P1 Fix: Shows user-facing notification when storage fails
 * (Safari Private Mode, quota exceeded, etc.)
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface StorageErrorEvent {
  type: 'write_failed' | 'read_failed' | 'quota_exceeded';
  message: string;
  table?: string;
}

export function StorageErrorBanner() {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleStorageError = (event: CustomEvent<StorageErrorEvent>) => {
      setErrorMessage(event.detail.message);
      setIsVisible(true);
    };

    window.addEventListener('zenflow:storage-error', handleStorageError as EventListener);

    return () => {
      window.removeEventListener('zenflow:storage-error', handleStorageError as EventListener);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up"
    >
      <div className="bg-amber-500/95 dark:bg-amber-600/95 text-white rounded-xl p-4 shadow-lg backdrop-blur-sm flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {t.storageWarningTitle || 'Storage Warning'}
          </p>
          <p className="text-xs opacity-90 mt-0.5">
            {errorMessage || (t.storageWarningMessage || 'Data may not be saved. Try disabling Private Mode or clearing storage.')}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label={t.close || 'Close'}
          className="p-1 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default StorageErrorBanner;
