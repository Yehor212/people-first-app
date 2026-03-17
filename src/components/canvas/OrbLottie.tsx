/**
 * OrbLottie — Ambient glow animation behind the Root Node (Orb).
 *
 * Lazy-loads orb-ambient.json. Falls back to nothing if file is missing.
 * Replace src/assets/animations/orb-ambient.json with a custom Lottie
 * for a different ambient effect.
 */

import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

export function OrbLottie() {
  const [animData, setAnimData] = useState<object | null>(null);

  useEffect(() => {
    import('@/assets/animations/orb-ambient.json')
      .then(m => setAnimData(m.default))
      .catch((e) => { logger.warn('[OrbLottie] Animation load failed:', e); }); // graceful: decorative animation, component returns null without data
  }, []);

  if (!animData) return null;

  return (
    <div className="absolute inset-[-24px] pointer-events-none opacity-40">
      <Lottie
        animationData={animData}
        loop
        autoplay
        className="w-full h-full"
      />
    </div>
  );
}
