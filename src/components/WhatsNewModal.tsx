/**
 * What's New Modal
 *
 * Shows changelog to users after app update.
 * Only displays once per version update.
 */

import { useState, useEffect } from 'react';
import { Sparkles, Shield, Zap, Download, Moon, X, RefreshCw, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { APP_VERSION, wasAppUpdated } from '@/lib/appVersion';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

const LAST_SEEN_VERSION_KEY = 'zenflow_last_seen_version';

interface ChangelogItem {
  icon: React.ReactNode;
  titleKey: string;
  descriptionKey: string;
  // Fallback English text
  title: string;
  description: string;
}

// Changelog entries by version
const CHANGELOG: Record<string, ChangelogItem[]> = {
  '1.3.5': [
    {
      icon: <Shield className="w-5 h-5 text-green-500" />,
      titleKey: 'whatsNew.security.title',
      descriptionKey: 'whatsNew.security.description',
      title: 'Enhanced Security',
      description: 'Better data protection & privacy.',
    },
    {
      icon: <Zap className="w-5 h-5 text-yellow-500" />,
      titleKey: 'whatsNew.performance.title',
      descriptionKey: 'whatsNew.performance.description',
      title: 'Improved Stability',
      description: 'Fixed sync issues and deadlock prevention.',
    },
    {
      icon: <RefreshCw className="w-5 h-5 text-blue-500" />,
      titleKey: 'whatsNew.sync.title',
      descriptionKey: 'whatsNew.sync.description',
      title: 'Reliable Sync',
      description: 'Better cloud synchronization with timeout protection.',
    },
  ],
  '1.3.0': [
    {
      icon: <Sparkles className="w-5 h-5 text-purple-500" />,
      titleKey: 'whatsNew.leaderboards.title',
      descriptionKey: 'whatsNew.leaderboards.description',
      title: 'Leaderboards',
      description: 'Compete anonymously with others.',
    },
    {
      icon: <Zap className="w-5 h-5 text-green-500" />,
      titleKey: 'whatsNew.spotify.title',
      descriptionKey: 'whatsNew.spotify.description',
      title: 'Spotify Integration',
      description: 'Auto-play music during focus sessions.',
    },
    {
      icon: <RefreshCw className="w-5 h-5 text-orange-500" />,
      titleKey: 'whatsNew.challenges.title',
      descriptionKey: 'whatsNew.challenges.description',
      title: 'Friend Challenges',
      description: 'Challenge friends to build habits together.',
    },
    {
      icon: <MessageSquare className="w-5 h-5 text-blue-500" />,
      titleKey: 'whatsNew.digest.title',
      descriptionKey: 'whatsNew.digest.description',
      title: 'Weekly Digest',
      description: 'Get progress reports in your inbox.',
    },
  ],
  '1.2.0': [
    {
      icon: <Shield className="w-5 h-5 text-green-500" />,
      titleKey: 'whatsNew.security.title',
      descriptionKey: 'whatsNew.security.description',
      title: 'Enhanced Security',
      description: 'Improved data protection and validation to keep your information safe.',
    },
    {
      icon: <Zap className="w-5 h-5 text-yellow-500" />,
      titleKey: 'whatsNew.performance.title',
      descriptionKey: 'whatsNew.performance.description',
      title: 'Better Performance',
      description: 'Fixed sync issues and improved app stability.',
    },
    {
      icon: <Download className="w-5 h-5 text-blue-500" />,
      titleKey: 'whatsNew.offline.title',
      descriptionKey: 'whatsNew.offline.description',
      title: 'Offline Support',
      description: 'Your data is now saved even without internet connection.',
    },
    {
      icon: <Moon className="w-5 h-5 text-purple-500" />,
      titleKey: 'whatsNew.oled.title',
      descriptionKey: 'whatsNew.oled.description',
      title: 'OLED Dark Mode',
      description: 'True black theme for OLED screens saves battery.',
    },
  ],
  '1.2.1': [
    {
      icon: <RefreshCw className="w-5 h-5 text-blue-500" />,
      titleKey: 'whatsNew.updateSystem.title',
      descriptionKey: 'whatsNew.updateSystem.description',
      title: 'Smart Update System',
      description: 'Get notified about new versions even if installed outside Google Play.',
    },
    {
      icon: <MessageSquare className="w-5 h-5 text-green-500" />,
      titleKey: 'whatsNew.feedbackEmail.title',
      descriptionKey: 'whatsNew.feedbackEmail.description',
      title: 'Improved Feedback',
      description: 'Your feedback now reaches us faster via email notifications.',
    },
    {
      icon: <Zap className="w-5 h-5 text-yellow-500" />,
      titleKey: 'whatsNew.bugFixes.title',
      descriptionKey: 'whatsNew.bugFixes.description',
      title: 'Bug Fixes',
      description: 'Fixed various issues for a smoother experience.',
    },
  ],
};

interface WhatsNewModalProps {
  onClose?: () => void;
}

export function WhatsNewModal({ onClose }: WhatsNewModalProps) {
  const { t, language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    // Check if we should show the modal
    const lastSeenVersion = localStorage.getItem(LAST_SEEN_VERSION_KEY);

    // Show if:
    // 1. App was updated (version changed from stored metadata)
    // 2. User hasn't seen this version's changelog
    if (wasAppUpdated() || lastSeenVersion !== APP_VERSION) {
      // Only show if we have changelog for this version
      if (CHANGELOG[APP_VERSION]) {
        setCurrentVersion(APP_VERSION);
        setIsVisible(true);
        logger.log('[WhatsNew] Showing modal for version:', APP_VERSION);
      } else {
        // No changelog for this version, mark as seen
        localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
      }
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
    setIsVisible(false);
    onClose?.();
    logger.log('[WhatsNew] Modal dismissed');
  };

  if (!isVisible || !currentVersion) return null;

  const changes = CHANGELOG[currentVersion] || [];

  // Get translated text or fallback to English
  const getText = (key: string, fallback: string): string => {
    // Try to get from translations using dot notation
    const keys = key.split('.');
    let value: unknown = t;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return fallback;
      }
    }
    return typeof value === 'string' ? value : fallback;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        className={cn(
          'w-full max-w-md bg-card rounded-2xl shadow-2xl',
          'border border-border overflow-hidden'
        )}
      >
        {/* Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {getText('whatsNew.title', "What's New")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {getText('whatsNew.version', 'Version')} {currentVersion}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            {changes.map((change, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl',
                  'bg-muted/50 hover:bg-muted transition-colors'
                )}
              >
                <div className="flex-shrink-0 p-2 rounded-lg bg-background">
                  {change.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">
                    {getText(change.titleKey, change.title)}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {getText(change.descriptionKey, change.description)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <button
            onClick={handleDismiss}
            className={cn(
              'w-full py-3 px-4 rounded-xl font-medium',
              'bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
            )}
          >
            {getText('whatsNew.gotIt', 'Got it!')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WhatsNewModal;
