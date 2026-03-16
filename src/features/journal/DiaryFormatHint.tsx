/**
 * DiaryFormatHint — one-time onboarding hint for the formatting toolbar.
 * Shows "Select text to format" message, auto-dismisses after 5s or on tap.
 */

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { zenMotion } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface DiaryFormatHintProps {
  onDismiss: () => void;
}

export function DiaryFormatHint({ onDismiss }: DiaryFormatHintProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={zenMotion.gentle}
      onClick={onDismiss}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm cursor-pointer"
    >
      <span className="text-sm">✨</span>
      <span className="text-xs text-muted-foreground">
        {ts.diaryFormatHint || 'Select text to format (bold, italic, etc.)'}
      </span>
    </motion.div>
  );
}
