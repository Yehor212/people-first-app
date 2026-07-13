export type AppliedTheme = "paper" | "ink" | "oled";

export type ThemeAccentFamily = "green" | "blue" | "violet" | "amber";

export interface ThemeCustomization {
  schemaVersion: 1;
  accentFamily: ThemeAccentFamily;
  highContrast: boolean;
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
  schemaVersion: 1,
  accentFamily: "green",
  highContrast: false,
});

export const THEME_ACCENT_FAMILIES: Array<ThemeCustomizationOption<ThemeAccentFamily>> = [
  { id: "green", labelKey: "themeAccentTeal" },
  { id: "blue", labelKey: "themeAccentClay" },
  { id: "violet", labelKey: "themeAccentPlum" },
  { id: "amber", labelKey: "themeAccentAmber" },
];

const ACCENT_IDS = new Set<ThemeAccentFamily>(
  THEME_ACCENT_FAMILIES.map((option) => option.id),
);

const LEGACY_ACCENT_MAP: Record<string, ThemeAccentFamily> = {
  teal: "green",
  moss: "green",
  clay: "amber",
  plum: "violet",
  amber: "amber",
};

const LEGACY_PALETTE_MAP: Record<string, ThemeAccentFamily> = {
  zenflow: "green",
  morningHearth: "amber",
  velvetLibrary: "violet",
  botanicalPulse: "green",
  quietOled: "green",
};

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
  "--settings-v2-text-strong",
  "--settings-v2-text-muted",
  "--settings-v2-focus",
  "--ring",
  "--primary",
  "--primary-foreground",
  "--zen-shadow-card",
  "--zen-shadow-hover",
] as const;

const ACCENTS: Record<AppliedTheme, Record<ThemeAccentFamily, string>> = {
  paper: {
    green: "154 48% 28%",
    blue: "215 68% 38%",
    violet: "267 48% 38%",
    amber: "34 72% 30%",
  },
  ink: {
    green: "154 42% 72%",
    blue: "211 76% 72%",
    violet: "268 62% 78%",
    amber: "42 76% 70%",
  },
  oled: {
    green: "154 42% 72%",
    blue: "211 76% 72%",
    violet: "268 62% 78%",
    amber: "42 76% 70%",
  },
};

const META_THEME_COLORS: Record<AppliedTheme, string> = {
  paper: "#f6f4ef",
  ink: "#111613",
  oled: "#000000",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isThemeAccent(value: unknown): value is ThemeAccentFamily {
  return typeof value === "string" && ACCENT_IDS.has(value as ThemeAccentFamily);
}

function legacyAccentFor(source: Record<string, unknown>): ThemeAccentFamily {
  if (typeof source.accentFamily === "string" && LEGACY_ACCENT_MAP[source.accentFamily]) {
    return LEGACY_ACCENT_MAP[source.accentFamily];
  }
  if (typeof source.paletteId === "string" && LEGACY_PALETTE_MAP[source.paletteId]) {
    return LEGACY_PALETTE_MAP[source.paletteId];
  }
  return DEFAULT_THEME_CUSTOMIZATION.accentFamily;
}

export function normalizeThemeCustomization(value: unknown): ThemeCustomization {
  if (!isRecord(value)) return { ...DEFAULT_THEME_CUSTOMIZATION };

  if (value.schemaVersion === 1) {
    return {
      schemaVersion: 1,
      accentFamily: isThemeAccent(value.accentFamily)
        ? value.accentFamily
        : DEFAULT_THEME_CUSTOMIZATION.accentFamily,
      highContrast:
        typeof value.highContrast === "boolean"
          ? value.highContrast
          : DEFAULT_THEME_CUSTOMIZATION.highContrast,
    };
  }

  return {
    schemaVersion: 1,
    accentFamily: legacyAccentFor(value),
    highContrast: value.contrastMode === "high" || value.reduceTransparency === true,
  };
}

function primaryForeground(appliedTheme: AppliedTheme): string {
  return appliedTheme === "paper" ? "0 0% 100%" : "165 20% 8%";
}

function highContrastVars(appliedTheme: AppliedTheme): Record<string, string> {
  if (appliedTheme === "paper") {
    return {
      "--settings-v2-shell": "50 30% 98%",
      "--settings-v2-card": "50 20% 96%",
      "--settings-v2-panel": "150 16% 90%",
      "--settings-v2-border": "165 18% 28%",
      "--settings-v2-text-strong": "165 35% 8%",
      "--settings-v2-text-muted": "165 22% 24%",
      "--settings-v2-focus": "165 35% 8%",
      "--settings-v2-card-alpha": "1",
      "--settings-v2-panel-alpha": "1",
      "--settings-v2-shell-alpha": "1",
      "--settings-v2-glass-blur": "0px",
      "--settings-v2-rim-alpha": "0.08",
    };
  }

  return {
    "--settings-v2-shell": "170 14% 5%",
    "--settings-v2-card": "170 12% 9%",
    "--settings-v2-panel": "170 10% 14%",
    "--settings-v2-border": "150 12% 70%",
    "--settings-v2-text-strong": "45 20% 98%",
    "--settings-v2-text-muted": "45 12% 82%",
    "--settings-v2-focus": "45 20% 98%",
    "--settings-v2-card-alpha": "1",
    "--settings-v2-panel-alpha": "1",
    "--settings-v2-shell-alpha": "1",
    "--settings-v2-glass-blur": "0px",
    "--settings-v2-rim-alpha": "0.08",
  };
}

export function getThemeCustomizationRecipe(
  appliedTheme: AppliedTheme,
  value: ThemeCustomization,
): ThemeCustomizationRecipe {
  const customization = normalizeThemeCustomization(value);
  const accent = ACCENTS[appliedTheme][customization.accentFamily];

  return {
    cssVars: {
      ...(customization.highContrast ? highContrastVars(appliedTheme) : {}),
      "--settings-v2-accent": accent,
      "--ring": accent,
      "--primary": accent,
      "--primary-foreground": primaryForeground(appliedTheme),
    },
    metaThemeColor: META_THEME_COLORS[appliedTheme],
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

  delete root.dataset.themeStyle;
  delete root.dataset.themeIntensity;
  delete root.dataset.themeDepth;
  delete root.dataset.themeComfort;
  delete root.dataset.themeTransparency;
  delete root.dataset.themeGlow;
  root.dataset.themeAccent = customization.accentFamily;
  root.dataset.themeContrast = customization.highContrast ? "high" : "standard";

  for (const [name, token] of Object.entries(recipe.cssVars)) {
    root.style.setProperty(name, token);
  }
  setMetaThemeColor(recipe.metaThemeColor);
}
