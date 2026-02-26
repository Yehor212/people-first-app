/**
 * DiaryFormatToolbar — Telegram-style floating WYSIWYG toolbar.
 *
 * Appears above the text selection when user selects text inside the
 * contentEditable editor. Uses document.execCommand for formatting.
 * Hides when selection is cleared or moves outside the editor.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { zenMotion } from '@/lib/animationUtils';

interface DiaryFormatToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

const FORMAT_ACTIONS = [
  { cmd: 'bold', icon: 'B', style: 'font-bold' },
  { cmd: 'italic', icon: 'I', style: 'italic' },
  { cmd: 'underline', icon: 'U', style: 'underline' },
  { cmd: 'strikeThrough', icon: 'S', style: 'line-through' },
  { cmd: 'formatBlock:blockquote', icon: '❝', style: '' },
  { cmd: 'insertHTML:<code>', icon: '</>', style: 'font-mono text-[11px]' },
  { cmd: 'createLink', icon: '🔗', style: '' },
] as const;

const VIEWPORT_PADDING = 12;
const ARROW_OFFSET = 8;

export function DiaryFormatToolbar({ editorRef, scrollContainerRef }: DiaryFormatToolbarProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // --- Active format detection ---
  const checkActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    try {
      if (document.queryCommandState('bold')) formats.add('bold');
      if (document.queryCommandState('italic')) formats.add('italic');
      if (document.queryCommandState('underline')) formats.add('underline');
      if (document.queryCommandState('strikeThrough')) formats.add('strikeThrough');
    } catch {
      // queryCommandState may fail in some contexts
    }
    setActiveFormats(formats);
  }, []);

  // --- Selection tracking ---
  const updateSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setVisible(false);
      setSelectionRect(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const editorEl = editorRef.current;
    if (!editorEl || !editorEl.contains(range.commonAncestorContainer)) {
      setVisible(false);
      setSelectionRect(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setVisible(false);
      setSelectionRect(null);
      return;
    }

    setSelectionRect(rect);
    setVisible(true);
    checkActiveFormats();
  }, [editorRef, checkActiveFormats]);

  // Listen for selection changes
  useEffect(() => {
    document.addEventListener('selectionchange', updateSelection);
    return () => document.removeEventListener('selectionchange', updateSelection);
  }, [updateSelection]);

  // Mobile: also catch touchend (selection may finalize after touch handles released)
  useEffect(() => {
    const editorEl = editorRef.current;
    if (!editorEl) return;
    const onTouchEnd = () => {
      setTimeout(updateSelection, 50);
    };
    editorEl.addEventListener('touchend', onTouchEnd);
    return () => editorEl.removeEventListener('touchend', onTouchEnd);
  }, [editorRef, updateSelection]);

  // Scroll: reposition or hide if selection scrolled off-screen
  useEffect(() => {
    const scrollEl = scrollContainerRef?.current;
    if (!scrollEl) return;
    const onScroll = () => {
      if (!visible) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          setVisible(false);
          setSelectionRect(null);
        } else {
          setSelectionRect(rect);
        }
      }
    };
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, [scrollContainerRef, visible]);

  // --- Positioning ---
  const getPosition = useCallback((): React.CSSProperties => {
    if (!selectionRect || !toolbarRef.current) return {};

    const tbH = toolbarRef.current.offsetHeight;
    const tbW = toolbarRef.current.offsetWidth;

    // Prefer above selection
    let top = selectionRect.top - tbH - ARROW_OFFSET;
    if (top < VIEWPORT_PADDING) {
      // Flip below
      top = selectionRect.bottom + ARROW_OFFSET;
    }
    // Clamp bottom
    if (top + tbH > window.innerHeight - VIEWPORT_PADDING) {
      top = window.innerHeight - tbH - VIEWPORT_PADDING;
    }

    // Center horizontally on selection
    let left = selectionRect.left + selectionRect.width / 2 - tbW / 2;
    left = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - tbW - VIEWPORT_PADDING));

    return {
      position: 'fixed' as const,
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 100,
    };
  }, [selectionRect]);

  // --- Format execution ---
  const execFormat = useCallback((cmd: string) => {
    if (cmd === 'createLink') {
      const url = prompt(ts.diaryFormatLinkPrompt || 'URL:');
      if (url) document.execCommand('createLink', false, url);
    } else if (cmd === 'insertHTML:<code>') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const parent = range.commonAncestorContainer.parentElement;
        if (parent?.tagName === 'CODE') {
          const text = parent.textContent || '';
          parent.replaceWith(text);
        } else {
          const selectedText = range.toString();
          if (selectedText) {
            document.execCommand('insertHTML', false, `<code>${selectedText}</code>`);
          }
        }
      }
    } else if (cmd.startsWith('formatBlock:')) {
      document.execCommand('formatBlock', false, cmd.split(':')[1]);
    } else {
      document.execCommand(cmd, false);
    }
    editorRef.current?.focus();
    checkActiveFormats();
    // Re-read position after formatting (selection may shift)
    setTimeout(updateSelection, 0);
  }, [editorRef, checkActiveFormats, updateSelection, ts]);

  return (
    <AnimatePresence>
      {visible && selectionRect && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, scale: 0.85, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 8 }}
          transition={zenMotion.snappy}
          style={getPosition()}
          className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          onPointerDown={(e) => e.preventDefault()}
        >
          {FORMAT_ACTIONS.map(action => {
            const baseCmdName = action.cmd.includes(':') ? action.cmd.split(':')[0] : action.cmd;
            const isActive = activeFormats.has(baseCmdName === 'formatBlock' ? 'formatBlock' : action.cmd);
            return (
              <motion.button
                key={action.cmd}
                whileTap={{ scale: 0.9 }}
                onClick={() => execFormat(action.cmd)}
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center text-xs transition-all',
                  action.style,
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
                    : 'text-slate-400 hover:bg-white/10 hover:text-slate-50',
                )}
                aria-label={action.icon}
              >
                {action.icon}
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
