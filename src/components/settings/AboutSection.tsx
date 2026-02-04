import { useState } from 'react';
import { Sparkles, History, RefreshCw, CheckCircle, ExternalLink, MessageSquare, ChevronRight } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { checkForAppUpdate, openGooglePlayStore, UpdateState } from '@/lib/appUpdateManager';
import { APP_VERSION } from '@/lib/appVersion';
import { FeedbackForm } from '@/components/FeedbackForm';
import { ChangelogPanel } from '@/components/ChangelogPanel';

export function AboutSection() {
  const { t } = useLanguage();

  const [showFeedback, setShowFeedback] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [updateCheckStatus, setUpdateCheckStatus] = useState<'idle' | 'checking' | 'available' | 'latest' | 'error'>('idle');
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);

  const handleCheckForUpdates = async () => {
    setUpdateCheckStatus('checking');
    setUpdateState(null);

    try {
      const result = await checkForAppUpdate();
      setUpdateState(result);

      if (result.available) {
        setUpdateCheckStatus('available');
      } else if (result.error) {
        setUpdateCheckStatus('error');
      } else {
        setUpdateCheckStatus('latest');
      }
    } catch (error) {
      logger.error('[Settings] Update check failed:', error);
      setUpdateCheckStatus('error');
      toast.error(t.updateCheckFailed || 'Could not check for updates');
    }
  };

  const handleOpenGooglePlay = async () => {
    await openGooglePlayStore();
  };

  return (
    <>
      <AccordionItem value="about" className="bg-card rounded-2xl shadow-zen-sm border overflow-hidden">
        <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 zen-gradient rounded-xl shadow-zen-soft">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">{t.settingsGroupAbout}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          <div className="space-y-4">
            {/* Version Info */}
            <div className="text-center text-muted-foreground py-2">
              <p className="text-sm font-medium text-foreground">{t.appName} v{APP_VERSION}</p>
              <p className="text-xs mt-1">{t.tagline}</p>
            </div>

            {/* Version History Button */}
            <button
              onClick={() => setShowChangelog(true)}
              className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
            >
              <History className="w-4 h-4" />
              {t.changelogTitle || 'Version History'}
            </button>

            {/* Check for Updates Button - Only on native */}
            {Capacitor.isNativePlatform() && (
              <div className="space-y-3">
                <button
                  onClick={handleCheckForUpdates}
                  disabled={updateCheckStatus === 'checking'}
                  className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${updateCheckStatus === 'checking' ? 'animate-spin' : ''}`} />
                  {updateCheckStatus === 'checking'
                    ? (t.checkingForUpdates || 'Checking...')
                    : (t.checkForUpdates || 'Check for Updates')
                  }
                </button>

                {/* Update Status Messages */}
                {updateCheckStatus === 'latest' && (
                  <p className="text-sm text-center text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    {t.appUpToDate || 'App is up to date'}
                  </p>
                )}

                {updateCheckStatus === 'available' && updateState && (
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                    <p className="text-sm font-medium text-foreground text-center mb-2">
                      {t.updateAvailable || 'Update Available'}
                      {updateState.latestVersion && (
                        <span className="text-primary ml-1">v{updateState.latestVersion}</span>
                      )}
                    </p>
                    {updateState.releaseNotes && (
                      <p className="text-xs text-muted-foreground text-center mb-2">{updateState.releaseNotes}</p>
                    )}
                    <button
                      onClick={handleOpenGooglePlay}
                      className="w-full py-2 zen-gradient text-primary-foreground rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t.openGooglePlay || 'Open Google Play'}
                    </button>
                  </div>
                )}

                {updateCheckStatus === 'error' && (
                  <p className="text-sm text-center text-muted-foreground">
                    {t.updateCheckFailed || 'Could not check for updates. Try again later.'}
                  </p>
                )}
              </div>
            )}

            {/* Feedback Button */}
            <button
              onClick={() => setShowFeedback(true)}
              className="w-full flex items-center justify-between py-3 px-4 bg-secondary rounded-xl hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-primary" />
                <span className="font-medium">{t.sendFeedback}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Modals */}
      <FeedbackForm open={showFeedback} onOpenChange={setShowFeedback} />
      {showChangelog && (
        <ChangelogPanel onClose={() => setShowChangelog(false)} />
      )}
    </>
  );
}
