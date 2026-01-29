/**
 * ConsentBanner - GDPR-compliant analytics consent dialog
 * Shows on first launch to ask user permission for analytics
 */

import { Shield, BarChart3 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { PrivacySettings } from '@/types';

interface ConsentBannerProps {
  onConsent: (analytics: boolean) => void;
}

export function ConsentBanner({ onConsent }: ConsentBannerProps) {
  const { t } = useLanguage();

  const handleAccept = () => {
    onConsent(true);
  };

  const handleDecline = () => {
    onConsent(false);
  };

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center p-4 sm:pb-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      style={{
        zIndex: 'var(--z-overlay)',
        paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom))'
      }}
    >
      <div className="w-full max-w-md bg-card rounded-2xl p-4 sm:p-6 shadow-2xl animate-scale-in max-h-[80vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {t.consentTitle || 'Privacy Settings'}
          </h2>
        </div>

        <p className="text-muted-foreground mb-4">
          {t.consentDescription || 'We respect your privacy. Help us improve the app by allowing anonymous analytics?'}
        </p>

        <div className="p-4 bg-secondary/50 rounded-xl mb-6">
          <div className="flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {t.consentAnalyticsTitle || 'Anonymous Analytics'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.consentAnalyticsDesc || 'Usage patterns only. No personal data. You can change this anytime in Settings.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors"
          >
            {t.consentDecline || 'No thanks'}
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 py-3 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            {t.consentAccept || 'Allow'}
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          {t.consentFooter || 'You can change this anytime in Settings > Privacy'}
        </p>
      </div>
    </div>
  );
}
