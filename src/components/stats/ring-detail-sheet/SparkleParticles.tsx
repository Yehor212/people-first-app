/**
 * SparkleParticles - Floating sparkle particle animations
 */

import type { CSSProperties } from 'react';
import { Sparkles } from 'lucide-react';

// Floating sparkle particles
export function SparkleParticles({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-zen-loop-float"
          style={{
            left: `${5 + (i * 8)}%`,
            top: `${10 + (i % 4) * 20}%`,
            opacity: 0,
            '--zen-loop-rise': '15px',
            '--zen-loop-scale-min': 0.5,
            '--zen-loop-scale': 1,
            '--zen-loop-min-opacity': 0,
            '--zen-loop-max-opacity': 1,
            '--zen-loop-duration': `${2 + (i % 3) * 0.5 + 0.5}s`,
            '--zen-loop-delay': `${i * 0.15}s`,
          } as CSSProperties}
        >
          <Sparkles className="w-3 h-3" style={{ color }} />
        </div>
      ))}
    </div>
  );
}
