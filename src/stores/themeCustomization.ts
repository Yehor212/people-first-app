import type { AppliedTheme } from "./themeStore";

export type ThemePaletteId =
  | "zenflow"
  | "morningHearth"
  | "velvetLibrary"
  | "botanicalPulse"
  | "quietOled";
export type ThemeAccentFamily = "teal" | "clay" | "plum" | "moss" | "amber";
export type ThemeIntensity = "quiet" | "balanced" | "vivid";
export type ThemeWarmth = "cool" | "neutral" | "warm";
export type ThemeDepth = "crisp" | "cozy" | "soft";
export type ThemeContrastMode = "standard" | "high";

export interface ThemeCustomization {
  paletteId: ThemePaletteId;
  accentFamily: ThemeAccentFamily;
  intensity: ThemeIntensity;
  warmth: ThemeWarmth;
  depth: ThemeDepth;
  contrastMode: ThemeContrastMode;
  reduceGlow: boolean;
  reduceTransparency: boolean;
}

export interface ThemeCustomizationRecipe {
  cssVars: Record<string, string>;
  metaThemeColor: string;
}

export interface ThemeCustomizationOption<T extends string> {
  id: T;
  labelKey: string;
}

export const DEFAULT_THEME_CUSTOMIZATION: ThemeCustomization = Object.freeze({
  paletteId: "zenflow",
  accentFamily: "teal",
  intensity: "balanced",
  warmth: "neutral",
  depth: "crisp",
  contrastMode: "standard",
  reduceGlow: false,
  reduceTransparency: false,
});

export const THEME_CUSTOMIZATION_PRESETS: Array<ThemeCustomizationOption<ThemePaletteId>> = [
  { id: "zenflow", labelKey: "themePaletteZenflow" },
  { id: "morningHearth", labelKey: "themePaletteMorningHearth" },
  { id: "velvetLibrary", labelKey: "themePaletteVelvetLibrary" },
  { id: "botanicalPulse", labelKey: "themePaletteBotanicalPulse" },
  { id: "quietOled", labelKey: "themePaletteQuietOled" },
];

export const THEME_ACCENT_FAMILIES: Array<ThemeCustomizationOption<ThemeAccentFamily>> = [
  { id: "teal", labelKey: "themeAccentTeal" },
  { id: "clay", labelKey: "themeAccentClay" },
  { id: "plum", labelKey: "themeAccentPlum" },
  { id: "moss", labelKey: "themeAccentMoss" },
  { id: "amber", labelKey: "themeAccentAmber" },
];

export const THEME_INTENSITIES: Array<ThemeCustomizationOption<ThemeIntensity>> = [
  { id: "quiet", labelKey: "themeIntensityQuiet" },
  { id: "balanced", labelKey: "themeIntensityBalanced" },
  { id: "vivid", labelKey: "themeIntensityVivid" },
];

const PALETTE_IDS = new Set<ThemePaletteId>(THEME_CUSTOMIZATION_PRESETS.map((option) => option.id));
const ACCENT_FAMILIES = new Set<ThemeAccentFamily>(
  THEME_ACCENT_FAMILIES.map((option) => option.id),
);
const INTENSITIES = new Set<ThemeIntensity>(THEME_INTENSITIES.map((option) => option.id));
const WARMTHS = new Set<ThemeWarmth>(["cool", "neutral", "warm"]);
const DEPTHS = new Set<ThemeDepth>(["crisp", "cozy", "soft"]);
const CONTRAST_MODES = new Set<ThemeContrastMode>(["standard", "high"]);

const CUSTOMIZATION_CSS_VARS = [
  "--settings-v2-shell",
  "--settings-v2-card",
  "--settings-v2-panel",
  "--settings-v2-border",
  "--settings-v2-accent",
  "--settings-v2-shadow",
  "--settings-v2-card-alpha",
  "--settings-v2-panel-alpha",
  "--settings-v2-shell-alpha",
  "--settings-v2-glass-blur",
  "--settings-v2-rim-light",
  "--settings-v2-rim-alpha",
  "--ring",
  "--primary",
  "--primary-foreground",
  "--zen-shadow-card",
  "--zen-shadow-hover",
] as const;

const DEFAULT_THEME_COLOR = "#4a9d7c";

const PAPER_PALETTES: Record<ThemePaletteId, Record<string, string>> = {
  zenflow: {},
  morningHearth: {
    "--settings-v2-shell": "198 32% 91%",
    "--settings-v2-card": "0 0% 100%",
    "--settings-v2-panel": "204 40% 96%",
    "--settings-v2-border": "205 15% 72%",
    "--settings-v2-shadow": "212 24% 22%",
    "--settings-v2-rim-light": "0 0% 100%",
  },
  velvetLibrary: {
    "--settings-v2-shell": "268 24% 91%",
    "--settings-v2-card": "43 34% 96%",
    "--settings-v2-panel": "265 22% 84%",
    "--settings-v2-border": "266 18% 52%",
    "--settings-v2-shadow": "266 28% 14%",
  },
  botanicalPulse: {
    "--settings-v2-shell": "139 28% 89%",
    "--settings-v2-card": "47 42% 96%",
    "--settings-v2-panel": "148 28% 82%",
    "--settings-v2-border": "151 21% 49%",
    "--settings-v2-shadow": "153 28% 12%",
  },
  quietOled: {
    "--settings-v2-shell": "205 20% 91%",
    "--settings-v2-card": "210 24% 97%",
    "--settings-v2-panel": "210 18% 85%",
    "--settings-v2-border": "210 13% 53%",
    "--settings-v2-shadow": "210 24% 14%",
  },
};

const DARK_PALETTES: Record<ThemePaletteId, Record<string, string>> = {
  zenflow: {},
  morningHearth: {
    "--settings-v2-shell": "26 26% 9%",
    "--settings-v2-card": "28 24% 13%",
    "--settings-v2-panel": "25 22% 18%",
    "--settings-v2-border": "30 20% 34%",
    "--settings-v2-shadow": "24 34% 4%",
  },
  velvetLibrary: {
    "--settings-v2-shell": "252 16% 8%",
    "--settings-v2-card": "258 18% 12%",
    "--settings-v2-panel": "252 16% 18%",
    "--settings-v2-border": "252 14% 44%",
    "--settings-v2-shadow": "258 36% 4%",
    "--settings-v2-rim-light": "264 36% 82%",
  },
  botanicalPulse: {
    "--settings-v2-shell": "154 22% 8%",
    "--settings-v2-card": "154 18% 13%",
    "--settings-v2-panel": "148 16% 18%",
    "--settings-v2-border": "150 14% 35%",
    "--settings-v2-shadow": "154 32% 4%",
  },
  quietOled: {
    "--settings-v2-shell": "0 0% 0%",
    "--settings-v2-card": "210 14% 5%",
    "--settings-v2-panel": "210 12% 8%",
    "--settings-v2-border": "210 10% 30%",
    "--settings-v2-shadow": "0 0% 0%",
  },
};

const ACCENTS: Record<AppliedTheme, Record<ThemeAccentFamily, Record<ThemeIntensity, string>>> = {
  paper: {
    teal: { quiet: "211 68% 42%", balanced: "211 84% 45%", vivid: "211 94% 39%" },
    clay: { quiet: "18 38% 45%", balanced: "18 44% 42%", vivid: "17 54% 36%" },
    plum: { quiet: "274 34% 44%", balanced: "274 40% 38%", vivid: "274 52% 34%" },
    moss: { quiet: "128 34% 36%", balanced: "130 42% 32%", vivid: "130 52% 27%" },
    amber: { quiet: "37 48% 37%", balanced: "37 58% 35%", vivid: "36 68% 30%" },
  },
  ink: {
    teal: { quiet: "211 48% 70%", balanced: "211 72% 76%", vivid: "211 84% 80%" },
    clay: { quiet: "18 40% 66%", balanced: "18 48% 62%", vivid: "17 62% 66%" },
    plum: { quiet: "258 48% 74%", balanced: "258 70% 78%", vivid: "258 84% 82%" },
    moss: { quiet: "130 32% 64%", balanced: "130 42% 60%", vivid: "130 56% 64%" },
    amber: { quiet: "38 50% 68%", balanced: "38 62% 64%", vivid: "38 76% 66%" },
  },
  oled: {
    teal: { quiet: "211 44% 68%", balanced: "211 68% 74%", vivid: "211 82% 78%" },
    clay: { quiet: "18 40% 66%", balanced: "18 50% 62%", vivid: "17 64% 66%" },
    plum: { quiet: "258 42% 72%", balanced: "258 66% 76%", vivid: "258 80% 80%" },
    moss: { quiet: "130 34% 64%", balanced: "130 44% 60%", vivid: "130 58% 64%" },
    amber: { quiet: "38 52% 68%", balanced: "38 64% 64%", vivid: "38 78% 66%" },
  },
};

const META_THEME_COLORS: Record<ThemePaletteId, Record<ThemeAccentFamily, string>> = {
  zenflow: { teal: "#4a9d7c", clay: "#8e5640", plum: "#76519b", moss: "#3d7e48", amber: "#9b6b1f" },
  morningHearth: { teal: "#dbeef2", clay: "#dbeef2", plum: "#dbeef2", moss: "#dbeef2", amber: "#dbeef2" },
  velvetLibrary: { teal: "#211d2b", clay: "#211d2b", plum: "#211d2b", moss: "#211d2b", amber: "#211d2b" },
  botanicalPulse: { teal: "#3e837c", clay: "#8f5a3f", plum: "#795896", moss: "#357d49", amber: "#986e24" },
  quietOled: { teal: "#58aca6", clay: "#bd765f", plum: "#a687cf", moss: "#73ad76", amber: "#c69545" },
};

function enumValue<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeThemeCustomization(value: unknown): ThemeCustomization {
  if (!value || typeof value !== "object") return { ...DEFAULT_THEME_CUSTOMIZATION };
  const source = value as Partial<Record<keyof ThemeCustomization, unknown>>;
  return {
    paletteId: enumValue(source.paletteId, PALETTE_IDS, DEFAULT_THEME_CUSTOMIZATION.paletteId),
    accentFamily: enumValue(
      source.accentFamily,
      ACCENT_FAMILIES,
      DEFAULT_THEME_CUSTOMIZATION.accentFamily,
    ),
    intensity: enumValue(source.intensity, INTENSITIES, DEFAULT_THEME_CUSTOMIZATION.intensity),
    warmth: enumValue(source.warmth, WARMTHS, DEFAULT_THEME_CUSTOMIZATION.warmth),
    depth: enumValue(source.depth, DEPTHS, DEFAULT_THEME_CUSTOMIZATION.depth),
    contrastMode: enumValue(
      source.contrastMode,
      CONTRAST_MODES,
      DEFAULT_THEME_CUSTOMIZATION.contrastMode,
    ),
    reduceGlow: booleanValue(source.reduceGlow, DEFAULT_THEME_CUSTOMIZATION.reduceGlow),
    reduceTransparency: booleanValue(
      source.reduceTransparency,
      DEFAULT_THEME_CUSTOMIZATION.reduceTransparency,
    ),
  };
}

function paletteForTheme(appliedTheme: AppliedTheme, paletteId: ThemePaletteId): Record<string, string> {
  return appliedTheme === "paper" ? PAPER_PALETTES[paletteId] : DARK_PALETTES[paletteId];
}

function foregroundForTheme(appliedTheme: AppliedTheme): string {
  return appliedTheme === "paper" ? "160 42% 96%" : "170 22% 8%";
}

function transparencyVars(
  appliedTheme: AppliedTheme,
  customization: ThemeCustomization,
): Record<string, string> {
  if (customization.reduceTransparency) {
    return {
      "--settings-v2-card-alpha": "1",
      "--settings-v2-panel-alpha": "0.96",
      "--settings-v2-shell-alpha": "0.9",
      "--settings-v2-glass-blur": "0px",
      "--settings-v2-rim-alpha": "0.18",
    };
  }
  return {
    "--settings-v2-card-alpha": customization.depth === "soft"
      ? appliedTheme === "paper"
        ? "0.64"
        : "0.62"
      : "0.86",
    "--settings-v2-panel-alpha": customization.depth === "soft"
      ? appliedTheme === "paper"
        ? "0.5"
        : "0.5"
      : "0.72",
    "--settings-v2-shell-alpha": customization.depth === "cozy" ? "0.58" : "0.44",
    "--settings-v2-glass-blur": customization.depth === "soft"
      ? appliedTheme === "paper"
        ? "28px"
        : "30px"
      : "14px",
    "--settings-v2-rim-alpha": customization.depth === "soft"
      ? appliedTheme === "paper"
        ? "0.74"
        : "0.24"
      : "0.28",
  };
}

function shadowVars(appliedTheme: AppliedTheme, customization: ThemeCustomization): Record<string, string> {
  if (customization.reduceGlow || customization.depth === "crisp") {
    return {
      "--zen-shadow-card":
        appliedTheme === "paper"
          ? "0 8px 24px -22px hsl(var(--settings-v2-shadow) / 0.28)"
          : "0 10px 28px -24px hsl(var(--settings-v2-shadow) / 0.62)",
      "--zen-shadow-hover":
        appliedTheme === "paper"
          ? "0 12px 30px -24px hsl(var(--settings-v2-shadow) / 0.32)"
          : "0 14px 34px -26px hsl(var(--settings-v2-shadow) / 0.68)",
    };
  }
  return {
    "--zen-shadow-card":
      appliedTheme === "paper"
        ? "0 16px 38px -28px hsl(var(--settings-v2-shadow) / 0.34)"
        : "0 18px 44px -30px hsl(var(--settings-v2-shadow) / 0.74)",
    "--zen-shadow-hover":
      appliedTheme === "paper"
        ? "0 20px 48px -30px hsl(var(--settings-v2-shadow) / 0.4)"
        : "0 22px 54px -32px hsl(var(--settings-v2-shadow) / 0.78)",
  };
}

export function getThemeCustomizationRecipe(
  appliedTheme: AppliedTheme,
  value: ThemeCustomization,
): ThemeCustomizationRecipe {
  const customization = normalizeThemeCustomization(value);
  if (JSON.stringify(customization) === JSON.stringify(DEFAULT_THEME_CUSTOMIZATION)) {
    return { cssVars: {}, metaThemeColor: DEFAULT_THEME_COLOR };
  }

  const accent = ACCENTS[appliedTheme][customization.accentFamily][customization.intensity];
  const palette = paletteForTheme(appliedTheme, customization.paletteId);
  const contrastBorder: Record<string, string> =
    customization.contrastMode === "high"
      ? appliedTheme === "paper"
        ? { "--settings-v2-border": "210 12% 38%" }
        : { "--settings-v2-border": "170 10% 48%" }
      : {};

  return {
    cssVars: {
      ...palette,
      ...contrastBorder,
      ...transparencyVars(appliedTheme, customization),
      ...shadowVars(appliedTheme, customization),
      "--settings-v2-accent": accent,
      "--ring": accent,
      "--primary": accent,
      "--primary-foreground": foregroundForTheme(appliedTheme),
    },
    metaThemeColor: META_THEME_COLORS[customization.paletteId][customization.accentFamily],
  };
}

function setMetaThemeColor(color: string): void {
  if (typeof document === "undefined") return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = color;
}

export function applyThemeCustomizationToDOM(
  appliedTheme: AppliedTheme,
  value: ThemeCustomization,
): void {
  if (typeof document === "undefined") return;
  const customization = normalizeThemeCustomization(value);
  const root = document.documentElement;
  const recipe = getThemeCustomizationRecipe(appliedTheme, customization);

  for (const name of CUSTOMIZATION_CSS_VARS) {
    root.style.removeProperty(name);
  }

  root.dataset.themeStyle = customization.paletteId;
  root.dataset.themeAccent = customization.accentFamily;
  root.dataset.themeIntensity = customization.intensity;
  root.dataset.themeDepth = customization.depth;
  root.dataset.themeComfort = customization.contrastMode === "high" ? "high-contrast" : "standard";
  root.dataset.themeTransparency = customization.reduceTransparency ? "solid" : "layered";
  root.dataset.themeGlow = customization.reduceGlow ? "reduced" : "standard";

  for (const [name, token] of Object.entries(recipe.cssVars)) {
    root.style.setProperty(name, token);
  }
  setMetaThemeColor(recipe.metaThemeColor);
}
