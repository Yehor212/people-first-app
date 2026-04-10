/**
 * Centralized spring physics and animation duration config.
 * Use these constants instead of hardcoding values in components.
 */

export const springs = {
  sidebar: { stiffness: 300, damping: 30 },
  commandPalette: { stiffness: 400, damping: 28 },
  panelResize: { stiffness: 500, damping: 35 },
  dragDrop: { stiffness: 200, damping: 20 },
  celebration: { stiffness: 600, damping: 15 },
  modal: { stiffness: 350, damping: 30 },
  lightbox: { stiffness: 300, damping: 25 },
} as const;

export const durations = {
  micro: 120,
  component: 250,
  layout: 350,
  emphasis: 600,
} as const;

export type SpringKey = keyof typeof springs;
export type DurationKey = keyof typeof durations;
