import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAds } from "@/contexts/AdContext";
import { deriveAdAgeEligibility } from "@/lib/adAgeEligibility";
import { applyAdConsentPreference, canInitializeAds } from "@/lib/privacyConsent";
import { logger } from "@/lib/logger";
import {
  PanelFrame,
  SettingsDialog,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsInset,
  SettingsStatus,
  SettingsTextInput,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";

export function PrivacyPanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { adsSupported, privacyOptionsRequired, openAdPrivacyOptions } = useAds();
  const effectiveAdConsent = canInitializeAds(controls.privacy);
  const [isOpeningAdPrivacy, setIsOpeningAdPrivacy] = useState(false);
  const [adPrivacyOpenFailed, setAdPrivacyOpenFailed] = useState(false);
  const [adConsent, setAdConsent] = useState(effectiveAdConsent);
  const [isSavingAdConsent, setIsSavingAdConsent] = useState(false);
  const [adConsentSaveError, setAdConsentSaveError] = useState<string | null>(null);
  const [showAgeCheck, setShowAgeCheck] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [ageCheckError, setAgeCheckError] = useState(false);
  const [ageNotice, setAgeNotice] = useState<string | null>(null);
  const [enableAfterAgeCheck, setEnableAfterAgeCheck] = useState(false);

  useEffect(() => {
    if (!isSavingAdConsent) {
      setAdConsent(effectiveAdConsent);
    }
  }, [effectiveAdConsent, isSavingAdConsent]);

  const persistAdPrivacy = async (
    checked: boolean,
    update: Parameters<V2SettingsControls["onPrivacyChange"]>[0],
  ): Promise<boolean> => {
    if (isSavingAdConsent) return false;
    const previous = canInitializeAds(controls.privacy);
    setAdConsent(checked);
    setAdConsentSaveError(null);
    setIsSavingAdConsent(true);
    try {
      await controls.onPrivacyChange(update);
      return true;
    } catch (error) {
      logger.error("[V2Settings] Failed to save optional-ad preference", error);
      setAdConsent(previous);
      setAdConsentSaveError(
        tx.settingsPreferenceSaveError ||
          "Couldn’t save this change. Your previous setting is still active."
      );
      return false;
    } finally {
      setIsSavingAdConsent(false);
    }
  };

  const openAgeCheck = (enableAfterCheck: boolean) => {
    setEnableAfterAgeCheck(enableAfterCheck);
    setBirthDate("");
    setAgeCheckError(false);
    setShowAgeCheck(true);
  };

  const handleAdConsentChange = async (checked: boolean) => {
    if (isSavingAdConsent) return;
    setAgeNotice(null);

    if (checked && controls.privacy.adAgeEligibility !== "adult") {
      openAgeCheck(true);
      return;
    }

    await persistAdPrivacy(
      checked,
      (privacy) => applyAdConsentPreference(privacy, checked),
    );
  };

  const handleAgeCheckConfirm = async () => {
    if (isSavingAdConsent) return;
    const result = deriveAdAgeEligibility(birthDate);
    if (!result.ok) {
      setAgeCheckError(true);
      return;
    }

    const shouldEnable = result.eligibility === "adult" && enableAfterAgeCheck;
    const saved = await persistAdPrivacy(shouldEnable, (privacy) => ({
      ...privacy,
      adAgeEligibility: result.eligibility,
      adConsent: shouldEnable,
    }));
    if (!saved) return;

    setShowAgeCheck(false);
    setBirthDate("");
    setAgeCheckError(false);
    setAgeNotice(
      result.eligibility === "minor"
        ? t.adAgeMinorNotice
        : null,
    );
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
        title={tx.privacyAds || "Habit list banner"}
        description={
          tx.privacyAdsHint ||
          "Shows a small banner below your habit list after you turn it on. It stays out of mood check-ins, journal, focus, and menus. Google may ask for your privacy choice when required."
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
      {ageNotice ? <SettingsStatus>{ageNotice}</SettingsStatus> : null}
      {controls.privacy.adAgeEligibility &&
      controls.privacy.adAgeEligibility !== "unknown" ? (
        <SettingsInset testId="settings-v2-ad-age-review">
          <SettingsFieldHeader
            icon={Shield}
            title={t.adAgeReview}
            description={t.adAgeReviewHint}
          />
          <SettingsInlineButton
            onClick={() => openAgeCheck(canInitializeAds(controls.privacy))}
            disabled={isSavingAdConsent}
            testId="settings-v2-review-ad-age"
          >
            {t.adAgeReview}
          </SettingsInlineButton>
        </SettingsInset>
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
      {showAgeCheck ? (
        <SettingsDialog
          titleId="settings-v2-ad-age-check-title"
          title={t.adAgeCheckTitle}
          description={t.adAgeCheckDescription}
          cancelLabel={t.adAgeCheckCancel}
          confirmLabel={t.adAgeCheckContinue}
          onCancel={() => {
            if (isSavingAdConsent) return;
            setShowAgeCheck(false);
            setBirthDate("");
            setAgeCheckError(false);
          }}
          onConfirm={() => {
            void handleAgeCheckConfirm();
          }}
        >
          <label
            htmlFor="settings-v2-ad-birth-date"
            className="block text-sm font-semibold text-foreground"
          >
            {t.adAgeBirthDate}
          </label>
          <SettingsTextInput
            id="settings-v2-ad-birth-date"
            type="date"
            value={birthDate}
            onChange={(value) => {
              setBirthDate(value);
              setAgeCheckError(false);
            }}
            autoComplete="bday"
            disabled={isSavingAdConsent}
            ariaInvalid={ageCheckError}
            ariaDescribedBy="settings-v2-ad-birth-date-hint"
          />
          <p id="settings-v2-ad-birth-date-hint" className="text-xs text-muted-foreground">
            {t.adAgeBirthDateHint}
          </p>
          {ageCheckError ? (
            <p role="alert" className="text-sm text-destructive">
              {t.adAgeCheckInvalid}
            </p>
          ) : null}
        </SettingsDialog>
      ) : null}
    </PanelFrame>
  );
}
