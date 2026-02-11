/**
 * InnerWorldCard — compact card for the Garden tab
 * Shows tree preview, treats balance, and streak.
 * Tapping opens the full TreePanel.
 */

import { Droplets, TreePine, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { TreeStage } from '@/types';
import { SeasonalTree } from './SeasonalTree';
import { getCurrentSeason } from '@/lib/seasonHelper';

interface InnerWorldCardProps {
  treeStage: TreeStage;
  waterLevel: number;
  treatsBalance: number;
  streak: number;
  onOpen: () => void;
  className?: string;
}

export function InnerWorldCard({
  treeStage,
  waterLevel,
  treatsBalance,
  streak,
  onOpen,
  className,
}: InnerWorldCardProps) {
  const { t } = useLanguage();
  const season = getCurrentSeason();

  return (
    <button
      onClick={onOpen}
      className={cn(
        'w-full text-start rounded-2xl p-4 transition-all active:scale-[0.98]',
        'bg-gradient-to-br from-emerald-500/10 to-teal-500/10',
        'border border-emerald-500/20 dark:border-emerald-500/15',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        {/* Tree preview */}
        <div className="shrink-0 w-16 h-16 flex items-center justify-center">
          <SeasonalTree
            stage={treeStage}
            season={season}
            waterLevel={waterLevel}
            size="sm"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {t.innerWorld || 'Inner World'}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {treatsBalance} {t.treats || 'treats'}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Droplets className="w-3.5 h-3.5 text-blue-500" />
              {waterLevel}%
            </span>
            {streak > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                🔥 {streak}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {t.tapToInteract || 'Tap to interact'}
          </p>
        </div>

        <TreePine className="w-5 h-5 text-emerald-500/60 shrink-0" />
      </div>
    </button>
  );
}
