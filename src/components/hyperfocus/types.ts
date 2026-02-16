// Feature flags — temporarily disabled features
export const SHOW_SPOTIFY = false;
export const SHOW_DND = false;

export interface HyperfocusModeProps {
  duration: number; // minutes
  onComplete: () => void;
  onExit: () => void;
}

export interface ProgressColor {
  from: string;
  to: string;
}
