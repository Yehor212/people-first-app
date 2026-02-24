/**
 * FontPicker — Inline dropdown for selecting diary font.
 * Renders 3 font options with live preview text.
 */

import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { zenMotion } from '@/lib/animationUtils';
import type { DiaryFontName } from './types';
import { DIARY_FONT_NAMES, DIARY_FONTS } from './types';

const FONT_LABELS: Record<DiaryFontName, string> = {
  caveat: 'Handwriting',
  cormorant: 'Serif',
  outfit: 'Sans-serif',
};

interface FontPickerProps {
  currentFont: DiaryFontName;
  onSelect: (font: DiaryFontName) => void;
  onClose: () => void;
}

export function FontPicker({ currentFont, onSelect, onClose }: FontPickerProps) {
  return (
    <motion.div
      className="absolute top-full right-0 mt-2 rounded-xl overflow-hidden"
      role="listbox"
      aria-label="Font selection"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--diary-bg, hsl(var(--background))) 90%, transparent)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--diary-border, hsl(var(--border)))',
        minWidth: 200,
        zIndex: 25,
      }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={zenMotion.snappy}
    >
      {/* Backdrop dismiss */}
      <div className="fixed inset-0 z-[-1]" onClick={onClose} />

      {DIARY_FONT_NAMES.map((name) => {
        const isActive = name === currentFont;
        return (
          <button
            key={name}
            role="option"
            aria-selected={isActive}
            onClick={() => { onSelect(name); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors min-h-[48px]"
            style={{
              color: 'var(--diary-text, hsl(var(--foreground)))',
              backgroundColor: isActive ? 'color-mix(in srgb, var(--diary-accent, hsl(var(--primary))) 12%, transparent)' : 'transparent',
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <span
              style={{ fontFamily: DIARY_FONTS[name].family, fontSize: '1.1rem' }}
            >
              {FONT_LABELS[name]}
            </span>
            {isActive && <Check className="w-4 h-4 ml-auto" style={{ color: 'var(--diary-accent, hsl(var(--primary)))' }} />}
          </button>
        );
      })}
    </motion.div>
  );
}
