/**
 * DiaryToolbar — Frosted glass toolbar for the fullscreen diary.
 *
 * Contains: formatting buttons, insert actions, pickers, close.
 * Sticky top when keyboard is open (Phase 1 architecture).
 * onMouseDown={preventDefault} on all buttons to preserve editor focus.
 */

import { useState } from 'react';
import {
  Bold, Italic, Heading2, List, ImagePlus, Flame,
  Focus, Type, Palette, X,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { FontPicker } from './FontPicker';
import { ThemePicker } from './ThemePicker';
import type { DiaryEditorReturn } from '../hooks/useDiaryEditor';
import type { DiaryThemeName, DiaryFontName, DiaryThemeConfig } from '../types';

interface DiaryToolbarProps {
  editor: DiaryEditorReturn;
  theme: DiaryThemeName;
  font: DiaryFontName;
  themeVars: DiaryThemeConfig;
  keyboardOpen: boolean;
  spotlightActive: boolean;
  onSetTheme: (t: DiaryThemeName) => void;
  onSetFont: (f: DiaryFontName) => void;
  onInsertImage: () => void;
  onInsertBurnWidget: () => void;
  onToggleSpotlight: () => void;
  onClose: () => void;
}

export function DiaryToolbar({
  editor, theme, font, themeVars, keyboardOpen, spotlightActive,
  onSetTheme, onSetFont, onInsertImage, onInsertBurnWidget,
  onToggleSpotlight, onClose,
}: DiaryToolbarProps) {
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);

  const closePickers = () => { setShowFontPicker(false); setShowThemePicker(false); };

  return (
    <div
      className="relative z-20 flex items-center gap-0.5 px-3 shrink-0"
      style={{
        height: 52,
        ...(keyboardOpen
          ? {
              position: 'sticky' as const,
              top: 0,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              backgroundColor: `color-mix(in srgb, ${themeVars['--diary-bg']} 80%, transparent)`,
              borderBottom: `1px solid ${themeVars['--diary-border']}`,
            }
          : {
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }),
      }}
    >
      {/* ── Formatting group ── */}
      <ToolBtn onClick={editor.execBold} label="Bold"><Bold className="w-4 h-4" /></ToolBtn>
      <ToolBtn onClick={editor.execItalic} label="Italic"><Italic className="w-4 h-4" /></ToolBtn>
      <ToolBtn onClick={editor.execHeading} label="Heading"><Heading2 className="w-4 h-4" /></ToolBtn>
      <ToolBtn onClick={editor.execList} label="List"><List className="w-4 h-4" /></ToolBtn>

      <Separator />

      {/* ── Insert group ── */}
      <ToolBtn onClick={onInsertImage} label="Insert image"><ImagePlus className="w-4 h-4" /></ToolBtn>
      <ToolBtn onClick={onInsertBurnWidget} label="Burn a thought"><Flame className="w-4 h-4" /></ToolBtn>

      <Separator />

      {/* ── Mode ── */}
      <ToolBtn
        onClick={onToggleSpotlight}
        label="Focus mode"
        active={spotlightActive}
      >
        <Focus className="w-4 h-4" />
      </ToolBtn>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Pickers ── */}
      <div className="relative">
        <ToolBtn
          onClick={() => { closePickers(); setShowFontPicker(!showFontPicker); }}
          label="Font"
          active={showFontPicker}
        >
          <Type className="w-4 h-4" />
        </ToolBtn>
        <AnimatePresence>
          {showFontPicker && (
            <FontPicker
              currentFont={font}
              onSelect={onSetFont}
              onClose={() => setShowFontPicker(false)}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        <ToolBtn
          onClick={() => { closePickers(); setShowThemePicker(!showThemePicker); }}
          label="Theme"
          active={showThemePicker}
        >
          <Palette className="w-4 h-4" />
        </ToolBtn>
        <AnimatePresence>
          {showThemePicker && (
            <ThemePicker
              currentTheme={theme}
              onSelect={onSetTheme}
              onClose={() => setShowThemePicker(false)}
            />
          )}
        </AnimatePresence>
      </div>

      <Separator />

      {/* ── Close ── */}
      <ToolBtn onClick={onClose} label="Close diary">
        <X className="w-4.5 h-4.5" />
      </ToolBtn>
    </div>
  );
}

// ── Presentational helpers (tiny, no separate files) ──

function ToolBtn({
  onClick, label, active, children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
      style={{
        color: active ? 'var(--diary-accent)' : 'var(--diary-muted)',
        backgroundColor: active ? 'color-mix(in srgb, var(--diary-accent) 12%, transparent)' : 'transparent',
      }}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

function Separator() {
  return (
    <div
      className="w-px h-5 mx-1 shrink-0"
      style={{ backgroundColor: 'var(--diary-border)' }}
    />
  );
}
