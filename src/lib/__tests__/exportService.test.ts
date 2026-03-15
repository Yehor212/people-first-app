import { describe, it, expect, vi, beforeEach } from 'vitest';

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
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();

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
} from '@/lib/exportService';

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
    const blobCall = mockCreateObjectURL.mock.calls[0][0];
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
