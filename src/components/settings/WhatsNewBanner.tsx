import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { APP_VERSION } from '@/lib/appVersion';
import { CHANGELOG } from '@/components/WhatsNewModal';

export function WhatsNewBanner() {
  const { t } = useLanguage();
  const whatsNewKey = `zenflow_whats_new_v${APP_VERSION}_dismissed`;

  const [showWhatsNew, setShowWhatsNew] = useState(() => {
    const dismissed = localStorage.getItem(whatsNewKey);
    return dismissed !== 'true' && (CHANGELOG[APP_VERSION]?.length ?? 0) > 0;
  });

  if (!showWhatsNew) return null;

  const handleDismiss = () => {
    localStorage.setItem(whatsNewKey, 'true');
    setShowWhatsNew(false);
  };

  return (
    <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6 border border-primary/20 motion-safe:animate-scale-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">{`${t.whatsNewTitle || "What's New"} v${APP_VERSION}`}</h3>
        </div>
        <button
          onClick={handleDismiss}
          className="text-xs text-primary hover:text-primary/80 transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          {t.settingsWhatsNewGotIt || 'Got it!'}
        </button>
      </div>

      <div className="space-y-3">
        {(CHANGELOG[APP_VERSION] || []).map((item, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">{item.icon}</div>
            <div>
              <p className="text-sm font-medium text-foreground">{(t as Record<string, string>)[item.titleKey] || item.title}</p>
              <p className="text-xs text-muted-foreground">{(t as Record<string, string>)[item.descriptionKey] || item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
