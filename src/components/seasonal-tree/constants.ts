/**
 * Shared constants and color utilities for the SVG SeasonalTree.
 */

import { TreeStage } from '@/lib/seasonHelper';

export const sizeConfig = {
  sm: { width: 120, height: 150 },
  md: { width: 200, height: 250 },
  lg: { width: 280, height: 350 },
} as const;

export const stageScaleMap: Record<TreeStage, number> = {
  1: 0.55,
  2: 0.7,
  3: 0.9,
  4: 1,
  5: 1.15,
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

export const mixColor = (a: string, b: string, t: number): string => {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  const mix = (v1: number, v2: number) => Math.round(v1 + (v2 - v1) * t);
  const r = clamp(mix(c1.r, c2.r), 0, 255);
  const g = clamp(mix(c1.g, c2.g), 0, 255);
  const b2 = clamp(mix(c1.b, c2.b), 0, 255);
  return `rgb(${r}, ${g}, ${b2})`;
};

export const colorWithAlpha = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
