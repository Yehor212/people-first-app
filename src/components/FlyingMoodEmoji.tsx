import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface FlyingEmoji {
  id: string;
  emoji: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// Global event system
type FlyingEmojiListener = (emoji: FlyingEmoji) => void;
const listeners = new Set<FlyingEmojiListener>();

// Store calendar position
let calendarPosition = { x: window.innerWidth / 2, y: 100 };

export function setCalendarPosition(x: number, y: number) {
  calendarPosition = { x, y };
}

export function triggerFlyingEmoji(
  emoji: string,
  startPosition: { x: number; y: number }
) {
  const flyingEmoji: FlyingEmoji = {
    id: `${Date.now()}-${Math.random()}`,
    emoji,
    startX: startPosition.x,
    startY: startPosition.y,
    endX: calendarPosition.x,
    endY: calendarPosition.y,
  };

  listeners.forEach(listener => listener(flyingEmoji));
}

function FlyingEmojiItem({ emoji, onComplete }: { emoji: FlyingEmoji; onComplete: () => void }) {
  const [stage, setStage] = useState<'start' | 'fly' | 'land'>('start');

  useEffect(() => {
    // Start flying immediately
    requestAnimationFrame(() => setStage('fly'));

    // Land animation
    const landTimer = setTimeout(() => setStage('land'), 600);

    // Complete
    const completeTimer = setTimeout(onComplete, 900);

    return () => {
      clearTimeout(landTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  // Calculate the arc path
  const deltaX = emoji.endX - emoji.startX;
  const deltaY = emoji.endY - emoji.startY;

  return (
    <div
      className={cn(
        "fixed pointer-events-none z-[10002] text-4xl",
        "transition-all duration-600 ease-out",
        stage === 'start' && "scale-100 opacity-100",
        stage === 'fly' && "scale-75 opacity-90",
        stage === 'land' && "scale-50 opacity-0"
      )}
      style={{
        left: stage === 'start' ? emoji.startX : emoji.endX,
        top: stage === 'start' ? emoji.startY : emoji.endY,
        transform: `translate(-50%, -50%) ${stage === 'fly' ? 'rotate(360deg)' : 'rotate(0deg)'}`,
        transition: stage === 'start' ? 'none' : 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        filter: stage === 'fly' ? 'drop-shadow(0 0 20px currentColor)' : 'none',
      }}
    >
      {/* Emoji */}
      <span className="relative">
        {emoji.emoji}

        {/* Trail particles */}
        {stage === 'fly' && (
          <>
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className="absolute inset-0 animate-ping opacity-30"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '0.5s',
                }}
              >
                {emoji.emoji}
              </span>
            ))}
          </>
        )}
      </span>
    </div>
  );
}

// Calendar landing effect
export function CalendarLandingEffect({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute inset-0 animate-ping bg-primary/20 rounded-full" />
      <div className="absolute inset-0 animate-pulse bg-primary/10 rounded-full" />
    </div>
  );
}

// Provider component
export function FlyingEmojiProvider({ children }: { children: React.ReactNode }) {
  const [emojis, setEmojis] = useState<FlyingEmoji[]>([]);

  useEffect(() => {
    const listener: FlyingEmojiListener = (emoji) => {
      setEmojis(prev => [...prev, emoji]);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const handleComplete = useCallback((id: string) => {
    setEmojis(prev => prev.filter(e => e.id !== id));
  }, []);

  return (
    <>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <>
          {emojis.map(emoji => (
            <FlyingEmojiItem
              key={emoji.id}
              emoji={emoji}
              onComplete={() => handleComplete(emoji.id)}
            />
          ))}
        </>,
        document.body
      )}
    </>
  );
}

// Hook for components to register as calendar target
export function useCalendarTarget() {
  const registerRef = useCallback((element: HTMLElement | null) => {
    if (element) {
      const rect = element.getBoundingClientRect();
      setCalendarPosition(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
    }
  }, []);

  return { registerRef };
}
