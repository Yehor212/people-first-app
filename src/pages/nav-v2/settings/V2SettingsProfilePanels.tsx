import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  ChevronDown,
  Contrast,
  Eye,
  Globe2,
  Layers,
  Loader2,
  Moon,
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
        setNameStatus(tx.nameSavedLocally || "Saved locally");
      }
    } catch (error) {
      logger.error("[V2Settings] Failed to update profile name:", error);
      setNameStatus(tx.nameSavedLocally || "Saved locally");
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
      <div role="status" aria-live="polite">
        <SettingsStatus>{nameStatus}</SettingsStatus>
      </div>
    </PanelFrame>
  );
}

const PALETTE_LABEL_FALLBACK: Record<ThemePaletteId, string> = {
  zenflow: "ZenFlow",
  morningHearth: "Soft Light",
  velvetLibrary: "Deep Glass",
  botanicalPulse: "Fresh Glass",
  quietOled: "OLED Glass",
};

const ACCENT_LABEL_FALLBACK: Record<ThemeAccentFamily, string> = {
  teal: "Blue",
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
  zenflow: { start: "174 38% 34%", end: "42 20% 96%" },
  morningHearth: { start: "211 84% 45%", end: "0 0% 100%" },
  velvetLibrary: { start: "258 70% 78%", end: "252 16% 18%" },
  botanicalPulse: { start: "130 42% 32%", end: "148 28% 82%" },
  quietOled: { start: "0 0% 0%", end: "211 68% 74%" },
};

const ACCENT_SWATCH_TOKENS: Record<ThemeAccentFamily, string> = {
  teal: "211 84% 45%",
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


export function AppearancePanel() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const theme = useThemeStore((s) => s.theme);
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const themeCustomization = useThemeStore((s) => s.themeCustomization);
  const setThemeCustomization = useThemeStore((s) => s.setThemeCustomization);
  const previewThemeCustomization = useThemeStore((s) => s.previewThemeCustomization);
  const cancelThemeCustomizationPreview = useThemeStore((s) => s.cancelThemeCustomizationPreview);
  const resetThemeCustomization = useThemeStore((s) => s.resetThemeCustomization);
  const undoThemeCustomization = useThemeStore((s) => s.undoThemeCustomization);
  const [draft, setDraft] = useState<ThemeCustomization>(themeCustomization);
  const [themeStatus, setThemeStatus] = useState<string | null>(null);
  const previewActiveRef = useRef(false);

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
      setThemeStatus(tx.themePreviewChanged || "Preview cleared after changes");
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
    setThemeStatus(tx.themePreviewing || "Previewing style");
  };

  const handleApply = () => {
    setThemeCustomization(draft);
    previewActiveRef.current = false;
    setThemeStatus(tx.themeApplied || "Style applied");
  };

  const handleReset = () => {
    const resetCustomization = { ...DEFAULT_THEME_CUSTOMIZATION };
    setDraft(resetCustomization);
    resetThemeCustomization();
    previewActiveRef.current = false;
    setThemeStatus(tx.themeReset || "Style reset");
  };

  const handleUndo = () => {
    undoThemeCustomization();
    previewActiveRef.current = false;
    setThemeStatus(tx.themeUndone || "Style restored");
  };

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
            selectedTone="solid"
            testId={`settings-v2-theme-choice-${option.value}`}
          >
            {option.label}
          </SettingsChoiceButton>
        ))}
      </SettingsButtonGrid>

      <ToggleRow
        icon={Moon}
        title={tx.oledDarkMode || "OLED Dark Mode"}
        description={tx.oledDarkModeHint || "Pure black theme for OLED screens. May save battery."}
        checked={theme === "oled"}
        onCheckedChange={(checked) => updateTheme(checked ? "oled" : "ink")}
        testId="settings-v2-oled-toggle"
      />

      <SettingsInset testId="settings-v2-style-customization">
        <SettingsFieldHeader
          icon={Sparkles}
          title={tx.themeStyleTitle || "Glass style"}
          description={
            tx.themeStyleDescription || "Tune translucency while keeping text readable."
          }
        />
        <SettingsButtonGrid columns="two" role="group" ariaLabel={tx.themeStyleTitle || "Glass style"}>
          {THEME_CUSTOMIZATION_PRESETS.map((option) => (
            <SettingsChoiceButton
              key={option.id}
              selected={draft.paletteId === option.id}
              onClick={() => updateDraft({ paletteId: option.id })}
              surface="card"
              testId={`settings-v2-style-choice-${option.id}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 rounded-full border border-[hsl(var(--settings-v2-border)/0.55)] bg-[linear-gradient(135deg,hsl(var(--theme-palette-swatch-start)),hsl(var(--theme-palette-swatch-end)))]"
                  style={paletteSwatchStyle(option.id)}
                />
                <span className="min-w-0 truncate">{labelFor(option, PALETTE_LABEL_FALLBACK)}</span>
              </span>
            </SettingsChoiceButton>
          ))}
        </SettingsButtonGrid>

        <SettingsFieldHeader
          icon={Palette}
          title={tx.themeAccentTitle || "Accent"}
          description={
            tx.themeAccentDescription ||
            "Color used for focus, selected states, and key controls."
          }
        />
        <SettingsButtonGrid columns="three" role="group" ariaLabel={tx.themeAccentTitle || "Accent"}>
          {THEME_ACCENT_FAMILIES.map((option) => (
            <SettingsChoiceButton
              key={option.id}
              selected={draft.accentFamily === option.id}
              onClick={() => updateDraft({ accentFamily: option.id })}
              presentation="compact"
              testId={`settings-v2-accent-choice-${option.id}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 rounded-full bg-[hsl(var(--theme-accent-swatch))]"
                  style={accentSwatchStyle(option.id)}
                />
                <span className="min-w-0 truncate">{labelFor(option, ACCENT_LABEL_FALLBACK)}</span>
              </span>
            </SettingsChoiceButton>
          ))}
        </SettingsButtonGrid>

        <SettingsFieldHeader icon={Layers} title={tx.themeIntensityTitle || "Intensity"} />
        <SettingsButtonGrid columns="three" role="group" ariaLabel={tx.themeIntensityTitle || "Intensity"}>
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

        <details
          className="group rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.42)] bg-[hsl(var(--settings-v2-shell)/0.46)]"
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

        <div
          className="grid gap-2 rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.48)] bg-[hsl(var(--settings-v2-card)/0.82)] p-3"
          data-testid="settings-v2-style-preview-card"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">
              {tx.themePreviewTitle}
            </span>
            <span className="rounded-[999px] border border-[hsl(var(--settings-v2-accent)/0.55)] bg-[hsl(var(--settings-v2-accent)/0.14)] px-2 py-1 text-xs font-semibold text-[hsl(var(--settings-v2-accent))]">
              {labelFor(
                THEME_CUSTOMIZATION_PRESETS.find((option) => option.id === draft.paletteId) ||
                  THEME_CUSTOMIZATION_PRESETS[0],
                PALETTE_LABEL_FALLBACK,
              )}
            </span>
          </div>
          <div className="min-w-0 rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.45)] bg-[hsl(var(--settings-v2-shell)/0.54)] p-3">
            <span className="block text-sm font-semibold text-foreground">ZenFlow</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {tx.themePreviewDescription ||
                "Preview shows cards, focus, and selected states before saving."}
            </span>
          </div>
        </div>

        <SettingsButtonGrid columns="confirm">
          <SettingsInlineButton
            icon={Eye}
            onClick={handlePreview}
            testId="settings-v2-style-preview"
            variant="secondary"
          >
            {tx.themePreviewAction}
          </SettingsInlineButton>
          <SettingsInlineButton
            icon={Save}
            onClick={handleApply}
            disabled={!previewActiveRef.current}
            testId="settings-v2-style-apply"
            variant="primary"
          >
            {tx.themeApplyAction || "Apply"}
          </SettingsInlineButton>
          <SettingsInlineButton
            icon={RotateCcw}
            onClick={handleReset}
            testId="settings-v2-style-reset"
            variant="secondary"
          >
            {tx.themeResetAction || "Reset"}
          </SettingsInlineButton>
          <SettingsInlineButton
            icon={Undo2}
            onClick={handleUndo}
            testId="settings-v2-style-undo"
            variant="secondary"
          >
            {tx.themeUndoAction || "Undo"}
          </SettingsInlineButton>
        </SettingsButtonGrid>
        <div role="status" aria-live="polite">
          <SettingsStatus>{themeStatus}</SettingsStatus>
        </div>
      </SettingsInset>
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
