import { MonitorSmartphone, Moon, Sun } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { isAndroid } from "@/lib/platform";
import { cn } from "@/lib/utils";
import {
  type ThemePreference,
  type ThemeWriteResult,
  useThemeStore,
} from "@/stores/themeStore";

const ENTRY_NATIVE_THEME_SWAP_ATTRIBUTE = "data-theme-swap-mode";
const ENTRY_NATIVE_THEME_SWAP_VALUE = "entry-native-instant";
const ENTRY_NATIVE_THEME_SWAP_RESET_MS = 140;

let entryNativeThemeSwapResetTimer: number | undefined;

function commitEntryTheme(
  preference: ThemePreference,
  setTheme: (theme: ThemePreference) => ThemeWriteResult,
): ThemeWriteResult {
  if (!isAndroid || typeof document === "undefined" || typeof window === "undefined") {
    return setTheme(preference);
  }

  const root = document.documentElement;
  if (entryNativeThemeSwapResetTimer !== undefined) {
    window.clearTimeout(entryNativeThemeSwapResetTimer);
    entryNativeThemeSwapResetTimer = undefined;
  }
  root.setAttribute(ENTRY_NATIVE_THEME_SWAP_ATTRIBUTE, ENTRY_NATIVE_THEME_SWAP_VALUE);

  let result: ThemeWriteResult;
  try {
    result = setTheme(preference);
  } catch (error) {
    root.removeAttribute(ENTRY_NATIVE_THEME_SWAP_ATTRIBUTE);
    throw error;
  }

  if (!result.ok || !result.changed) {
    root.removeAttribute(ENTRY_NATIVE_THEME_SWAP_ATTRIBUTE);
    return result;
  }

  entryNativeThemeSwapResetTimer = window.setTimeout(() => {
    if (root.getAttribute(ENTRY_NATIVE_THEME_SWAP_ATTRIBUTE) === ENTRY_NATIVE_THEME_SWAP_VALUE) {
      root.removeAttribute(ENTRY_NATIVE_THEME_SWAP_ATTRIBUTE);
    }
    entryNativeThemeSwapResetTimer = undefined;
  }, ENTRY_NATIVE_THEME_SWAP_RESET_MS);

  return result;
}

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
      className="entry-action-tile mx-auto grid w-full max-w-[32rem] grid-cols-[repeat(auto-fit,minmax(min(100%,calc(6rem*var(--font-scale,1))),1fr))] gap-1 rounded-2xl border border-border/45 bg-card/45 p-1 shadow-sm max-[359px]:grid-cols-1"
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
            onClick={() => commitEntryTheme(preference, setTheme)}
            className={cn(
              "flex h-auto min-h-[48px] min-w-0 items-center justify-center gap-1 whitespace-normal break-normal rounded-xl px-1.5 py-2 text-xs font-semibold leading-tight outline-none [hyphens:manual] [overflow-wrap:normal] transition-all sm:gap-1.5 sm:px-2 sm:text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "bg-primary/20 text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card/75 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-normal text-center [hyphens:manual] [overflow-wrap:normal]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
