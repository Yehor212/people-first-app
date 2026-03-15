/**
 * OrbLottie — Ambient glow animation behind the Root Node (Orb).
 *
 * Lazy-loads orb-ambient.json. Falls back to nothing if file is missing.
 * Replace src/assets/animations/orb-ambient.json with a custom Lottie
 * for a different ambient effect.
 */

import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';

export function OrbLottie() {
  const [animData, setAnimData] = useState<object | null>(null);

  useEffect(() => {
    import('@/assets/animations/orb-ambient.json')
      .then(m => setAnimData(m.default))
      .catch((e) => { console.warn('[OrbLottie] Animation load failed:', e); });
  }, []);

  if (!animData) return null;

  return (
    <div className="absolute inset-[-24px] pointer-events-none opacity-40">
      <Lottie
        animationData={animData}
        loop
        autoplay
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
