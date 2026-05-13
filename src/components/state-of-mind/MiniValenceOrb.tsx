import { memo } from "react";

import { cn } from "@/lib/utils";

import { ValenceOrb, type OrbRendererMode, type OrbTransitionProfile } from "./ValenceOrb";

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
  renderer?: OrbRendererMode;
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
  containerClassName,
  orbClassName,
  transitionProfile,
  renderer,
}: {
  valence: number;
  containerClassName: string;
  orbClassName: string;
  transitionProfile: OrbTransitionProfile;
  renderer: OrbRendererMode;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none relative flex-shrink-0", containerClassName)}
    >
      <div
        className={cn(
          "absolute left-1/2 top-1/2 h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2",
          orbClassName,
        )}
      >
        <ValenceOrb
          valence={valence}
          size={120}
          transitionProfile={transitionProfile}
          renderer={renderer}
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
  size = "md",
  chrome = "none",
  containerClassName,
  orbClassName,
  transitionProfile = "v1-soft",
  renderer = "webgl",
}: MiniValenceOrbProps) {
  if (chrome === "none") {
    const preset = BARE_SIZE_PRESETS[size];
    return (
      <OrbCore
        valence={valence}
        containerClassName={cn(preset.container, containerClassName)}
        orbClassName={cn(preset.orb, orbClassName)}
        transitionProfile={transitionProfile}
        renderer={renderer}
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
        containerClassName={preset.orbInset}
        orbClassName={cn(preset.orb, orbClassName)}
        transitionProfile={transitionProfile}
        renderer={renderer}
      />
    </div>
  );
});
