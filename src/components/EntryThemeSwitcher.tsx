import { MonitorSmartphone, Moon, Sun } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { type ThemePreference, useThemeStore } from "@/stores/themeStore";

const options: Array<{
  preference: ThemePreference;
  labelKey: "themeLight" | "themeDark" | "themeSystem";
  fallback: string;
  Icon: typeof Sun;
}> = [
  { preference: "paper", labelKey: "themeLight", fallback: "Light", Icon: Sun },
  { preference: "ink", labelKey: "themeDark", fallback: "Dark", Icon: Moon },
  {
    preference: "auto",
    labelKey: "themeSystem",
    fallback: "System",
    Icon: MonitorSmartphone,
  },
];

export function EntryThemeSwitcher() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label={tx.themeLabel || tx.appearance || "Theme"}
      className="entry-action-tile entry-theme-switcher mx-auto grid w-full min-w-0 max-w-[32rem] grid-cols-[repeat(auto-fit,minmax(min(100%,calc(5rem*var(--font-scale,1))),1fr))] gap-1 rounded-2xl border border-border/45 bg-card/45 p-1 shadow-sm"
      data-testid="entry-theme-switcher"
    >
      {options.map(({ preference, labelKey, fallback, Icon }) => {
        const selected = theme === preference;
        const label = tx[labelKey] || fallback;

        return (
          <button
            key={preference}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            onClick={() => setTheme(preference)}
            className={cn(
              "entry-theme-switcher-option flex h-auto min-h-[44px] min-w-0 items-center justify-center gap-1 whitespace-normal break-words rounded-xl px-1.5 py-2 text-xs font-semibold leading-tight outline-none [hyphens:manual] [overflow-wrap:break-word] transition-all sm:gap-1.5 sm:px-2 sm:text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "bg-primary/20 text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/75 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="entry-theme-switcher-label min-w-0 break-words text-center [hyphens:manual] [overflow-wrap:break-word]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
