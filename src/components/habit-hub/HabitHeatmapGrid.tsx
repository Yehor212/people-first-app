/**
 * HabitHeatmapGrid — GitHub-style contribution grid for the last 26 weeks (182 days).
 * 7 rows (Mon-Sun) x ~26 columns (weeks). Deep Space aesthetic.
 *
 * Cell states: YES_MANUAL (habit color), YES_AUTO (dimmed), SKIP (stripe), NO/UNKNOWN (dim).
 */

import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { resolveHabitColor } from '@/lib/habitColorUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import { computeEntriesWithAuto } from '@/lib/habitComputedEntries';
import { ENTRY } from '@/types';
import type { Habit, HabitEntry } from '@/types';

interface HabitHeatmapGridProps {
  habit: Habit;
  className?: string;
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatShortDate(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: '2-digit' }).format(new Date(y, m - 1, d));
}

type CellStatus = 'yes_manual' | 'yes_auto' | 'skipped' | 'no' | 'unknown' | 'future' | 'before';

interface DayCell {
  date: string;
  status: CellStatus;
  dow: number; // Mon=0 … Sun=6
}

const TOTAL_DAYS = 182; // 26 weeks

function buildGrid(habit: Habit, entries: Record<string, HabitEntry>): { cells: DayCell[]; weeks: number } {
  const today = new Date();
  const todayStr = toDateStr(today);
  const createdStr = toDateStr(new Date(habit.createdAt));

  const cells: DayCell[] = [];

  for (let i = TOTAL_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = toDateStr(d);

    // Remap JS day (0=Sun) to Mon-first: Mon=0 … Sun=6
    const jsDay = d.getDay();
    const dow = jsDay === 0 ? 6 : jsDay - 1;

    let status: CellStatus;
    if (dateStr > todayStr) {
      status = 'future';
    } else if (dateStr < createdStr) {
      status = 'before';
    } else {
      const val = entries[dateStr]?.value ?? ENTRY.UNKNOWN;
      switch (val) {
        case ENTRY.YES_MANUAL: status = 'yes_manual'; break;
        case ENTRY.YES_AUTO: status = 'yes_auto'; break;
        case ENTRY.SKIP: status = 'skipped'; break;
        case ENTRY.NO: status = 'no'; break;
        default: status = 'unknown';
      }
    }

    cells.push({ date: dateStr, status, dow });
  }

  // Pad start to align the grid (first cell = Monday)
  const firstDow = cells[0]?.dow ?? 0;
  const padding: DayCell[] = [];
  for (let i = 0; i < firstDow; i++) {
    padding.push({ date: '', status: 'before', dow: i });
  }

  const allCells = [...padding, ...cells];
  const weeks = Math.ceil(allCells.length / 7);
  return { cells: allCells, weeks };
}

// ─── Day-of-week labels ──────────────────────────────────────────────────────

export const HabitHeatmapGrid = memo(function HabitHeatmapGrid({
  habit,
  className,
}: HabitHeatmapGridProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const dowLabels = useMemo(() => [
    t.dayMo, t.dayTu, t.dayWe, t.dayTh, t.dayFr, t.daySa, t.daySu,
  ], [t.dayMo, t.dayTu, t.dayWe, t.dayTh, t.dayFr, t.daySa, t.daySu]);
  const [tooltip, setTooltip] = useState<{ date: string; status: string; x: number; y: number } | null>(null);
  const habitColor = resolveHabitColor(habit.color);

  // Compute entries with YES_AUTO fills for non-daily boolean habits
  const computedEntries = useMemo(() => computeEntriesWithAuto(habit), [habit]);
  const { cells, weeks } = useMemo(() => buildGrid(habit, computedEntries), [habit, computedEntries]);

  const getStatusLabel = useCallback((status: CellStatus) => {
    switch (status) {
      case 'yes_manual': return '✓';
      case 'yes_auto': return `✓ (${ts.auto || 'auto'})`;
      case 'skipped': return ts.skipped || 'Skipped';
      case 'no': return '✗';
      default: return '·';
    }
  }, [ts.skipped, ts.auto]);

  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { clearTimeout(tooltipTimeoutRef.current); }, []);

  const handleCellTap = useCallback((cell: DayCell, e: React.MouseEvent | React.TouchEvent) => {
    if (cell.status === 'before' || cell.status === 'future') return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const adjustedY = Math.max(40, rect.top - 32);
    const adjustedX = Math.max(8, Math.min(rect.left, window.innerWidth - 148));
    setTooltip({ date: formatShortDate(cell.date, language), status: getStatusLabel(cell.status), x: adjustedX, y: adjustedY });
    clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = setTimeout(() => setTooltip(null), 2000);
  }, [getStatusLabel, language]);

  const handleCellHover = useCallback((cell: DayCell, e: React.MouseEvent) => {
    if (cell.status === 'before' || cell.status === 'future') return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const adjustedY = Math.max(40, rect.top - 32);
    const adjustedX = Math.max(8, Math.min(rect.left, window.innerWidth - 148));
    setTooltip({ date: formatShortDate(cell.date, language), status: getStatusLabel(cell.status), x: adjustedX, y: adjustedY });
  }, [getStatusLabel, language]);

  const handleCellKeyDown = useCallback((cell: DayCell, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCellTap(cell, e as unknown as React.MouseEvent);
    }
  }, [handleCellTap]);

  return (
    <div className={cn('relative', className)}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        {ts.habitHistory || 'History'}
      </h4>

      <div className="flex gap-[3px]">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-[3px] me-1 pt-0">
          {dowLabels.map((label, i) => (
            <div
              key={i}
              className="w-3 h-3 flex items-center justify-center text-[9px] text-slate-600 leading-none"
            >
              {i % 2 === 0 ? label : ''}
            </div>
          ))}
        </div>

        {/* Grid columns (weeks) */}
        <div
          className="flex gap-[3px] overflow-x-auto scrollbar-hide"
          style={{ maxWidth: '100%' }}
        >
          {Array.from({ length: weeks }, (_, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, dayIdx) => {
                const cellIdx = weekIdx * 7 + dayIdx;
                const cell = cells[cellIdx];
                if (!cell) return <div key={dayIdx} className="w-3 h-3" />;

                const isActionable = cell.status !== 'before' && cell.status !== 'future';

                return (
                  <div
                    key={dayIdx}
                    {...(isActionable
                      ? {
                          role: 'button' as const,
                          'aria-label': `${cell.date}: ${cell.status}`,
                          onClick: (e: React.MouseEvent) => handleCellTap(cell, e),
                          onKeyDown: (e: React.KeyboardEvent) => handleCellKeyDown(cell, e),
                          onMouseEnter: (e: React.MouseEvent) => handleCellHover(cell, e),
                          onMouseLeave: () => setTooltip(null),
                          tabIndex: 0,
                        }
                      : {
                          'aria-disabled': true,
                          tabIndex: -1,
                        }
                    )}
                    title={
                      isActionable
                        ? `${formatShortDate(cell.date, language)} · ${getStatusLabel(cell.status)}`
                        : undefined
                    }
                    className={cn(
                      'w-3 h-3 rounded-[2px] transition-colors',
                      isActionable ? 'cursor-pointer hover:brightness-150' : 'cursor-default',
                      (cell.status === 'before' || cell.status === 'future') && 'bg-transparent',
                      (cell.status === 'no' || cell.status === 'unknown') && 'bg-white/[0.04]',
                    )}
                    style={
                      cell.status === 'yes_manual'
                        ? { backgroundColor: habitColor, opacity: 0.85 }
                        : cell.status === 'yes_auto'
                          ? { backgroundColor: habitColor, opacity: 0.35 }
                          : cell.status === 'skipped'
                            ? { backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, var(--chart-skip, #64748b) 2px, var(--chart-skip, #64748b) 3px)`, opacity: 0.4 }
                            : undefined
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-[100] px-2 py-1 rounded-lg bg-slate-800 border border-white/10 text-[10px] text-slate-200 pointer-events-none shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.date} · {tooltip.status}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-600">
        <span className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-white/[0.04]" /> {ts.legendMiss || 'Miss'}
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: habitColor, opacity: 0.85 }} /> {ts.legendDone || 'Done'}
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: habitColor, opacity: 0.35 }} /> {ts.legendAuto || 'Auto'}
        </span>
        <span className="flex items-center gap-1">
          <div
            className="w-2.5 h-2.5 rounded-[2px]"
            style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, #64748b 2px, #64748b 3px)`, opacity: 0.4 }}
          /> {ts.legendSkip || 'Skip'}
        </span>
      </div>
    </div>
  );
});
