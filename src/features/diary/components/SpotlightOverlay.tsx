/**
 * SpotlightOverlay — Focus mode dimming.
 *
 * Dims everything except the currently active paragraph.
 * Listens to `selectionchange` to track which paragraph has the cursor.
 * The active paragraph gets elevated z-index + background to "pop through" the overlay.
 */

import { useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { zenMotion } from '@/lib/animationUtils';

interface SpotlightOverlayProps {
  isActive: boolean;
  editorRef: React.RefObject<HTMLDivElement | null>;
}

const SPOTLIGHT_CLASS = 'diary-spotlight-active';

export function SpotlightOverlay({ isActive, editorRef }: SpotlightOverlayProps) {
  const prevHighlightRef = useRef<Element | null>(null);

  // Track cursor paragraph via selectionchange
  const updateSpotlight = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !isActive) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const node = sel.focusNode;
    if (!node || !editor.contains(node)) return;

    // Walk up to nearest block element
    let block: Element | null = node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

    while (block && block !== editor) {
      const tag = block.tagName?.toLowerCase();
      if (tag === 'p' || tag === 'div' || tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'li') break;
      block = block.parentElement;
    }

    if (block === editor) block = null;

    // Remove old highlight
    if (prevHighlightRef.current && prevHighlightRef.current !== block) {
      prevHighlightRef.current.classList.remove(SPOTLIGHT_CLASS);
    }

    // Add new highlight
    if (block) {
      block.classList.add(SPOTLIGHT_CLASS);
      prevHighlightRef.current = block;
    }
  }, [isActive, editorRef]);

  useEffect(() => {
    if (!isActive) {
      // Clean up on deactivation
      if (prevHighlightRef.current) {
        prevHighlightRef.current.classList.remove(SPOTLIGHT_CLASS);
        prevHighlightRef.current = null;
      }
      return;
    }

    document.addEventListener('selectionchange', updateSpotlight);
    updateSpotlight(); // Initial highlight

    return () => {
      document.removeEventListener('selectionchange', updateSpotlight);
      if (prevHighlightRef.current) {
        prevHighlightRef.current.classList.remove(SPOTLIGHT_CLASS);
        prevHighlightRef.current = null;
      }
    };
  }, [isActive, updateSpotlight]);

  if (!isActive) return null;

  return (
    <motion.div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 15, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={zenMotion.exit}
      aria-hidden="true"
    />
  );
}
