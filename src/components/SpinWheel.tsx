/**
 * Spin Wheel Component
 * Luck-based reward system with spinning animation
 */

import { useState, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getSpinWheelPrizes, spinWheel, SpinWheelPrize } from '@/lib/adhdHooks';

interface SpinWheelProps {
  onClose: () => void;
  onWin: (prize: SpinWheelPrize) => void;
  spinsAvailable: number;
}

const COLORS = [
  'from-red-400 to-red-500',
  'from-orange-400 to-orange-500',
  'from-yellow-400 to-yellow-500',
  'from-green-400 to-green-500',
  'from-teal-400 to-teal-500',
  'from-blue-400 to-blue-500',
  'from-indigo-400 to-indigo-500',
  'from-purple-400 to-purple-500',
];

export function SpinWheel({ onClose, onWin, spinsAvailable }: SpinWheelProps) {
  const { t } = useLanguage();
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [prize, setPrize] = useState<SpinWheelPrize | null>(null);
  const [showResult, setShowResult] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  const prizes = getSpinWheelPrizes();
  const segmentAngle = prizes.length > 0 ? 360 / prizes.length : 0;

  // P1 Fix: Add ref to prevent double-click race condition
  const spinLockRef = useRef(false);

  const handleSpin = () => {
    // P1 Fix: Double-check with ref to prevent race conditions
    if (isSpinning || spinsAvailable <= 0 || spinLockRef.current) return;
    spinLockRef.current = true;

    setIsSpinning(true);
    setShowResult(false);
    setPrize(null);

    // Determine winning prize
    const winningPrize = spinWheel();
    const prizeIndex = prizes.findIndex(p => p.id === winningPrize.id);

    // Calculate final rotation (multiple full spins + landing on prize)
    const spins = 5 + Math.random() * 3; // 5-8 full rotations
    const prizeAngle = prizeIndex * segmentAngle;
    const finalRotation = rotation + (360 * spins) + (360 - prizeAngle - segmentAngle / 2);

    setRotation(finalRotation);

    // Show result after spinning
    setTimeout(() => {
      setIsSpinning(false);
      spinLockRef.current = false; // P1 Fix: Release lock after animation
      setPrize(winningPrize);
      setShowResult(true);
    }, 4000); // Match animation duration
  };

  const handleClaim = () => {
    if (prize) {
      onWin(prize);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-card rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="relative p-6 text-center bg-gradient-to-r from-purple-600 to-pink-600 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <Sparkles className="w-10 h-10 mx-auto mb-2" />
          <h2 className="text-2xl font-bold">{t.spinWheel || 'Spin the Wheel!'}</h2>
          <p className="text-white/80 text-sm mt-1">
            {t.spinsAvailable || 'Spins Available'}: {spinsAvailable} 🎰
          </p>
        </div>

        {/* Wheel Container */}
        <div className="p-8 flex flex-col items-center">
          <div className="relative w-72 h-72">
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
              <div className="w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-yellow-500 drop-shadow-lg" />
            </div>

            {/* Wheel */}
            <div
              ref={wheelRef}
              className="w-full h-full rounded-full border-8 border-yellow-500 shadow-2xl overflow-hidden"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
              }}
            >
              {prizes.map((prize, index) => {
                const startAngle = index * segmentAngle;
                return (
                  <div
                    key={prize.id}
                    className={cn(
                      'absolute w-1/2 h-1/2 origin-bottom-right',
                      `bg-gradient-to-br ${COLORS[index % COLORS.length]}`
                    )}
                    style={{
                      transform: `rotate(${startAngle}deg) skewY(-${90 - segmentAngle}deg)`,
                      transformOrigin: 'bottom right',
                      left: '50%',
                      top: '0',
                    }}
                  >
                    <div
                      className="absolute text-white font-bold text-xs flex items-center justify-center"
                      style={{
                        transform: `skewY(${90 - segmentAngle}deg) rotate(${segmentAngle / 2}deg)`,
                        top: '30%',
                        left: '20%',
                      }}
                    >
                      <span className="text-lg mr-1">{prize.icon}</span>
                    </div>
                  </div>
                );
              })}

              {/* Center circle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-4 border-white shadow-lg flex items-center justify-center">
                <span className="text-2xl">🎰</span>
              </div>
            </div>

            {/* Glow effect when spinning */}
            {isSpinning && (
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/30 to-pink-500/30 animate-pulse" />
            )}
          </div>

          {/* Result */}
          {showResult && prize && (
            <div className="mt-6 text-center animate-scale-in">
              <div className={cn(
                'inline-flex items-center gap-3 px-6 py-4 rounded-2xl',
                prize.rarity === 'legendary' && 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white',
                prize.rarity === 'epic' && 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
                prize.rarity === 'rare' && 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
                prize.rarity === 'common' && 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
              )}>
                <span className="text-4xl">{prize.icon}</span>
                <div className="text-left">
                  <div className="font-bold text-xl">{prize.label}</div>
                  <div className="text-sm opacity-90">
                    {prize.rarity === 'legendary' && '🌟 LEGENDARY!'}
                    {prize.rarity === 'epic' && '✨ EPIC!'}
                    {prize.rarity === 'rare' && '💫 RARE!'}
                    {prize.rarity === 'common' && '⭐ Nice!'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleClaim}
                className="mt-4 px-8 py-3 zen-gradient text-white font-bold rounded-xl hover:scale-105 active:scale-95 transition-transform"
              >
                {t.claimPrize || 'Claim Prize!'} 🎉
              </button>
            </div>
          )}

          {/* Spin Button */}
          {!showResult && (
            <button
              onClick={handleSpin}
              disabled={isSpinning || spinsAvailable <= 0}
              className={cn(
                'mt-6 px-10 py-4 rounded-2xl font-bold text-lg transition-all',
                isSpinning
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : spinsAvailable > 0
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-105 active:scale-95 shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              )}
            >
              {isSpinning
                ? '🎰 Spinning...'
                : spinsAvailable > 0
                ? `🎰 ${t.spin || 'SPIN'}!`
                : t.noSpins || 'No Spins Left'}
            </button>
          )}
        </div>

        {/* Legend */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-4 gap-2 text-xs text-center">
            {[
              { color: 'bg-gray-400', label: 'Common' },
              { color: 'bg-blue-500', label: 'Rare' },
              { color: 'bg-purple-500', label: 'Epic' },
              { color: 'bg-yellow-500', label: 'Legendary' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-center gap-1">
                <div className={cn('w-3 h-3 rounded', item.color)} />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
