import { memo, useEffect, useState, type CSSProperties } from "react";

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
    orb: "scale-[0.23] brightness-[1.04] saturate-[1.18]",
  },
  sm: {
    container: "h-10 w-10",
    orb: "scale-[0.41] brightness-[1.04] saturate-[1.16]",
  },
  md: {
    container: "h-12 w-12",
    orb: "scale-[0.48] brightness-[1.03] saturate-[1.18]",
  },
  lg: {
    container: "h-16 w-16",
    orb: "scale-[0.62] brightness-[1.04] saturate-[1.16]",
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
  const [oscillatedValence, setOscillatedValence] = useState(0);

  useEffect(() => {
    if (hasEntry) {
      setOscillatedValence(0);
      return;
    }

    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      setOscillatedValence(Math.sin(frame * 0.07) * 0.34);
    }, 320);

    return () => window.clearInterval(id);
  }, [hasEntry]);

  const displayValence = hasEntry ? valence : oscillatedValence;
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
          className="absolute inset-[3px] rounded-full opacity-95"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) + 20%) / 0.38), hsl(var(--mini-orb-h) var(--mini-orb-s) var(--mini-orb-l) / 0.24) 44%, transparent 74%)",
            filter: "blur(8px)",
          }}
        />
        <span
          className="absolute inset-[14px] rounded-full opacity-100"
          style={{
            background:
              "radial-gradient(circle at 38% 30%, hsl(var(--mini-orb-h) calc(var(--mini-orb-s) * 0.22) 99% / 0.98), hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) + 18%) / 0.96) 19%, hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) + 4%) / 0.86) 43%, hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) - 12%) / 0.48) 67%, transparent 84%)",
            filter: "blur(0.2px)",
            boxShadow:
              "0 0 22px hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) + 12%) / 0.28)",
          }}
        />
        <span
          className="absolute inset-[18px] rounded-full border opacity-90"
          style={{
            borderColor:
              "hsl(var(--mini-orb-h) calc(var(--mini-orb-s) * 0.48) calc(var(--mini-orb-l) + 24%) / 0.72)",
            boxShadow:
              "inset 0 0 18px hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) + 20%) / 0.46), 0 0 22px hsl(var(--mini-orb-h) var(--mini-orb-s) var(--mini-orb-l) / 0.34)",
          }}
        />
        <span
          className="absolute inset-[30px] rounded-full border opacity-75"
          style={{
            borderColor:
              "hsl(var(--mini-orb-h) calc(var(--mini-orb-s) * 0.42) calc(var(--mini-orb-l) + 30%) / 0.58)",
            boxShadow:
              "0 0 14px hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) + 24%) / 0.3)",
          }}
        />
        <span
          className="absolute left-[31px] top-[25px] h-[22px] w-[36px] rotate-[-20deg] rounded-full opacity-85 blur-[1px]"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--mini-orb-h) calc(var(--mini-orb-s) * 0.18) 99% / 0.82), transparent)",
          }}
        />
        <span
          className="absolute right-[28px] top-[42px] h-[7px] w-[7px] rounded-full opacity-75"
          style={{
            background:
              "hsl(var(--mini-orb-h) calc(var(--mini-orb-s) * 0.28) calc(var(--mini-orb-l) + 34%) / 0.86)",
            boxShadow:
              "0 0 10px hsl(var(--mini-orb-h) var(--mini-orb-s) calc(var(--mini-orb-l) + 24%) / 0.52)",
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
