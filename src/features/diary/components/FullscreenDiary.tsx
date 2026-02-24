/**
 * FullscreenDiary — Premium fullscreen diary overlay.
 *
 * Architecture:
 * - Fixed inset-0 z-50 overlay — covers entire screen
 * - Scoped CSS vars on wrapper (no global body/html mutation)
 * - Canvas background layer (decorative, never resizes for keyboard)
 * - ContentEditable editor with event delegation
 * - 2-layer image system: inert placeholders + interactive overlay (DiaryImageBlock)
 * - Widget overlay: BurnThoughtWidget renders at placeholder coordinates
 * - VisualViewport API for keyboard detection → toolbar sticky top
 * - SpotlightOverlay for focus mode dimming
 * - useModalA11y for Escape + Android back
 * - useScrollLock to freeze background scroll
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { nanoid } from 'nanoid';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useScrollLock } from '@/hooks/useScrollLock';
import { zenMotion } from '@/lib/animationUtils';
import { DiaryCanvas } from './DiaryCanvas';
import { DiaryEditor } from './DiaryEditor';
import { DiaryToolbar } from './DiaryToolbar';
import { DiaryImageBlock } from './DiaryImageBlock';
import { BurnThoughtWidget } from './BurnThoughtWidget';
import { SpotlightOverlay } from './SpotlightOverlay';
import { useDiaryTheme } from '../hooks/useDiaryTheme';
import { useDiaryEditor } from '../hooks/useDiaryEditor';
import { useDiaryImages } from '../hooks/useDiaryImages';
import { useDiaryPersistence } from '../hooks/useDiaryPersistence';
import type { DiaryThemeName, DiaryFontName, WidgetState } from '../types';

interface FullscreenDiaryProps {
  isOpen: boolean;
  onClose: () => void;
  initialTheme?: DiaryThemeName;
  initialFont?: DiaryFontName;
}

export function FullscreenDiary({
  isOpen,
  onClose,
  initialTheme = 'dark',
  initialFont = 'caveat',
}: FullscreenDiaryProps) {
  useScrollLock(isOpen);

  const themeState = useDiaryTheme(initialTheme, initialFont);
  const editor = useDiaryEditor();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const entryIdRef = useRef<string | null>(null);

  const diaryImages = useDiaryImages(
    editor.editorRef,
    scrollContainerRef,
    editor.handleInput,
  );

  const persistence = useDiaryPersistence();

  // ── Save-on-close (fire-and-forget — don't block UI) ──
  const handleSaveAndClose = useCallback(() => {
    if (editor.state.plainText.trim()) {
      void persistence.save({
        id: entryIdRef.current,
        htmlContent: editor.state.htmlContent,
        plainText: editor.state.plainText,
        wordCount: editor.state.wordCount,
        theme: themeState.theme,
        font: themeState.font,
        widgetStates: editor.widgetStates,
        images: diaryImages.images,
      }).then(id => { entryIdRef.current = id; });
    }
    persistence.cancelPendingSave();
    onClose();
  }, [editor.state, editor.widgetStates, themeState.theme, themeState.font, diaryImages.images, persistence, onClose]);

  useModalA11y(isOpen, handleSaveAndClose);

  // ── Spotlight focus mode ──
  const [spotlightActive, setSpotlightActive] = useState(false);

  // ── Keyboard detection via VisualViewport API ──
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const kbH = window.innerHeight - vv.height;
      const isKb = kbH > 100;
      setKeyboardOpen(isKb);
      setKeyboardHeight(isKb ? kbH : 0);
    };

    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [isOpen]);

  // ── Burn widget position (computed once on activation) ──
  const [burnWidgetPos, setBurnWidgetPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!editor.activeWidgetId) {
      setBurnWidgetPos(null);
      return;
    }
    const el = editor.editorRef.current;
    const container = scrollContainerRef.current;
    if (!el || !container) return;

    const placeholder = el.querySelector(`[data-widget-id="${editor.activeWidgetId}"]`);
    if (!placeholder) return;

    const containerRect = container.getBoundingClientRect();
    const rect = placeholder.getBoundingClientRect();
    setBurnWidgetPos({
      top: rect.top - containerRect.top + container.scrollTop,
      left: rect.left - containerRect.left,
      width: rect.width,
    });
  }, [editor.activeWidgetId, editor.editorRef]);

  // ── Insert burn widget placeholder at cursor ──
  const handleInsertBurnWidget = useCallback(() => {
    const id = nanoid(10);
    const html = `<div data-widget="burn" data-widget-id="${id}" contenteditable="false" class="diary-widget-placeholder">\u{1F525} Burn a thought</div>`;
    editor.insertHtmlAtCursor(html);
    editor.setActiveWidgetId(id);
  }, [editor]);

  // ── Image insertion via file input ──
  const handleInsertImage = useCallback(() => {
    diaryImages.fileInputRef.current?.click();
  }, [diaryImages.fileInputRef]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      void diaryImages.insertImage(file);
    }
    e.target.value = '';
  }, [diaryImages]);

  // ── Scoped style vars (CSS isolation — no body mutation) ──
  const scopeStyle = useMemo(
    () => ({
      ...themeState.themeVars,
      backgroundColor: themeState.themeVars['--diary-bg'],
      color: themeState.themeVars['--diary-text'],
    } as React.CSSProperties),
    [themeState.themeVars],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="diary-fullscreen"
          className="fixed inset-0 z-50 flex flex-col overflow-hidden"
          style={scopeStyle}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={zenMotion.gentle}
        >
          {/* Canvas decorative background */}
          <DiaryCanvas accentColor={themeState.accentColor} isActive={isOpen} />

          {/* Glass toolbar */}
          <DiaryToolbar
            editor={editor}
            theme={themeState.theme}
            font={themeState.font}
            themeVars={themeState.themeVars}
            keyboardOpen={keyboardOpen}
            spotlightActive={spotlightActive}
            onSetTheme={themeState.setTheme}
            onSetFont={themeState.setFont}
            onInsertImage={handleInsertImage}
            onInsertBurnWidget={handleInsertBurnWidget}
            onToggleSpotlight={() => setSpotlightActive(prev => !prev)}
            onClose={handleSaveAndClose}
          />

          {/* Scrollable content area (relative for absolute-positioned overlays) */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto relative z-10"
            style={{ paddingBottom: keyboardOpen ? keyboardHeight + 16 : 80 }}
            onDragOver={diaryImages.handleDragOver}
            onDrop={diaryImages.handleDrop}
          >
            <DiaryEditor editor={editor} fontFamily={themeState.fontFamily} />

            {/* Image overlay — pointer-events: none base, each block gets pointer-events: auto */}
            {diaryImages.images.length > 0 && (
              <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ zIndex: 5 }}>
                {diaryImages.images.map(img => (
                  <DiaryImageBlock
                    key={img.id}
                    image={img}
                    onRemove={diaryImages.removeImage}
                    onScaleChange={diaryImages.updateImageScale}
                  />
                ))}
              </div>
            )}

            {/* Burn widget overlay */}
            {editor.activeWidgetId && burnWidgetPos && (
              <BurnThoughtWidget
                widgetId={editor.activeWidgetId}
                initialState={
                  editor.widgetStates[editor.activeWidgetId] as
                    Extract<WidgetState, { type: 'burn' }> | undefined
                }
                position={burnWidgetPos}
                onStateChange={editor.updateWidgetState}
                onClose={() => editor.setActiveWidgetId(null)}
              />
            )}
          </div>

          {/* Hidden file input for image insertion */}
          <input
            ref={diaryImages.fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Spotlight focus overlay */}
          <SpotlightOverlay isActive={spotlightActive} editorRef={editor.editorRef} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
