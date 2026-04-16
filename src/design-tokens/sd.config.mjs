/**
 * Style Dictionary v4 configuration — ZenFlow Phase 0-A → Phase 0-B
 *
 * Builds `src/design-tokens/tokens.json` (W3C DTCG format) into:
 *   - `src/generated/tokens.css`  — CSS custom properties under :root
 *   - `src/generated/tokens.ts`   — typed TS exports for runtime access
 *
 * Pipeline:
 *   tokens.json  →  Style Dictionary (DTCG preprocess + custom transforms)
 *                →  tokens.css (raw oklch() / rem / joined font-family strings)
 *                →  (Vite build) PostCSS @csstools/postcss-oklab-function
 *                →  dist CSS with rgb() fallback + oklch() in cascade
 *
 * DTCG $value shapes we handle:
 *   - color        → {colorSpace, components[], alpha?} → oklch(L C H / A)
 *   - fontFamily   → string | string[]                   → joined CSS stack w/ quoted multi-word names
 *   - dimension    → {value, unit}                       → `${value}${unit}` e.g. "1.125rem"
 *   - fontWeight   → number | string                     → passthrough (CSS accepts both)
 *   - number       → number                              → passthrough
 *
 * Phase 0-B adds typography tokens (family, scale, weight, leading, tracking).
 * Colors in src/index.css remain the source of truth until Phase 2-B.
 *
 * Docs: https://styledictionary.com/ (v4), DTCG spec 2025-10-28
 */

import StyleDictionary from "style-dictionary";
import { fileHeader } from "style-dictionary/utils";

// ---------- DTCG $value helpers ----------

/**
 * DTCG allows color $value to be either:
 *   1. Legacy string:  "#ffffff" | "rgb(...)" | "oklch(...)"
 *   2. Structured:     { colorSpace: "oklch", components: [L, C, H] }
 *
 * We normalise the structured form to CSS `oklch(L C H)` syntax and pass
 * strings through unchanged.
 *
 * Spec: https://design-tokens.github.io/community-group/format/#color
 */
function dtcgColorToCss(value) {
  if (value == null) return value;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.colorSpace && Array.isArray(value.components)) {
    const [a, b, c] = value.components;
    const alpha = typeof value.alpha === "number" && value.alpha < 1 ? ` / ${value.alpha}` : "";
    switch (value.colorSpace) {
      case "oklch":
        return `oklch(${a} ${b} ${c}${alpha})`;
      case "oklab":
        return `oklab(${a} ${b} ${c}${alpha})`;
      case "srgb":
        return `rgb(${a} ${b} ${c}${alpha})`;
      case "hsl":
        return `hsl(${a} ${b}% ${c}%${alpha})`;
      default:
        throw new Error(
          `[sd.config] Unsupported DTCG colorSpace "${value.colorSpace}". ` +
            `Extend dtcgColorToCss() in src/design-tokens/sd.config.mjs.`,
        );
    }
  }
  return value;
}

/**
 * DTCG fontFamily $value:
 *   - string   → single name
 *   - string[] → ordered preference list (first = most preferred)
 *
 * CSS serialisation rule: font names containing whitespace MUST be quoted;
 * single-word names SHOULD stay unquoted (helps with CSS generic families
 * like `serif`, `sans-serif`, `cursive`, `monospace` which MUST NOT be
 * quoted to retain their generic semantics).
 *
 * Spec: https://design-tokens.github.io/community-group/format/#font-family
 */
function dtcgFontFamilyToCss(value) {
  if (value == null) return value;
  const names = Array.isArray(value) ? value : [value];
  return names
    .map((name) => {
      const str = String(name);
      // Quote any name containing whitespace OR non-identifier characters,
      // but leave generic CSS families unquoted per CSS Fonts Module Level 4.
      return /\s|[^\w-]/.test(str) ? `"${str}"` : str;
    })
    .join(", ");
}

/**
 * DTCG dimension $value: { value: number, unit: "px" | "rem" | "em" | ... }
 * Emit `{value}{unit}`, e.g. `{ value: 1.125, unit: "rem" }` → "1.125rem".
 * "em" is outside the DTCG spec (spec lists px + rem) but pragmatic for
 * letter-spacing tokens. Style Dictionary does not restrict units server-side.
 */
function dtcgDimensionToCss(value) {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object" && "value" in value && "unit" in value) {
    return `${value.value}${value.unit}`;
  }
  return value;
}

// ---------- Custom transforms ----------

// Convert DTCG structured color $value → CSS color() function
StyleDictionary.registerTransform({
  name: "zen/color/dtcg-to-css",
  type: "value",
  transitive: true,
  filter: (token) => token.$type === "color" || token.type === "color",
  transform: (token) => dtcgColorToCss(token.$value ?? token.value),
});

// Convert DTCG fontFamily $value → CSS-ready comma-joined string with quoting
StyleDictionary.registerTransform({
  name: "zen/fontFamily/dtcg-to-css",
  type: "value",
  transitive: true,
  filter: (token) => token.$type === "fontFamily" || token.type === "fontFamily",
  transform: (token) => dtcgFontFamilyToCss(token.$value ?? token.value),
});

// Convert DTCG dimension $value → CSS-ready length string (e.g. "1.125rem")
StyleDictionary.registerTransform({
  name: "zen/dimension/dtcg-to-css",
  type: "value",
  transitive: true,
  filter: (token) => token.$type === "dimension" || token.type === "dimension",
  transform: (token) => dtcgDimensionToCss(token.$value ?? token.value),
});

// Filter out _placeholder tokens from generated output — they document future
// categories but should not emit CSS vars or TS exports.
function isRealToken(token) {
  return !token.path.some((segment) => segment.startsWith("_"));
}

// ---------- Custom TS format ----------

StyleDictionary.registerFormat({
  name: "zen/typescript/tokens",
  format: async ({ dictionary, file }) => {
    const header = await fileHeader({ file });
    const entries = dictionary.allTokens
      .filter(isRealToken)
      .map((token) => {
        const key = token.path.join(".");
        const value = JSON.stringify(token.$value ?? token.value);
        const jsdoc = token.$description ?? token.comment ?? "";
        const commentBlock = jsdoc ? `  /** ${jsdoc.replace(/\*\//g, "*\\/")} */\n` : "";
        return `${commentBlock}  ${JSON.stringify(key)}: ${value}`;
      })
      .join(",\n");

    return `${header}// AUTO-GENERATED by Style Dictionary (src/design-tokens/sd.config.mjs). DO NOT EDIT.\n// Source: src/design-tokens/tokens.json\n\nexport const tokens = {\n${entries},\n} as const;\n\nexport type TokenKey = keyof typeof tokens;\nexport type TokenValue = (typeof tokens)[TokenKey];\n`;
  },
});

// ---------- Custom CSS format (filters placeholders) ----------

StyleDictionary.registerFormat({
  name: "zen/css/variables",
  format: async ({ dictionary, file }) => {
    const header = await fileHeader({ file });
    const vars = dictionary.allTokens
      .filter(isRealToken)
      .map((token) => `  --${token.name}: ${token.$value ?? token.value};`)
      .join("\n");
    return `${header}/* AUTO-GENERATED by Style Dictionary (src/design-tokens/sd.config.mjs). DO NOT EDIT. */\n/* Source: src/design-tokens/tokens.json */\n\n:root {\n${vars}\n}\n`;
  },
});

// ---------- Config ----------

export default {
  // DTCG $value/$type/$description support (Style Dictionary v4 built-in)
  preprocessors: ["tokens-studio"],
  source: ["src/design-tokens/tokens.json"],
  log: {
    verbosity: "default",
    warnings: "warn",
    errors: { brokenReferences: "throw" },
  },
  platforms: {
    css: {
      transforms: [
        "attribute/cti",
        "name/kebab",
        "zen/color/dtcg-to-css",
        "zen/fontFamily/dtcg-to-css",
        "zen/dimension/dtcg-to-css",
      ],
      buildPath: "src/generated/",
      files: [
        {
          destination: "tokens.css",
          format: "zen/css/variables",
        },
      ],
    },
    ts: {
      transforms: [
        "attribute/cti",
        "name/kebab",
        "zen/color/dtcg-to-css",
        "zen/fontFamily/dtcg-to-css",
        "zen/dimension/dtcg-to-css",
      ],
      buildPath: "src/generated/",
      files: [
        {
          destination: "tokens.ts",
          format: "zen/typescript/tokens",
        },
      ],
    },
  },
};
