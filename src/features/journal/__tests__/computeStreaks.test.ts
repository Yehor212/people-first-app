import { describe, it, expect } from 'vitest';
import { computeStreaks } from '../computeStreaks';
import type { MoodType } from '@/types';

function makeMap(dates: string[]): Map<string, MoodType | undefined> {
  return new Map(dates.map((d) => [d, 'good' as MoodType]));
}

describe('computeStreaks', () => {
  it('returns empty map for empty dates', () => {
    const result = computeStreaks(new Map());
    expect(result.size).toBe(0);
  });

  it('returns empty map for a single date (min 2 consecutive required)', () => {
    const result = computeStreaks(makeMap(['2025-01-15']));
    expect(result.size).toBe(0);
  });

  it('detects a streak of two consecutive dates', () => {
    const result = computeStreaks(makeMap(['2025-01-15', '2025-01-16']));

    expect(result.size).toBe(2);
    expect(result.get('2025-01-15')).toEqual({ isStart: true, isEnd: false, length: 2 });
    expect(result.get('2025-01-16')).toEqual({ isStart: false, isEnd: true, length: 2 });
  });

  it('gap breaks streak: [Jan 1, Jan 2, Jan 5, Jan 6] produces two separate streaks', () => {
    const result = computeStreaks(
      makeMap(['2025-01-01', '2025-01-02', '2025-01-05', '2025-01-06'])
    );

    expect(result.size).toBe(4);

    // First streak: Jan 1-2
    expect(result.get('2025-01-01')).toEqual({ isStart: true, isEnd: false, length: 2 });
    expect(result.get('2025-01-02')).toEqual({ isStart: false, isEnd: true, length: 2 });

    // Second streak: Jan 5-6
    expect(result.get('2025-01-05')).toEqual({ isStart: true, isEnd: false, length: 2 });
    expect(result.get('2025-01-06')).toEqual({ isStart: false, isEnd: true, length: 2 });
  });

  it('detects a long streak of 7 consecutive days', () => {
    const dates = [
      '2025-03-01', '2025-03-02', '2025-03-03', '2025-03-04',
      '2025-03-05', '2025-03-06', '2025-03-07',
    ];
    const result = computeStreaks(makeMap(dates));

    expect(result.size).toBe(7);
    for (const [i, date] of dates.entries()) {
      expect(result.get(date)).toEqual({
        isStart: i === 0,
        isEnd: i === 6,
        length: 7,
      });
    }
  });

  it('handles unsorted input correctly', () => {
    const unsorted = ['2025-02-03', '2025-02-01', '2025-02-02'];
    const result = computeStreaks(makeMap(unsorted));

    expect(result.size).toBe(3);
    expect(result.get('2025-02-01')).toEqual({ isStart: true, isEnd: false, length: 3 });
    expect(result.get('2025-02-02')).toEqual({ isStart: false, isEnd: false, length: 3 });
    expect(result.get('2025-02-03')).toEqual({ isStart: false, isEnd: true, length: 3 });
  });
});
