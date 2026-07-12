import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { X, Shield, FileText, Scale, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";

type LegalTab = "privacy" | "terms" | "licenses";

interface LegalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: LegalTab;
}

const PRIVACY_URL = "https://yehor212.github.io/people-first-app/privacy.html";
const TERMS_URL = "https://yehor212.github.io/people-first-app/terms.html";

const OSS_LICENSES = [
  { name: "React", license: "MIT", url: "https://github.com/facebook/react" },
  {
    name: "Capacitor",
    license: "MIT",
    url: "https://github.com/ionic-team/capacitor",
  },
  {
    name: "Supabase",
    license: "Apache 2.0",
    url: "https://github.com/supabase/supabase",
  },
  { name: "Zustand", license: "MIT", url: "https://github.com/pmndrs/zustand" },
  {
    name: "Dexie.js",
    license: "Apache 2.0",
    url: "https://github.com/dexie/Dexie.js",
  },
  {
    name: "Framer Motion",
    license: "MIT",
    url: "https://github.com/framer/motion",
  },
  {
    name: "Tailwind CSS",
    license: "MIT",
    url: "https://github.com/tailwindlabs/tailwindcss",
  },
  {
    name: "Radix UI",
    license: "MIT",
    url: "https://github.com/radix-ui/primitives",
  },
  {
    name: "Lucide Icons",
    license: "ISC",
    url: "https://github.com/lucide-icons/lucide",
  },
  { name: "Zod", license: "MIT", url: "https://github.com/colinhacks/zod" },
  {
    name: "DOMPurify",
    license: "Apache 2.0",
    url: "https://github.com/cure53/DOMPurify",
  },
  {
    name: "date-fns",
    license: "MIT",
    url: "https://github.com/date-fns/date-fns",
  },
  {
    name: "Sentry",
    license: "MIT",
    url: "https://github.com/getsentry/sentry-javascript",
  },
] as const;

export function LegalModal({ open, onOpenChange, initialTab = "privacy" }: LegalModalProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);
  const tabRefs = useRef<Record<LegalTab, HTMLButtonElement | null>>({
    privacy: null,
    terms: null,
    licenses: null,
  });
  const onClose = () => onOpenChange(false);

  const { modalRef, handleKeyDown } = useModalA11y(open, onClose);
  useScrollLock(open);

  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [initialTab, open]);

  if (!open || typeof document === "undefined") return null;

  const tabs: { key: LegalTab; label: string; icon: typeof Shield }[] = [
    { key: "privacy", label: t.privacyPolicy, icon: Shield },
    { key: "terms", label: t.termsOfService, icon: FileText },
    { key: "licenses", label: t.openSourceLicenses, icon: Scale },
  ];

  const handleOpenExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    const rtlDirection = document.documentElement.dir === "rtl" ? -1 : 1;

    if (event.key === "ArrowRight") nextIndex = index + rtlDirection;
    if (event.key === "ArrowLeft") nextIndex = index - rtlDirection;
    if (event.key === "ArrowDown") nextIndex = index + 1;
    if (event.key === "ArrowUp") nextIndex = index - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = tabs[(nextIndex + tabs.length) % tabs.length];
    setActiveTab(nextTab.key);
    tabRefs.current[nextTab.key]?.focus();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-4 pt-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="flex max-h-[calc(var(--app-viewport-height)-var(--safe-top)-var(--safe-bottom)-2rem)] w-full max-w-md min-h-0 flex-col overflow-hidden rounded-2xl bg-card shadow-zen-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h2 id="legal-modal-title" className="text-lg font-semibold text-foreground">
            {tabs.find((tab) => tab.key === activeTab)?.label}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted/50 motion-safe:transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label={t.close}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="grid shrink-0 gap-1 border-b p-2 min-[520px]:grid-cols-3"
          role="tablist"
        >
          {tabs.map(({ key, label, icon: Icon }, index) => (
            <button
              key={key}
              ref={(node) => {
                tabRefs.current[key] = node;
              }}
              id={`legal-tab-${key}`}
              role="tab"
              aria-controls={`legal-panel-${key}`}
              aria-selected={activeTab === key}
              tabIndex={activeTab === key ? 0 : -1}
              onClick={() => setActiveTab(key)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`flex min-h-[48px] min-w-0 items-center justify-start gap-2 rounded-[8px] border border-transparent px-3 py-2 text-start text-sm font-medium motion-safe:transition-[background-color,border-color,color] min-[520px]:justify-center min-[520px]:text-center ${
                activeTab === key
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 whitespace-normal break-words hyphens-auto">{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          id={`legal-panel-${activeTab}`}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5"
          role="tabpanel"
          aria-labelledby={`legal-tab-${activeTab}`}
        >
          {activeTab === "privacy" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.legalPrivacyDescription}</p>
              <button
                onClick={() => handleOpenExternal(PRIVACY_URL)}
                className="w-full py-3 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 motion-safe:transition-colors flex items-center justify-center gap-2 min-h-[48px]"
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                {t.legalOpenInBrowser}
              </button>
            </div>
          )}

          {activeTab === "terms" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.legalTermsDescription}</p>
              <button
                onClick={() => handleOpenExternal(TERMS_URL)}
                className="w-full py-3 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 motion-safe:transition-colors flex items-center justify-center gap-2 min-h-[48px]"
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                {t.legalOpenInBrowser}
              </button>
            </div>
          )}

          {activeTab === "licenses" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">{t.legalLicensesDescription}</p>
              {OSS_LICENSES.map(({ name, license, url }) => (
                <button
                  key={name}
                  onClick={() => handleOpenExternal(url)}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/50 motion-safe:transition-colors text-start min-h-[48px]"
                >
                  <span className="text-sm font-medium text-foreground">{name}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {license}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
