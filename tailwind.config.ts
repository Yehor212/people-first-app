import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

// Platform-adaptive variants: touch/mouse for input type, ios/android/desktop for platform
const platformVariants = plugin(({ addVariant }) => {
  addVariant("touch", "@media (pointer: coarse)");
  addVariant("mouse", "@media (hover: hover) and (pointer: fine)");
  addVariant("ios", "[data-platform='ios'] &");
  addVariant("android", "[data-platform='android'] &");
  addVariant("desktop", "[data-platform='web'] &");
});

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      /**
       * Phase 0-B typography slot families.
       *
       * Backed by CSS vars emitted from src/design-tokens/tokens.json via
       * Style Dictionary (src/generated/tokens.css). Hard-coded fallbacks
       * mirror the token values so these families still resolve during Vite
       * HMR before the generated CSS loads, and for static analysis tools.
       *
       * Slot policy (see docs/typography-grammar.md):
       *   sans / body  → Inter Variable   (hot path, font-display: optional)
       *   display      → Fraunces Variable (sacred moments, font-display: swap)
       *   serif        → alias of display  (prose, editorial)
       *   hand         → Caveat Variable   (gratitude, handwritten notes)
       *   mono         → system stack      (tabular numerics, future code blocks)
       *
       * `sans` is the Tailwind default alias (`font-sans` and base body copy)
       * so pre-existing classes that rely on Tailwind's system stack still
       * render — now via Inter Variable once loaded, with system fallback
       * preserved. Cross-platform Law 10 respected (iOS/Android/Desktop equal).
       */
      fontFamily: {
        sans: [
          '"Inter Variable"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          "system-ui",
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        body: [
          '"Inter Variable"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          "system-ui",
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        display: [
          '"Fraunces Variable"',
          '"Literata Variable"',
          "Georgia",
          "Cambria",
          '"Times New Roman"',
          "serif",
        ],
        serif: [
          '"Fraunces Variable"',
          '"Literata Variable"',
          "Georgia",
          "Cambria",
          '"Times New Roman"',
          "serif",
        ],
        hand: [
          '"Caveat Variable"',
          '"Comic Sans MS"',
          "cursive",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        /* Fluid typography: clamp(mobile, preferred, desktop) × --font-scale (user-controllable)
         * --font-scale defaults to 1 if not set. Range: 0.85–1.5 via in-app slider.
         * WCAG 1.4.4: rem bounds dominate at 200% zoom — compliant. */
        xs: [
          "calc(clamp(0.8125rem, 0.798rem + 0.06vw, 0.875rem) * var(--font-scale, 1))",
          { lineHeight: "calc(1.125rem * var(--font-scale, 1))" },
        ] /* 13→14px × scale */,
        sm: [
          "calc(clamp(0.9375rem, 0.917rem + 0.09vw, 1rem) * var(--font-scale, 1))",
          { lineHeight: "calc(1.375rem * var(--font-scale, 1))" },
        ] /* 15→16px × scale */,
        base: [
          "calc(clamp(1.0625rem, 1.022rem + 0.17vw, 1.1875rem) * var(--font-scale, 1))",
          { lineHeight: "calc(1.5625rem * var(--font-scale, 1))" },
        ] /* 17→19px × scale */,
        lg: [
          "calc(clamp(1.25rem, 1.189rem + 0.26vw, 1.4375rem) * var(--font-scale, 1))",
          { lineHeight: "calc(1.75rem * var(--font-scale, 1))" },
        ] /* 20→23px × scale */,
        xl: [
          "calc(clamp(1.375rem, 1.314rem + 0.26vw, 1.5625rem) * var(--font-scale, 1))",
          { lineHeight: "calc(1.875rem * var(--font-scale, 1))" },
        ] /* 22→25px × scale */,
        "2xl": [
          "calc(clamp(1.75rem, 1.648rem + 0.43vw, 2.0625rem) * var(--font-scale, 1))",
          { lineHeight: "calc(2.125rem * var(--font-scale, 1))" },
        ] /* 28→33px × scale */,
        "3xl": [
          "calc(clamp(2.125rem, 2.003rem + 0.52vw, 2.5rem) * var(--font-scale, 1))",
          { lineHeight: "calc(2.5rem * var(--font-scale, 1))" },
        ] /* 34→40px × scale */,
        "4xl": [
          "calc(clamp(2.5rem, 2.337rem + 0.69vw, 3rem) * var(--font-scale, 1))",
          { lineHeight: "1" },
        ] /* 40→48px × scale */,
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        mood: {
          great: "hsl(var(--mood-great))",
          good: "hsl(var(--mood-good))",
          okay: "hsl(var(--mood-okay))",
          bad: "hsl(var(--mood-bad))",
          terrible: "hsl(var(--mood-terrible))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        "zen-xs": "var(--zen-shadow-xs)",
        "zen-sm": "var(--zen-shadow-sm)",
        "zen-md": "var(--zen-shadow-md)",
        "zen-lg": "var(--zen-shadow-lg)",
        "zen-xl": "var(--zen-shadow-xl)",
        "zen-soft": "var(--zen-shadow-soft)",
        "zen-card": "var(--zen-shadow-card)",
        "zen-glow": "var(--zen-shadow-glow)",
        "zen-hover": "var(--zen-shadow-hover)",
      },
      height: {
        // @ts-expect-error — Tailwind accepts string[] for fallback values (100dvh with 100vh fallback)
        screen: ["100vh", "100dvh"],
      },
      minHeight: {
        // @ts-expect-error — Tailwind accepts string[] for fallback values
        screen: ["100vh", "100dvh"],
      },
      maxHeight: {
        // @ts-expect-error — Tailwind accepts string[] for fallback values
        screen: ["100vh", "100dvh"],
      },
      backgroundColor: {
        surface: "hsl(var(--surface-base))",
        "surface-raised": "hsl(var(--surface-raised))",
        "surface-elevated": "hsl(var(--surface-elevated))",
        "surface-overlay": "hsl(var(--surface-overlay))",
        "surface-glass": "var(--surface-glass)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "fraunces-soft-wobble": {
          "0%, 100%": { fontVariationSettings: '"SOFT" 0' },
          "50%": { fontVariationSettings: '"SOFT" 100' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "spin-slow": "spin-slow 20s linear infinite",
        twinkle: "twinkle 1.5s ease-in-out infinite",
        float: "float 2s ease-in-out infinite",
        "fraunces-soft-wobble": "fraunces-soft-wobble 800ms ease-out",
      },
    },
  },
  /* eslint-disable @typescript-eslint/no-require-imports */
  plugins: [
    // @ts-expect-error — CJS require for Tailwind plugins (no ESM export available)
    require("tailwindcss-animate"),
    // @ts-expect-error — CJS require for Tailwind plugins (no ESM export available)
    require("@tailwindcss/container-queries"),
    platformVariants,
  ],
  /* eslint-enable @typescript-eslint/no-require-imports */
} satisfies Config;
