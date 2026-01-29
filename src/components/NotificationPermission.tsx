import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useLanguage } from '@/contexts/LanguageContext';
import { Capacitor } from '@capacitor/core';
import { logger } from '@/lib/logger';

interface NotificationPermissionProps {
  onComplete: () => void;
}

export function NotificationPermission({ onComplete }: NotificationPermissionProps) {
  const { t } = useLanguage();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    // Only show on native platforms
    if (!Capacitor.isNativePlatform()) {
      onComplete();
      return;
    }

    // Check if we've already asked
    const hasAsked = localStorage.getItem('notification-permission-asked');
    if (hasAsked) {
      onComplete();
      return;
    }

    try {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display === 'granted') {
        localStorage.setItem('notification-permission-asked', 'true');
        onComplete();
        return;
      }

      // Show the prompt
      setShowPrompt(true);
    } catch (error) {
      logger.error('[Notifications] Failed to check permissions:', error);
      onComplete();
    }
  };

  const handleAllow = async () => {
    try {
      const result = await LocalNotifications.requestPermissions();
      localStorage.setItem('notification-permission-asked', 'true');

      if (result.display === 'granted') {
        logger.log('[Notifications] Permission granted');
      }

      setShowPrompt(false);
      onComplete();
    } catch (error) {
      logger.error('[Notifications] Failed to request permissions:', error);
      setShowPrompt(false);
      onComplete();
    }
  };

  const handleDeny = () => {
    localStorage.setItem('notification-permission-asked', 'true');
    setShowPrompt(false);
    onComplete();
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md bg-card rounded-2xl p-4 sm:p-6 zen-shadow-card animate-scale-in">
        {/* Close button */}
        <button
          onClick={handleDeny}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="p-4 zen-gradient rounded-2xl zen-shadow-glow">
            <Bell className="w-12 h-12 text-primary-foreground" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-foreground text-center mb-2">
          {t.notificationPermissionTitle || 'Stay on Track'}
        </h2>

        {/* Description */}
        <p className="text-muted-foreground text-center mb-6">
          {t.notificationPermissionDescription ||
            'Get gentle reminders to track your mood, complete habits, and take focus breaks. Notifications help you build healthy routines.'}
        </p>

        {/* Features */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <div>
              <p className="font-medium text-foreground">
                {t.notificationFeature1Title || 'Daily Mood Reminders'}
              </p>
              <p className="text-sm text-muted-foreground">
                {t.notificationFeature1Desc || 'Check in with yourself every day'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <div>
              <p className="font-medium text-foreground">
                {t.notificationFeature2Title || 'Habit Tracking'}
              </p>
              <p className="text-sm text-muted-foreground">
                {t.notificationFeature2Desc || 'Stay consistent with your goals'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <div>
              <p className="font-medium text-foreground">
                {t.notificationFeature3Title || 'Focus Sessions'}
              </p>
              <p className="text-sm text-muted-foreground">
                {t.notificationFeature3Desc || 'Get reminded to take productive breaks'}
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleAllow}
            className="btn-press w-full py-3 zen-gradient text-primary-foreground font-semibold rounded-xl zen-shadow-soft hover:opacity-90 transition-opacity"
          >
            {t.notificationAllow || 'Enable Notifications'}
          </button>
          <button
            onClick={handleDeny}
            className="btn-press w-full py-3 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-muted transition-colors"
          >
            {t.notificationDeny || 'Maybe Later'}
          </button>
        </div>

        {/* Privacy note */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          {t.notificationPrivacyNote || 'You can change this anytime in Settings. Notifications are local and private.'}
        </p>
      </div>
    </div>
  );
}
