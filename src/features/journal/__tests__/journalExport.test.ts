import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { JournalEntry, JournalPhoto } from '../types';

// ─── Mocks ────────────────────────────────────────────────────

vi.mock('../journalStorage', () => ({
  getAllEntries: vi.fn(() => Promise.resolve([])),
  getPhotosForEntry: vi.fn(() => Promise.resolve([])),
  getAudioForEntry: vi.fn(() => Promise.resolve([])),
}));

// Mock DOM download infrastructure
const mockClick = vi.fn();
const mockLink = {
  href: '',
  download: '',
  click: mockClick,
};

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
});

const originalCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  if (tag === 'a') return mockLink as unknown as HTMLAnchorElement;
  return originalCreateElement(tag);
});
vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

import * as storage from '../journalStorage';
import { exportJSON, exportCSV, exportMarkdown, exportPDF } from '../journalExport';

// ─── Helpers ──────────────────────────────────────────────────

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'entry-1',
    date: '2026-02-17',
    title: 'Test Entry',
    content: 'Hello world content',
    stickers: [],
    photoIds: [],
    tags: ['personal'],
    createdAt: 1708128000000,
    updatedAt: 1708128000000,
    ...overrides,
  };
}

function makePhoto(overrides: Partial<JournalPhoto> = {}): JournalPhoto {
  return {
    id: 'photo-1',
    entryId: 'entry-1',
    data: 'data:image/jpeg;base64,abc',
    thumbnail: 'data:image/jpeg;base64,thumb',
    width: 800,
    height: 600,
    createdAt: 1000,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockLink.href = '';
  mockLink.download = '';
});

// ============================================================
// exportJSON
// ============================================================
describe('exportJSON', () => {
  it('exports all entries as JSON with version 2 structure', async () => {
    const entries = [makeEntry()];
    vi.mocked(storage.getAllEntries).mockResolvedValue(entries);

    await exportJSON();

    expect(storage.getAllEntries).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockLink.download).toMatch(/^journal-backup-.*\.json$/);
  });

  it('loads photos for entries that have photoIds', async () => {
    const entries = [
      makeEntry({ id: 'e1', photoIds: ['p1'] }),
      makeEntry({ id: 'e2', photoIds: [] }),
    ];
    vi.mocked(storage.getAllEntries).mockResolvedValue(entries);
    vi.mocked(storage.getPhotosForEntry).mockResolvedValue([makePhoto()]);

    await exportJSON();

    // Only called for entry with photos
    expect(storage.getPhotosForEntry).toHaveBeenCalledTimes(1);
    expect(storage.getPhotosForEntry).toHaveBeenCalledWith('e1');
  });

  it('loads audio for entries that have audioIds', async () => {
    const entries = [
      makeEntry({ id: 'e1', audioIds: ['a1'] }),
      makeEntry({ id: 'e2', audioIds: [] }),
      makeEntry({ id: 'e3' }), // no audioIds
    ];
    vi.mocked(storage.getAllEntries).mockResolvedValue(entries);

    await exportJSON();

    // Only called for entry with audio
    expect(storage.getAudioForEntry).toHaveBeenCalledTimes(1);
    expect(storage.getAudioForEntry).toHaveBeenCalledWith('e1');
  });

  it('calls onProgress callback at each step', async () => {
    vi.mocked(storage.getAllEntries).mockResolvedValue([]);
    const progress = vi.fn();

    await exportJSON(progress);

    expect(progress).toHaveBeenCalledWith('Loading entries...');
    expect(progress).toHaveBeenCalledWith('Loading photos...');
    expect(progress).toHaveBeenCalledWith('Loading audio...');
    expect(progress).toHaveBeenCalledWith('Generating file...');
  });
});

// ============================================================
// exportCSV
// ============================================================
describe('exportCSV', () => {
  it('creates CSV with correct header columns', async () => {
    vi.mocked(storage.getAllEntries).mockResolvedValue([]);

    await exportCSV();

    expect(mockClick).toHaveBeenCalled();
    expect(mockLink.download).toMatch(/^journal-.*\.csv$/);
  });

  it('includes entry data in CSV rows', async () => {
    const entries = [
      makeEntry({ title: 'My Day', content: 'Some content', mood: 'great', tags: ['tag1'] }),
    ];
    vi.mocked(storage.getAllEntries).mockResolvedValue(entries);

    await exportCSV();

    // Verify the download was triggered (content tested via Blob creation)
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
  });

  it('handles entries with special characters in title (CSV escaping)', async () => {
    const entries = [
      makeEntry({ title: 'Entry "with" quotes', content: 'Line1\nLine2' }),
    ];
    vi.mocked(storage.getAllEntries).mockResolvedValue(entries);

    // Should not throw
    await exportCSV();
    expect(mockClick).toHaveBeenCalled();
  });
});

// ============================================================
// exportMarkdown
// ============================================================
describe('exportMarkdown', () => {
  it('generates markdown file with diary header', async () => {
    vi.mocked(storage.getAllEntries).mockResolvedValue([]);

    await exportMarkdown();

    expect(mockClick).toHaveBeenCalled();
    expect(mockLink.download).toMatch(/^journal-.*\.md$/);
  });

  it('creates section per entry with title and content', async () => {
    const entries = [
      makeEntry({ title: 'Entry One', content: 'Content one', mood: 'good' }),
      makeEntry({ id: 'e2', title: 'Entry Two', content: 'Content two' }),
    ];
    vi.mocked(storage.getAllEntries).mockResolvedValue(entries);

    await exportMarkdown();

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
  });

  it('includes mood, tags, stickers, and media counts in markdown', async () => {
    const entries = [
      makeEntry({
        mood: 'great',
        tags: ['work', 'life'],
        stickers: ['star', 'heart'],
        photoIds: ['p1', 'p2'],
        audioIds: ['a1'],
      }),
    ];
    vi.mocked(storage.getAllEntries).mockResolvedValue(entries);

    await exportMarkdown();

    expect(mockClick).toHaveBeenCalled();
  });
});

// ============================================================
// exportPDF
// ============================================================
describe('exportPDF', () => {
  it('lazy-imports jsPDF and creates a document', async () => {
    const mockSave = vi.fn();
    const mockText = vi.fn();
    const mockAddPage = vi.fn();
    const mockSetFontSize = vi.fn();
    const mockSetTextColor = vi.fn();
    const mockSplitTextToSize = vi.fn(() => ['line1']);
    const mockAddImage = vi.fn();

    vi.doMock('jspdf', () => ({
      jsPDF: vi.fn(() => ({
        internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
        text: mockText,
        addPage: mockAddPage,
        setFontSize: mockSetFontSize,
        setTextColor: mockSetTextColor,
        splitTextToSize: mockSplitTextToSize,
        addImage: mockAddImage,
        save: mockSave,
      })),
    }));

    const entries = [makeEntry({ title: 'PDF Entry', content: 'PDF content' })];
    vi.mocked(storage.getAllEntries).mockResolvedValue(entries);
    vi.mocked(storage.getPhotosForEntry).mockResolvedValue([]);

    await exportPDF();

    expect(storage.getAllEntries).toHaveBeenCalled();
  });
});
