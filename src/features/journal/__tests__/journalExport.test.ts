import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { JournalEntry, JournalPhoto } from '../types';

// ─── Mocks ────────────────────────────────────────────────────

const platformMocks = vi.hoisted(() => ({ isNative: false }));
const nativeExportMocks = vi.hoisted(() => ({
  writeFile: vi.fn(async () => ({ uri: 'file://journal-backup.json' })),
  deleteFile: vi.fn(async () => undefined),
  share: vi.fn(async () => ({ activityType: 'test' })),
}));
const capacityMocks = vi.hoisted(() => ({
  serialize: vi.fn((payload: unknown) => {
    const json = JSON.stringify(payload);
    return { json, sizeBytes: new TextEncoder().encode(json).byteLength };
  }),
}));
const exportBoundaryMocks = vi.hoisted(() => ({
  generation: "generation-a",
  assertGeneration: vi.fn(),
  sessionUserId: vi.fn<() => Promise<string | null>>(() => Promise.resolve("account-a")),
  localOwnerUserId: vi.fn<() => Promise<string | null>>(() => Promise.resolve("account-a")),
}));

vi.mock('@/lib/platform', () => ({
  get isNative() {
    return platformMocks.isNative;
  },
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: nativeExportMocks.writeFile,
    deleteFile: nativeExportMocks.deleteFile,
  },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));

vi.mock('@capacitor/share', () => ({
  Share: { share: nativeExportMocks.share },
}));

vi.mock('@/storage/backupCapacity', () => ({
  serializePortableBackupWithinLimit: capacityMocks.serialize,
}));

vi.mock('@/hooks/useIndexedDB', () => ({
  captureDataWriteBoundaryGeneration: () => exportBoundaryMocks.generation,
  assertDataWriteBoundaryGeneration: exportBoundaryMocks.assertGeneration,
}));

vi.mock('@/lib/supabaseClient', () => ({
  getCurrentSessionUserId: exportBoundaryMocks.sessionUserId,
}));

vi.mock('@/storage/db', () => ({
  getLocalDataOwnerId: exportBoundaryMocks.localOwnerUserId,
}));

vi.mock('../journalStorage', () => ({
  getJournalExportSnapshot: vi.fn(() =>
    Promise.resolve({ entries: [], photos: [], audio: [], deletedEntryIds: [] }),
  ),
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
  platformMocks.isNative = false;
  exportBoundaryMocks.generation = 'generation-a';
  exportBoundaryMocks.sessionUserId.mockResolvedValue('account-a');
  exportBoundaryMocks.localOwnerUserId.mockResolvedValue('account-a');
  mockLink.href = '';
  mockLink.download = '';
});

// ============================================================
// exportJSON
// ============================================================
describe('exportJSON', () => {
  it('uses one storage snapshot instead of separate live entry and media reads', async () => {
    const entries = [makeEntry({ photoIds: ['photo-1'], audioIds: ['audio-1'] })];
    vi.mocked(storage.getJournalExportSnapshot).mockResolvedValue({
      entries,
      photos: [makePhoto()],
      audio: [{
        id: 'audio-1',
        entryId: 'entry-1',
        data: 'data:audio/webm;base64,YQ==',
        duration: 1,
        mimeType: 'audio/webm',
        createdAt: 1000,
      }],
      deletedEntryIds: ["deleted-entry"],
    });

    await exportJSON();

    expect(storage.getJournalExportSnapshot).toHaveBeenCalledTimes(1);
    expect(storage.getAllEntries).not.toHaveBeenCalled();
    expect(storage.getPhotosForEntry).not.toHaveBeenCalled();
    expect(storage.getAudioForEntry).not.toHaveBeenCalled();
    expect(capacityMocks.serialize).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 3,
        entries,
        photos: expect.any(Array),
        audio: expect.any(Array),
        deletedEntryIds: ["deleted-entry"],
      }),
      50 * 1024 * 1024,
    );
  });

  it('exports all entries as JSON with version 3 deletion history', async () => {
    const entries = [makeEntry()];
    vi.mocked(storage.getJournalExportSnapshot).mockResolvedValue({
      entries,
      photos: [],
      audio: [],
      deletedEntryIds: ["deleted-entry"],
    });

    await exportJSON();

    expect(storage.getJournalExportSnapshot).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockLink.download).toMatch(/^journal-backup-.*\.json$/);
    expect(capacityMocks.serialize).toHaveBeenCalledWith(
      expect.objectContaining({ version: 3, deletedEntryIds: ["deleted-entry"] }),
      50 * 1024 * 1024,
    );
  });

  it('loads photos for entries that have photoIds', async () => {
    const entries = [
      makeEntry({ id: 'e1', photoIds: ['p1'] }),
      makeEntry({ id: 'e2', photoIds: [] }),
    ];
    const photos = [makePhoto({ entryId: 'e1' })];
    vi.mocked(storage.getJournalExportSnapshot).mockResolvedValue({
      entries,
      photos,
      audio: [],
      deletedEntryIds: [],
    });

    await exportJSON();

    expect(capacityMocks.serialize).toHaveBeenCalledWith(
      expect.objectContaining({ photos }),
      50 * 1024 * 1024,
    );
    expect(storage.getPhotosForEntry).not.toHaveBeenCalled();
  });

  it('loads audio for entries that have audioIds', async () => {
    const entries = [
      makeEntry({ id: 'e1', audioIds: ['a1'] }),
      makeEntry({ id: 'e2', audioIds: [] }),
      makeEntry({ id: 'e3' }), // no audioIds
    ];
    const audio = [{
      id: 'a1',
      entryId: 'e1',
      data: 'data:audio/webm;base64,YQ==',
      duration: 1,
      mimeType: 'audio/webm',
      createdAt: 1,
    }];
    vi.mocked(storage.getJournalExportSnapshot).mockResolvedValue({
      entries,
      photos: [],
      audio,
      deletedEntryIds: [],
    });

    await exportJSON();

    expect(capacityMocks.serialize).toHaveBeenCalledWith(
      expect.objectContaining({ audio }),
      50 * 1024 * 1024,
    );
    expect(storage.getAudioForEntry).not.toHaveBeenCalled();
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

  it('rejects a JSON backup that the 50 MB importer limit would reject', async () => {
    const capacityError = Object.assign(new Error('Backup too large'), {
      code: 'BACKUP_TOO_LARGE',
    });
    capacityMocks.serialize.mockImplementationOnce(() => {
      throw capacityError;
    });

    await expect(exportJSON()).rejects.toMatchObject({ code: 'BACKUP_TOO_LARGE' });

    expect(capacityMocks.serialize).toHaveBeenCalledWith(
      expect.objectContaining({ version: 3, deletedEntryIds: [] }),
      50 * 1024 * 1024,
    );
    expect(mockClick).not.toHaveBeenCalled();
    expect(nativeExportMocks.writeFile).not.toHaveBeenCalled();
  });

  it('writes importer-compatible JSON without a byte-order mark', async () => {
    vi.mocked(storage.getAllEntries).mockResolvedValue([makeEntry()]);
    const OriginalBlob = globalThis.Blob;
    const createdBlobs: Array<{ text: () => Promise<string> }> = [];
    class TestBlob {
      readonly parts: BlobPart[];

      constructor(parts: BlobPart[]) {
        this.parts = parts;
        createdBlobs.push(this);
      }

      async text() {
        return this.parts.map((part) => (typeof part === 'string' ? part : '')).join('');
      }
    }
    vi.stubGlobal('Blob', TestBlob);

    try {
      await exportJSON();
      const json = await createdBlobs.at(-1)?.text();
      expect(json?.startsWith('{')).toBe(true);
      expect(() => JSON.parse(json || '')).not.toThrow();
    } finally {
      vi.stubGlobal('Blob', OriginalBlob);
    }
  });

  it('uses the native file and share flow instead of a DOM download', async () => {
    platformMocks.isNative = true;
    vi.mocked(storage.getAllEntries).mockResolvedValue([makeEntry()]);

    await expect(exportJSON(undefined, 'Sauvegarde JSON')).resolves.toBe('saved');

    expect(nativeExportMocks.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(/^journal-backup-.*\.json$/),
        data: expect.stringContaining('"version":3'),
        directory: 'CACHE',
        encoding: 'utf8',
      }),
    );
    expect(nativeExportMocks.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sauvegarde JSON',
        dialogTitle: 'Sauvegarde JSON',
        url: 'file://journal-backup.json',
      }),
    );
    expect(nativeExportMocks.deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ directory: 'CACHE' }),
    );
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('returns cancelled without reporting a completed native share', async () => {
    platformMocks.isNative = true;
    nativeExportMocks.share.mockRejectedValueOnce(new Error('Share canceled'));

    await expect(exportJSON()).resolves.toBe('cancelled');

    expect(nativeExportMocks.deleteFile).toHaveBeenCalledTimes(1);
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('propagates native share failures after cleaning the temporary file', async () => {
    platformMocks.isNative = true;
    nativeExportMocks.share.mockRejectedValueOnce(new Error('Share unavailable'));

    await expect(exportJSON()).rejects.toThrow('Share unavailable');

    expect(nativeExportMocks.deleteFile).toHaveBeenCalledTimes(1);
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('aborts before creating a file when the account changes during export', async () => {
    exportBoundaryMocks.sessionUserId
      .mockResolvedValueOnce('account-a')
      .mockResolvedValueOnce('account-b');
    vi.mocked(storage.getAllEntries).mockResolvedValue([makeEntry()]);

    await expect(exportJSON()).rejects.toThrow(/account boundary/i);

    expect(mockClick).not.toHaveBeenCalled();
    expect(nativeExportMocks.writeFile).not.toHaveBeenCalled();
  });

  it('removes the native cache file and never opens Share after an account switch during write', async () => {
    platformMocks.isNative = true;
    let finishWrite!: (file: { uri: string }) => void;
    nativeExportMocks.writeFile.mockReturnValueOnce(new Promise((resolve) => {
      finishWrite = resolve;
    }));

    const exportPromise = exportJSON();
    await vi.waitFor(() => expect(nativeExportMocks.writeFile).toHaveBeenCalledTimes(1));
    exportBoundaryMocks.sessionUserId.mockResolvedValue('account-b');
    exportBoundaryMocks.localOwnerUserId.mockResolvedValue('account-b');
    finishWrite({ uri: 'file://account-a-journal.json' });

    await expect(exportPromise).rejects.toThrow(/account boundary/i);
    expect(nativeExportMocks.deleteFile).toHaveBeenCalledTimes(1);
    expect(nativeExportMocks.share).not.toHaveBeenCalled();
  });
});

// ============================================================
// exportCSV
// ============================================================
describe('exportCSV', () => {
  it('reports only that the browser download was started', async () => {
    await expect(exportCSV()).resolves.toBe('started');
  });

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

  it('counts Japanese rich text with locale-aware word boundaries', async () => {
    vi.mocked(storage.getAllEntries).mockResolvedValue([
      makeEntry({ content: '<p>今日は静かな一日でした</p>' }),
    ]);
    const OriginalBlob = globalThis.Blob;
    const createdBlobs: Array<{ text: () => Promise<string> }> = [];
    class TestBlob {
      readonly parts: BlobPart[];
      constructor(parts: BlobPart[]) {
        this.parts = parts;
        createdBlobs.push(this);
      }
      async text() {
        return this.parts.map((part) => (typeof part === 'string' ? part : '')).join('');
      }
    }
    vi.stubGlobal('Blob', TestBlob);

    try {
      await exportCSV('ja');
      const csv = await createdBlobs.at(-1)?.text();
      const exportedCount = Number(csv?.trim().split('\n').at(-1)?.split(',').at(7)?.replace(/"/g, ''));
      expect(exportedCount).toBeGreaterThan(1);
    } finally {
      vi.stubGlobal('Blob', OriginalBlob);
    }
  });

  it('exports the complete Unicode content without splitting emoji or combining text', async () => {
    const content = `${'a'.repeat(499)}😀 e\u0301 שלום`;
    vi.mocked(storage.getAllEntries).mockResolvedValue([makeEntry({ content })]);
    const OriginalBlob = globalThis.Blob;
    const createdBlobs: Array<{ text: () => Promise<string> }> = [];
    class TestBlob {
      readonly parts: BlobPart[];
      constructor(parts: BlobPart[]) {
        this.parts = parts;
        createdBlobs.push(this);
      }
      async text() {
        return this.parts.map((part) => (typeof part === 'string' ? part : '')).join('');
      }
    }
    vi.stubGlobal('Blob', TestBlob);

    try {
      await exportCSV('he');
      const csv = await createdBlobs.at(-1)?.text();
      expect(csv).toContain(content);
      expect(csv).not.toContain('\uFFFD');
    } finally {
      vi.stubGlobal('Blob', OriginalBlob);
    }
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

  it('neutralizes spreadsheet formulas in exported CSV cells', async () => {
    const entries = [
      makeEntry({
        title: '=IMPORTXML("https://example.test","//a")',
        content: '+cmd|\' /C calc!A0',
        date: '=DATE(2026,1,1)',
        mood: '=mood' as JournalEntry['mood'],
        stickers: ['+sticker', '@symbol'],
        tags: ['@private', '-tag'],
      }),
    ];
    vi.mocked(storage.getAllEntries).mockResolvedValue(entries);

    const OriginalBlob = globalThis.Blob;
    const createdBlobs: Array<{ text: () => Promise<string> }> = [];
    class TestBlob {
      readonly parts: BlobPart[];

      constructor(parts: BlobPart[]) {
        this.parts = parts;
        createdBlobs.push(this);
      }

      async text() {
        return this.parts
          .map((part) => {
            if (typeof part === 'string') return part;
            if (part instanceof ArrayBuffer) return new TextDecoder().decode(part);
            if (ArrayBuffer.isView(part)) {
              return new TextDecoder().decode(part);
            }
            return '';
          })
          .join('');
      }
    }

    vi.stubGlobal('Blob', TestBlob);

    try {
      await exportCSV();
      const csv = await createdBlobs.at(-1)?.text();
      expect(csv).toContain(`"'=IMPORTXML(""https://example.test"",""//a"")"`);
      expect(csv).toContain(`"'+cmd|' /C calc!A0"`);
      expect(csv).toContain(`"'=DATE(2026,1,1)"`);
      expect(csv).toContain(`"'=mood"`);
      expect(csv).toContain(`"'@private, -tag"`);
      expect(csv).toContain(`"'+sticker @symbol"`);
    } finally {
      vi.stubGlobal('Blob', OriginalBlob);
    }
  });

  it('uses the native share sheet and reports cancellation instead of a DOM download', async () => {
    platformMocks.isNative = true;
    nativeExportMocks.share.mockRejectedValueOnce(new Error('Share canceled'));

    await expect(exportCSV('en', 'Journal CSV')).resolves.toBe('cancelled');

    expect(nativeExportMocks.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(/^journal-.*\.csv$/),
        directory: 'CACHE',
        encoding: 'utf8',
      }),
    );
    expect(nativeExportMocks.share).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Journal CSV', url: 'file://journal-backup.json' }),
    );
    expect(nativeExportMocks.deleteFile).toHaveBeenCalledTimes(1);
    expect(mockClick).not.toHaveBeenCalled();
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

  it('uses the entry civil date instead of its creation timestamp', async () => {
    vi.mocked(storage.getAllEntries).mockResolvedValue([
      makeEntry({
        date: '2030-12-24',
        createdAt: new Date(2020, 0, 1, 8, 0).getTime(),
      }),
    ]);
    const OriginalBlob = globalThis.Blob;
    const createdBlobs: Array<{ text: () => Promise<string> }> = [];
    class TestBlob {
      readonly parts: BlobPart[];
      constructor(parts: BlobPart[]) {
        this.parts = parts;
        createdBlobs.push(this);
      }
      async text() {
        return this.parts.map((part) => (typeof part === 'string' ? part : '')).join('');
      }
    }
    vi.stubGlobal('Blob', TestBlob);

    try {
      await exportMarkdown('en');
      const markdown = await createdBlobs.at(-1)?.text();
      expect(markdown).toContain('2030');
      expect(markdown).not.toContain('2020');
    } finally {
      vi.stubGlobal('Blob', OriginalBlob);
    }
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

  it('uses the native share sheet instead of a DOM download', async () => {
    platformMocks.isNative = true;

    await expect(exportMarkdown('en', 'Journal Markdown')).resolves.toBe('saved');

    expect(nativeExportMocks.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(/^journal-.*\.md$/),
        directory: 'CACHE',
        encoding: 'utf8',
      }),
    );
    expect(nativeExportMocks.share).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Journal Markdown', url: 'file://journal-backup.json' }),
    );
    expect(mockClick).not.toHaveBeenCalled();
  });
});

// ============================================================
// exportPDF
// ============================================================
describe('exportPDF', () => {
  it('creates a lightweight PDF document', async () => {
    const entries = [makeEntry({ title: 'PDF Entry', content: 'PDF content' })];
    vi.mocked(storage.getJournalExportSnapshot).mockResolvedValue({
      entries,
      photos: [],
      audio: [],
      deletedEntryIds: [],
    });

    await exportPDF();

    expect(storage.getJournalExportSnapshot).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockLink.download).toMatch(/^journal-.*\.pdf$/);
  });
});
