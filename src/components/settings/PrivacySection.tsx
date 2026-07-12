import { useState } from "react";
import { Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAds } from "@/contexts/AdContext";
import type { PrivacySettings } from "@/types";
import { Switch } from "@/components/ui/switch";
import { BASE_URL } from "@/lib/env";
import {
  applyAdConsentPreference,
} from "@/lib/privacyConsent";

interface PrivacySectionProps {
  privacy: PrivacySettings;
  onPrivacyChange: (
    value: PrivacySettings | ((prev: PrivacySettings) => PrivacySettings),
  ) => void;
}

export function PrivacySection({
  privacy,
  onPrivacyChange,
}: PrivacySectionProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string | undefined>;
  const { privacyOptionsRequired, openAdPrivacyOptions } = useAds();
  const [isOpeningAdPrivacy, setIsOpeningAdPrivacy] = useState(false);

  const baseUrl = BASE_URL;
  const privacyHref = `${baseUrl}privacy.html`;
  const termsHref = `${baseUrl}terms.html`;

  const handleAdConsentChange = (checked: boolean) => {
    onPrivacyChange((prev) => applyAdConsentPreference(prev, checked));
  };

  const handleOpenAdPrivacyOptions = async () => {
    if (isOpeningAdPrivacy) return;
    setIsOpeningAdPrivacy(true);
    try {
      await openAdPrivacyOptions();
    } finally {
      setIsOpeningAdPrivacy(false);
    }
  };

  return (
    <div className="pt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          {t.privacyTitle}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t.privacyDescription}
      </p>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4 p-4 bg-secondary/50 rounded-xl">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t.privacyAds}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.privacyAdsHint}
            </p>
          </div>
          <Switch
            checked={privacy.adConsent === true}
            onCheckedChange={handleAdConsentChange}
            aria-label={t.privacyAds}
            className="mt-0.5 shrink-0"
          />
        </div>

        {privacyOptionsRequired && (
          <div className="flex items-start justify-between gap-4 p-4 bg-secondary/50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-foreground">
                {tx.adPrivacyOptions || "Google ad privacy choices"}
              </p>
              <p className="text-xs text-muted-foreground">
                {tx.adPrivacyOptionsHint || "Change or withdraw Google ad consent where required."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAdPrivacyOptions}
              disabled={isOpeningAdPrivacy}
              aria-busy={isOpeningAdPrivacy ? "true" : undefined}
              className="min-h-[44px] shrink-0 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-60"
            >
              {tx.adPrivacyOptionsOpen || "Review ad choices"}
            </button>
          </div>
        )}


        <div className="flex flex-wrap gap-4 text-sm">
          <a
            href={privacyHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/90"
          >
            {t.privacyPolicy}
          </a>
          <a
            href={termsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/90"
          >
            {t.termsOfService}
          </a>
        </div>
      </div>
    </div>
  );
}
