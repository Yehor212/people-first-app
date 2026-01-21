/**
 * CompletedSection - Collapsible wrapper for completed activities
 * Reduces cognitive load by minimizing completed items
 * ADHD-friendly: less visual noise, clear status indication
 */

import { useState, ReactNode, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface CompletedSectionProps {
  title: string;
  icon: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  accentColor?: string;
}

export const CompletedSection = memo(function CompletedSection({
  title,
  icon,
  children,
  defaultExpanded = false,
  accentColor = 'primary',
}: CompletedSectionProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    primary: { bg: 'bg-primary/10', border: 'border-primary/20', text: 'text-primary' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500' },
    violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-500' },
    pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-500' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500' },
  };

  const colors = colorClasses[accentColor] || colorClasses.primary;

  return (
    <div className="animate-fade-in">
      {/* Collapsed view - compact bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between p-4 rounded-2xl transition-all",
          colors.bg,
          "border",
          colors.border,
          "hover:opacity-80"
        )}
      >
        <div className="flex items-center gap-3">
          {/* Check icon */}
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            colors.bg,
            colors.text
          )}>
            <Check className="w-4 h-4" />
          </div>

          {/* Icon and title */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <span className="font-medium text-foreground">{title}</span>
          </div>
        </div>

        {/* Expand/collapse indicator */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xs">{isExpanded ? t.collapse : t.expand}</span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </div>
      </button>

      {/* Expanded view - full content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
