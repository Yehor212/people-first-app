import { memo } from 'react';
import { Lock, Share2 } from 'lucide-react';
import { Badge } from '@/types';
import type { Language } from '@/i18n/translations';
import { getLocale } from '@/lib/timeUtils';
import { getRarityColor } from '@/lib/badges';
import { EmojiOrIcon } from '@/components/icons';

interface BadgeCardProps {
  badge: Badge;
  language: string;
  t: Record<string, string>;
  onShare: (badge: Badge) => void;
  /** When true, applies line-clamp to description/requirement for virtualized grids */
  virtual?: boolean;
}

export const BadgeCard = memo(function BadgeCard({ badge, language, t, onShare, virtual = false }: BadgeCardProps) {
  return (
    <div
      className={`relative bg-secondary rounded-2xl p-4 zen-shadow-card motion-safe:transition-all ${virtual ? 'h-full ' : ''}${
        badge.unlocked ? 'hover:zen-shadow-hover' : 'opacity-50'
      }`}
    >
      {badge.unlocked && (
        <button
          onClick={() => onShare(badge)}
          className="absolute top-2 end-2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 text-primary motion-safe:transition-colors"
          aria-label={t.shareButton || 'Share'}
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="text-center">
        <div className={`flex items-center justify-center mb-3 ${!badge.unlocked && 'grayscale'}`}>
          {badge.unlocked ? (
            <EmojiOrIcon emoji={badge.icon} iconName={badge.iconName} size="xl" />
          ) : (
            <Lock className="w-12 h-12 text-muted-foreground" />
          )}
        </div>
        <h3 className={`font-semibold mb-1 ${badge.unlocked ? getRarityColor(badge.rarity) : 'text-muted-foreground'}`}>
          {badge.title[language]}
        </h3>
        <p className={`text-xs text-muted-foreground mb-2${virtual ? ' line-clamp-2' : ''}`}>
          {badge.description[language]}
        </p>
        {badge.unlocked && badge.unlockedDate && (
          <p className="text-xs text-primary">
            {new Date(badge.unlockedDate).toLocaleDateString(getLocale(language as Language))}
          </p>
        )}
        {!badge.unlocked && (
          <p className={`text-xs text-muted-foreground${virtual ? ' line-clamp-1' : ''}`}>
            {t.requirement || 'Requirement'}: {badge.requirement}
          </p>
        )}
      </div>
    </div>
  );
});
