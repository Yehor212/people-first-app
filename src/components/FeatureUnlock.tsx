/**
 * Feature Unlock Celebration
 *
 * Shows when a new feature is unlocked with:
 * - Celebration animation
 * - Feature description
 * - "Try it now" CTA
 */

import { useState, useEffect } from 'react';
import { Sparkles, Timer, Trophy, ListTodo, Heart, Target } from 'lucide-react';
import type { FeatureId } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface FeatureUnlockProps {
  feature: FeatureId;
  onClose: () => void;
  onTryNow?: () => void;
}

// Feature metadata
const FEATURE_META: Record<
  FeatureId,
  {
    icon: typeof Sparkles;
    colorClass: string;
    bgClass: string;
  }
> = {
  mood: {
    icon: Heart,
    colorClass: 'text-pink-500',
    bgClass: 'bg-pink-50 dark:bg-pink-950',
  },
  habits: {
    icon: Target,
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-50 dark:bg-blue-950',
  },
  focusTimer: {
    icon: Timer,
    colorClass: 'text-purple-500',
    bgClass: 'bg-purple-50 dark:bg-purple-950',
  },
  xp: {
    icon: Sparkles,
    colorClass: 'text-yellow-500',
    bgClass: 'bg-yellow-50 dark:bg-yellow-950',
  },
  quests: {
    icon: Sparkles,
    colorClass: 'text-yellow-500',
    bgClass: 'bg-yellow-50 dark:bg-yellow-950',
  },
  companion: {
    icon: Heart,
    colorClass: 'text-green-500',
    bgClass: 'bg-green-50 dark:bg-green-950',
  },
  tasks: {
    icon: ListTodo,
    colorClass: 'text-emerald-500',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950',
  },
  challenges: {
    icon: Trophy,
    colorClass: 'text-primary',
    bgClass: 'bg-primary/10',
  },
};

export function FeatureUnlock({ feature, onClose, onTryNow }: FeatureUnlockProps) {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  const meta = FEATURE_META[feature];
  const Icon = meta.icon;

  // Entrance animation
  useEffect(() => {
    setIsVisible(true);

    // Generate celebration particles
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 0.5,
    }));
    setParticles(newParticles);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for exit animation
  };

  const handleTryNow = () => {
    handleClose();
    if (onTryNow) {
      setTimeout(onTryNow, 400);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      {/* Celebration particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-ping opacity-75"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animationDelay: `${particle.delay}s`,
            animationDuration: '2s',
          }}
        />
      ))}

      {/* Main card */}
      <div
        className={`relative m-4 max-w-md w-full bg-card rounded-2xl zen-shadow-card border border-border overflow-hidden transform transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with icon */}
        <div className={`p-6 ${meta.bgClass} border-b border-border`}>
          <div className="flex flex-col items-center text-center">
            <div
              className={`p-4 rounded-full ${meta.bgClass} ring-4 ring-white dark:ring-gray-900 mb-4 animate-bounce-slow`}
            >
              <Icon className={`w-12 h-12 ${meta.colorClass}`} />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {t[`onboarding${feature}UnlockTitle` as keyof typeof t] || '🎉 New Feature Unlocked!'}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t[`onboarding${feature}UnlockSubtitle` as keyof typeof t] || "You've made great progress!"}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="p-6">
          <p className="text-foreground mb-6 leading-relaxed">
            {t[`onboarding${feature}Description` as keyof typeof t] ||
              'This new feature will help you on your journey.'}
          </p>

          {/* Action buttons */}
          <div className="flex gap-3">
            {onTryNow && (
              <button
                onClick={handleTryNow}
                className="flex-1 py-3 px-4 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors zen-shadow-sm"
              >
                {t.onboardingTryNow || 'Try it now'}
              </button>
            )}
            <button
              onClick={handleClose}
              className="flex-1 py-3 px-4 bg-card border border-border text-foreground rounded-xl font-medium hover:bg-accent transition-colors"
            >
              {t.onboardingGotIt || 'Got it!'}
            </button>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className={`h-2 ${meta.bgClass}`} />
      </div>
    </div>
  );
}

/**
 * Custom animation keyframes for slow bounce
 */
const style = document.createElement('style');
style.textContent = `
  @keyframes bounce-slow {
    0%, 100% {
      transform: translateY(-10%);
      animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
    }
    50% {
      transform: translateY(0);
      animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
  }

  .animate-bounce-slow {
    animation: bounce-slow 2s infinite;
  }
`;
document.head.appendChild(style);
