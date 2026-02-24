/**
 * ThemePicker — Inline dropdown for selecting diary theme.
 * Renders 6 theme color swatches with labels.
 */

import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { zenMotion } from '@/lib/animationUtils';
import type { DiaryThemeName } from './types';
import { DIARY_THEME_NAMES, DIARY_THEMES } from './types';

const THEME_LABELS: Record<DiaryThemeName, string> = {
  light: 'Light',
  dark: 'Dark',
  sepia: 'Sepia',
  forest: 'Forest',
  ocean: 'Ocean',
  sunset: 'Sunset',
};

interface ThemePickerProps {
  currentTheme: DiaryThemeName;
  onSelect: (theme: DiaryThemeName) => void;
  onClose: () => void;
}

export function ThemePicker({ currentTheme, onSelect, onClose }: ThemePickerProps) {
  return (
    <motion.div
      className="absolute top-full right-0 mt-2 rounded-xl overflow-hidden"
      role="listbox"
      aria-label="Theme selection"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--diary-bg, hsl(var(--background))) 90%, transparent)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--diary-border, hsl(var(--border)))',
        minWidth: 180,
        zIndex: 25,
      }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={zenMotion.snappy}
    >
      {/* Backdrop dismiss */}
      <div className="fixed inset-0 z-[-1]" onClick={onClose} />

      <div className="p-2 grid grid-cols-3 gap-2">
        {DIARY_THEME_NAMES.map((name) => {
          const theme = DIARY_THEMES[name];
          const isActive = name === currentTheme;
          return (
            <button
              key={name}
              role="option"
              aria-selected={isActive}
              onClick={() => { onSelect(name); onClose(); }}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg transition-colors min-h-[48px]"
              style={{
                backgroundColor: isActive ? 'color-mix(in srgb, var(--diary-accent, hsl(var(--primary))) 12%, transparent)' : 'transparent',
              }}
              aria-label={`Theme: ${THEME_LABELS[name]}`}
              onMouseDown={(e) => e.preventDefault()}
            >
              {/* Color swatch */}
              <div
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme['--diary-bg'],
                  borderColor: isActive ? theme['--diary-accent'] : theme['--diary-border'],
                }}
              >
                {isActive && <Check className="w-3.5 h-3.5" style={{ color: theme['--diary-accent'] }} />}
              </div>
              <span className="text-[10px]" style={{ color: 'var(--diary-muted, hsl(var(--muted-foreground)))' }}>
                {THEME_LABELS[name]}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
