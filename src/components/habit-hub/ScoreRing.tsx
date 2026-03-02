/**
 * ScoreRing — Compact 16px SVG score indicator for HabitHubCard header.
 * Display-only (not interactive — no WCAG touch target needed).
 * Two circles: track (background) + arc (filled by score %).
 */

import { memo } from 'react';

interface ScoreRingProps {
  score: number;  // 0.0–1.0
  color: string;  // habit hex color
  size?: number;  // default 16
}

export const ScoreRing = memo(function ScoreRing({
  score,
  color,
  size = 16,
}: ScoreRingProps) {
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(score, 0), 1));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="flex-shrink-0"
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="white"
        strokeOpacity={0.08}
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="motion-safe:[transition:stroke-dashoffset_0.3s_ease]"
      />
    </svg>
  );
});
