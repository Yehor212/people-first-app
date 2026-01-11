import { Download, X } from 'lucide-react';
import { useState } from 'react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { useLanguage } from '@/contexts/LanguageContext';

export function InstallBanner() {
  const { t } = useLanguage();
  const { canInstall, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) {
    return null;
  }

  return (
    <div className="mb-4 p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border border-primary/20 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="p-2 zen-gradient rounded-xl">
          <Download className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{t.installApp || 'Install App'}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t.installDescription || 'Add to home screen for quick access'}
          </p>
          <button
            onClick={promptInstall}
            className="mt-3 px-4 py-2 zen-gradient text-primary-foreground text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            {t.install || 'Install'}
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
