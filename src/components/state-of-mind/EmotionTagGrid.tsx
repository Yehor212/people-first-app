import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { zenMotion, zenTap, zenHover } from '@/lib/animationUtils';
import { haptics } from '@/lib/haptics';
import { getTagsForValence } from './emotionTags';
import type { Translations } from '@/i18n/types';

interface EmotionTagGridProps {
  valence: number;
  selected: string[];
  onToggle: (tag: string) => void;
}

/** Map emotion tag key to i18n key */
const tagToI18nKey = (key: string): keyof Translations => {
  const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
  return `somTag${capitalized}` as keyof Translations;
};

/** Parent variant: orchestrates stagger cascade (like HabitHubList pattern) */
const chipContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.02, delayChildren: 0.05 } },
};

/** Child variant: each chip scales + slides in */
const chipItem = {
  hidden: { opacity: 0, scale: 0.85, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: zenMotion.snappy },
};

/**
 * Multi-select chip grid for emotion adjectives.
 * Tags are filtered by current valence range.
 *
 * Law 9 (a11y): semantic <button>, keyboard accessible.
 * Law 13 (Premium): zenTap/zenHover tokens, no ad-hoc springs.
 * Law 17 (i18n): logical margins, i18n key lookup.
 * Upgrade 5: framer-motion staggerChildren (replaces CSS nth-child).
 */
export function EmotionTagGrid({ valence, selected, onToggle }: EmotionTagGridProps) {
  const { t } = useLanguage();

  const filteredTags = useMemo(() => getTagsForValence(valence), [valence]);

  return (
    <motion.div
      variants={chipContainer}
      initial="hidden"
      animate="visible"
      className="flex flex-wrap gap-2.5 px-1"
    >
      {filteredTags.map((tag) => {
        const isSelected = selected.includes(tag.key);
        const i18nKey = tagToI18nKey(tag.key);
        const label = (t[i18nKey] as string) || tag.key;

        return (
          <motion.button
            key={tag.key}
            type="button"
            variants={chipItem}
            whileTap={zenTap.button}
            whileHover={zenHover.glow}
            animate={{
              scale: isSelected ? 1 : 0.95,
              opacity: isSelected ? 1 : 0.75,
            }}
            transition={zenMotion.snappy}
            className={[
              'px-4 py-2.5 rounded-xl text-sm font-medium min-h-[44px]',
              'ring-1 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50',
              isSelected
                ? 'bg-primary/10 text-primary ring-primary/30'
                : 'bg-card text-muted-foreground ring-black/5 dark:ring-white/10',
            ].join(' ')}
            onClick={() => {
              onToggle(tag.key);
              void haptics.light();
            }}
          >
            {label}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
