import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  ChevronDown,
  Contrast,
  Eye,
  Globe2,
  Layers,
  Leaf,
  Loader2,
  Moon,
  MoreHorizontal,
  Palette,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Sun,
  Undo2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { updateProfileName } from "@/lib/accountService";
import { logger } from "@/lib/logger";
import { sanitizeUserName } from "@/lib/sanitize";
import { safeLocalStorageGet, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { userNameSchema } from "@/lib/validation";
import { Language, languageNames } from "@/i18n/translations";
import { setThemePreference } from "@/components/ThemeToggle";
import {
  DEFAULT_THEME_CUSTOMIZATION,
  THEME_ACCENT_FAMILIES,
  THEME_CUSTOMIZATION_PRESETS,
  THEME_INTENSITIES,
  type ThemeAccentFamily,
  type ThemeCustomization,
  type ThemeIntensity,
  type ThemePaletteId,
} from "@/stores/themeCustomization";
import { useThemeStore, type ThemePreference } from "@/stores/themeStore";
import {
  PanelFrame,
  SettingsButtonGrid,
  SettingsChoiceButton,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsInset,
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
  const [lastSavedName, setLastSavedName] = useState(controls.userName);
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    setName(controls.userName);
    setLastSavedName(controls.userName);
    setNameStatus(null);
  }, [controls.userName]);

  useEffect(() => {
    if (!nameStatus) return;
    const timer = window.setTimeout(() => setNameStatus(null), 2400);
    return () => window.clearTimeout(timer);
  }, [nameStatus]);

  const sanitizedName = sanitizeUserName(name);
  const sanitizedCurrentName = sanitizeUserName(lastSavedName);
  let isNameValid = Boolean(sanitizedName);

  if (isNameValid) {
    try {
      userNameSchema.parse(sanitizedName);
    } catch {
      isNameValid = false;
    }
  }

  const isNameSaveDisabled = isSavingName || !isNameValid || sanitizedName === sanitizedCurrentName;

  const handleNameSave = async () => {
    const sanitized = sanitizeUserName(name);
    if (isSavingName || !sanitized) return;

    try {
      userNameSchema.parse(sanitized);
    } catch {
      setNameStatus(tx.invalidNameFormat || "Invalid name format");
      return;
    }

    setIsSavingName(true);
    setName(sanitized);
    setLastSavedName(sanitized);
    controls.onNameChange(sanitized);
    setNameStatus(tx.nameSaved || "Saved");

    try {
      const success = await updateProfileName(sanitized);
      if (!success) {
        setNameStatus(tx.nameSavedLocally || "Saved on this device");
      }
    } catch (error) {
      logger.error("[V2Settings] Failed to update profile name:", error);
      setNameStatus(tx.nameSavedLocally || "Saved on this device");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || isNameSaveDisabled) return;
    event.preventDefault();
    void handleNameSave();
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
          onKeyDown={handleNameKeyDown}
        />
        <SettingsInlineButton
          icon={isSavingName ? Loader2 : Save}
          isLoading={isSavingName}
          onClick={() => {
            void handleNameSave();
          }}
          disabled={isNameSaveDisabled}
          testId="settings-v2-profile-save"
          variant="primary"
        >
          {isSavingName ? tx.saving || "Saving..." : tx.saveName || "Save name"}
        </SettingsInlineButton>
      </div>
      <div>
        <SettingsStatus>{nameStatus}</SettingsStatus>
      </div>
    </PanelFrame>
  );
}

const PALETTE_LABEL_FALLBACK: Record<ThemePaletteId, string> = {
  zenflow: "ZenFlow",
  morningHearth: "Morning Hearth",
  velvetLibrary: "Velvet Library",
  botanicalPulse: "Botanical Pulse",
  quietOled: "Quiet Black",
};

const ACCENT_LABEL_FALLBACK: Record<ThemeAccentFamily, string> = {
  teal: "Sea glass",
  clay: "Clay",
  plum: "Violet",
  moss: "Moss",
  amber: "Amber",
};

const INTENSITY_LABEL_FALLBACK: Record<ThemeIntensity, string> = {
  quiet: "Quiet",
  balanced: "Balanced",
  vivid: "Vivid",
};

const PALETTE_SWATCH_TOKENS: Record<ThemePaletteId, { start: string; end: string }> = {
  zenflow: { start: "143 42% 34%", end: "142 32% 94%" },
  morningHearth: { start: "36 44% 56%", end: "42 62% 98%" },
  velvetLibrary: { start: "258 70% 78%", end: "252 16% 18%" },
  botanicalPulse: { start: "139 44% 66%", end: "148 28% 82%" },
  quietOled: { start: "150 34% 6%", end: "139 38% 66%" },
};

const ACCENT_SWATCH_TOKENS: Record<ThemeAccentFamily, string> = {
  teal: "143 42% 34%",
  clay: "18 48% 38%",
  plum: "258 70% 78%",
  moss: "130 42% 32%",
  amber: "37 58% 35%",
};

function paletteSwatchStyle(paletteId: ThemePaletteId): CSSProperties {
  const swatch = PALETTE_SWATCH_TOKENS[paletteId];
  return {
    "--theme-palette-swatch-start": swatch.start,
    "--theme-palette-swatch-end": swatch.end,
  } as CSSProperties;
}

function accentSwatchStyle(accentFamily: ThemeAccentFamily): CSSProperties {
  return {
    "--theme-accent-swatch": ACCENT_SWATCH_TOKENS[accentFamily],
  } as CSSProperties;
}

function themeCustomizationsEqual(first: ThemeCustomization, second: ThemeCustomization): boolean {
  return (
    first.paletteId === second.paletteId &&
    first.accentFamily === second.accentFamily &&
    first.intensity === second.intensity &&
    first.warmth === second.warmth &&
    first.depth === second.depth &&
    first.contrastMode === second.contrastMode &&
    first.reduceGlow === second.reduceGlow &&
    first.reduceTransparency === second.reduceTransparency
  );
}

export function AppearancePanel() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const theme = useThemeStore((s) => s.theme);
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const themeCustomization = useThemeStore((s) => s.themeCustomization);
  const previousThemeCustomization = useThemeStore((s) => s.previousThemeCustomization);
  const setThemeCustomization = useThemeStore((s) => s.setThemeCustomization);
  const previewThemeCustomization = useThemeStore((s) => s.previewThemeCustomization);
  const cancelThemeCustomizationPreview = useThemeStore((s) => s.cancelThemeCustomizationPreview);
  const resetThemeCustomization = useThemeStore((s) => s.resetThemeCustomization);
  const undoThemeCustomization = useThemeStore((s) => s.undoThemeCustomization);
  const [draft, setDraft] = useState<ThemeCustomization>(themeCustomization);
  const [themeStatus, setThemeStatus] = useState<string | null>(null);
  const [appearanceMenuOpen, setAppearanceMenuOpen] = useState(false);
  const previewActiveRef = useRef(false);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const hasUnsavedAppearanceChanges = !themeCustomizationsEqual(draft, themeCustomization);
  const canUndoAppearanceChange = previousThemeCustomization !== null;

  useEffect(() => {
    syncLegacyThemePreference(theme);
  }, [appliedTheme, theme]);

  useEffect(() => {
    setDraft(themeCustomization);
  }, [themeCustomization]);

  useEffect(() => {
    return () => {
      if (previewActiveRef.current) {
        cancelThemeCustomizationPreview();
      }
    };
  }, [cancelThemeCustomizationPreview]);

  useEffect(() => {
    if (!themeStatus) return;
    const timer = window.setTimeout(() => setThemeStatus(null), 2400);
    return () => window.clearTimeout(timer);
  }, [themeStatus]);

  const updateTheme = (nextTheme: ThemePreference) => setTheme(nextTheme);
  const updateDraft = (patch: Partial<ThemeCustomization>) => {
    if (previewActiveRef.current) {
      cancelThemeCustomizationPreview();
      previewActiveRef.current = false;
      setThemeStatus(tx.themePreviewChanged);
    }
    setDraft((current) => ({ ...current, ...patch }));
  };
  const labelFor = <T extends string>(
    option: { id: T; labelKey: string },
    fallback: Record<T, string>,
  ) => tx[option.labelKey] || fallback[option.id];

  const handlePreview = () => {
    previewThemeCustomization(draft);
    previewActiveRef.current = true;
    setThemeStatus(tx.themePreviewing);
  };

  const handleApply = () => {
    if (!hasUnsavedAppearanceChanges) return;
    setThemeCustomization(draft);
    previewActiveRef.current = false;
    setThemeStatus(tx.themeApplied);
  };

  const handleReset = () => {
    const resetCustomization = { ...DEFAULT_THEME_CUSTOMIZATION };
    setDraft(resetCustomization);
    resetThemeCustomization();
    setAppearanceMenuOpen(false);
    previewActiveRef.current = false;
    setThemeStatus(tx.themeReset);
  };

  const handleUndo = () => {
    if (!canUndoAppearanceChange) return;
    undoThemeCustomization();
    previewActiveRef.current = false;
    setThemeStatus(tx.themeUndone);
  };

  const toggleAppearanceMenu = () => setAppearanceMenuOpen((open) => !open);

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
      description={tx.themeStyleDescription || tx.navV2Theme || tx.theme || "Theme"}
      testId="settings-v2-panel-appearance"
      variant="studio"
      showHeader={false}
    >
      <div
        className="relative grid justify-items-center gap-1 pb-3 text-center"
        data-testid="settings-v2-appearance-studio-title"
      >
        <button
          type="button"
          aria-label={tx.themeMoreActions || tx.moreActions || tx.appearance}
          aria-haspopup="menu"
          aria-expanded={appearanceMenuOpen}
          aria-controls="settings-v2-appearance-more-menu"
          onClick={toggleAppearanceMenu}
          className="absolute end-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--settings-v2-border)/0.34)] bg-[hsl(var(--settings-v2-card)/0.36)] text-foreground/82 shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.24),0_14px_30px_-24px_hsl(var(--settings-v2-shadow)/0.72)] backdrop-blur-[var(--settings-v2-glass-blur,24px)] [-webkit-backdrop-filter:blur(var(--settings-v2-glass-blur,24px))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 motion-safe:transition-[transform,border-color,background-color] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px]"
          data-testid="settings-v2-appearance-more"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
        {appearanceMenuOpen && (
          <div
            id="settings-v2-appearance-more-menu"
            role="menu"
            className="absolute end-0 top-12 z-10 min-w-[10.5rem] rounded-[18px] border border-[hsl(var(--settings-v2-border)/0.22)] bg-[hsl(var(--settings-v2-card)/0.9)] p-1.5 text-start shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.22),0_18px_42px_-30px_hsl(var(--settings-v2-shadow)/0.58)] backdrop-blur-[var(--settings-v2-glass-blur,24px)] [-webkit-backdrop-filter:blur(var(--settings-v2-glass-blur,24px))]"
            data-testid="settings-v2-appearance-more-menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleReset}
              data-testid="settings-v2-style-reset"
              className="flex min-h-11 w-full items-center gap-2 rounded-[14px] px-3 text-sm font-semibold text-foreground/78 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 motion-safe:transition-[transform,background-color,color] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-[hsl(var(--settings-v2-panel)/0.32)] motion-safe:active:translate-y-[1px]"
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{tx.themeResetAction}</span>
            </button>
          </div>
        )}
        <h2 className="max-w-[17rem] font-body text-[1.72rem] font-semibold leading-tight text-foreground sm:max-w-none sm:text-[2.35rem]">
          {tx.navV2Settings || tx.settings}
        </h2>
        <p className="max-w-[22rem] text-sm leading-relaxed text-muted-foreground">
          {tx.settingsOverviewDescription || tx.settings}
        </p>
      </div>

      <div
        className="rounded-[30px] border border-[hsl(var(--settings-v2-border)/0.24)] bg-[hsl(var(--settings-v2-card)/0.44)] p-3 shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.24),0_18px_44px_-34px_hsl(var(--settings-v2-shadow)/0.5)] sm:p-4"
        data-testid="settings-v2-appearance-glass-card"
      >
      <SettingsInset
        testId="settings-v2-style-customization"
        className="!space-y-0 !border-0 !bg-transparent !p-0 md:!p-0"
      >
        <section
          className="grid gap-3 rounded-[28px] border border-[hsl(var(--settings-v2-border)/0.18)] bg-[linear-gradient(145deg,hsl(var(--settings-v2-rim-light)/0.34),hsl(var(--settings-v2-card)/0.48)_42%,hsl(var(--settings-v2-panel)/0.34))] p-3 shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.28),0_18px_34px_-30px_hsl(var(--settings-v2-shadow)/0.48)] sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:p-4"
          aria-label={tx.appearance || "Appearance"}
          data-testid="settings-v2-identity-anchor"
        >
          <span
            aria-hidden="true"
            className="mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-[26px] border border-[hsl(var(--settings-v2-rim-light)/0.26)] bg-[radial-gradient(circle_at_32%_18%,hsl(var(--settings-v2-rim-light)/0.42),transparent_34%),linear-gradient(145deg,hsl(var(--settings-v2-icon-glass-mid)),hsl(var(--settings-v2-icon-glass))_58%,hsl(var(--settings-v2-icon-glass-dark)))] text-[hsl(var(--settings-v2-icon-glyph))] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.35),inset_0_-18px_26px_-22px_hsl(var(--settings-v2-icon-shadow)/0.62),0_18px_34px_-24px_hsl(var(--settings-v2-shadow)/0.72)]"
          >
            <Leaf className="h-12 w-12" strokeWidth={2.75} aria-hidden="true" />
          </span>
          <span className="grid min-w-0 gap-1 text-center sm:text-start">
            <span className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[hsl(var(--settings-v2-accent))]">
              ZenFlow
            </span>
            <span className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">
              {tx.appearance || "Appearance"}
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">
              {tx.themeStyleDescription || tx.navV2Theme || tx.theme}
            </span>
          </span>
        </section>

        <div
          className="border-t border-[hsl(var(--settings-v2-border)/0.2)] py-3"
          data-testid="settings-v2-theme-mode-field"
        >
          <div
            className="grid grid-cols-3 gap-1 rounded-full border border-[hsl(var(--settings-v2-border)/0.2)] bg-[hsl(var(--settings-v2-shell)/0.22)] p-1 shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.14)]"
            role="group"
            aria-label={tx.themeLabel || "Theme"}
            data-testid="settings-v2-theme-segmented-control"
          >
            {themeOptions.map((option) => {
              const selected = theme === option.value;
              const Icon = option.icon;

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => updateTheme(option.value)}
                  data-interaction-surface="settings-choice"
                  data-testid={`settings-v2-theme-choice-${option.value}`}
                  className={cn(
                    "relative flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-full border px-2.5 text-[0.8125rem] font-semibold motion-safe:transition-[transform,border-color,background-color,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 sm:min-h-[58px] sm:px-3 sm:text-sm",
                    selected
                      ? "border-[hsl(var(--settings-v2-accent)/0.38)] bg-[hsl(var(--settings-v2-accent)/0.14)] text-[hsl(var(--settings-v2-accent))] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.2),0_10px_24px_-22px_hsl(var(--settings-v2-accent)/0.36)]"
                      : "border-transparent bg-transparent text-foreground/84 hover:bg-[hsl(var(--settings-v2-panel)/0.28)]"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{option.label}</span>
                </button>
              );
            })}
          </div>

          <ToggleRow
            icon={Moon}
            title={tx.oledDarkMode || "OLED Dark Mode"}
            description={tx.oledDarkModeHint || "Pure black theme for OLED screens. May save battery."}
            checked={theme === "oled"}
            onCheckedChange={(checked) => updateTheme(checked ? "oled" : "ink")}
            testId="settings-v2-oled-toggle"
          />
        </div>

        <details
          className="group rounded-[24px] border border-[hsl(var(--settings-v2-border)/0.18)] bg-[hsl(var(--settings-v2-shell)/0.24)]"
          data-testid="settings-v2-advanced-appearance-details"
        >
          <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent)/0.55)] [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-[hsl(var(--settings-v2-accent)/0.1)] text-[hsl(var(--settings-v2-accent))]">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 truncate">{tx.themeStyleTitle || "Mood palette"}</span>
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="space-y-0 border-t border-[hsl(var(--settings-v2-border)/0.24)] px-3 pb-3">
        <div
          className="border-t border-[hsl(var(--settings-v2-border)/0.24)] py-3.5 first:border-t-0 first:pt-0"
          data-testid="settings-v2-mood-palette-field"
        >
          <SettingsFieldHeader
            icon={Sparkles}
            title={tx.themeStyleTitle || "Mood palette"}
            description={tx.themeStyleDescription || "Choose a curated look that sets the tone."}
          />
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-label={tx.themeStyleTitle || "Mood palette"}
          >
            {THEME_CUSTOMIZATION_PRESETS.map((option) => {
              const selected = draft.paletteId === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  data-interaction-surface="settings-choice"
                  data-testid={`settings-v2-style-choice-${option.id}`}
                  onClick={() => updateDraft({ paletteId: option.id })}
                  className={cn(
                    "relative flex min-h-[54px] min-w-0 items-center justify-center gap-2 overflow-hidden rounded-full border px-3 text-center text-[0.8125rem] font-semibold leading-tight text-foreground motion-safe:transition-[transform,border-color,background-color,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2",
                    "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px]",
                    selected
                      ? "border-[hsl(var(--settings-v2-accent)/0.38)] bg-[hsl(var(--settings-v2-accent)/0.1)] text-[hsl(var(--settings-v2-accent))] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.32),0_14px_28px_-24px_hsl(var(--settings-v2-accent)/0.42)]"
                      : "border-[hsl(var(--settings-v2-border)/0.24)] bg-[hsl(var(--settings-v2-card)/0.28)] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.16),0_8px_18px_-18px_hsl(var(--settings-v2-shadow)/0.32)] hover:border-[hsl(var(--settings-v2-border)/0.38)] hover:bg-[hsl(var(--settings-v2-panel)/0.36)]",
                    option.id === "quietOled" && "col-span-2"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-[hsl(var(--settings-v2-rim-light)/0.42)] bg-[linear-gradient(135deg,hsl(var(--theme-palette-swatch-start)),hsl(var(--theme-palette-swatch-end)))] shadow-[0_0_18px_-8px_hsl(var(--theme-palette-swatch-start)/0.7)]"
                    style={paletteSwatchStyle(option.id)}
                  />
                  <span className="min-w-0 text-balance">{labelFor(option, PALETTE_LABEL_FALLBACK)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="border-t border-[hsl(var(--settings-v2-border)/0.24)] py-3.5"
          data-testid="settings-v2-accent-field"
        >
          <SettingsFieldHeader
            icon={Palette}
            title={tx.themeAccentTitle || "Accent"}
          />
          <p
            id="settings-v2-accent-selected-label"
            className="text-xs font-semibold text-[hsl(var(--settings-v2-accent))]"
            data-testid="settings-v2-accent-selected-label"
          >
            {labelFor(
              THEME_ACCENT_FAMILIES.find((option) => option.id === draft.accentFamily) ||
                THEME_ACCENT_FAMILIES[0],
              ACCENT_LABEL_FALLBACK,
            )}
          </p>
          <div
            className="flex flex-wrap items-center gap-2.5 py-1"
            role="group"
            aria-label={tx.themeAccentTitle || "Accent"}
            aria-describedby="settings-v2-accent-selected-label"
            data-testid="settings-v2-accent-swatch-row"
          >
            {THEME_ACCENT_FAMILIES.map((option) => {
              const selected = draft.accentFamily === option.id;
              const label = labelFor(option, ACCENT_LABEL_FALLBACK);

              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={label}
                  aria-pressed={selected}
                  aria-describedby="settings-v2-accent-selected-label"
                  title={label}
                  data-interaction-surface="settings-choice"
                  data-swatch-kind="accent"
                  data-testid={`settings-v2-accent-choice-${option.id}`}
                  onClick={() => updateDraft({ accentFamily: option.id })}
                  className={cn(
                    "relative h-11 w-11 rounded-full border motion-safe:transition-[transform,border-color,box-shadow,filter] motion-safe:duration-200 motion-safe:ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2",
                    "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px]",
                    selected
                      ? "border-[hsl(var(--settings-v2-accent)/0.48)] shadow-[0_0_0_3px_hsl(var(--settings-v2-accent)/0.12),0_0_18px_-12px_hsl(var(--theme-accent-swatch)/0.5)]"
                      : "border-[hsl(var(--settings-v2-border)/0.38)] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.24),0_10px_18px_-18px_hsl(var(--settings-v2-shadow)/0.48)]"
                  )}
                  style={accentSwatchStyle(option.id)}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-1.5 rounded-full bg-[radial-gradient(circle_at_32%_24%,hsl(var(--settings-v2-rim-light)/0.6),transparent_34%),linear-gradient(145deg,hsl(var(--theme-accent-swatch)/0.76),hsl(var(--theme-accent-swatch)/0.42))]"
                  />
                </button>
              );
            })}
          </div>
        </div>


        <div className="border-t border-[hsl(var(--settings-v2-border)/0.24)] py-3.5">
          <details
            className="group rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.24)] bg-[hsl(var(--settings-v2-shell)/0.28)]"
            data-testid="settings-v2-comfort-details"
          >
            <summary
              className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent)/0.55)] [&::-webkit-details-marker]:hidden"
              data-testid="settings-v2-comfort-summary"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[hsl(var(--settings-v2-accent)/0.1)] text-[hsl(var(--settings-v2-accent))]">
                  <Contrast className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 truncate">{tx.themeComfortTitle || "Comfort"}</span>
              </span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-3 border-t border-[hsl(var(--settings-v2-border)/0.36)] p-3 pt-3">
              <div>
                <SettingsFieldHeader icon={Layers} title={tx.themeIntensityTitle || "Intensity"} />
                <SettingsButtonGrid
                  columns="three"
                  role="group"
                  ariaLabel={tx.themeIntensityTitle || "Intensity"}
                >
                  {THEME_INTENSITIES.map((option) => (
                    <SettingsChoiceButton
                      key={option.id}
                      selected={draft.intensity === option.id}
                      onClick={() => updateDraft({ intensity: option.id })}
                      presentation="compact"
                      testId={`settings-v2-intensity-choice-${option.id}`}
                    >
                      {labelFor(option, INTENSITY_LABEL_FALLBACK)}
                    </SettingsChoiceButton>
                  ))}
                </SettingsButtonGrid>
              </div>
              <ToggleRow
                icon={Contrast}
                title={tx.themeHighContrast || "High contrast"}
                description={
                  tx.themeHighContrastHint || "Strengthens text, borders, and focus indicators."
                }
                checked={draft.contrastMode === "high"}
                onCheckedChange={(checked) =>
                  updateDraft({ contrastMode: checked ? "high" : "standard" })
                }
                testId="settings-v2-high-contrast-toggle"
              />
              <ToggleRow
                icon={Sparkles}
                title={tx.themeReduceGlow || "Reduce glow"}
                description={tx.themeReduceGlowHint || "Keeps surfaces calmer in low light."}
                checked={draft.reduceGlow}
                onCheckedChange={(checked) => updateDraft({ reduceGlow: checked })}
                testId="settings-v2-reduce-glow-toggle"
              />
              <ToggleRow
                icon={Layers}
                title={tx.themeReduceTransparency || "Reduce transparency"}
                description={
                  tx.themeReduceTransparencyHint || "Uses more solid panels for readability."
                }
                checked={draft.reduceTransparency}
                onCheckedChange={(checked) => updateDraft({ reduceTransparency: checked })}
                testId="settings-v2-reduce-transparency-toggle"
              />
            </div>
          </details>
        </div>

          </div>
        </details>

        <div
          id="settings-v2-appearance-actions"
          ref={actionsRef}
          className="border-t border-[hsl(var(--settings-v2-border)/0.24)] pt-3"
          data-testid="settings-v2-appearance-actions"
        >
          <div className="grid grid-cols-[minmax(0,0.86fr)_minmax(0,0.92fr)_minmax(0,1.28fr)] gap-1.5 rounded-[22px] border border-[hsl(var(--settings-v2-border)/0.16)] bg-[hsl(var(--settings-v2-shell)/0.22)] p-1.5 shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.12)]">
            <button
              type="button"
              aria-label={tx.themeUndoAction}
              title={tx.themeUndoAction}
              onClick={handleUndo}
              disabled={!canUndoAppearanceChange}
              data-testid="settings-v2-style-undo"
              className="flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] border border-transparent bg-transparent px-1.5 text-foreground/76 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-safe:transition-[transform,background-color,color,border-color,opacity] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-[hsl(var(--settings-v2-panel)/0.26)] motion-safe:active:translate-y-[1px]"
            >
              <Undo2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate text-[0.68rem] font-semibold leading-none min-[390px]:text-[0.72rem]">
                {tx.themeUndoAction}
              </span>
            </button>
            <button
              type="button"
              aria-label={tx.themePreviewAction}
              title={tx.themePreviewAction}
              onClick={handlePreview}
              disabled={!hasUnsavedAppearanceChanges}
              data-button-tone="secondary"
              data-testid="settings-v2-style-preview"
              className="flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] border border-transparent bg-transparent px-1.5 text-foreground/76 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-safe:transition-[transform,background-color,color,border-color,opacity] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-[hsl(var(--settings-v2-panel)/0.26)] motion-safe:active:translate-y-[1px]"
            >
              <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate text-[0.68rem] font-semibold leading-none min-[390px]:text-[0.72rem]">
                {tx.themePreviewAction}
              </span>
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!hasUnsavedAppearanceChanges}
              data-button-tone="primary"
              data-testid="settings-v2-style-apply"
              className="flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] border border-[hsl(var(--settings-v2-accent)/0.34)] bg-[hsl(var(--settings-v2-accent)/0.18)] px-2 text-[hsl(var(--settings-v2-accent))] shadow-[inset_0_1px_0_hsl(var(--settings-v2-rim-light)/0.2),0_12px_28px_-21px_hsl(var(--settings-v2-accent)/0.52)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--settings-v2-accent))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[hsl(var(--settings-v2-panel)/0.24)] disabled:text-foreground/44 disabled:shadow-none motion-safe:transition-[transform,background-color,border-color,box-shadow,color,opacity] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-[hsl(var(--settings-v2-accent)/0.22)] motion-safe:active:translate-y-[1px]"
            >
              <Save className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate text-[0.68rem] font-semibold leading-none min-[390px]:text-[0.72rem]">
                {tx.themeApplyAction}
              </span>
            </button>
          </div>
          <div>
            <SettingsStatus>{themeStatus}</SettingsStatus>
          </div>
        </div>
      </SettingsInset>
      </div>
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
