/**
 * AddHabitFrequencySection — Frequency preset buttons + custom ratio picker.
 * Deep Space aesthetic.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { frequencyPresets } from '@/hooks/useHabitForm';
import type { HabitFrequencyRatio } from '@/types';

interface AddHabitFrequencySectionProps {
  frequency: HabitFrequencyRatio;
  setFrequency: (v: HabitFrequencyRatio) => void;
  ts: Record<string, string>;
}

export function AddHabitFrequencySection({ frequency, setFrequency, ts }: AddHabitFrequencySectionProps) {
  const [forceCustomFreq, setForceCustomFreq] = useState(false);

  const isPresetMatch = (preset: HabitFrequencyRatio) =>
    frequency.numerator === preset.numerator && frequency.denominator === preset.denominator;
  const isCustomFreq = !frequencyPresets.some(p => isPresetMatch(p.ratio));

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-2 block">
        {ts.habitFrequency || 'Frequency'}
      </label>
      <div className="flex flex-wrap gap-2">
        {frequencyPresets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => { setForceCustomFreq(false); setFrequency(preset.ratio); }}
            aria-pressed={isPresetMatch(preset.ratio) && !forceCustomFreq}
            className={cn(
              'px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px]',
              'border',
              (isPresetMatch(preset.ratio) && !forceCustomFreq)
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                : 'bg-white/[0.03] border-border text-muted-foreground hover:bg-white/[0.06]',
            )}
          >
            {ts[preset.i18nKey] || preset.label}
          </button>
        ))}
        <button
          onClick={() => setForceCustomFreq(true)}
          className={cn(
            'px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px]',
            'border',
            (forceCustomFreq || isCustomFreq)
              ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
              : 'bg-white/[0.03] border-border text-muted-foreground hover:bg-white/[0.06]',
          )}
        >
          {ts.customFreq || 'Custom'}
        </button>
      </div>

      {/* Custom ratio picker */}
      {(forceCustomFreq || isCustomFreq) && (
        <div className="flex items-center gap-2 mt-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFrequency({ ...frequency, numerator: Math.max(1, frequency.numerator - 1) })}
              className="w-7 h-7 rounded-lg bg-white/[0.05] border border-border text-muted-foreground flex items-center justify-center text-xs min-h-[44px] min-w-[44px]"
            >
              -
            </button>
            <span className="text-sm text-foreground w-5 text-center tabular-nums">{frequency.numerator}</span>
            <button
              onClick={() => setFrequency({ ...frequency, numerator: Math.min(frequency.denominator, frequency.numerator + 1) })}
              className="w-7 h-7 rounded-lg bg-white/[0.05] border border-border text-muted-foreground flex items-center justify-center text-xs min-h-[44px] min-w-[44px]"
            >
              +
            </button>
          </div>
          <span className="text-xs text-muted-foreground">{ts.timesPer || 'times per'}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { const newD = Math.max(1, frequency.denominator - 1); setFrequency({ ...frequency, denominator: newD, numerator: Math.min(frequency.numerator, newD) }); }}
              className="w-7 h-7 rounded-lg bg-white/[0.05] border border-border text-muted-foreground flex items-center justify-center text-xs min-h-[44px] min-w-[44px]"
            >
              -
            </button>
            <span className="text-sm text-foreground w-5 text-center tabular-nums">{frequency.denominator}</span>
            <button
              onClick={() => setFrequency({ ...frequency, denominator: Math.min(365, frequency.denominator + 1) })}
              className="w-7 h-7 rounded-lg bg-white/[0.05] border border-border text-muted-foreground flex items-center justify-center text-xs min-h-[44px] min-w-[44px]"
            >
              +
            </button>
          </div>
          <span className="text-xs text-muted-foreground">{ts.days || 'days'}</span>
        </div>
      )}
    </div>
  );
}
