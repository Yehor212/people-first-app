import { memo, type CSSProperties } from "react";

interface SettingsEmeraldNightBackdropProps {
  mobileDetailOpen: boolean;
  motionEnabled: boolean;
}

type EmeraldStarStyle = CSSProperties & {
  "--settings-star-inline": string;
  "--settings-star-desktop-inline"?: string;
  "--settings-star-desktop-block"?: string;
  "--settings-star-detail-inline"?: string;
  "--settings-star-block": string;
  "--settings-star-size": string;
  "--settings-star-opacity": number;
  "--settings-star-motion-delay-compact"?: string;
  "--settings-star-motion-delay-desktop"?: string;
  "--settings-star-motion-duration"?: string;
};

type EmeraldStar = {
  id: string;
  inline: number;
  desktopInline?: number;
  detailInline?: number;
  block: number;
  desktopBlock?: number;
  size: number;
  opacity: number;
  side: "start" | "end" | "top";
  major?: true;
  hideInDetail?: true;
  desktopVisible?: true;
};

// Exact, deterministic edge-safe layout verified by the Variant A runtime geometry checks.
// Logical inline coordinates mirror naturally in Arabic and Hebrew.
const EMERALD_NIGHT_STARS: readonly EmeraldStar[] = [
  { id: "emerald-01", inline: 20, block: 2, size: 2.2, opacity: 0.85, side: "top" },
  {
    id: "emerald-02",
    inline: 4,
    block: 10,
    size: 1.5,
    opacity: 0.7,
    side: "start",
    hideInDetail: true,
  },
  {
    id: "emerald-03",
    inline: 43,
    desktopInline: 27,
    block: 2,
    size: 1.4,
    opacity: 0.66,
    side: "top",
  },
  {
    id: "emerald-04",
    inline: 63,
    desktopInline: 75,
    block: 2,
    size: 3.2,
    opacity: 0.96,
    side: "top",
    major: true,
  },
  { id: "emerald-05", inline: 79, block: 2, size: 1.7, opacity: 0.74, side: "top" },
  {
    id: "emerald-06",
    inline: 92,
    detailInline: 99.5,
    block: 10,
    size: 2.4,
    opacity: 0.88,
    side: "end",
  },
  {
    id: "emerald-07",
    inline: 3,
    block: 14,
    size: 1.4,
    opacity: 0.72,
    side: "start",
    hideInDetail: true,
  },
  {
    id: "emerald-08",
    inline: 3,
    block: 20,
    size: 2.8,
    opacity: 0.9,
    side: "start",
    hideInDetail: true,
  },
  {
    id: "emerald-09",
    inline: 100.2,
    block: 18,
    desktopBlock: 14,
    size: 1.5,
    opacity: 0.78,
    side: "end",
  },
  { id: "emerald-10", inline: 100.2, block: 25, size: 2.6, opacity: 0.92, side: "end" },
  { id: "emerald-11", inline: 2, block: 31, size: 1.7, opacity: 0.76, side: "start" },
  { id: "emerald-12", inline: 98, block: 39, size: 1.4, opacity: 0.72, side: "end" },
  { id: "emerald-13", inline: 2, block: 47, size: 2.8, opacity: 0.94, side: "start", major: true },
  { id: "emerald-14", inline: 98, block: 55, size: 1.8, opacity: 0.78, side: "end" },
  {
    id: "emerald-15",
    inline: 2,
    block: 64,
    desktopInline: 0.2,
    size: 1.4,
    opacity: 0.7,
    side: "start",
    desktopVisible: true,
  },
  { id: "emerald-16", inline: 98, block: 71, size: 2.5, opacity: 0.88, side: "end" },
  { id: "emerald-17", inline: 2, block: 80, size: 2, opacity: 0.82, side: "start" },
  { id: "emerald-18", inline: 98, block: 82, size: 3.4, opacity: 0.98, side: "end", major: true },
  { id: "emerald-19", inline: 1, block: 90, size: 1.4, opacity: 0.7, side: "start" },
  { id: "emerald-20", inline: 38, block: 0.5, size: 2.4, opacity: 0.86, side: "top" },
  {
    id: "emerald-21",
    inline: 99.5,
    detailInline: 99.5,
    block: 15,
    size: 1.5,
    opacity: 0.74,
    side: "end",
  },
  { id: "emerald-22", inline: 72, block: 2.5, size: 1.7, opacity: 0.78, side: "top" },
  { id: "emerald-23", inline: 98, block: 92, size: 2.5, opacity: 0.9, side: "end" },
  { id: "emerald-24", inline: 2, block: 96, size: 1.4, opacity: 0.7, side: "start" },
] as const;

const COMPACT_MOTION_DELAYS = new Map<string, number>([
  ["emerald-01", 0],
  ["emerald-04", -1.75],
  ["emerald-10", -3.5],
  ["emerald-11", -5.25],
  ["emerald-13", -7],
  ["emerald-14", -8.75],
  ["emerald-17", -10.5],
  ["emerald-18", -12.25],
]);
const DESKTOP_MOTION_DELAYS = new Map<string, number>([
  ["emerald-01", 0],
  ["emerald-04", -3.5],
  ["emerald-15", -7],
  ["emerald-16", -10.5],
]);

export const SettingsEmeraldNightBackdrop = memo(function SettingsEmeraldNightBackdrop({
  mobileDetailOpen,
  motionEnabled,
}: SettingsEmeraldNightBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className="settings-emerald-night-backdrop"
      data-animated={motionEnabled ? "true" : "false"}
      data-mobile-detail={mobileDetailOpen ? "true" : "false"}
      data-testid="settings-emerald-night-backdrop"
    >
      <div className="settings-emerald-night-backdrop__sky" />
      <div
        className="settings-emerald-night-backdrop__nebula"
        data-motion-active={motionEnabled ? "true" : undefined}
        data-motion-emphasis="primary"
        data-motion-id="ambient-nebula"
      />
      <div className="settings-emerald-night-backdrop__star-field">
        {EMERALD_NIGHT_STARS.map((star) => {
          const compactDelay = COMPACT_MOTION_DELAYS.get(star.id);
          const desktopDelay = DESKTOP_MOTION_DELAYS.get(star.id);
          const motionCandidate = compactDelay !== undefined || desktopDelay !== undefined;
          return (
            <span
              key={star.id}
              className="settings-emerald-night-backdrop__star"
              data-desktop-visible={star.desktopVisible ? "true" : undefined}
              data-detail-hidden={star.hideInDetail ? "true" : undefined}
              data-major={star.major ? "true" : "false"}
              data-motion-compact={compactDelay !== undefined ? "true" : undefined}
              data-motion-desktop={desktopDelay !== undefined ? "true" : undefined}
              data-side={star.side}
              data-star-id={star.id}
              data-testid="settings-emerald-night-star"
              style={
                {
                  "--settings-star-inline": `${star.inline}%`,
                  "--settings-star-desktop-inline":
                    star.desktopInline === undefined ? undefined : `${star.desktopInline}%`,
                  "--settings-star-desktop-block":
                    star.desktopBlock === undefined ? undefined : `${star.desktopBlock}%`,
                  "--settings-star-detail-inline":
                    star.detailInline === undefined ? undefined : `${star.detailInline}%`,
                  "--settings-star-block": `${star.block}%`,
                  "--settings-star-size": `${star.size}px`,
                  "--settings-star-opacity": star.opacity,
                  "--settings-star-motion-delay-compact":
                    compactDelay === undefined ? undefined : `${compactDelay}s`,
                  "--settings-star-motion-delay-desktop":
                    desktopDelay === undefined ? undefined : `${desktopDelay}s`,
                  "--settings-star-motion-duration": motionCandidate
                    ? `${10 + (Number.parseInt(star.id.slice(-2), 10) % 3) * 2}s`
                    : undefined,
                } as EmeraldStarStyle
              }
            >
              <span className="settings-emerald-night-backdrop__star-core" />
            </span>
          );
        })}
      </div>
      <div className="settings-emerald-night-backdrop__vignette" />
    </div>
  );
});
