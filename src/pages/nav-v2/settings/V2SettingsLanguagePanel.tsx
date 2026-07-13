import { Globe2 } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { type Language, languageNames } from "@/i18n/translations";

import {
  PanelFrame,
  SettingsButtonGrid,
  SettingsChoiceButton,
} from "./components/V2SettingsControlPrimitives";

const LANGUAGES: Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];

export function LanguagePanel() {
  const { t, language, setLanguage } = useLanguage();
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
            selected={language === lang}
            lang={lang}
            dir={lang === "ar" || lang === "he" ? "rtl" : "ltr"}
          >
            {languageNames[lang]}
          </SettingsChoiceButton>
        ))}
      </SettingsButtonGrid>
    </PanelFrame>
  );
}
