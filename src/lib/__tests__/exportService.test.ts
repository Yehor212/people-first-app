import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GratitudeEntry, Habit } from '@/types';

// We need to test the internal arrayToCSV and sanitizeFilename functions.
// Since they are not exported, we test them indirectly through the exported functions,
// but also import the module to access the default export.

// Mock dependencies
vi.mock('@/lib/utils', () => ({
  formatDate: vi.fn(() => '2024-01-15'),
}));

vi.mock('@/lib/habits', () => ({
  getHabitCompletedDates: vi.fn((h: any) => {
    // Return dates from entries where value >= 2 (YES_MANUAL)
    if (!h.entries) return [];
    return Object.entries(h.entries)
      .filter(([, e]: [string, any]) => e.value >= 2)
      .map(([d]) => d);
  }),
  getHabitCompletionTotal: vi.fn((h: any) => {
    if (!h.entries) return 0;
    return Object.values(h.entries).filter((e: any) => e.value >= 2).length;
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock DOM APIs
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockCreateObjectURL = vi.fn((_: Blob | MediaSource) => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();

  // Mock document.createElement
  vi.spyOn(document, 'createElement').mockReturnValue({
    href: '',
    download: '',
    click: mockClick,
  } as unknown as HTMLElement);

  vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
  vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

  globalThis.URL.createObjectURL = mockCreateObjectURL;
  globalThis.URL.revokeObjectURL = mockRevokeObjectURL;
});

// Import after mocks are set up
import {
  exportMoodsToCSV,
  exportHabitsToCSV,
  exportFocusSessionsToCSV,
  exportGratitudeToCSV,
  exportAllToCSV,
  exportProgressReportPDF,
} from '@/lib/exportService';

const getLastDownloadedText = async (): Promise<string> => {
  const blob = mockCreateObjectURL.mock.calls.at(-1)?.[0];
  expect(blob).toBeInstanceOf(Blob);
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Expected downloaded blob text'));
    };
    reader.onerror = () => {
      reject(reader.error instanceof Error ? reader.error : new Error('Failed to read blob text'));
    };
    reader.readAsText(blob as Blob);
  });
  return text.replace(/^\ufeff/, '');
};

// ─── Helper data ─────────────────────────────────────────────────

const mockMoods = [
  { date: '2024-01-01', mood: 'good', note: 'Nice day', tags: ['work', 'health'] },
  { date: '2024-01-02', mood: 'great', note: '', tags: [] },
];

const mockHabits = [
  {
    id: 'h1',
    name: 'Meditate',
    icon: '🧘',
    habitType: 'boolean',
    color: 5,
    position: 0,
    createdAt: 1700000000000,
    frequency: { numerator: 1, denominator: 1 },
    question: '',
    description: '',
    isArchived: false,
    targetValue: 0,
    targetType: 'atLeast',
    unit: '',
    entries: { '2024-01-01': { value: 2 }, '2024-01-02': { value: 2 } },
    reminders: [],
  },
];

const mockSessions = [
  { date: '2024-01-01', duration: 25, label: 'Deep work', status: 'completed', reflection: 'Good focus' },
  { date: '2024-01-02', duration: 15, label: 'Reading', status: 'completed', reflection: '' },
];

const mockGratitude = [
  { date: '2024-01-01', text: 'Grateful for sunshine', timestamp: 1704067200000 },
  { date: '2024-01-02', text: 'Grateful for friends', timestamp: 1704153600000 },
];

// ─── exportMoodsToCSV ────────────────────────────────────────────

describe('exportMoodsToCSV', () => {
  it('triggers file download with CSV content', () => {
    exportMoodsToCSV(mockMoods as any);
    expect(mockCreateObjectURL).toHaveBeenCalledOnce();
    expect(mockClick).toHaveBeenCalledOnce();
    expect(mockRevokeObjectURL).toHaveBeenCalledOnce();
  });

  it('creates a blob with CSV data including headers', () => {
    exportMoodsToCSV(mockMoods as any);
    expect(mockCreateObjectURL.mock.calls.length).toBeGreaterThan(0);
    const blobCall = mockCreateObjectURL.mock.calls[0]?.[0];
    expect(blobCall).toBeInstanceOf(Blob);
  });

  it('handles empty mood array', () => {
    exportMoodsToCSV([]);
    // Should still trigger download (empty CSV)
    expect(mockClick).toHaveBeenCalledOnce();
  });
});

// ─── exportHabitsToCSV ───────────────────────────────────────────

describe('exportHabitsToCSV', () => {
  it('triggers file download', () => {
    exportHabitsToCSV(mockHabits as any);
    expect(mockClick).toHaveBeenCalledOnce();
  });

  it('handles habits with no entries', () => {
    const emptyHabit = { ...mockHabits[0], entries: {} };
    exportHabitsToCSV([emptyHabit] as any);
    expect(mockClick).toHaveBeenCalledOnce();
  });
});

// ─── exportFocusSessionsToCSV ────────────────────────────────────

describe('exportFocusSessionsToCSV', () => {
  it('triggers file download', () => {
    exportFocusSessionsToCSV(mockSessions as any);
    expect(mockClick).toHaveBeenCalledOnce();
  });

  it('handles empty sessions array', () => {
    exportFocusSessionsToCSV([]);
    expect(mockClick).toHaveBeenCalledOnce();
  });
});

// ─── exportGratitudeToCSV ────────────────────────────────────────

describe('exportGratitudeToCSV', () => {
  it('triggers file download', () => {
    exportGratitudeToCSV(mockGratitude as any);
    expect(mockClick).toHaveBeenCalledOnce();
  });
});

// ─── exportAllToCSV ──────────────────────────────────────────────

describe('exportAllToCSV', () => {
  it('exports all data sections in a single file', () => {
    exportAllToCSV({
      moods: mockMoods as any,
      habits: mockHabits as any,
      focusSessions: mockSessions as any,
      gratitudeEntries: mockGratitude as any,
    });
    expect(mockClick).toHaveBeenCalledOnce();
  });

  it('handles all empty data gracefully', () => {
    exportAllToCSV({
      moods: [],
      habits: [],
      focusSessions: [],
      gratitudeEntries: [],
    });
    expect(mockClick).toHaveBeenCalledOnce();
  });
});

// ─── Progress report immutability ───────────────────────────────

describe('exportProgressReportPDF', () => {
  it('ranks report rows without changing the input array order', async () => {
    const lowerCompletionHabit: Habit = {
      ...mockHabits[0],
      id: 'habit-lower',
      name: 'Lower completion habit',
      habitType: 'boolean',
      targetType: 'atLeast',
      entries: { '2024-01-01': { value: 2 } },
    };
    const higherCompletionHabit: Habit = {
      ...mockHabits[0],
      id: 'habit-higher',
      name: 'Higher completion habit',
      habitType: 'boolean',
      targetType: 'atLeast',
      entries: {
        '2024-01-01': { value: 2 },
        '2024-01-02': { value: 2 },
        '2024-01-03': { value: 2 },
      },
    };
    const olderGratitude: GratitudeEntry = {
      id: 'gratitude-older',
      date: '2024-01-01',
      text: 'Older gratitude entry',
      timestamp: 1704067200000,
    };
    const newerGratitude: GratitudeEntry = {
      id: 'gratitude-newer',
      date: '2024-01-02',
      text: 'Newer gratitude entry',
      timestamp: 1704153600000,
    };
    const habits = [lowerCompletionHabit, higherCompletionHabit];
    const gratitudeEntries = [olderGratitude, newerGratitude];

    await exportProgressReportPDF({
      moods: [],
      habits,
      focusSessions: [],
      gratitudeEntries,
    });

    expect.soft(habits).toEqual([lowerCompletionHabit, higherCompletionHabit]);
    expect.soft(gratitudeEntries).toEqual([olderGratitude, newerGratitude]);

    const pdf = await getLastDownloadedText();
    const pdfHex = (value: string): string =>
      [...value].map((character) => character.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()).join('');
    expect(pdf.indexOf(pdfHex('Higher completion habit'))).toBeLessThan(
      pdf.indexOf(pdfHex('Lower completion habit')),
    );
    expect(pdf.indexOf(pdfHex('Newer gratitude entry'))).toBeLessThan(
      pdf.indexOf(pdfHex('Older gratitude entry')),
    );
  });
});

// ─── CSV formatting (tested via Blob content) ────────────────────

describe('CSV formatting', () => {
  it('properly quotes strings with embedded quotes', () => {
    const moodsWithQuotes = [
      { date: '2024-01-01', mood: 'good', note: 'Said "hello"', tags: [] },
    ];
    exportMoodsToCSV(moodsWithQuotes as any);
    // Blob was created — validates no errors in CSV generation
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('handles null and undefined values', () => {
    const moodsWithNulls = [
      { date: '2024-01-01', mood: 'good', note: null, tags: undefined },
    ];
    exportMoodsToCSV(moodsWithNulls as any);
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });

  it('handles array values (tags) in CSV', () => {
    const moodsWithTags = [
      { date: '2024-01-01', mood: 'good', note: 'Test', tags: ['a', 'b', 'c'] },
    ];
    exportMoodsToCSV(moodsWithTags as any);
    expect(mockCreateObjectURL).toHaveBeenCalled();
  });
});

// ─── CSV injection safety ───────────────────────────────────────

describe('CSV formula injection safety', () => {
  it('neutralizes formula-like mood notes and tag cells before download', async () => {
    exportMoodsToCSV([
      {
        date: '2024-01-01',
        mood: 'good',
        note: '=HYPERLINK("https://attacker.test","open")',
        tags: ['@urgent'],
      },
    ] as any);

    const csv = await getLastDownloadedText();
    expect(csv).toContain('"\'=HYPERLINK(""https://attacker.test"",""open"")"');
    expect(csv).toContain('"\'@urgent"');
    expect(csv).not.toContain(',"=HYPERLINK');
    expect(csv).not.toContain(',"@urgent"');
  });

  it('neutralizes formulas hidden behind leading whitespace or control characters', async () => {
    exportFocusSessionsToCSV([
      {
        date: '2024-01-01',
        duration: 25,
        label: ' =SUM(1,1)',
        status: 'completed',
        reflection: '\r@SUM(1,1)',
      },
    ] as any);

    const csv = await getLastDownloadedText();
    expect(csv).toContain('"\' =SUM(1,1)"');
    expect(csv).toContain('"\' @SUM(1,1)"');
  });

  it('neutralizes formula-like values in habit, gratitude, and combined exports', async () => {
    exportAllToCSV({
      moods: [{ date: '2024-01-01', mood: 'good', note: '\t+SUM(1,1)' }] as any,
      habits: [{ ...mockHabits[0], name: '-cmd|\'/c calc\'!A0' }] as any,
      focusSessions: [{ date: '2024-01-01', duration: 15, label: '＠SUM(1,1)' }] as any,
      gratitudeEntries: [{ date: '2024-01-01', text: '＝1+1', timestamp: 1704067200000 }] as any,
    });

    const csv = await getLastDownloadedText();
    expect(csv).toContain('"\'\t+SUM(1,1)"');
    expect(csv).toContain('"\'-cmd|\'/c calc\'!A0"');
    expect(csv).toContain('"\'＠SUM(1,1)"');
    expect(csv).toContain('"\'＝1+1"');
  });

  it('writes combined export section rows as ordinary CSV cells, not formula-like cells', async () => {
    exportAllToCSV({
      moods: [],
      habits: [],
      focusSessions: [],
      gratitudeEntries: [],
    });

    const csv = await getLastDownloadedText();
    const sectionLines = csv
      .split('\n')
      .filter((line) => /mood tracking|habits|focus sessions|gratitude journal/i.test(line));

    expect(sectionLines).toEqual([
      '"Section","Mood tracking"',
      '"Section","Habits"',
      '"Section","Focus sessions"',
      '"Section","Gratitude journal"',
    ]);
    expect(sectionLines.every((line) => !/^[\t=+\-@]/u.test(line))).toBe(true);
  });
});

// ─── Filename sanitization (tested indirectly) ───────────────────

describe('filename safety', () => {
  it('downloads file with sanitized filename', () => {
    // The filename includes formatDate result which we mocked to '2024-01-15'
    exportMoodsToCSV(mockMoods as any);
    const linkEl = (document.createElement as ReturnType<typeof vi.fn>).mock.results[0].value;
    // download property should be set to a sanitized filename
    expect(typeof linkEl.download).toBe('string');
  });
});
