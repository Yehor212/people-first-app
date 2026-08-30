import type { CSSProperties } from "react";

export const PRIMARY_NEBULA_STYLE = {
  opacity: 0.4,
  "--zen-loop-min-opacity": 0.3,
  "--zen-loop-max-opacity": 0.5,
  "--zen-loop-duration": "4s",
} as CSSProperties;

export const SECONDARY_NEBULA_STYLE = {
  opacity: 0.3,
  "--zen-loop-min-opacity": 0.2,
  "--zen-loop-max-opacity": 0.4,
  "--zen-loop-duration": "5s",
  "--zen-loop-delay": "1.5s",
} as CSSProperties;

export const THREE_SECOND_LOOP_STYLE = { "--zen-loop-duration": "3s" } as CSSProperties;
export const GRATITUDE_HEADING_STYLE = {
  "--zen-loop-rotate": "15deg",
  "--zen-loop-scale": 1.2,
  "--zen-loop-duration": "2s",
} as CSSProperties;
export const EMPTY_DAY_STYLE = {
  opacity: 0.75,
  "--zen-loop-min-opacity": 0.5,
  "--zen-loop-max-opacity": 1,
  "--zen-loop-duration": "2s",
} as CSSProperties;

export function getStatCardStyle(color: string): CSSProperties {
  return { boxShadow: `0 0 10px ${color}20` };
}

export function getStatIconStyle(color: string): CSSProperties {
  return { color };
}

export function getTimelineDotStyle(color: string, index: number): CSSProperties {
  return {
    borderColor: color,
    background: `radial-gradient(circle, ${color}40, transparent)`,
    boxShadow: `0 0 10px ${color}60`,
    "--zen-loop-scale": 1.2,
    "--zen-loop-duration": "2s",
    "--zen-loop-delay": `${index * 0.2}s`,
  } as CSSProperties;
}

export function getGratitudeSparkleStyle(index: number): CSSProperties {
  return {
    "--zen-loop-scale": 1.2,
    "--zen-loop-duration": "2s",
    "--zen-loop-delay": `${index * 0.3}s`,
  } as CSSProperties;
}
