import { memo, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { valenceToHSL } from "./colorUtils";
import type { OrbTransitionProfile } from "./ValenceOrb";

export type MiniValenceOrbSize = "xs" | "sm" | "md" | "lg";
export type MiniValenceOrbChrome = "none" | "badge" | "refine";

interface MiniValenceOrbProps {
  valence: number;
  hasEntry: boolean;
  size?: MiniValenceOrbSize;
  chrome?: MiniValenceOrbChrome;
  containerClassName?: string;
  orbClassName?: string;
  transitionProfile?: OrbTransitionProfile;
}

const BARE_SIZE_PRESETS: Record<
  MiniValenceOrbSize,
  {
    container: string;
    orb: string;
  }
> = {
  xs: {
    container: "h-5 w-5",
    orb: "scale-[0.19] brightness-[0.9]",
  },
  sm: {
    container: "h-10 w-10",
    orb: "scale-[0.34] brightness-[0.88]",
  },
  md: {
    container: "h-12 w-12",
    orb: "scale-[0.4] brightness-75",
  },
  lg: {
    container: "h-16 w-16",
    orb: "scale-[0.52] brightness-[0.82]",
  },
};

const CHROME_PRESETS: Record<
  Exclude<MiniValenceOrbChrome, "none">,
  Record<
    MiniValenceOrbSize,
    {
      shell: string;
      ring: string;
      orbInset: string;
      orb: string;
    }
  >
> = {
  badge: {
    xs: {
      shell:
        "h-7 w-7 rounded-full border border-border/35 bg-card/70 shadow-sm backdrop-blur-sm",
      ring: "inset-[1px] border-border/20",
      orbInset: "absolute inset-[2px] overflow-hidden rounded-full",
      orb: "scale-[0.24] brightness-[0.92]",
    },
    sm: {
      shell:
        "h-12 w-12 rounded-full border border-border/40 bg-card/80 shadow-sm backdrop-blur-sm",
      ring: "inset-[2px] border-border/20",
      orbInset: "absolute inset-[5px] overflow-hidden rounded-full",
      orb: "scale-[0.43] brightness-[0.88]",
    },
    md: {
      shell:
        "h-16 w-16 rounded-full border border-border/40 bg-card/80 shadow-sm backdrop-blur-sm",
      ring: "inset-[3px] border-border/20",
      orbInset: "absolute inset-[6px] overflow-hidden rounded-full",
      orb: "scale-[0.52] brightness-[0.9]",
    },
    lg: {
      shell:
        "h-[4.5rem] w-[4.5rem] rounded-full border border-border/40 bg-card/82 shadow-sm backdrop-blur-sm",
      ring: "inset-[3px] border-border/20",
      orbInset: "absolute inset-[6px] overflow-hidden rounded-full",
      orb: "scale-[0.58] brightness-[0.92]",
    },
  },
  refine: {
    xs: {
      shell:
        "h-7 w-7 rounded-full border border-border/30 bg-background/45 shadow-sm backdrop-blur-md",
      ring: "inset-[1px] border-border/15",
      orbInset: "absolute inset-[2px] overflow-hidden rounded-full",
      orb: "scale-[0.25] brightness-[0.94]",
    },
    sm: {
      shell:
        "h-12 w-12 rounded-full border border-border/35 bg-background/45 shadow-sm backdrop-blur-md",
      ring: "inset-[2px] border-border/15",
      orbInset: "absolute inset-[4px] overflow-hidden rounded-full",
      orb: "scale-[0.46] brightness-[0.92]",
    },
    md: {
      shell:
        "h-16 w-16 rounded-full border border-border/35 bg-background/45 shadow-sm backdrop-blur-md",
      ring: "inset-[3px] border-border/15",
      orbInset: "absolute inset-[5px] overflow-hidden rounded-full",
      orb: "scale-[0.56] brightness-[0.94]",
    },
    lg: {
      shell:
        "h-20 w-20 rounded-full border border-border/35 bg-background/45 shadow-md backdrop-blur-md",
      ring: "inset-[4px] border-border/15",
      orbInset: "absolute inset-[6px] overflow-hidden rounded-full",
      orb: "scale-[0.68] brightness-[0.96]",
    },
  },
};

function OrbCore({
  valence,
  hasEntry,
  containerClassName,
  orbClassName,
  transitionProfile,
}: {
  valence: number;
  hasEntry: boolean;
  containerClassName: string;
  orbClassName: string;
  transitionProfile: OrbTransitionProfile;
}) {
  const displayValence = hasEntry ? valence : 0;
  const color = valenceToHSL(displayValence);
  const style = {
    "--mini-orb-h": `${Math.round(color.h)}`,
    "--mini-orb-s": `${Math.round(color.s)}%`,
    "--mini-orb-l": `${Math.round(color.l)}%`,
  } as CSSProperties;

  return (
    <div
      aria-hidden="true"
      data-orb-renderer="css"
      data-orb-transition-profile={transitionProfile}
      className={cn("pointer-events-none relative flex-shrink-0", containerClassName)}
    >
      <div
        className={cn(
          "absolute left-1/2 top-1/2 h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2",
          hasEntry ? "animate-orb-breathe" : "motion-safe:animate-pulse",
          orbClassName,
        )}
        style={style}
      >
        <span
          className="absolute inset-[16px] rounded-full opacity-90"
          style={{
            background:
              "radial-gradient(circle at 38% 32%, hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) + 30%) / 0.96), hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) + 9%) / 0.78) 34%, hsl(var(--mini-orb-h) var(--mini-orb-s) var(--mini-orb-l) / 0.42) 58%, transparent 78%)",
            filter: "blur(0.2px)",
          }}
        />
        <span
          className="absolute inset-[8px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) + 18%) / 0.24), transparent 66%)",
            filter: "blur(12px)",
          }}
        />
        <span
          className="absolute inset-[22px] rounded-full border"
          style={{
            borderColor: "hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) + 18%) / 0.42)",
            boxShadow:
              "inset 0 0 16px hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) + 18%) / 0.34), 0 0 22px hsl(var(--mini-orb-h) var(--mini-orb-s) var(--mini-orb-l) / 0.24)",
          }}
        />
        <span
          className="absolute left-[34px] top-[28px] h-[20px] w-[32px] rotate-[-18deg] rounded-full opacity-70 blur-[1px]"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) + 38%) / 0.72), transparent)",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Decorative compact orb used in previews, handoff cards, and empty states.
 *
 * `size` + `chrome` form the canonical preset API.
 * `containerClassName` / `orbClassName` remain as escape hatches so older
 * callers can optically nudge the orb without inventing a second visual system.
 */
export const MiniValenceOrb = memo(function MiniValenceOrb({
  valence,
  hasEntry,
  size = "md",
  chrome = "none",
  containerClassName,
  orbClassName,
  transitionProfile = "v1-soft",
}: MiniValenceOrbProps) {
  if (chrome === "none") {
    const preset = BARE_SIZE_PRESETS[size];
    return (
      <OrbCore
        valence={valence}
        hasEntry={hasEntry}
        containerClassName={cn(preset.container, containerClassName)}
        orbClassName={cn(preset.orb, orbClassName)}
        transitionProfile={transitionProfile}
      />
    );
  }

  const preset = CHROME_PRESETS[chrome][size];

  return (
    <div
      aria-hidden="true"
      className={cn("relative inline-flex shrink-0 items-center justify-center", preset.shell, containerClassName)}
    >
      <div
        className={cn("pointer-events-none absolute rounded-full border", preset.ring)}
      />
      <OrbCore
        valence={valence}
        hasEntry={hasEntry}
        containerClassName={preset.orbInset}
        orbClassName={cn(preset.orb, orbClassName)}
        transitionProfile={transitionProfile}
      />
    </div>
  );
});
