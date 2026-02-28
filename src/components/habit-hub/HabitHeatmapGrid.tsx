/**
 * HabitHeatmapGrid — GitHub-style contribution grid for the last 26 weeks (182 days).
 * 7 rows (Mon-Sun) × ~26 columns (weeks). Deep Space aesthetic.
 *
 * Cell states: Done (habit color), Skipped (muted stripe), Missed (dim), Future (hidden).
 */

import { memo, useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Habit } from '@/types';

interface HabitHeatmapGridProps {
  habit: Habit;
  className?: string;
}

// ─── Date helpers (local, no library) ────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

type CellStatus = 'done' | 'skipped' | 'missed' | 'future' | 'before';

interface DayCell {
  date: string;
  status: CellStatus;
  dow: number; // 0=Sun … 6=Sat → remapped to Mon=0 … Sun=6
}

const TOTAL_DAYS = 182; // 26 weeks

function buildGrid(habit: Habit): { cells: DayCell[]; weeks: number } {
  const today = new Date();
  const todayStr = toDateStr(today);
  const completedSet = new Set(habit.completedDates || []);
  const skippedSet = new Set(habit.skippedDates || []);
  const createdStr = habit.startDate || toDateStr(new Date(habit.createdAt));

  const cells: DayCell[] = [];

  // Walk backwards from today for TOTAL_DAYS
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
    } else if (completedSet.has(dateStr)) {
      status = 'done';
    } else if (skippedSet.has(dateStr)) {
      status = 'skipped';
    } else {
      status = 'missed';
    }

    cells.push({ date: dateStr, status, dow });
  }

  // Pad start with 'before' cells to align the grid (first cell = Monday of that week)
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

const DOW_LABELS_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const HabitHeatmapGrid = memo(function HabitHeatmapGrid({
  habit,
  className,
}: HabitHeatmapGridProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [tooltip, setTooltip] = useState<{ date: string; status: string; x: number; y: number } | null>(null);

  const { cells, weeks } = useMemo(() => buildGrid(habit), [habit]);

  const getStatusLabel = useCallback((status: CellStatus) => {
    return status === 'done' ? '✓' : status === 'skipped' ? (ts.skipped || 'Skipped') : '✗';
  }, [ts.skipped]);

  const handleCellTap = useCallback((cell: DayCell, e: React.MouseEvent | React.TouchEvent) => {
    if (cell.status === 'before' || cell.status === 'future') return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({ date: formatShortDate(cell.date), status: getStatusLabel(cell.status), x: rect.left, y: rect.top - 32 });
    setTimeout(() => setTooltip(null), 2000);
  }, [getStatusLabel]);

  const handleCellHover = useCallback((cell: DayCell, e: React.MouseEvent) => {
    if (cell.status === 'before' || cell.status === 'future') return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({ date: formatShortDate(cell.date), status: getStatusLabel(cell.status), x: rect.left, y: rect.top - 32 });
  }, [getStatusLabel]);

  return (
    <div className={cn('relative', className)}>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        {ts.habitHistory || 'History'}
      </h4>

      <div className="flex gap-[3px]">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-[3px] mr-1 pt-0">
          {DOW_LABELS_EN.map((label, i) => (
            <div
              key={i}
              className="w-3 h-3 flex items-center justify-center text-[8px] text-slate-600 leading-none"
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

                const isActionable = cell.status === 'done' || cell.status === 'missed' || cell.status === 'skipped';

                return (
                  <div
                    key={dayIdx}
                    onClick={(e) => handleCellTap(cell, e)}
                    onMouseEnter={(e) => handleCellHover(cell, e)}
                    onMouseLeave={() => setTooltip(null)}
                    title={
                      isActionable
                        ? `${formatShortDate(cell.date)} · ${getStatusLabel(cell.status)}`
                        : undefined
                    }
                    className={cn(
                      'w-3 h-3 rounded-[2px] transition-colors',
                      isActionable ? 'cursor-pointer' : 'cursor-default',
                      cell.status === 'before' && 'bg-transparent',
                      cell.status === 'future' && 'bg-transparent',
                      cell.status === 'missed' && 'bg-white/[0.04]',
                    )}
                    style={
                      cell.status === 'done'
                        ? { backgroundColor: habit.color, opacity: 0.85 }
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
          <div className="w-2.5 h-2.5 rounded-[2px] bg-white/[0.04]" /> Miss
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: habit.color, opacity: 0.85 }} /> Done
        </span>
        <span className="flex items-center gap-1">
          <div
            className="w-2.5 h-2.5 rounded-[2px]"
            style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, #64748b 2px, #64748b 3px)`, opacity: 0.4 }}
          /> Skip
        </span>
      </div>
    </div>
  );
});
