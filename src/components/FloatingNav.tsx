/**
 * FloatingNav — Bottom-center navigation pill for the Home tab.
 *
 * 3 buttons: MAP / HABITS / FOCUS.
 * HABITS and FOCUS open their respective overlays.
 * Replaces standard Navigation.tsx on the home tab.
 */

import { useState, useEffect } from 'react';
import { Leaf, RefreshCw, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';

interface FloatingNavProps {
  onOpenHabits: () => void;
  onOpenFocus: () => void;
}

export function FloatingNav({ onOpenHabits, onOpenFocus }: FloatingNavProps) {
  const { t } = useLanguage();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'map' | 'habits' | 'focus'>('map');

  // Hide when software keyboard opens (same as Navigation.tsx)
  useEffect(() => {
    const threshold = window.screen.height * 0.75;
    const onResize = () => setKeyboardOpen(window.innerHeight < threshold);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (keyboardOpen) return null;

  const items = [
    { id: 'map' as const, icon: Leaf, label: t.map || 'Map' },
    { id: 'habits' as const, icon: RefreshCw, label: t.habits },
    { id: 'focus' as const, icon: Brain, label: t.focus },
  ];

  const handleTap = (id: 'map' | 'habits' | 'focus') => {
    void haptics.tabChanged();
    setActiveMode(id);
    if (id === 'habits') {
      onOpenHabits();
      // Reset to map after opening overlay
      setTimeout(() => setActiveMode('map'), 300);
    } else if (id === 'focus') {
      onOpenFocus();
      setTimeout(() => setActiveMode('map'), 300);
    }
  };

  return (
    <nav
      className={cn(
        'fixed z-50',
        'bottom-6 left-1/2 -translate-x-1/2',
        'bg-white/5 backdrop-blur-md',
        'border border-white/10',
        'rounded-full',
        'flex items-center gap-1 px-2 py-1',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
      aria-label={t.mainNavigation || 'Home navigation'}
    >
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => handleTap(item.id)}
          role="tab"
          aria-selected={activeMode === item.id}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 rounded-full min-h-[44px]',
            'transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
            activeMode === item.id
              ? 'text-emerald-400'
              : 'text-white/50 hover:text-white/70',
          )}
        >
          <item.icon className="w-4 h-4" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
