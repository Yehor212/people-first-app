import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────

vi.mock('@/storage/db', () => {
  const mockTable = () => ({
    add: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(undefined)),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
    update: vi.fn(() => Promise.resolve(1)),
    count: vi.fn(() => Promise.resolve(0)),
    toArray: vi.fn(() => Promise.resolve([])),
    bulkDelete: vi.fn(() => Promise.resolve()),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([])),
        count: vi.fn(() => Promise.resolve(0)),
        reverse: vi.fn(() => ({
          sortBy: vi.fn(() => Promise.resolve([])),
        })),
        sortBy: vi.fn(() => Promise.resolve([])),
      })),
    })),
    orderBy: vi.fn(() => ({
      reverse: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([])),
      })),
    })),
  });
  return {
    db: {
      journalEntries: mockTable(),
      journalPhotos: mockTable(),
      journalAudio: mockTable(),
      transaction: vi.fn((_mode: string, _tables: unknown[], fn: () => unknown) => fn()),
    },
  };
});

vi.mock('@/storage/realtimeSync', () => ({
  syncJournalEntry: vi.fn(() => Promise.resolve()),
  deleteJournalEntryFromCloud: vi.fn(() => Promise.resolve()),
  syncJournalPhoto: vi.fn(() => Promise.resolve()),
  syncJournalAudio: vi.fn(() => Promise.resolve()),
  deleteJournalPhotoFromCloud: vi.fn(() => Promise.resolve()),
  deleteJournalAudioFromCloud: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/storage/cloudSync', () => ({ triggerSync: vi.fn() }));

vi.mock('@/storage/journalStorageService', () => ({
  uploadPhoto: vi.fn(() => Promise.resolve(null)),
  uploadAudio: vi.fn(() => Promise.resolve(null)),
  deletePhotoFromStorage: vi.fn(),
  deleteAudioFromStorage: vi.fn(),
  deleteEntryMediaFromStorage: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(() => 'test-id-123'),
}));

import { db } from '@/storage/db';
import {
  getAllEntries,
  getEntriesByDate,
  getEntryById,
  saveEntry,
  updateEntry,
  deleteEntry,
  getEntryCount,
  getPhotosForEntry,
  getPhotoById,
  deletePhoto,
  storeAudio,
  getAudioForEntry,
  getAudioById,
  deleteAudio,
} from '../journalStorage';
import { syncJournalEntry, deleteJournalEntryFromCloud, syncJournalAudio, deleteJournalPhotoFromCloud, deleteJournalAudioFromCloud } from '@/storage/realtimeSync';
import { triggerSync } from '@/storage/cloudSync';
import { deleteEntryMediaFromStorage } from '@/storage/journalStorageService';
import type { JournalEntry, JournalPhoto, JournalAudio } from '../types';

// ─── Helpers ──────────────────────────────────────────────────

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'entry-1',
    date: '2026-02-17',
    title: 'Test Entry',
    content: 'Test content',
    stickers: [],
    photoIds: [],
    tags: [],
    createdAt: 1000,
    updatedAt: 1000,
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

function makeAudio(overrides: Partial<JournalAudio> = {}): JournalAudio {
  return {
    id: 'audio-1',
    entryId: 'entry-1',
    data: 'data:audio/webm;base64,xyz',
    duration: 30,
    mimeType: 'audio/webm',
    createdAt: 1000,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// getAllEntries
// ============================================================
describe('getAllEntries', () => {
  it('returns entries ordered by createdAt descending', async () => {
    const entries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' })];
    const mockReverse = vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve(entries)) }));
    vi.mocked(db.journalEntries.orderBy).mockReturnValue({ reverse: mockReverse } as never);

    const result = await getAllEntries();

    expect(db.journalEntries.orderBy).toHaveBeenCalledWith('createdAt');
    expect(mockReverse).toHaveBeenCalled();
    expect(result).toEqual(entries);
  });

  it('returns empty array when no entries exist', async () => {
    const mockReverse = vi.fn(() => ({ toArray: vi.fn(() => Promise.resolve([])) }));
    vi.mocked(db.journalEntries.orderBy).mockReturnValue({ reverse: mockReverse } as never);

    const result = await getAllEntries();
    expect(result).toEqual([]);
  });
});

// ============================================================
// getEntriesByDate
// ============================================================
describe('getEntriesByDate', () => {
  it('queries journalEntries by date field', async () => {
    const entries = [makeEntry({ date: '2026-02-17' })];
    const mockSortBy = vi.fn(() => Promise.resolve(entries));
    const mockReverse = vi.fn(() => ({ sortBy: mockSortBy }));
    const mockEquals = vi.fn(() => ({ reverse: mockReverse, sortBy: mockSortBy }));
    const mockWhere = vi.fn(() => ({ equals: mockEquals }));
    vi.mocked(db.journalEntries.where).mockImplementation(mockWhere as any);

    const result = await getEntriesByDate('2026-02-17');

    expect(mockWhere).toHaveBeenCalledWith('date');
    expect(mockEquals).toHaveBeenCalledWith('2026-02-17');
    expect(result).toEqual(entries);
  });
});

// ============================================================
// getEntryById
// ============================================================
describe('getEntryById', () => {
  it('returns entry by id from db.journalEntries.get', async () => {
    const entry = makeEntry();
    vi.mocked(db.journalEntries.get).mockResolvedValue(entry);

    const result = await getEntryById('entry-1');
    expect(db.journalEntries.get).toHaveBeenCalledWith('entry-1');
    expect(result).toEqual(entry);
  });

  it('returns undefined when entry not found', async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    const result = await getEntryById('nonexistent');
    expect(result).toBeUndefined();
  });
});

// ============================================================
// saveEntry
// ============================================================
describe('saveEntry', () => {
  it('generates id and timestamps, adds to db', async () => {
    const input = {
      date: '2026-02-17',
      title: 'New Entry',
      content: 'Content here',
      stickers: [],
      photoIds: [],
      tags: ['test'],
    };

    const result = await saveEntry(input);

    expect(result.id).toBe('test-id-123');
    expect(result.createdAt).toBeGreaterThan(0);
    expect(result.updatedAt).toBe(result.createdAt);
    expect(result.title).toBe('New Entry');
    expect(db.journalEntries.add).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-id-123', title: 'New Entry' }),
    );
  });

  it('triggers cloud sync after saving', async () => {
    await saveEntry({
      date: '2026-02-17',
      title: 'T',
      content: 'C',
      stickers: [],
      photoIds: [],
      tags: [],
    });

    expect(syncJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-id-123' }),
    );
    expect(triggerSync).toHaveBeenCalled();
  });

  it('preserves all input fields in the saved entry', async () => {
    const result = await saveEntry({
      date: '2026-01-01',
      title: 'Title',
      content: 'Body text',
      stickers: ['star'],
      photoIds: ['p1'],
      tags: ['tag1', 'tag2'],
      mood: 'great',
    });

    expect(result.mood).toBe('great');
    expect(result.stickers).toEqual(['star']);
    expect(result.tags).toEqual(['tag1', 'tag2']);
    expect(result.photoIds).toEqual(['p1']);
  });
});

// ============================================================
// updateEntry
// ============================================================
describe('updateEntry', () => {
  it('calls db.update with merged changes and new updatedAt', async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(makeEntry());

    await updateEntry('entry-1', { title: 'Updated' });

    expect(db.journalEntries.update).toHaveBeenCalledWith(
      'entry-1',
      expect.objectContaining({ title: 'Updated' }),
    );
    // updatedAt should be a timestamp
    const callArgs = vi.mocked(db.journalEntries.update).mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs.updatedAt).toBeGreaterThan(0);
  });

  it('triggers triggerSync after update', async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(makeEntry());

    await updateEntry('entry-1', { content: 'New content' });

    expect(triggerSync).toHaveBeenCalled();
  });
});

// ============================================================
// deleteEntry
// ============================================================
describe('deleteEntry', () => {
  it('deletes entry, photos, and audio from db in a transaction', async () => {
    const photos = [makePhoto({ id: 'p1' }), makePhoto({ id: 'p2' })];
    const audios = [makeAudio({ id: 'a1' })];

    const mockPhotosEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve(photos)),
      count: vi.fn(() => Promise.resolve(2)),
    }));
    vi.mocked(db.journalPhotos.where).mockReturnValue({ equals: mockPhotosEquals } as never);

    const mockAudioEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve(audios)),
      count: vi.fn(() => Promise.resolve(1)),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockAudioEquals } as never);

    await deleteEntry('entry-1');

    expect(db.transaction).toHaveBeenCalled();
    expect(db.journalPhotos.bulkDelete).toHaveBeenCalledWith(['p1', 'p2']);
    expect(db.journalAudio.bulkDelete).toHaveBeenCalledWith(['a1']);
    expect(db.journalEntries.delete).toHaveBeenCalledWith('entry-1');
  });

  it('deletes media from storage and syncs cloud deletion', async () => {
    const mockEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([])),
      count: vi.fn(() => Promise.resolve(0)),
    }));
    vi.mocked(db.journalPhotos.where).mockReturnValue({ equals: mockEquals } as never);
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    await deleteEntry('entry-1');

    expect(deleteEntryMediaFromStorage).toHaveBeenCalledWith([], []);
    expect(deleteJournalEntryFromCloud).toHaveBeenCalledWith('entry-1');
    expect(triggerSync).toHaveBeenCalled();
  });

  it('skips bulkDelete when entry has no photos or audio', async () => {
    const mockEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([])),
      count: vi.fn(() => Promise.resolve(0)),
    }));
    vi.mocked(db.journalPhotos.where).mockReturnValue({ equals: mockEquals } as never);
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    await deleteEntry('entry-1');

    expect(db.journalPhotos.bulkDelete).not.toHaveBeenCalled();
    expect(db.journalAudio.bulkDelete).not.toHaveBeenCalled();
    expect(db.journalEntries.delete).toHaveBeenCalledWith('entry-1');
  });
});

// ============================================================
// getEntryCount
// ============================================================
describe('getEntryCount', () => {
  it('returns count from db.journalEntries.count()', async () => {
    vi.mocked(db.journalEntries.count).mockResolvedValue(42);

    const result = await getEntryCount();
    expect(result).toBe(42);
  });

  it('returns 0 when no entries', async () => {
    vi.mocked(db.journalEntries.count).mockResolvedValue(0);

    const result = await getEntryCount();
    expect(result).toBe(0);
  });
});

// ============================================================
// getPhotosForEntry
// ============================================================
describe('getPhotosForEntry', () => {
  it('queries photos by entryId', async () => {
    const photos = [makePhoto()];
    const mockEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve(photos)),
    }));
    vi.mocked(db.journalPhotos.where).mockReturnValue({ equals: mockEquals } as never);

    const result = await getPhotosForEntry('entry-1');

    expect(db.journalPhotos.where).toHaveBeenCalledWith('entryId');
    expect(mockEquals).toHaveBeenCalledWith('entry-1');
    expect(result).toEqual(photos);
  });
});

// ============================================================
// getPhotoById
// ============================================================
describe('getPhotoById', () => {
  it('returns photo from db.journalPhotos.get', async () => {
    const photo = makePhoto();
    vi.mocked(db.journalPhotos.get).mockResolvedValue(photo);

    const result = await getPhotoById('photo-1');
    expect(db.journalPhotos.get).toHaveBeenCalledWith('photo-1');
    expect(result).toEqual(photo);
  });
});

// ============================================================
// deletePhoto
// ============================================================
describe('deletePhoto', () => {
  it('removes photo from db and updates entry photoIds', async () => {
    const entry = makeEntry({ photoIds: ['photo-1', 'photo-2'] });
    vi.mocked(db.journalEntries.get).mockResolvedValue(entry);

    await deletePhoto('photo-1', 'entry-1');

    expect(db.journalPhotos.delete).toHaveBeenCalledWith('photo-1');
    expect(db.journalEntries.get).toHaveBeenCalledWith('entry-1');
    expect(db.journalEntries.update).toHaveBeenCalledWith(
      'entry-1',
      expect.objectContaining({ photoIds: ['photo-2'] }),
    );
  });

  it('triggers cloud photo deletion', async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    await deletePhoto('photo-1', 'entry-1');

    expect(deleteJournalPhotoFromCloud).toHaveBeenCalledWith('photo-1');
  });

  it('does not update entry when entry not found', async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    await deletePhoto('photo-1', 'entry-1');

    expect(db.journalEntries.update).not.toHaveBeenCalled();
  });
});

// ============================================================
// storeAudio
// ============================================================
describe('storeAudio', () => {
  it('creates audio record and stores in db', async () => {
    const mockCount = vi.fn(() => Promise.resolve(0));
    const mockEquals = vi.fn(() => ({
      count: mockCount,
      toArray: vi.fn(() => Promise.resolve([])),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    const result = await storeAudio('entry-1', 'base64data', 30, 'audio/webm');

    expect(result.id).toBe('test-id-123');
    expect(result.entryId).toBe('entry-1');
    expect(result.data).toBe('base64data');
    expect(result.duration).toBe(30);
    expect(result.mimeType).toBe('audio/webm');
    expect(result.createdAt).toBeGreaterThan(0);
    expect(db.journalAudio.add).toHaveBeenCalled();
  });

  it('throws when MAX_AUDIO_PER_ENTRY is reached', async () => {
    const mockCount = vi.fn(() => Promise.resolve(3));
    const mockEquals = vi.fn(() => ({
      count: mockCount,
      toArray: vi.fn(() => Promise.resolve([])),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    await expect(storeAudio('entry-1', 'data', 10, 'audio/webm')).rejects.toThrow(
      'Maximum 3 audio recordings per entry',
    );
  });

  it('triggers cloud sync for audio metadata', async () => {
    const mockCount = vi.fn(() => Promise.resolve(0));
    const mockEquals = vi.fn(() => ({
      count: mockCount,
      toArray: vi.fn(() => Promise.resolve([])),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    await storeAudio('entry-1', 'data', 15, 'audio/mp4');

    expect(syncJournalAudio).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-id-123', entryId: 'entry-1' }),
    );
  });
});

// ============================================================
// getAudioForEntry
// ============================================================
describe('getAudioForEntry', () => {
  it('queries audio by entryId', async () => {
    const audios = [makeAudio()];
    const mockEquals = vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve(audios)),
    }));
    vi.mocked(db.journalAudio.where).mockReturnValue({ equals: mockEquals } as never);

    const result = await getAudioForEntry('entry-1');

    expect(db.journalAudio.where).toHaveBeenCalledWith('entryId');
    expect(mockEquals).toHaveBeenCalledWith('entry-1');
    expect(result).toEqual(audios);
  });
});

// ============================================================
// getAudioById
// ============================================================
describe('getAudioById', () => {
  it('returns audio from db.journalAudio.get', async () => {
    const audio = makeAudio();
    vi.mocked(db.journalAudio.get).mockResolvedValue(audio);

    const result = await getAudioById('audio-1');
    expect(db.journalAudio.get).toHaveBeenCalledWith('audio-1');
    expect(result).toEqual(audio);
  });

  it('returns undefined when audio not found', async () => {
    vi.mocked(db.journalAudio.get).mockResolvedValue(undefined);

    const result = await getAudioById('nonexistent');
    expect(result).toBeUndefined();
  });
});

// ============================================================
// deleteAudio
// ============================================================
describe('deleteAudio', () => {
  it('removes audio from db and updates entry audioIds', async () => {
    const entry = makeEntry({ audioIds: ['audio-1', 'audio-2'] });
    vi.mocked(db.journalEntries.get).mockResolvedValue(entry);

    await deleteAudio('audio-1', 'entry-1');

    expect(db.journalAudio.delete).toHaveBeenCalledWith('audio-1');
    expect(db.journalEntries.get).toHaveBeenCalledWith('entry-1');
    expect(db.journalEntries.update).toHaveBeenCalledWith(
      'entry-1',
      expect.objectContaining({ audioIds: ['audio-2'] }),
    );
  });

  it('triggers cloud audio deletion', async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    await deleteAudio('audio-1', 'entry-1');

    expect(deleteJournalAudioFromCloud).toHaveBeenCalledWith('audio-1');
  });

  it('does not update entry when entry not found', async () => {
    vi.mocked(db.journalEntries.get).mockResolvedValue(undefined);

    await deleteAudio('audio-1', 'entry-1');

    expect(db.journalEntries.update).not.toHaveBeenCalled();
  });
});
