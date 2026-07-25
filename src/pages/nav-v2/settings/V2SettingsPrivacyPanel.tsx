import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAds } from "@/contexts/AdContext";
import { applyAdConsentPreference } from "@/lib/privacyConsent";
import { logger } from "@/lib/logger";
import {
  PanelFrame,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsInset,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";

export function PrivacyPanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { adsSupported, privacyOptionsRequired, openAdPrivacyOptions } = useAds();
  const [isOpeningAdPrivacy, setIsOpeningAdPrivacy] = useState(false);
  const [adPrivacyOpenFailed, setAdPrivacyOpenFailed] = useState(false);
  const [adConsent, setAdConsent] = useState(controls.privacy.adConsent === true);
  const [isSavingAdConsent, setIsSavingAdConsent] = useState(false);
  const [adConsentSaveError, setAdConsentSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSavingAdConsent) {
      setAdConsent(controls.privacy.adConsent === true);
    }
  }, [controls.privacy.adConsent, isSavingAdConsent]);

  const handleAdConsentChange = async (checked: boolean) => {
    if (isSavingAdConsent) return;
    const previous = controls.privacy.adConsent === true;
    setAdConsent(checked);
    setAdConsentSaveError(null);
    setIsSavingAdConsent(true);
    try {
      await controls.onPrivacyChange((privacy) => applyAdConsentPreference(privacy, checked));
    } catch (error) {
      logger.error("[V2Settings] Failed to save rewarded-video preference", error);
      setAdConsent(previous);
      setAdConsentSaveError(
        tx.settingsPreferenceSaveError ||
          "Couldn’t save this change. Your previous setting is still active."
      );
    } finally {
      setIsSavingAdConsent(false);
    }
  };

  const handleOpenAdPrivacyOptions = async () => {
    if (isOpeningAdPrivacy) return;
    setAdPrivacyOpenFailed(false);
    setIsOpeningAdPrivacy(true);
    try {
      const opened = await openAdPrivacyOptions();
      if (!opened) setAdPrivacyOpenFailed(true);
    } catch (error) {
      logger.warn("[V2Settings] Could not open Google ad privacy options", error);
      setAdPrivacyOpenFailed(true);
    } finally {
      setIsOpeningAdPrivacy(false);
    }
  };

  if (!adsSupported) return null;

  return (
    <PanelFrame
      icon={Shield}
      title={tx.settingsGroupSecurity || tx.privacyTitle || "Privacy & security"}
      description={
        tx.settingsPrivacyDataDescription || "Choose which optional services ZenFlow may use."
      }
      testId="settings-v2-panel-privacy"
    >
      <ToggleRow
        icon={Shield}
        title={tx.privacyAds || "Rewarded videos"}
        description={
          tx.privacyAdsHint ||
          "They load only when you turn them on. Google may ask for your privacy choice when required."
        }
        checked={adConsent}
        disabled={isSavingAdConsent}
        onCheckedChange={(checked) => {
          void handleAdConsentChange(checked);
        }}
        surfaceWeight="quiet"
        testId="settings-v2-ad-consent"
      />
      {adConsentSaveError ? (
        <p role="alert" className="text-sm text-destructive">
          {adConsentSaveError}
        </p>
      ) : null}
      {adsSupported && privacyOptionsRequired && (
        <SettingsInset testId="settings-v2-ad-privacy-options">
          <SettingsFieldHeader
            icon={Shield}
            title={tx.adPrivacyOptions || "Google ad privacy choices"}
            description={
              tx.adPrivacyOptionsHint || "Change or withdraw Google ad consent where required."
            }
          />
          <SettingsInlineButton
            onClick={handleOpenAdPrivacyOptions}
            disabled={isOpeningAdPrivacy}
            isLoading={isOpeningAdPrivacy}
            testId="settings-v2-open-ad-privacy-options"
          >
            {tx.adPrivacyOptionsOpen || "Review ad choices"}
          </SettingsInlineButton>
          {adPrivacyOpenFailed && (
            <p role="alert" className="text-sm text-destructive">
              {tx.adPrivacyOptionsError || "Could not open Google ad privacy choices. Try again."}
            </p>
          )}
        </SettingsInset>
      )}
    </PanelFrame>
  );
}
