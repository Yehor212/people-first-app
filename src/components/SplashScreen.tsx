import type { CSSProperties } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { safeJsonParse, storageGetRaw } from "@/lib/safeJson";
import { PremiumLoader } from "@/components/PremiumLoader";

interface SplashScreenProps {
  loadingFadeOut: boolean;
  subtitle: string;
  theme?: SplashThemePreference;
  instant?: boolean;
}

type SplashTheme = "paper" | "ink" | "oled";
export type SplashThemePreference = SplashTheme | "auto";
type StoredThemeState = {
  state?: {
    theme?: SplashThemePreference;
  };
};
type BokehOrb = {
  className: string;
  style: CSSProperties;
};
type NightThread = {
  className: string;
  style: CSSProperties;
};

const THEME_STORAGE_KEY = "zenflow:theme-v0c";

function resolveAutoTheme(): SplashTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "paper";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "ink" : "paper";
}

function resolveSplashTheme(theme: SplashThemePreference = "auto"): SplashTheme {
  if (theme === "paper" || theme === "ink" || theme === "oled") {
    return theme;
  }

  if (typeof document !== "undefined") {
    const htmlTheme = document.documentElement.dataset.theme;
    if (htmlTheme === "paper" || htmlTheme === "ink" || htmlTheme === "oled") {
      return htmlTheme;
    }
  }

  const persistedTheme = safeJsonParse<StoredThemeState>(
    storageGetRaw(THEME_STORAGE_KEY, ""),
    {},
  ).state?.theme;

  if (persistedTheme === "paper" || persistedTheme === "ink" || persistedTheme === "oled") {
    return persistedTheme;
  }

  if (persistedTheme === "auto") {
    return resolveAutoTheme();
  }

  const legacyTheme = storageGetRaw("zenflow-theme", "");
  if (legacyTheme === "dark") return "ink";
  if (legacyTheme === "light") return "paper";

  return resolveAutoTheme();
}

const splashThemeVars: Record<SplashTheme, CSSProperties> = {
  paper: {
    "--splash-bg": "hsl(var(--zf-night-0))",
    "--splash-bg-deep": "hsl(var(--zf-night-0))",
    "--splash-bg-warm": "hsl(var(--zf-night-1))",
    "--splash-copy": "hsl(var(--zf-text-strong))",
    "--splash-muted": "hsl(var(--zf-text-soft))",
    "--splash-ring": "hsl(var(--zf-primary) / 0.18)",
    "--splash-dot": "hsl(var(--zf-primary))",
    "--splash-ambient-a": "hsl(var(--zf-primary) / 0.1)",
    "--splash-ambient-b": "hsl(var(--zf-growth) / 0.08)",
    "--splash-atmosphere": "hsl(var(--zf-primary) / 0.08)",
    "--splash-atmosphere-opacity": "0.46",
    "--splash-horizon": "hsl(var(--zf-primary) / 0.16)",
    "--splash-day-topbar": "hsl(var(--zf-primary) / 0.72)",
    "--splash-day-depth-core": "hsl(var(--zf-primary) / 0.1)",
    "--splash-day-depth-warm": "hsl(var(--zf-memory) / 0.05)",
    "--splash-day-depth-edge": "hsl(var(--zf-night-0) / 0.34)",
    "--splash-day-aurora-a": "hsl(var(--zf-primary) / 0.1)",
    "--splash-day-aurora-b": "hsl(var(--zf-memory) / 0.05)",
    "--splash-day-bubble-a": "hsl(var(--zf-primary) / 0.05)",
    "--splash-day-bubble-b": "hsl(var(--zf-primary) / 0.07)",
    "--splash-day-bubble-c": "hsl(var(--zf-primary) / 0.04)",
    "--splash-logo-shadow": "hsl(var(--zf-primary) / 0.28)",
    "--splash-logo-stop-1": "var(--color-mood-great)",
    "--splash-logo-stop-2": "var(--color-surface-primary)",
    "--splash-logo-stop-3": "var(--color-mood-good)",
    "--splash-logo-highlight-opacity": "0.12",
    "--splash-logo-leaf-glow-opacity": "0.18",
    "--splash-logo-leaf-fill-opacity": "0.18",
    "--splash-logo-glyph-opacity": "0.92",
    "--splash-loader-shadow": "hsl(var(--zf-primary) / 0.36)",
    "--premium-loader-foundation-opacity": "0.2",
    "--premium-loader-mid-opacity": "0.3",
    "--premium-loader-base-line-opacity": "0.28",
    "--premium-loader-trail-opacity": "0.42",
    "--premium-loader-core-opacity": "1",
    "--premium-loader-stop-1": "var(--color-mood-terrible)",
    "--premium-loader-stop-2": "var(--color-mood-bad)",
    "--premium-loader-stop-3": "var(--color-mood-okay)",
    "--premium-loader-stop-4": "var(--color-mood-good)",
    "--premium-loader-stop-5": "var(--color-mood-great)",
  } as CSSProperties,
  ink: {
    "--splash-bg": "var(--color-theme-ink-surface)",
    "--splash-bg-deep": "color-mix(in oklab, var(--color-theme-ink-surface) 72%, var(--color-theme-oled-surface))",
    "--splash-bg-warm": "color-mix(in oklab, var(--color-theme-ink-surface-card) 70%, var(--color-theme-ink-surface))",
    "--splash-copy": "var(--color-theme-ink-ink)",
    "--splash-muted": "var(--color-theme-ink-ink-muted)",
    "--splash-ring": "color-mix(in oklab, var(--color-theme-ink-primary) 28%, transparent)",
    "--splash-dot": "var(--color-theme-ink-primary)",
    "--splash-ambient-a": "color-mix(in oklab, var(--color-theme-ink-primary) 13%, transparent)",
    "--splash-ambient-b": "color-mix(in oklab, var(--color-mood-great) 8%, transparent)",
    "--splash-atmosphere": "color-mix(in oklab, var(--color-theme-ink-primary) 11%, transparent)",
    "--splash-atmosphere-opacity": "0.38",
    "--splash-horizon": "color-mix(in oklab, var(--color-theme-ink-border) 20%, transparent)",
    "--splash-night-depth-core": "color-mix(in oklab, var(--color-theme-ink-primary) 9%, transparent)",
    "--splash-night-depth-warm": "color-mix(in oklab, var(--color-mood-okay) 11%, transparent)",
    "--splash-night-depth-edge": "color-mix(in oklab, var(--color-theme-ink-surface-card) 34%, transparent)",
    "--splash-night-ribbon-a": "color-mix(in oklab, var(--color-mood-good) 13%, transparent)",
    "--splash-night-ribbon-b": "color-mix(in oklab, var(--color-mood-bad) 10%, transparent)",
    "--splash-night-orb-a": "color-mix(in oklab, var(--color-mood-okay) 15%, transparent)",
    "--splash-night-orb-b": "color-mix(in oklab, var(--color-mood-good) 12%, transparent)",
    "--splash-night-orb-c": "color-mix(in oklab, var(--color-mood-bad) 10%, transparent)",
    "--splash-night-orb-d": "color-mix(in oklab, var(--color-theme-ink-primary) 12%, transparent)",
    "--splash-night-spark": "color-mix(in oklab, var(--color-theme-ink-primary) 30%, transparent)",
    "--splash-night-thread": "color-mix(in oklab, var(--color-theme-ink-ink) 10%, transparent)",
    "--splash-logo-shadow": "color-mix(in oklab, var(--color-theme-paper-primary) 34%, transparent)",
    "--splash-logo-stop-1": "var(--color-mood-great)",
    "--splash-logo-stop-2": "var(--color-surface-primary)",
    "--splash-logo-stop-3": "var(--color-mood-good)",
    "--splash-logo-highlight-opacity": "0.12",
    "--splash-logo-leaf-glow-opacity": "0.18",
    "--splash-logo-leaf-fill-opacity": "0.18",
    "--splash-logo-glyph-opacity": "0.92",
    "--splash-loader-shadow": "color-mix(in oklab, var(--color-mood-great) 26%, transparent)",
    "--premium-loader-stop-1": "var(--color-mood-terrible)",
    "--premium-loader-stop-2": "var(--color-mood-bad)",
    "--premium-loader-stop-3": "var(--color-mood-okay)",
    "--premium-loader-stop-4": "var(--color-mood-good)",
    "--premium-loader-stop-5": "var(--color-mood-great)",
  } as CSSProperties,
  oled: {
    "--splash-bg": "var(--color-theme-oled-surface)",
    "--splash-bg-deep": "var(--color-theme-oled-surface)",
    "--splash-bg-warm": "var(--color-theme-oled-surface-card)",
    "--splash-copy": "var(--color-theme-oled-ink)",
    "--splash-muted": "var(--color-theme-oled-ink-muted)",
    "--splash-ring": "color-mix(in oklab, var(--color-theme-oled-primary) 30%, transparent)",
    "--splash-dot": "var(--color-theme-oled-primary)",
    "--splash-ambient-a": "color-mix(in oklab, var(--color-theme-oled-primary) 14%, transparent)",
    "--splash-ambient-b": "color-mix(in oklab, var(--color-mood-great) 9%, transparent)",
    "--splash-atmosphere": "color-mix(in oklab, var(--color-theme-oled-primary) 9%, transparent)",
    "--splash-atmosphere-opacity": "0.34",
    "--splash-horizon": "color-mix(in oklab, var(--color-theme-oled-border) 22%, transparent)",
    "--splash-night-depth-core": "color-mix(in oklab, var(--color-theme-oled-primary) 8%, transparent)",
    "--splash-night-depth-warm": "color-mix(in oklab, var(--color-mood-okay) 9%, transparent)",
    "--splash-night-depth-edge": "color-mix(in oklab, var(--color-theme-oled-surface-card) 28%, transparent)",
    "--splash-night-ribbon-a": "color-mix(in oklab, var(--color-mood-good) 11%, transparent)",
    "--splash-night-ribbon-b": "color-mix(in oklab, var(--color-mood-bad) 8%, transparent)",
    "--splash-night-orb-a": "color-mix(in oklab, var(--color-mood-okay) 13%, transparent)",
    "--splash-night-orb-b": "color-mix(in oklab, var(--color-mood-good) 10%, transparent)",
    "--splash-night-orb-c": "color-mix(in oklab, var(--color-mood-bad) 8%, transparent)",
    "--splash-night-orb-d": "color-mix(in oklab, var(--color-theme-oled-primary) 10%, transparent)",
    "--splash-night-spark": "color-mix(in oklab, var(--color-theme-oled-primary) 24%, transparent)",
    "--splash-night-thread": "color-mix(in oklab, var(--color-theme-oled-ink) 8%, transparent)",
    "--splash-logo-shadow": "color-mix(in oklab, var(--color-theme-paper-primary) 34%, transparent)",
    "--splash-logo-stop-1": "var(--color-mood-great)",
    "--splash-logo-stop-2": "var(--color-surface-primary)",
    "--splash-logo-stop-3": "var(--color-mood-good)",
    "--splash-logo-highlight-opacity": "0.12",
    "--splash-logo-leaf-glow-opacity": "0.18",
    "--splash-logo-leaf-fill-opacity": "0.18",
    "--splash-logo-glyph-opacity": "0.92",
    "--splash-loader-shadow": "color-mix(in oklab, var(--color-mood-great) 22%, transparent)",
    "--premium-loader-stop-1": "var(--color-mood-terrible)",
    "--premium-loader-stop-2": "var(--color-mood-bad)",
    "--premium-loader-stop-3": "var(--color-mood-okay)",
    "--premium-loader-stop-4": "var(--color-mood-good)",
    "--premium-loader-stop-5": "var(--color-mood-great)",
  } as CSSProperties,
};

const daySceneBubbles: BokehOrb[] = [
  {
    className: "splash-day-bubble absolute h-24 w-24 rounded-full",
    style: {
      top: "20%",
      left: "15%",
      "--splash-orb-tone": "var(--splash-day-bubble-a)",
      "--splash-orb-duration": "6s",
      "--splash-orb-delay": "0s",
      "--splash-orb-x": "0",
      "--splash-orb-y": "-1rem",
    } as CSSProperties,
  },
  {
    className: "splash-day-bubble absolute h-16 w-16 rounded-full",
    style: {
      top: "15%",
      right: "20%",
      "--splash-orb-tone": "var(--splash-day-bubble-b)",
      "--splash-orb-duration": "7s",
      "--splash-orb-delay": "-2s",
      "--splash-orb-x": "0",
      "--splash-orb-y": "-1rem",
    } as CSSProperties,
  },
  {
    className: "splash-day-bubble absolute h-20 w-20 rounded-full",
    style: {
      bottom: "25%",
      left: "20%",
      "--splash-orb-tone": "var(--splash-day-bubble-c)",
      "--splash-orb-duration": "5s",
      "--splash-orb-delay": "-1s",
      "--splash-orb-x": "0",
      "--splash-orb-y": "-1rem",
    } as CSSProperties,
  },
  {
    className: "splash-day-bubble absolute h-14 w-14 rounded-full",
    style: {
      right: "15%",
      bottom: "20%",
      "--splash-orb-tone": "var(--splash-day-bubble-a)",
      "--splash-orb-duration": "8s",
      "--splash-orb-delay": "-3s",
      "--splash-orb-x": "0",
      "--splash-orb-y": "-1rem",
    } as CSSProperties,
  },
  {
    className: "splash-day-bubble splash-day-bubble--small absolute h-10 w-10 rounded-full",
    style: {
      top: "45%",
      left: "10%",
      "--splash-orb-tone": "var(--splash-day-bubble-c)",
      "--splash-orb-duration": "6.5s",
      "--splash-orb-delay": "-4s",
      "--splash-orb-x": "0",
      "--splash-orb-y": "-1rem",
    } as CSSProperties,
  },
  {
    className: "splash-day-bubble splash-day-bubble--small absolute h-12 w-12 rounded-full",
    style: {
      top: "40%",
      right: "10%",
      "--splash-orb-tone": "var(--splash-day-bubble-a)",
      "--splash-orb-duration": "7.5s",
      "--splash-orb-delay": "-2.5s",
      "--splash-orb-x": "0",
      "--splash-orb-y": "-1rem",
    } as CSSProperties,
  },
];

const nightSceneOrbs: BokehOrb[] = [
  {
    className: "splash-night-orb absolute h-40 w-40 rounded-full",
    style: {
      top: "14%",
      left: "7%",
      "--splash-orb-tone": "var(--splash-night-orb-a)",
      "--splash-orb-duration": "13s",
      "--splash-orb-delay": "-1s",
      "--splash-orb-x": "0.9rem",
      "--splash-orb-y": "-1.2rem",
    } as CSSProperties,
  },
  {
    className: "splash-night-orb absolute h-32 w-32 rounded-full",
    style: {
      top: "12%",
      right: "16%",
      "--splash-orb-tone": "var(--splash-night-orb-b)",
      "--splash-orb-duration": "15s",
      "--splash-orb-delay": "-4s",
      "--splash-orb-x": "-1rem",
      "--splash-orb-y": "0.7rem",
    } as CSSProperties,
  },
  {
    className: "splash-night-orb absolute h-36 w-36 rounded-full",
    style: {
      bottom: "18%",
      left: "12%",
      "--splash-orb-tone": "var(--splash-night-orb-c)",
      "--splash-orb-duration": "16s",
      "--splash-orb-delay": "-8s",
      "--splash-orb-x": "1.1rem",
      "--splash-orb-y": "0.8rem",
    } as CSSProperties,
  },
  {
    className: "splash-night-orb absolute h-28 w-28 rounded-full",
    style: {
      right: "11%",
      bottom: "17%",
      "--splash-orb-tone": "var(--splash-night-orb-a)",
      "--splash-orb-duration": "14s",
      "--splash-orb-delay": "-6s",
      "--splash-orb-x": "-0.7rem",
      "--splash-orb-y": "-1rem",
    } as CSSProperties,
  },
  {
    className: "splash-night-orb splash-night-orb--small absolute h-20 w-20 rounded-full",
    style: {
      top: "42%",
      left: "5%",
      "--splash-orb-tone": "var(--splash-night-orb-d)",
      "--splash-orb-duration": "12s",
      "--splash-orb-delay": "-3s",
      "--splash-orb-x": "0.55rem",
      "--splash-orb-y": "-0.8rem",
    } as CSSProperties,
  },
  {
    className: "splash-night-orb splash-night-orb--small absolute h-24 w-24 rounded-full",
    style: {
      top: "39%",
      right: "6%",
      "--splash-orb-tone": "var(--splash-night-orb-b)",
      "--splash-orb-duration": "17s",
      "--splash-orb-delay": "-10s",
      "--splash-orb-x": "-0.8rem",
      "--splash-orb-y": "0.55rem",
    } as CSSProperties,
  },
];

const nightSceneThreads: NightThread[] = [
  {
    className: "splash-night-thread absolute h-px w-[72vw]",
    style: {
      top: "28%",
      left: "-12%",
      "--splash-thread-rotate": "-14deg",
      "--splash-thread-delay": "-1s",
    } as CSSProperties,
  },
  {
    className: "splash-night-thread absolute h-px w-[68vw]",
    style: {
      right: "-16%",
      bottom: "31%",
      "--splash-thread-rotate": "16deg",
      "--splash-thread-delay": "-5s",
    } as CSSProperties,
  },
];

function DaySplashBackground() {
  return (
    <>
      <div className="splash-day-topbar pointer-events-none absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
      <div
        className="splash-day-depth pointer-events-none absolute inset-0"
        style={
          {
            background: [
              "radial-gradient(ellipse 60% 50% at 50% 30%, var(--splash-day-depth-core) 0%, transparent 70%)",
            ].join(", "),
            "--zen-glow-min": "0.4",
            "--zen-glow-max": "0.8",
          } as CSSProperties
        }
        aria-hidden="true"
      />
      <div className="splash-day-aurora pointer-events-none absolute inset-[-12%]" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        data-testid="splash-day-green-background"
        aria-hidden="true"
      >
        {daySceneBubbles.map((bubble, index) => (
          <div key={index} className={bubble.className} style={bubble.style} data-testid="splash-day-bubble" />
        ))}
      </div>
    </>
  );
}

function NightSplashBackground() {
  return (
    <>
      <div
        className="splash-night-depth pointer-events-none absolute inset-0"
        style={
          {
            background: [
              "radial-gradient(ellipse 72% 58% at 50% 42%, var(--splash-night-depth-core) 0%, transparent 66%)",
              "radial-gradient(circle at 25% 25%, var(--splash-night-depth-warm) 0%, transparent 26%)",
              "radial-gradient(circle at 76% 22%, var(--splash-night-ribbon-a) 0%, transparent 28%)",
              "radial-gradient(circle at 28% 72%, var(--splash-night-ribbon-b) 0%, transparent 28%)",
              "radial-gradient(ellipse 92% 72% at 50% 108%, var(--splash-night-depth-edge) 0%, transparent 62%)",
            ].join(", "),
            "--zen-glow-min": "0.72",
            "--zen-glow-max": "1",
          } as CSSProperties
        }
        aria-hidden="true"
      />
      <div
        className="splash-night-ribbon splash-night-ribbon--a pointer-events-none absolute inset-[-12%]"
        aria-hidden="true"
      />
      <div
        className="splash-night-ribbon splash-night-ribbon--b pointer-events-none absolute inset-[-14%]"
        aria-hidden="true"
      />
      <div className="splash-night-vellum pointer-events-none absolute inset-[-10%]" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        data-testid="splash-night-background"
        aria-hidden="true"
      >
        {nightSceneOrbs.map((orb, index) => (
          <div key={index} className={orb.className} style={orb.style} data-testid="splash-night-bokeh-orb">
            <span className="splash-night-orb__core absolute rounded-full" />
          </div>
        ))}
        {nightSceneThreads.map((thread, index) => (
          <div key={index} className={thread.className} style={thread.style} />
        ))}
      </div>
      <div className="splash-night-focus-well pointer-events-none absolute inset-0" aria-hidden="true" />
    </>
  );
}

export function SplashScreen({
  loadingFadeOut,
  subtitle,
  theme = "auto",
  instant = false,
}: SplashScreenProps) {
  const { t } = useLanguage();
  const splashTheme = resolveSplashTheme(theme);
  const isNightBackground = splashTheme === "ink" || splashTheme === "oled";

  return (
    <div
      key="loading"
      data-testid="splash-theme-shell"
      data-splash-theme={splashTheme}
      data-splash-instant={instant ? "true" : "false"}
      data-splash-scene={isNightBackground ? "night" : "day"}
      data-splash-fade-out={loadingFadeOut ? "true" : "false"}
      className="splash-theme-shell fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-[var(--splash-bg)] text-[var(--splash-copy)] will-change-transform"
      style={splashThemeVars[splashTheme]}
      aria-live="polite"
    >
      {isNightBackground ? (
        <NightSplashBackground />
      ) : (
        <DaySplashBackground />
      )}

      <div
        className="splash-brand-logo relative z-10 mb-[24px] flex h-[80px] w-[80px] shrink-0 items-center justify-center"
        data-testid="splash-brand-logo"
      >
        {!isNightBackground ? (
          <div
            className="splash-logo-ring pointer-events-none absolute left-1/2 top-1/2 h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            data-testid="splash-day-logo-ring"
            aria-hidden="true"
          />
        ) : null}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          width="80"
          height="80"
          className="relative z-10 drop-shadow-[0_1.1rem_2.6rem_var(--splash-logo-shadow)]"
          role="img"
          aria-label="ZenFlow"
        >
          <defs>
            <linearGradient id="splashLogoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--splash-logo-stop-1)" />
              <stop offset="55%" stopColor="var(--splash-logo-stop-2)" />
              <stop offset="100%" stopColor="var(--splash-logo-stop-3)" />
            </linearGradient>
            <radialGradient id="splashLogoHighlight" cx="35%" cy="35%" r="60%">
              <stop offset="0%" stopColor="white" stopOpacity="var(--splash-logo-highlight-opacity)" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="splashLeafGlow" cx="50%" cy="45%" r="35%">
              <stop offset="0%" stopColor="white" stopOpacity="var(--splash-logo-leaf-glow-opacity)" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect
            x="16"
            y="16"
            width="480"
            height="480"
            rx="100"
            ry="100"
            fill="url(#splashLogoBgGrad)"
          />
          <rect
            x="16"
            y="16"
            width="480"
            height="480"
            rx="100"
            ry="100"
            fill="url(#splashLogoHighlight)"
          />
          <ellipse cx="256" cy="240" rx="130" ry="130" fill="url(#splashLeafGlow)" />
          <g transform="translate(106, 96) scale(12.5)">
            <path
              d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
              fill="white"
              fillOpacity="var(--splash-logo-leaf-fill-opacity)"
              stroke="white"
              strokeOpacity="var(--splash-logo-glyph-opacity)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
              fill="none"
              stroke="white"
              strokeOpacity="var(--splash-logo-glyph-opacity)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <circle cx="340" cy="140" r="3" fill="white" opacity="0.4" />
          <circle cx="345" cy="135" r="1.5" fill="white" opacity="0.6" />
        </svg>
      </div>

      <h1
        aria-label="ZenFlow"
        dir="ltr"
        className="splash-title relative z-10 flex max-w-[calc(100vw-2rem)] flex-wrap justify-center text-center text-3xl font-bold leading-none tracking-[0.15em] text-[var(--splash-copy)]"
      >
        <span aria-hidden="true">Zen</span>
        <span aria-hidden="true">Flow</span>
      </h1>

      <p
        className="splash-subtitle relative z-10 mt-[12px] max-w-[calc(100vw-32px)] text-center text-sm text-[var(--splash-muted)] [overflow-wrap:anywhere]"
      >
        {subtitle}
      </p>

      <div
        className="splash-loader relative z-10 mt-[32px] flex min-h-[130px] shrink-0 items-center justify-center drop-shadow-[0_0_2rem_var(--splash-loader-shadow)]"
        data-testid="splash-infinity-loader"
      >
        <PremiumLoader size="xl" label={t.loading} />
      </div>
    </div>
  );
}
