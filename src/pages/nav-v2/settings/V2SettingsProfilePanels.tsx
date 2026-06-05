import { useEffect, useState } from "react";
import { Globe2, Moon, Palette, Smartphone, Sun, UserRound, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { updateProfileName } from "@/lib/accountService";
import { logger } from "@/lib/logger";
import { sanitizeUserName } from "@/lib/sanitize";
import { safeLocalStorageGet, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { userNameSchema } from "@/lib/validation";
import { Language, languageNames } from "@/i18n/translations";
import { setThemePreference } from "@/components/ThemeToggle";
import { useThemeStore, type ThemePreference } from "@/stores/themeStore";
import {
  PanelFrame,
  SettingsButtonGrid,
  SettingsChoiceButton,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsStatus,
  SettingsTextInput,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";

const LANGUAGES: Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];

function syncLegacyThemePreference(theme: ThemePreference) {
  const oledEnabled = theme === "oled";
  storageSetRaw(SK.OLED_MODE, String(oledEnabled));
  document.documentElement.classList.toggle("oled", oledEnabled);

  if (theme === "paper") {
    setThemePreference("light");
  } else if (theme === "auto") {
    setThemePreference("system");
  } else {
    setThemePreference("dark");
  }
}

export function getStoredLockTimeoutMs(): number {
  return safeLocalStorageGet<number | null>(SK.JOURNAL_LOCK_TIMEOUT, null) ?? 300_000;
}

export function ProfilePanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const [name, setName] = useState(controls.userName);
  const [nameStatus, setNameStatus] = useState<string | null>(null);

  useEffect(() => {
    setName(controls.userName);
    setNameStatus(null);
  }, [controls.userName]);

  useEffect(() => {
    if (!nameStatus) return;
    const timer = window.setTimeout(() => setNameStatus(null), 2400);
    return () => window.clearTimeout(timer);
  }, [nameStatus]);

  const handleNameSave = async () => {
    const sanitized = sanitizeUserName(name);
    if (!sanitized) return;

    try {
      userNameSchema.parse(sanitized);
    } catch {
      setNameStatus(tx.invalidNameFormat || "Invalid name format");
      return;
    }

    controls.onNameChange(sanitized);
    setNameStatus(tx.nameSaved || "Saved");

    try {
      const success = await updateProfileName(sanitized);
      if (!success) {
        setNameStatus(tx.nameSavedLocally || "Saved locally");
      }
    } catch (error) {
      logger.error("[V2Settings] Failed to update profile name:", error);
      setNameStatus(tx.nameSavedLocally || "Saved locally");
    }
  };

  return (
    <PanelFrame
      icon={UserRound}
      title={tx.profile || tx.settingsGroupProfile || "Profile"}
      description={tx.yourName || "Name and personal preferences."}
      testId="settings-v2-panel-profile"
    >
      <SettingsFieldHeader htmlFor="settings-v2-name" title={tx.yourName || "Your name"} />
      <div className="flex flex-col gap-2 min-[520px]:flex-row">
        <SettingsTextInput
          id="settings-v2-name"
          value={name}
          onChange={setName}
          autoComplete="name"
          fill
        />
        <SettingsInlineButton
          onClick={() => {
            void handleNameSave();
          }}
          variant="primary"
        >
          {tx.save || "Save"}
        </SettingsInlineButton>
      </div>
      <div role="status" aria-live="polite">
        <SettingsStatus>{nameStatus}</SettingsStatus>
      </div>
    </PanelFrame>
  );
}

export function AppearancePanel() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const theme = useThemeStore((s) => s.theme);
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    syncLegacyThemePreference(theme);
  }, [appliedTheme, theme]);

  const updateTheme = (nextTheme: ThemePreference) => setTheme(nextTheme);

  const themeOptions: Array<{
    value: Exclude<ThemePreference, "oled">;
    icon: LucideIcon;
    label: string;
  }> = [
    { value: "paper", icon: Sun, label: tx.themeLight || "Light" },
    { value: "ink", icon: Moon, label: tx.themeDark || "Dark" },
    { value: "auto", icon: Smartphone, label: tx.themeSystem || "System" },
  ];

  return (
    <PanelFrame
      icon={Palette}
      title={tx.appearance || "Appearance"}
      description={tx.navV2Theme || tx.theme || "Theme"}
      testId="settings-v2-panel-appearance"
    >
      <SettingsButtonGrid columns="three" role="group" ariaLabel={tx.themeLabel || "Theme"}>
        {themeOptions.map((option) => (
          <SettingsChoiceButton
            key={option.value}
            icon={option.icon}
            selected={theme === option.value}
            onClick={() => updateTheme(option.value)}
            presentation="stacked"
            testId={`settings-v2-theme-choice-${option.value}`}
          >
            {option.label}
          </SettingsChoiceButton>
        ))}
      </SettingsButtonGrid>

      <ToggleRow
        icon={Moon}
        title={tx.oledDarkMode || "OLED Dark Mode"}
        description={tx.oledDarkModeHint || "Pure black theme for OLED screens."}
        checked={theme === "oled"}
        onCheckedChange={(checked) => updateTheme(checked ? "oled" : "ink")}
        testId="settings-v2-oled-toggle"
      />
    </PanelFrame>
  );
}

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
          >
            {languageNames[lang]}
          </SettingsChoiceButton>
        ))}
      </SettingsButtonGrid>
    </PanelFrame>
  );
}
