/**
 * PrivacyShield — Masks diary text for public writing (metro, café, etc.).
 *
 * When active:
 * - All text in the editor is heavily blurred (blur 8px)
 * - Only the current word being typed remains visible
 * - As user types spaces, previous words get blurred instantly
 *
 * This is a headless component — it manipulates the editorRef's children
 * via CSS classes for performance.
 */

import { useEffect, useRef, useCallback } from 'react';

const BLURRED_CLASS = 'privacy-blurred';
const VISIBLE_CLASS = 'privacy-visible';

interface PrivacyShieldProps {
  isActive: boolean;
  editorRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Find the text node and offset of the current caret position.
 */
function getCaretContext(): { node: Text; offset: number } | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    return { node: node as Text, offset: range.startOffset };
  }
  return null;
}

/**
 * Find word boundaries around a given offset in text.
 * Returns [start, end] indices.
 */
function getWordBounds(text: string, offset: number): [number, number] {
  // Expand left to find word start
  let start = offset;
  while (start > 0 && text[start - 1] !== ' ' && text[start - 1] !== '\n') {
    start--;
  }
  // Expand right to find word end
  let end = offset;
  while (end < text.length && text[end] !== ' ' && text[end] !== '\n') {
    end++;
  }
  return [start, end];
}

export function PrivacyShield({ isActive, editorRef }: PrivacyShieldProps) {
  const prevSpanRef = useRef<HTMLSpanElement | null>(null);

  /** Remove any existing privacy-visible span and merge text nodes */
  const cleanupVisibleSpan = useCallback(() => {
    const span = prevSpanRef.current;
    if (span && span.parentNode) {
      const text = span.textContent || '';
      const textNode = document.createTextNode(text);
      span.parentNode.replaceChild(textNode, span);
      textNode.parentElement?.normalize();
    }
    prevSpanRef.current = null;
  }, []);

  /** Apply blur to editor, reveal current word */
  const update = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !isActive) return;

    // Clean up previous visible span first
    cleanupVisibleSpan();

    const caret = getCaretContext();
    if (!caret) return;

    const { node, offset } = caret;

    // Only process if caret is inside our editor
    if (!editor.contains(node)) return;
    const text = node.textContent || '';
    const [wordStart, wordEnd] = getWordBounds(text, offset);

    if (wordStart === wordEnd) return; // empty

    // Split the text node into: before | visible-word | after
    // We need to be careful not to break the selection
    const before = text.slice(0, wordStart);
    const word = text.slice(wordStart, wordEnd);
    const after = text.slice(wordEnd);

    const parent = node.parentNode;
    if (!parent) return;

    const span = document.createElement('span');
    span.className = VISIBLE_CLASS;
    span.textContent = word;

    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(span);
    if (after) frag.appendChild(document.createTextNode(after));

    parent.replaceChild(frag, node);
    prevSpanRef.current = span;

    // Restore caret position inside the visible span
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      const spanText = span.firstChild;
      if (spanText) {
        const newOffset = Math.min(offset - wordStart, spanText.textContent?.length || 0);
        range.setStart(spanText, newOffset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, [isActive, editorRef, cleanupVisibleSpan]);

  // ── Toggle blur class on editor ──
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (isActive) {
      editor.classList.add(BLURRED_CLASS);
      update();
    } else {
      editor.classList.remove(BLURRED_CLASS);
      cleanupVisibleSpan();
    }

    return () => {
      editor.classList.remove(BLURRED_CLASS);
      cleanupVisibleSpan();
    };
  }, [isActive, editorRef, update, cleanupVisibleSpan]);

  // ── Track input and selection changes ──
  useEffect(() => {
    if (!isActive) return;

    const editor = editorRef.current;

    const onInput = () => update();
    const onSelectionChange = () => update();

    editor?.addEventListener('input', onInput);
    document.addEventListener('selectionchange', onSelectionChange);

    return () => {
      editor?.removeEventListener('input', onInput);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [isActive, editorRef, update]);

  return null;
}
