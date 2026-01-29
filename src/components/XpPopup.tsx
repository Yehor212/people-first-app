import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Flame, Star, Zap, Heart, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface XpEvent {
  id: string;
  amount: number;
  x: number;
  y: number;
  type: 'mood' | 'habit' | 'focus' | 'gratitude' | 'breathing' | 'streak' | 'bonus' | 'mindful';
  message?: string;
}

// Helper function to get XP config - avoids module-level const with component refs
function getXpConfig(type: XpEvent['type']) {
  switch (type) {
    case 'mood': return { icon: Sparkles, color: 'text-purple-400', glow: 'purple' };
    case 'habit': return { icon: Star, color: 'text-green-400', glow: 'green' };
    case 'focus': return { icon: Zap, color: 'text-blue-400', glow: 'blue' };
    case 'gratitude': return { icon: Heart, color: 'text-pink-400', glow: 'pink' };
    case 'breathing': return { icon: Wind, color: 'text-cyan-400', glow: 'cyan' };
    case 'mindful': return { icon: Wind, color: 'text-teal-400', glow: 'teal' };
    case 'streak': return { icon: Flame, color: 'text-orange-400', glow: 'orange' };
    case 'bonus': return { icon: Sparkles, color: 'text-amber-400', glow: 'amber' };
    default: return { icon: Sparkles, color: 'text-purple-400', glow: 'purple' };
  }
}

function XpPopupItem({ event, onComplete }: { event: XpEvent; onComplete: () => void }) {
  const [stage, setStage] = useState<'enter' | 'float' | 'exit'>('enter');
  const config = getXpConfig(event.type);
  const Icon = config.icon;

  useEffect(() => {
    // Enter animation
    const enterTimer = setTimeout(() => setStage('float'), 100);

    // Float animation
    const floatTimer = setTimeout(() => setStage('exit'), 1200);

    // Remove from DOM
    const exitTimer = setTimeout(onComplete, 1800);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(floatTimer);
      clearTimeout(exitTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={cn(
        "fixed pointer-events-none z-[10000] flex flex-col items-center gap-1",
        "transition-all duration-500 ease-out",
        stage === 'enter' && "opacity-0 scale-50",
        stage === 'float' && "opacity-100 scale-100",
        stage === 'exit' && "opacity-0 scale-75"
      )}
      style={{
        left: event.x,
        top: event.y,
        transform: `translate(-50%, -50%) translateY(${stage === 'float' ? '-40px' : stage === 'exit' ? '-80px' : '0'})`,
      }}
    >
      {/* XP Badge */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
          "bg-black/80 backdrop-blur-sm border border-white/20",
          "shadow-lg"
        )}
        style={{
          boxShadow: `0 0 20px var(--tw-shadow-color), 0 0 40px var(--tw-shadow-color)`,
          ['--tw-shadow-color' as string]: `var(--${config.glow}-500)`,
        }}
      >
        <Icon className={cn("w-4 h-4", config.color)} />
        <span className={cn("font-bold text-sm", config.color)}>
          +{event.amount} XP
        </span>
      </div>

      {/* Optional message */}
      {event.message && (
        <span className="text-xs text-white/70 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
          {event.message}
        </span>
      )}
    </div>
  );
}

// Global event system for XP popups
type XpListener = (event: XpEvent) => void;
const listeners = new Set<XpListener>();

export function triggerXpPopup(
  amount: number,
  type: XpEvent['type'],
  position?: { x: number; y: number },
  message?: string
) {
  // Default position: center-ish of screen
  const defaultPos = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2 - 100,
  };

  const event: XpEvent = {
    id: `${Date.now()}-${Math.random()}`,
    amount,
    type,
    x: position?.x ?? defaultPos.x,
    y: position?.y ?? defaultPos.y,
    message,
  };

  listeners.forEach(listener => listener(event));
}

// Hook to get position from click/tap event
export function getEventPosition(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
  if ('touches' in e) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

// Provider component that renders popups
export function XpPopupProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<XpEvent[]>([]);

  useEffect(() => {
    const listener: XpListener = (event) => {
      setEvents(prev => [...prev, event]);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const handleComplete = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  return (
    <>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <>
          {events.map(event => (
            <XpPopupItem
              key={event.id}
              event={event}
              onComplete={() => handleComplete(event.id)}
            />
          ))}
        </>,
        document.body
      )}
    </>
  );
}

// Confetti burst for special achievements
export function ConfettiBurst({ x, y }: { x: number; y: number }) {
  const [particles, setParticles] = useState<Array<{
    id: number;
    angle: number;
    distance: number;
    color: string;
    size: number;
  }>>([]);

  useEffect(() => {
    const colors = ['#fbbf24', '#a855f7', '#22c55e', '#3b82f6', '#ec4899', '#f97316'];
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      angle: (i * 30) + Math.random() * 20,
      distance: 40 + Math.random() * 30,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 4,
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 800);
    return () => clearTimeout(timer);
  }, [x, y]);

  if (particles.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[10001]">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute animate-particle-burst"
          style={{
            left: x,
            top: y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: '50%',
            ['--particle-angle' as string]: `${p.angle}deg`,
            ['--particle-distance' as string]: `${p.distance}px`,
          }}
        />
      ))}
    </div>,
    document.body
  );
}

// Streak fire animation component
export function StreakFireAnimation({ streak }: { streak: number }) {
  if (streak < 2) return null;

  return (
    <div className="relative inline-flex items-center">
      <Flame
        className={cn(
          "w-6 h-6 text-orange-500 animate-flame-flicker",
          streak >= 7 && "text-orange-400",
          streak >= 30 && "text-amber-400"
        )}
        style={{
          filter: `drop-shadow(0 0 ${4 + streak}px ${streak >= 30 ? '#fbbf24' : streak >= 7 ? '#fb923c' : '#f97316'})`,
        }}
      />
      <span className={cn(
        "absolute -top-1 -right-1 text-[10px] font-bold",
        "bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center",
        streak >= 7 && "bg-orange-400",
        streak >= 30 && "bg-amber-400"
      )}>
        {streak}
      </span>
    </div>
  );
}
