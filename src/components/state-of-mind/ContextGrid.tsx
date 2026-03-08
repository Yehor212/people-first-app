import { motion } from 'framer-motion';
import {
  Users, Newspaper, Heart, GraduationCap, Home, Dumbbell, UserPlus,
  Gamepad2, Activity, Palette, Fingerprint, Wallet, Sparkles, ListTodo,
  CloudSun, Briefcase, type LucideIcon,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { zenMotion, zenTap, zenHover } from '@/lib/animationUtils';
import { haptics } from '@/lib/haptics';
import { CONTEXT_OPTIONS } from './contextOptions';
import type { Translations } from '@/i18n/types';

/** Map icon name string → Lucide component */
const ICON_MAP: Record<string, LucideIcon> = {
  Users, Newspaper, Heart, GraduationCap, Home, Dumbbell, UserPlus,
  Gamepad2, Activity, Palette, Fingerprint, Wallet, Sparkles, ListTodo,
  CloudSun, Briefcase,
};

interface ContextGridProps {
  selected: string[];
  onToggle: (context: string) => void;
}

/** Map context key to i18n key */
const ctxToI18nKey = (key: string): keyof Translations => {
  const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
  return `somCtx${capitalized}` as keyof Translations;
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
 * Multi-select chip grid for life context associations.
 * What's influencing how you feel?
 *
 * Law 9 (a11y): semantic <button>, keyboard accessible.
 * Law 17 (i18n): logical margins (me-), i18n key lookup.
 * Upgrade 5: framer-motion staggerChildren (replaces CSS nth-child).
 */
export function ContextGrid({ selected, onToggle }: ContextGridProps) {
  const { t } = useLanguage();

  return (
    <motion.div
      variants={chipContainer}
      initial="hidden"
      animate="visible"
      className="flex flex-wrap gap-2.5 px-1"
    >
      {CONTEXT_OPTIONS.map((ctx) => {
        const isSelected = selected.includes(ctx.key);
        const i18nKey = ctxToI18nKey(ctx.key);
        const label = (t[i18nKey] as string) || ctx.key;

        return (
          <motion.button
            key={ctx.key}
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
              'inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-medium min-h-[44px]',
              'ring-1 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50',
              isSelected
                ? 'bg-primary/10 text-primary ring-primary/30'
                : 'bg-card text-muted-foreground ring-black/5 dark:ring-white/10',
            ].join(' ')}
            onClick={() => {
              onToggle(ctx.key);
              void haptics.light();
            }}
          >
            {(() => {
              const Icon = ICON_MAP[ctx.icon];
              return Icon ? <Icon className="w-4 h-4 me-1.5 shrink-0" aria-hidden="true" /> : null;
            })()}
            {label}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
