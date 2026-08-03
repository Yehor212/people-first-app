import { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { zenMotion, zenTap, zenHover } from '@/lib/animationUtils';
import { haptics } from '@/lib/haptics';
import { getTagsForValence, sortByWarmth } from './emotionTags';
import { emotionTagToI18nKey } from './emotionI18n';

interface EmotionTagGridProps {
  valence: number;
  selected: string[];
  onToggle: (tag: string) => void;
  /**
   * When true, collapses to only tags flagged `initialVisible` and
   * exposes a "More precise" button to reveal the remainder with a
   * Bloom stagger. Button also collapses back. When false (default),
   * preserves V1 behavior — tags flow with the legacy "Show More" split.
   */
  expandable?: boolean;
  /** Fired when the user toggles the precision control. */
  onExpandToggle?: (expanded: boolean) => void;
}

/** Legacy V1 fallback: first 8 tags, flip to all on click (no collapse). */
const INITIAL_VISIBLE = 8;

/** Parent variant: orchestrates stagger cascade (like HabitHubList pattern) */
const chipContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.02, delayChildren: 0.05 } },
};

/** Child variant: each chip scales + slides in (Bloom-shaped). */
const chipItem = {
  hidden: { opacity: 0, scale: 0.85, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: zenMotion.snappy },
};

/**
 * Multi-select chip grid for emotion adjectives.
 * Tags are filtered by current valence range.
 *
 * When `expandable={true}`:
 *   - initial view renders only `initialVisible` tags (tier-1)
 *   - "More precise" button reveals remaining tags with Bloom stagger
 *   - tapping again collapses back
 *   - aria-expanded wired, Arrow keys step between chips
 *
 * When `expandable={false}` (default): preserves V1 two-mode flow —
 * first 8 chips visible, "Show more" button reveals the rest (no collapse).
 *
 * Law 9 (a11y): semantic <button>, keyboard accessible, aria-expanded.
 * Law 13 (Premium): zenTap/zenHover tokens, no ad-hoc springs.
 * Law 17 (i18n): logical margins, i18n key lookup.
 */
export function EmotionTagGrid({
  valence,
  selected,
  onToggle,
  expandable = false,
  onExpandToggle,
}: EmotionTagGridProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const filteredTags = useMemo(() => getTagsForValence(valence), [valence]);

  // In expandable mode: initial = tier-1 (initialVisible flag), sorted by warmth.
  // Full = every matching tag, sorted by warmth.
  const { visibleTags, hasMore } = useMemo(() => {
    if (expandable) {
      const initial = sortByWarmth(filteredTags.filter((t) => t.initialVisible));
      const full = sortByWarmth(filteredTags);
      const list = expanded ? full : initial;
      return {
        visibleTags: list,
        hasMore: full.length > initial.length,
      };
    }
    // V1 path: untouched.
    const list = expanded
      ? filteredTags
      : filteredTags.slice(0, INITIAL_VISIBLE);
    return {
      visibleTags: list,
      hasMore: filteredTags.length > INITIAL_VISIBLE,
    };
  }, [expandable, expanded, filteredTags]);

  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleExpandToggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      onExpandToggle?.(next);
      void haptics.light();
      return next;
    });
  }, [onExpandToggle]);

  const handleChipKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const next = (index + delta + visibleTags.length) % visibleTags.length;
      chipRefs.current[next]?.focus();
    },
    [visibleTags.length],
  );

  const buttonLabel = expandable ? t.emotionMorePrecise : t.somShowMore;

  return (
    <div>
      <motion.div
        variants={chipContainer}
        initial="hidden"
        animate="visible"
        className="flex min-w-0 max-w-full flex-wrap gap-2.5 px-0"
        id="emotion-tag-chips"
        role="group"
        data-testid="emotion-tag-chips"
      >
        {visibleTags.map((tag, index) => {
          const isSelected = selected.includes(tag.key);
          const i18nKey = emotionTagToI18nKey(tag.key);
          const label = (t[i18nKey] as string) || tag.key;

          return (
            <motion.button
              key={tag.key}
              ref={(el) => {
                chipRefs.current[index] = el;
              }}
              type="button"
              variants={chipItem}
              whileTap={zenTap.button}
              whileHover={zenHover.glow}
              animate={{
                scale: isSelected ? 1 : 0.95,
                opacity: isSelected ? 1 : 0.75,
              }}
              transition={zenMotion.snappy}
              aria-pressed={isSelected}
              data-testid={`emotion-chip-${tag.key}`}
              onKeyDown={(e) => handleChipKeyDown(e, index)}
              className={[
                'min-w-0 max-w-full whitespace-normal px-2.5 py-2.5 rounded-xl text-center text-sm font-medium min-h-[44px] [hyphens:auto] [overflow-wrap:normal] [word-break:normal] max-[359px]:px-0 sm:px-4',
                'ring-1 motion-safe:transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50',
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

      {hasMore && (
        <div className="flex justify-center mt-3">
          {expandable ? (
            // Bidirectional toggle — tier-1 ↔ full spectrum.
            <button
              type="button"
              onClick={handleExpandToggle}
              aria-expanded={expanded}
              aria-controls="emotion-tag-chips"
              data-testid="emotion-more-precise"
              className="text-sm font-medium text-primary/80 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg px-3 py-1.5 motion-safe:transition-colors"
            >
              {buttonLabel}
            </button>
          ) : (
            // V1 one-way reveal (Apple style): show more, never collapse.
            !expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-sm font-medium text-primary/80 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg px-3 py-1.5"
              >
                {t.somShowMore}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
