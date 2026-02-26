/**
 * ConfettiBurst - Lightweight confetti particle animation
 * Triggers a small burst of particles at the specified position
 * Uses existing confetti-burst CSS keyframe from index.css
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#06b6d4'];

interface ConfettiBurstProps {
  x: number;
  y: number;
  onComplete: () => void;
}

export function ConfettiBurst({ x, y, onComplete }: ConfettiBurstProps) {
  const [particles] = useState(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      angle: (i / 10) * 360 + (Math.random() * 30 - 15),
      size: 3 + Math.random() * 4,
      delay: Math.random() * 0.1,
    }))
  );

  useEffect(() => {
    const timer = setTimeout(onComplete, 900);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[210]" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full animate-confetti-burst"
          style={{
            left: x,
            top: y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            '--confetti-angle': `${p.angle}deg`,
            animationDelay: `${p.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>,
    document.body
  );
}
