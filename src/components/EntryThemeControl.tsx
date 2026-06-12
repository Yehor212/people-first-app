import { Moon, Smartphone, Sun, type LucideIcon } from "lucide-react";
import { useEffect } from "react";

import { setThemePreference } from "@/components/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { cn } from "@/lib/utils";
import { useThemeStore, type ThemePreference } from "@/stores/themeStore";

type EntryThemeOption = Exclude<ThemePreference, "oled">;

const entryThemeOptions: Array<{
  value: EntryThemeOption;
  icon: LucideIcon;
  labelKey: "themeLight" | "themeDark" | "themeSystem";
  fallbackLabel: string;
}> = [
  { value: "paper", icon: Sun, labelKey: "themeLight", fallbackLabel: "Light" },
  { value: "ink", icon: Moon, labelKey: "themeDark", fallbackLabel: "Dark" },
  { value: "auto", icon: Smartphone, labelKey: "themeSystem", fallbackLabel: "System" },
];

function syncLegacyThemePreference(theme: ThemePreference) {
  if (typeof document === "undefined" || typeof window === "undefined") return;

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

interface EntryThemeControlProps {
  className?: string;
}

export function EntryThemeControl({ className }: EntryThemeControlProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const theme = useThemeStore((s) => s.theme);
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    syncLegacyThemePreference(theme);
  }, [appliedTheme, theme]);

  const handleThemeChange = (nextTheme: EntryThemeOption) => {
    setTheme(nextTheme);
    syncLegacyThemePreference(nextTheme);
  };

  return (
    <div
      className={cn("entry-theme-control mx-auto", className)}
      role="radiogroup"
      aria-label={tx.appearance || tx.navV2Theme || tx.theme || "Appearance"}
      data-testid="entry-theme-control"
    >
      {entryThemeOptions.map((option) => {
        const Icon = option.icon;
        const selected = theme === option.value || (theme === "oled" && option.value === "ink");
        const label = tx[option.labelKey] || option.fallbackLabel;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => handleThemeChange(option.value)}
            className="entry-theme-option btn-press"
            data-testid={`entry-theme-option-${option.value}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
