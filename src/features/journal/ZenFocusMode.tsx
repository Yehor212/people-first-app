/**
 * ZenFocusMode — Typewriter-style paragraph dimming for the diary editor.
 *
 * When active:
 * - Current paragraph (where caret is) stays at 100% opacity
 * - All other paragraphs dim to 30% opacity + blur(2px)
 * - On input, current paragraph auto-scrolls to viewport center (typewriter effect)
 * - On manual scroll, dimming pauses so user can read freely
 * - On next input/caret change, dimming resumes
 *
 * This is a headless component — it manipulates the editorRef's children directly
 * via CSS classes for 60fps performance (no React re-renders on caret movement).
 */

import { useEffect, useRef, useCallback } from 'react';

interface ZenFocusModeProps {
  isActive: boolean;
  editorRef: React.RefObject<HTMLDivElement | null>;
}

const ZEN_DIMMED_CLASS = 'zen-dimmed';

/**
 * Walk up from a node to find the direct child of the editor container.
 * Returns null if node is not inside the editor.
 */
function findParentParagraph(node: Node | null, editor: HTMLElement | null): HTMLElement | null {
  if (!node || !editor) return null;
  let current: Node | null = node;
  while (current && current !== editor) {
    if (current.parentNode === editor && current instanceof HTMLElement) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

export function ZenFocusMode({ isActive, editorRef }: ZenFocusModeProps) {
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastParagraphRef = useRef<HTMLElement | null>(null);

  /** Apply dimming to all paragraphs except the active one */
  const applyDimming = useCallback((activeParagraph: HTMLElement | null) => {
    const editor = editorRef.current;
    if (!editor) return;

    const children = editor.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      if (child === activeParagraph) {
        child.classList.remove(ZEN_DIMMED_CLASS);
      } else {
        child.classList.add(ZEN_DIMMED_CLASS);
      }
    }
    lastParagraphRef.current = activeParagraph;
  }, [editorRef]);

  /** Remove dimming from all paragraphs */
  const clearDimming = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const children = editor.children;
    for (let i = 0; i < children.length; i++) {
      (children[i] as HTMLElement).classList.remove(ZEN_DIMMED_CLASS);
    }
    lastParagraphRef.current = null;
  }, [editorRef]);

  /** Find active paragraph from current selection and apply dimming */
  const updateFocus = useCallback(() => {
    if (!isActive || isScrollingRef.current) return;
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const node = sel.getRangeAt(0).startContainer;
    const paragraph = findParentParagraph(node, editorRef.current);
    if (paragraph && paragraph !== lastParagraphRef.current) {
      applyDimming(paragraph);
    }
  }, [isActive, editorRef, applyDimming]);

  // ── Selection & input tracking ──
  useEffect(() => {
    if (!isActive) {
      clearDimming();
      return;
    }

    const onSelectionChange = () => {
      // Resume dimming if user tapped back into editor
      if (isScrollingRef.current) {
        isScrollingRef.current = false;
      }
      updateFocus();
    };

    const editor = editorRef.current;
    const onInput = () => {
      isScrollingRef.current = false;
      updateFocus();

      // Typewriter auto-scroll: keep active paragraph centered
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const node = sel.getRangeAt(0).startContainer;
      const paragraph = findParentParagraph(node, editor);
      if (paragraph) {
        paragraph.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    document.addEventListener('selectionchange', onSelectionChange);
    editor?.addEventListener('input', onInput);

    // Initial apply
    updateFocus();

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      editor?.removeEventListener('input', onInput);
      clearDimming();
    };
  }, [isActive, editorRef, updateFocus, clearDimming]);

  // ── Scroll detection: pause dimming while user reads ──
  useEffect(() => {
    if (!isActive) return;

    // Find the scrollable container (parent of editor with overflow-y: auto)
    const editor = editorRef.current;
    const scrollContainer = editor?.closest<HTMLElement>('[class*="overflow-y"]') ?? null;
    if (!scrollContainer) return;

    const onScroll = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        clearDimming();
      }
      // Reset debounce timer
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        // After 500ms of no scroll, stay in reading mode
        // Dimming will resume on next input/selection change
      }, 500);
    };

    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener('scroll', onScroll);
      clearTimeout(scrollTimeoutRef.current);
    };
  }, [isActive, editorRef, clearDimming]);

  // Headless component — renders nothing
  return null;
}
