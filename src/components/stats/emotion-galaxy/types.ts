export interface EmotionData {
  emotion: string;
  emoji: string;
  count: number;
  color: string;
}

export interface EmotionGalaxyProps {
  emotions: EmotionData[];
  totalEntries: number;
  className?: string;
}

// 3-layer parallax star system
export interface StarData {
  id: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}
