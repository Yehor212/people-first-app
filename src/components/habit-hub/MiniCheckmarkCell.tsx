/**
 * MiniCheckmarkCell — 32px compact toggle cell with 5 visual states.
 * Used inside MiniWeekRow for the 7-day mini calendar.
 *
 * Visual states:
 *   YES_MANUAL(2): filled circle + ✓ in habit color
 *   YES_AUTO(1):   hollow outline + hollow ✓ in habit color (40% opacity)
 *   SKIP(3):       muted circle + dash (60% opacity)
 *   NO(0):         dim circle + ✗
 *   UNKNOWN(-1):   empty dot
 *
 * Touch target: outer container ≥ 44px (WCAG 2.5.8), visual element 32px.
 * Toggle cycle: UNKNOWN ↔ YES_MANUAL (binary; SKIP/NO via detail sheet)
 */

import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { ENTRY } from '@/types';

interface MiniCheckmarkCellProps {
  date: string;
  value: number;       // EntryValue
  habitColor: string;  // resolved hex
  isToday: boolean;
  isNumerical: boolean;
  numericDisplay?: string; // "2.5" for numerical habits
  onTap: () => void;
}

export const MiniCheckmarkCell = memo(function MiniCheckmarkCell({
  date,
  value,
  habitColor,
  isToday,
  isNumerical,
  numericDisplay,
  onTap,
}: MiniCheckmarkCellProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap();
    }
  }, [onTap]);

  const isCompleted = value === ENTRY.YES_MANUAL || value === ENTRY.YES_AUTO;
  const isSkipped = value === ENTRY.SKIP;
  const isNo = value === ENTRY.NO;
  const isAuto = value === ENTRY.YES_AUTO;

  // For numerical: show the value text
  if (isNumerical) {
    const hasValue = numericDisplay && numericDisplay !== '0';
    return (
      <div
        onClick={onTap}
        onKeyDown={handleKeyDown}
        tabIndex={isToday ? 0 : -1}
        role="button"
        aria-label={`${date}: ${numericDisplay || '0'}`}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
      >
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
            'text-[10px] font-semibold tabular-nums',
            'hover:brightness-125',
            isToday && 'ring-1 ring-white/30',
          )}
          style={{
            backgroundColor: hasValue ? `${habitColor}25` : 'rgba(255,255,255,0.03)',
            color: hasValue ? habitColor : 'rgba(255,255,255,0.25)',
          }}
        >
          {numericDisplay || '·'}
        </div>
      </div>
    );
  }

  // Boolean cell
  return (
    <div
      onClick={onTap}
      onKeyDown={handleKeyDown}
      tabIndex={isToday ? 0 : -1}
      role="checkbox"
      aria-checked={isCompleted}
      aria-label={`${date}: ${isCompleted ? (ts.done || 'done') : isSkipped ? (ts.skipped || 'skipped') : isNo ? (ts.notDone || 'not done') : (ts.noData || 'no data')}`}
      className="min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
    >
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
          'hover:brightness-125',
          isToday && 'ring-1 ring-white/30',
        )}
        style={{
          backgroundColor: isCompleted
            ? isAuto ? `${habitColor}18` : `${habitColor}30`
            : isSkipped
              ? 'rgba(96,165,250,0.12)'
              : isNo
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(255,255,255,0.02)',
        }}
      >
        {value === ENTRY.YES_MANUAL && (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path
              d="M3 7.5 L5.5 10 L11 4"
              fill="none"
              stroke={habitColor}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {value === ENTRY.YES_AUTO && (
          <svg width="14" height="14" viewBox="0 0 14 14" opacity={0.4}>
            <path
              d="M3 7.5 L5.5 10 L11 4"
              fill="none"
              stroke={habitColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="2,2"
            />
          </svg>
        )}
        {isSkipped && (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="2" y1="5" x2="8" y2="5" stroke="#60A5FA" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
          </svg>
        )}
        {isNo && (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="2.5" y1="2.5" x2="7.5" y2="7.5" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} strokeLinecap="round" />
            <line x1="7.5" y1="2.5" x2="2.5" y2="7.5" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
        )}
        {value === ENTRY.UNKNOWN && (
          <div className="w-1.5 h-1.5 rounded-full bg-white/[0.12]" />
        )}
      </div>
    </div>
  );
});
