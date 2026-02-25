/**
 * SpotlightOverlay — Focus-mode radial spotlight for journal textarea.
 *
 * When active + textarea focused → dark overlay with radial-gradient mask
 * that follows mouse/touch cursor. Uses ref-based DOM manipulation for
 * 60fps performance (no React state for cursor position).
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { zenMotion } from '@/lib/animationUtils';

interface SpotlightOverlayProps {
  isActive: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function SpotlightOverlay({ isActive, textareaRef }: SpotlightOverlayProps) {
  const [isFocused, setIsFocused] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Focus/blur tracking
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !isActive) {
      setIsFocused(false);
      return;
    }

    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);

    textarea.addEventListener('focus', onFocus);
    textarea.addEventListener('blur', onBlur);

    if (document.activeElement === textarea) {
      setIsFocused(true);
    }

    return () => {
      textarea.removeEventListener('focus', onFocus);
      textarea.removeEventListener('blur', onBlur);
    };
  }, [isActive, textareaRef]);

  // Elevate textarea z-index when spotlight active
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (isActive && isFocused) {
      textarea.style.position = 'relative';
      textarea.style.zIndex = '20';
    } else {
      textarea.style.position = '';
      textarea.style.zIndex = '';
    }

    return () => {
      textarea.style.position = '';
      textarea.style.zIndex = '';
    };
  }, [isActive, isFocused, textareaRef]);

  // Ref-based cursor tracking — no React re-renders
  const updatePosition = useCallback((x: number, y: number) => {
    const el = overlayRef.current;
    if (!el) return;
    el.style.setProperty('--mx', `${x}px`);
    el.style.setProperty('--my', `${y}px`);
  }, []);

  useEffect(() => {
    if (!isActive || !isFocused) return;

    const onMouseMove = (e: MouseEvent) => updatePosition(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) updatePosition(touch.clientX, touch.clientY);
    };

    // Initialize at center
    updatePosition(window.innerWidth / 2, window.innerHeight / 2);

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, [isActive, isFocused, updatePosition]);

  return (
    <AnimatePresence>
      {isActive && isFocused && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 15,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            '--mx': '50%',
            '--my': '50%',
            WebkitMaskImage: 'radial-gradient(circle 140px at var(--mx) var(--my), transparent 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,1) 100%)',
            maskImage: 'radial-gradient(circle 140px at var(--mx) var(--my), transparent 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,1) 100%)',
          } as React.CSSProperties}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={zenMotion.exit}
          aria-hidden="true"
        />
      )}
    </AnimatePresence>
  );
}
