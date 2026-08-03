import { Globe2, RefreshCw } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { type Language, languageNames } from "@/i18n/translations";

import {
  PanelFrame,
  SettingsButtonGrid,
  SettingsChoiceButton,
  SettingsInlineButton,
  SettingsStatus,
} from "./components/V2SettingsControlPrimitives";

const LANGUAGES: Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];

export function LanguagePanel() {
  const {
    t,
    language,
    setLanguage,
    pendingLanguage,
    languageLoadError,
    languageSaveError,
    languagePushPresentationError,
    retryLanguage,
    retryLanguagePushPresentation,
  } = useLanguage();
  const tx = t as unknown as Record<string, string>;

  return (
    <PanelFrame
      icon={Globe2}
      title={tx.language || "Language"}
      description={tx.selectLanguage || "Choose language."}
      testId="settings-v2-panel-language"
    >
      <SettingsButtonGrid columns="two" role="group" ariaLabel={tx.language || "Language"}>
        {LANGUAGES.map((lang) => (
          <SettingsChoiceButton
            key={lang}
            onClick={() => setLanguage(lang)}
            selected={(pendingLanguage ?? language) === lang}
            lang={lang}
            dir={lang === "ar" || lang === "he" ? "rtl" : "ltr"}
          >
            {languageNames[lang]}
          </SettingsChoiceButton>
        ))}
      </SettingsButtonGrid>
      {pendingLanguage ? (
        <div className="mt-3">
          <SettingsStatus>{tx.languageApplying || "Applying language..."}</SettingsStatus>
        </div>
      ) : null}
      {languageLoadError ? (
        <div className="mt-3 space-y-2">
          <p
            role="alert"
            className="min-w-0 break-words text-sm text-destructive [hyphens:manual] [overflow-wrap:break-word]"
          >
            {tx.languageLoadFailed ||
              "This language could not load. Check your connection and try again."}
          </p>
          <SettingsInlineButton icon={RefreshCw} onClick={retryLanguage}>
            {tx.tryAgain || "Try Again"}
          </SettingsInlineButton>
        </div>
      ) : null}
      {languageSaveError ? (
        <div className="mt-3 space-y-2">
          <p
            role="alert"
            className="min-w-0 break-words text-sm text-destructive [hyphens:manual] [overflow-wrap:break-word]"
          >
            {tx.languageSaveFailed ||
              "This language is active for now, but ZenFlow couldn't save your choice on this device. You can continue or try again."}
          </p>
          <SettingsInlineButton icon={RefreshCw} onClick={retryLanguage}>
            {tx.tryAgain || "Try Again"}
          </SettingsInlineButton>
        </div>
      ) : null}
      {languagePushPresentationError ? (
        <div className="mt-3 space-y-2">
          <p
            role="alert"
            className="min-w-0 break-words text-sm text-destructive [hyphens:manual] [overflow-wrap:break-word]"
          >
            {tx.languageReminderUpdateFailed ||
              "The app language changed, but reminders may still use the previous language. Try again."}
          </p>
          <SettingsInlineButton icon={RefreshCw} onClick={retryLanguagePushPresentation}>
            {tx.tryAgain || "Try Again"}
          </SettingsInlineButton>
        </div>
      ) : null}
    </PanelFrame>
  );
}
