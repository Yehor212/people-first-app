/**
 * SpotlightOverlay — Focus mode dimming for journal textarea.
 *
 * When active + textarea focused → dims everything except the textarea.
 * On textarea blur → overlay fades out.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { zenMotion } from '@/lib/animationUtils';

interface SpotlightOverlayProps {
  isActive: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function SpotlightOverlay({ isActive, textareaRef }: SpotlightOverlayProps) {
  const [isFocused, setIsFocused] = useState(false);

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

    // Check if already focused
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

  return (
    <AnimatePresence>
      {isActive && isFocused && (
        <motion.div
          className="fixed inset-0 pointer-events-none backdrop-blur-[2px]"
          style={{ zIndex: 15, backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
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
