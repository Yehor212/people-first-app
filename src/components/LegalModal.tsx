import { useState } from 'react';
import { X, Shield, FileText, Scale, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useScrollLock } from '@/hooks/useScrollLock';

type LegalTab = 'privacy' | 'terms' | 'licenses';

interface LegalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: LegalTab;
}

const PRIVACY_URL = 'https://yehor212.github.io/people-first-app/privacy.html';
const TERMS_URL = 'https://yehor212.github.io/people-first-app/terms.html';

const OSS_LICENSES = [
  { name: 'React', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'Capacitor', license: 'MIT', url: 'https://github.com/ionic-team/capacitor' },
  { name: 'Supabase', license: 'Apache 2.0', url: 'https://github.com/supabase/supabase' },
  { name: 'Zustand', license: 'MIT', url: 'https://github.com/pmndrs/zustand' },
  { name: 'Dexie.js', license: 'Apache 2.0', url: 'https://github.com/dexie/Dexie.js' },
  { name: 'Framer Motion', license: 'MIT', url: 'https://github.com/framer/motion' },
  { name: 'Tailwind CSS', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss' },
  { name: 'Radix UI', license: 'MIT', url: 'https://github.com/radix-ui/primitives' },
  { name: 'Lucide Icons', license: 'ISC', url: 'https://github.com/lucide-icons/lucide' },
  { name: 'Zod', license: 'MIT', url: 'https://github.com/colinhacks/zod' },
  { name: 'DOMPurify', license: 'Apache 2.0', url: 'https://github.com/cure53/DOMPurify' },
  { name: 'Recharts', license: 'MIT', url: 'https://github.com/recharts/recharts' },
  { name: 'date-fns', license: 'MIT', url: 'https://github.com/date-fns/date-fns' },
  { name: 'Lottie React', license: 'MIT', url: 'https://github.com/Gamote/lottie-react' },
  { name: 'Sentry', license: 'MIT', url: 'https://github.com/getsentry/sentry-javascript' },
] as const;

export function LegalModal({ open, onOpenChange, initialTab = 'privacy' }: LegalModalProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);
  const onClose = () => onOpenChange(false);

  useModalA11y(open, onClose);
  useScrollLock(open);

  if (!open) return null;

  const tabs: { key: LegalTab; label: string; icon: typeof Shield }[] = [
    { key: 'privacy', label: t.privacyPolicy, icon: Shield },
    { key: 'terms', label: t.termsOfService, icon: FileText },
    { key: 'licenses', label: t.openSourceLicenses, icon: Scale },
  ];

  const handleOpenExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-card rounded-2xl shadow-zen-card w-full max-w-md max-h-[80dvh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 id="legal-modal-title" className="text-lg font-semibold text-foreground">
            {tabs.find(tab => tab.key === activeTab)?.label}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted/50 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label={t.close}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-2" role="tablist">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors min-h-[48px] ${
                activeTab === key
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5" role="tabpanel">
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t.legalPrivacyDescription}
              </p>
              <button
                onClick={() => handleOpenExternal(PRIVACY_URL)}
                className="w-full py-3 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 min-h-[48px]"
              >
                <ExternalLink className="w-4 h-4" />
                {t.legalOpenInBrowser}
              </button>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t.legalTermsDescription}
              </p>
              <button
                onClick={() => handleOpenExternal(TERMS_URL)}
                className="w-full py-3 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 min-h-[48px]"
              >
                <ExternalLink className="w-4 h-4" />
                {t.legalOpenInBrowser}
              </button>
            </div>
          )}

          {activeTab === 'licenses' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                {t.legalLicensesDescription}
              </p>
              {OSS_LICENSES.map(({ name, license, url }) => (
                <button
                  key={name}
                  onClick={() => handleOpenExternal(url)}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/50 transition-colors text-left min-h-[48px]"
                >
                  <span className="text-sm font-medium text-foreground">{name}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{license}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
