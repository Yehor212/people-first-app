/**
 * useDiaryEditor — ContentEditable state management.
 *
 * Manages:
 * - HTML content state via onInput (no dangerouslySetInnerHTML)
 * - Formatting commands with selection save/restore
 * - Plain text + word count derivation
 * - Event delegation routing for widget placeholders
 * - MutationObserver for widget placeholder deletion → orphan cleanup (Guardrail 2)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { WidgetState } from '../types';
import { logger } from '@/lib/logger';

interface EditorState {
  htmlContent: string;
  plainText: string;
  wordCount: number;
}

export interface DiaryEditorReturn {
  editorRef: React.RefObject<HTMLDivElement | null>;
  state: EditorState;
  widgetStates: Record<string, WidgetState>;
  activeWidgetId: string | null;
  handleInput: () => void;
  insertHtmlAtCursor: (html: string) => void;
  execBold: () => void;
  execItalic: () => void;
  execHeading: () => void;
  execList: () => void;
  handleEditorClick: (e: React.MouseEvent) => void;
  setActiveWidgetId: (id: string | null) => void;
  updateWidgetState: (id: string, ws: WidgetState) => void;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function useDiaryEditor(): DiaryEditorReturn {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<EditorState>({
    htmlContent: '',
    plainText: '',
    wordCount: 0,
  });
  const [widgetStates, setWidgetStates] = useState<Record<string, WidgetState>>({});
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);

  // ── Input handler ──
  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    const text = el.textContent || '';
    setState({ htmlContent: html, plainText: text, wordCount: countWords(text) });
  }, []);

  // ── Formatting with selection save/restore ──
  const execFormatting = useCallback((command: string, value?: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    // Save selection range
    const range = sel.getRangeAt(0);

    document.execCommand(command, false, value);

    // Restore selection (some Android WebViews reset it after execCommand)
    try {
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {
      // Selection restoration not critical — user can re-select
    }

    handleInput();
  }, [handleInput]);

  // ── Insert arbitrary HTML at cursor position ──
  const insertHtmlAtCursor = useCallback((html: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand('insertHTML', false, html);
    handleInput();
  }, [handleInput]);

  const execBold = useCallback(() => execFormatting('bold'), [execFormatting]);
  const execItalic = useCallback(() => execFormatting('italic'), [execFormatting]);
  const execHeading = useCallback(() => execFormatting('formatBlock', 'h2'), [execFormatting]);
  const execList = useCallback(() => execFormatting('insertUnorderedList'), [execFormatting]);

  // ── Event delegation for widget placeholders ──
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const widgetEl = target.closest('[data-widget]');
    if (!widgetEl) return;

    const widgetId = widgetEl.getAttribute('data-widget-id');
    if (widgetId) {
      setActiveWidgetId(widgetId);
    }
  }, []);

  // ── Widget state sidecar management ──
  const updateWidgetState = useCallback((id: string, ws: WidgetState) => {
    setWidgetStates(prev => ({ ...prev, [id]: ws }));
  }, []);

  // ── MutationObserver: garbage-collect orphaned widgetStates (Guardrail 2) ──
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      // Find all widget placeholder IDs still in the DOM
      const liveIds = new Set<string>();
      el.querySelectorAll('[data-widget-id]').forEach(node => {
        const id = node.getAttribute('data-widget-id');
        if (id) liveIds.add(id);
      });

      // Remove orphaned widget states
      setWidgetStates(prev => {
        const keys = Object.keys(prev);
        const orphans = keys.filter(k => !liveIds.has(k));
        if (orphans.length === 0) return prev;

        const next = { ...prev };
        for (const orphan of orphans) {
          delete next[orphan];
          logger.log(`[DiaryEditor] Cleaned orphaned widget state: ${orphan}`);
        }
        return next;
      });
    });

    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return {
    editorRef,
    state,
    widgetStates,
    activeWidgetId,
    handleInput,
    insertHtmlAtCursor,
    execBold,
    execItalic,
    execHeading,
    execList,
    handleEditorClick,
    setActiveWidgetId,
    updateWidgetState,
  };
}
