import { Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { PrivacySettings } from "@/types";
import { Switch } from "@/components/ui/switch";
import { BASE_URL } from "@/lib/env";

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

  const baseUrl = BASE_URL;
  const privacyHref = `${baseUrl}privacy.html`;
  const termsHref = `${baseUrl}terms.html`;

  const handleNoTrackingChange = (checked: boolean) => {
    // Prevent disabling both toggles
    if (!checked && !privacy.analytics) {
      return;
    }
    onPrivacyChange((prev) => ({
      ...prev,
      noTracking: checked,
      analytics: checked ? false : prev.analytics,
    }));
  };

  const handleAnalyticsChange = (checked: boolean) => {
    // Prevent disabling both toggles
    if (!checked && !privacy.noTracking) {
      return;
    }
    onPrivacyChange((prev) => ({
      ...prev,
      analytics: checked,
      noTracking: checked ? false : prev.noTracking,
    }));
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
              {t.privacyNoTracking}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.privacyNoTrackingHint}
            </p>
          </div>
          <Switch
            checked={privacy.noTracking}
            onCheckedChange={handleNoTrackingChange}
            aria-label={t.privacyNoTracking}
            className="mt-0.5 shrink-0"
          />
        </div>

        <div className="flex items-start justify-between gap-4 p-4 bg-secondary/50 rounded-xl">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t.privacyAnalytics}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.privacyAnalyticsHint}
            </p>
          </div>
          <Switch
            checked={privacy.analytics}
            onCheckedChange={handleAnalyticsChange}
            aria-label={t.privacyAnalytics}
            className="mt-0.5 shrink-0"
          />
        </div>

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
