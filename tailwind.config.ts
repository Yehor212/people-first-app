import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
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
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"',
          '"SF Pro Display"', 'system-ui', 'Roboto',
          '"Helvetica Neue"', 'Arial', 'sans-serif',
        ],
      },
      fontSize: {
        'xs':   ['0.8125rem', { lineHeight: '1.125rem' }],   /* 13px — Apple Caption */
        'sm':   ['0.9375rem', { lineHeight: '1.375rem' }],   /* 15px — Apple Secondary */
        'base': ['1.0625rem', { lineHeight: '1.5625rem' }],  /* 17px — Apple Body */
        'lg':   ['1.25rem',   { lineHeight: '1.75rem' }],    /* 20px — Apple Title 3 */
        'xl':   ['1.375rem',  { lineHeight: '1.875rem' }],   /* 22px — Apple Title 2 */
        '2xl':  ['1.75rem',   { lineHeight: '2.125rem' }],   /* 28px — Apple Title 1 */
        '3xl':  ['2.125rem',  { lineHeight: '2.5rem' }],     /* 34px — Apple Large Title */
        '4xl':  ['2.5rem',    { lineHeight: '1' }],          /* 40px — Display */
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
        'zen-xs': 'var(--zen-shadow-xs)',
        'zen-sm': 'var(--zen-shadow-sm)',
        'zen-md': 'var(--zen-shadow-md)',
        'zen-lg': 'var(--zen-shadow-lg)',
        'zen-xl': 'var(--zen-shadow-xl)',
        'zen-soft': 'var(--zen-shadow-soft)',
        'zen-card': 'var(--zen-shadow-card)',
        'zen-glow': 'var(--zen-shadow-glow)',
        'zen-hover': 'var(--zen-shadow-hover)',
      },
      height: {
        screen: ['100vh', '100dvh'],
      },
      minHeight: {
        screen: ['100vh', '100dvh'],
      },
      maxHeight: {
        screen: ['100vh', '100dvh'],
      },
      backgroundColor: {
        'surface': 'hsl(var(--surface-base))',
        'surface-raised': 'hsl(var(--surface-raised))',
        'surface-elevated': 'hsl(var(--surface-elevated))',
        'surface-overlay': 'hsl(var(--surface-overlay))',
        'surface-glass': 'var(--surface-glass)',
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "spin-slow": "spin-slow 20s linear infinite",
        twinkle: "twinkle 1.5s ease-in-out infinite",
        float: "float 2s ease-in-out infinite",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
