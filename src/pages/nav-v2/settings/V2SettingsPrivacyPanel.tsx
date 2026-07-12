import { useEffect, useState } from "react";
import { BellRing, Clock3, Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAds } from "@/contexts/AdContext";
import {
  hasPersistentJournalProtection,
  LOCK_TIMEOUT_OPTIONS,
  setAutoLockMs,
} from "@/features/journal";
import {
  applyAdConsentPreference,
  applyPushNotificationsPreference,
} from "@/lib/privacyConsent";
import { BASE_URL } from "@/lib/env";
import { safeLocalStorageGet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { isPushAvailable } from "@/lib/pushNotifications";
import { logger } from "@/lib/logger";
import {
  PanelFrame,
  SettingsExternalLink,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsInset,
  SettingsSelectField,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";

function getStoredLockTimeoutMs(): number {
  return safeLocalStorageGet<number | null>(SK.JOURNAL_LOCK_TIMEOUT, null) ?? 300_000;
}

export function PrivacyPanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { privacyOptionsRequired, openAdPrivacyOptions } = useAds();
  const [timeoutMs, setTimeoutMs] = useState(getStoredLockTimeoutMs);
  const [hasJournalProtection, setHasJournalProtection] = useState<boolean | null>(null);
  const [isOpeningAdPrivacy, setIsOpeningAdPrivacy] = useState(false);
  const [adPrivacyOpenFailed, setAdPrivacyOpenFailed] = useState(false);
  const timeoutLabels = {
    0: t.journalLockTimeoutImmediately,
    60_000: t.journalLockTimeoutOneMinute,
    300_000: t.journalLockTimeoutFiveMinutes,
    900_000: t.journalLockTimeoutFifteenMinutes,
    1_800_000: t.journalLockTimeoutThirtyMinutes,
  } satisfies Record<(typeof LOCK_TIMEOUT_OPTIONS)[number]["ms"], string>;
  const privacyHref = `${BASE_URL}privacy.html`;
  const termsHref = `${BASE_URL}terms.html`;

  const updateTimeout = (ms: number) => {
    setTimeoutMs(ms);
    setAutoLockMs(ms);
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

  useEffect(() => {
    let active = true;
    void hasPersistentJournalProtection()
      .then((protectedDiary) => {
        if (active) setHasJournalProtection(protectedDiary);
      })
      .catch((error) => {
        logger.warn("[V2Settings] Could not read diary protection status", error);
        if (active) setHasJournalProtection(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PanelFrame
      icon={Shield}
      title={tx.settingsGroupSecurity || tx.privacyTitle || "Privacy & security"}
      description={
        tx.settingsPrivacyDataDescription ||
        "You choose which optional services ZenFlow can use. Backup starts only after you sign in."
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
        checked={controls.privacy.adConsent === true}
        onCheckedChange={(checked) =>
          controls.onPrivacyChange((prev) => applyAdConsentPreference(prev, checked))
        }
        surfaceWeight="quiet"
        testId="settings-v2-ad-consent"
      />
      {privacyOptionsRequired && (
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
              {tx.adPrivacyOptionsError ||
                "Could not open Google ad privacy choices. Try again."}
            </p>
          )}
        </SettingsInset>
      )}
      {isPushAvailable() && (
        <ToggleRow
          icon={BellRing}
          title={tx.privacyPushNotifications || "Account reminders"}
          description={
            tx.privacyPushNotificationsHint ||
            "Receive reminders from your account on this device. Reminders you set on this device still work when this is off."
          }
          checked={controls.privacy.pushNotifications === true}
          onCheckedChange={(checked) =>
            controls.onPrivacyChange((prev) => applyPushNotificationsPreference(prev, checked))
          }
          surfaceWeight="quiet"
          testId="settings-v2-push-notifications"
        />
      )}

      {hasJournalProtection === true && (
        <SettingsInset className="border-transparent bg-[hsl(var(--settings-v2-shell)/0.28)]">
          <SettingsFieldHeader
            htmlFor="settings-v2-journal-lock"
            icon={Clock3}
            title={tx.journalLockTimeout || "Journal auto-lock"}
            description={
              tx.journalLockTimeoutDesc || "Automatically lock journal after inactivity."
            }
          />
          <SettingsSelectField
            id="settings-v2-journal-lock"
            value={timeoutMs}
            onChange={(value) => updateTimeout(Number(value))}
            options={LOCK_TIMEOUT_OPTIONS.map((option) => ({
              value: option.ms,
              label: timeoutLabels[option.ms],
            }))}
          />
        </SettingsInset>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <SettingsExternalLink href={privacyHref} size="sm">
          {tx.privacyPolicy || "Privacy Policy"}
        </SettingsExternalLink>
        <SettingsExternalLink href={termsHref} size="sm">
          {tx.termsOfService || "Terms of Service"}
        </SettingsExternalLink>
      </div>
    </PanelFrame>
  );
}
