import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────

let mockEntries: any[] = [];
let mockPhotos: any[] = [];
let mockAudio: any[] = [];
let addedEntries: any[] = [];
let addedPhotos: any[] = [];
let addedAudio: any[] = [];
let mockVaultKey: string | null = null;

vi.mock("../journalContentSession", () => ({
  getJournalContentVaultKey: vi.fn(() => mockVaultKey),
}));

vi.mock("../journalCrypto", () => ({
  encryptJournalContent: vi.fn((content: string, key: string) =>
    Promise.resolve(`encrypted-entry:${key}:${content}`)
  ),
  isEncryptedJournalContent: vi.fn((content: string) => content.startsWith("encrypted-entry:")),
}));

vi.mock("../journalMediaCrypto", () => ({
  encryptJournalMediaDataUrl: vi.fn((dataUrl: string, key: string) =>
    Promise.resolve(`encrypted-media:${key}:${dataUrl}`)
  ),
  isEncryptedJournalMediaData: vi.fn((dataUrl: string) => dataUrl.startsWith("encrypted-media:")),
}));

vi.mock("@/storage/cloudSync", () => ({
  triggerSync: vi.fn(),
}));

vi.mock("@/storage/db", () => ({
  db: {
    journalEntries: {
      toArray: vi.fn(() => Promise.resolve(mockEntries)),
      add: vi.fn((entry: any) => {
        addedEntries.push(entry);
        return Promise.resolve();
      }),
    },
    journalPhotos: {
      toArray: vi.fn(() => Promise.resolve(mockPhotos)),
      add: vi.fn((photo: any) => {
        addedPhotos.push(photo);
        return Promise.resolve();
      }),
    },
    journalAudio: {
      toArray: vi.fn(() => Promise.resolve(mockAudio)),
      add: vi.fn((audio: any) => {
        addedAudio.push(audio);
        return Promise.resolve();
      }),
    },
    transaction: vi.fn((_mode: string, _tables: any[], cb: () => Promise<any>) => cb()),
  },
}));

import { triggerSync } from "@/storage/cloudSync";
import { importJournalBackup } from "../journalImport";

// ─── Helpers ──────────────────────────────────────────────────

function makeFile(content: string): File {
  const blob = new Blob([content], { type: "application/json" });
  const file = new File([blob], "backup.json", { type: "application/json" });
  // Ensure .text() works in test environment
  if (!file.text) {
    file.text = () => Promise.resolve(content);
  }
  return file;
}

function makeBackup(overrides: Record<string, unknown> = {}) {
  return {
    version: 2,
    exportedAt: Date.now(),
    entries: [],
    photos: [],
    ...overrides,
  };
}

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    date: "2026-02-17",
    title: "Test Entry",
    content: "Hello world content",
    stickers: [],
    photoIds: [],
    tags: ["personal"],
    createdAt: 1708128000000,
    updatedAt: 1708128000000,
    ...overrides,
  };
}

function makePhoto(overrides: Record<string, unknown> = {}) {
  return {
    id: "photo-1",
    entryId: "entry-1",
    data: "data:image/jpeg;base64,abc",
    thumbnail: "data:image/jpeg;base64,thumb",
    width: 800,
    height: 600,
    createdAt: 1000,
    ...overrides,
  };
}

function makeAudioItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "audio-1",
    entryId: "entry-1",
    data: "data:audio/webm;base64,abc",
    duration: 30,
    mimeType: "audio/webm",
    createdAt: 1000,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockEntries = [];
  mockPhotos = [];
  mockAudio = [];
  addedEntries = [];
  addedPhotos = [];
  addedAudio = [];
  mockVaultKey = null;
});

// ─── Tests ────────────────────────────────────────────────────

describe("importJournalBackup", () => {
  it("returns error for invalid JSON", async () => {
    const file = makeFile("not-json{{{");

    const result = await importJournalBackup(file);

    expect(result.errors).toContain("Invalid JSON file");
    expect(result.imported).toBe(0);
  });

  it("returns error for missing version", async () => {
    const file = makeFile(JSON.stringify({ entries: [], photos: [] }));

    const result = await importJournalBackup(file);

    expect(result.errors).toContain("Invalid backup format");
  });

  it("returns error for missing entries array", async () => {
    const file = makeFile(JSON.stringify({ version: 2, photos: [] }));

    const result = await importJournalBackup(file);

    expect(result.errors).toContain("Invalid backup format");
  });

  it("imports 2 valid entries successfully", async () => {
    const backup = makeBackup({
      entries: [makeEntry({ id: "e1" }), makeEntry({ id: "e2" })],
    });
    const file = makeFile(JSON.stringify(backup));

    const result = await importJournalBackup(file);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(addedEntries).toHaveLength(2);
  });

  it("deduplicates: skips 1 existing entry, imports the other", async () => {
    mockEntries = [{ id: "e1" }];
    const backup = makeBackup({
      entries: [makeEntry({ id: "e1" }), makeEntry({ id: "e2" })],
    });
    const file = makeFile(JSON.stringify(backup));

    const result = await importJournalBackup(file);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(addedEntries).toHaveLength(1);
    expect(addedEntries[0].id).toBe("e2");
  });

  it("reports error for entry missing required id field", async () => {
    const backup = makeBackup({
      entries: [{ date: "2026-01-01", content: "text", createdAt: 1000 }],
    });
    const file = makeFile(JSON.stringify(backup));

    const result = await importJournalBackup(file);

    expect(result.errors.some((e) => e.includes("Invalid entry"))).toBe(true);
    expect(result.imported).toBe(0);
  });

  it("reports error for entry missing content", async () => {
    const backup = makeBackup({
      entries: [{ id: "e1", date: "2026-01-01", createdAt: 1000 }],
    });
    const file = makeFile(JSON.stringify(backup));

    const result = await importJournalBackup(file);

    expect(result.errors.some((e) => e.includes("Invalid entry"))).toBe(true);
    expect(result.imported).toBe(0);
  });

  it("imports photos alongside entries", async () => {
    const backup = makeBackup({
      entries: [makeEntry({ id: "e1", photoIds: ["photo-1"] })],
      photos: [makePhoto({ id: "photo-1", entryId: "e1" })],
    });
    const file = makeFile(JSON.stringify(backup));

    const result = await importJournalBackup(file);

    expect(result.imported).toBe(1);
    expect(result.photosImported).toBe(1);
    expect(addedPhotos).toHaveLength(1);
  });

  it("skips duplicate photos", async () => {
    mockPhotos = [{ id: "photo-1" }];
    const backup = makeBackup({
      entries: [makeEntry()],
      photos: [makePhoto({ id: "photo-1" }), makePhoto({ id: "photo-2" })],
    });
    const file = makeFile(JSON.stringify(backup));

    const result = await importJournalBackup(file);

    expect(result.photosImported).toBe(1);
    expect(addedPhotos).toHaveLength(1);
    expect(addedPhotos[0].id).toBe("photo-2");
  });

  it("imports audio from backup", async () => {
    const backup = makeBackup({
      entries: [makeEntry({ id: "e1", audioIds: ["audio-1"] })],
      photos: [],
      audio: [makeAudioItem({ id: "audio-1", entryId: "e1" })],
    });
    const file = makeFile(JSON.stringify(backup));

    const result = await importJournalBackup(file);

    expect(result.audioImported).toBe(1);
    expect(addedAudio).toHaveLength(1);
  });

  it("encrypts imported plaintext content and media when a diary vault key is active", async () => {
    mockVaultKey = "vault-key-1";
    const backup = makeBackup({
      entries: [
        makeEntry({
          id: "e1",
          content: "private imported entry",
          photoIds: ["photo-1"],
          audioIds: ["audio-1"],
        }),
      ],
      photos: [makePhoto({ id: "photo-1", entryId: "e1" })],
      audio: [makeAudioItem({ id: "audio-1", entryId: "e1" })],
    });
    const file = makeFile(JSON.stringify(backup));

    const result = await importJournalBackup(file);

    expect(result.errors).toHaveLength(0);
    expect(addedEntries[0].content).toBe(
      "encrypted-entry:vault-key-1:private imported entry"
    );
    expect(addedPhotos[0].data).toBe(
      "encrypted-media:vault-key-1:data:image/jpeg;base64,abc"
    );
    expect(addedPhotos[0].thumbnail).toBe(
      "encrypted-media:vault-key-1:data:image/jpeg;base64,thumb"
    );
    expect(addedAudio[0].data).toBe(
      "encrypted-media:vault-key-1:data:audio/webm;base64,abc"
    );
  });

  it("triggers sync when import adds media to an existing entry", async () => {
    mockEntries = [makeEntry({ id: "entry-1", photoIds: [], audioIds: [] })];
    const backup = makeBackup({
      entries: [makeEntry({ id: "entry-1", photoIds: ["photo-1"], audioIds: ["audio-1"] })],
      photos: [makePhoto({ id: "photo-1", entryId: "entry-1" })],
      audio: [makeAudioItem({ id: "audio-1", entryId: "entry-1" })],
    });
    const file = makeFile(JSON.stringify(backup));

    const result = await importJournalBackup(file);

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.photosImported).toBe(1);
    expect(result.audioImported).toBe(1);
    expect(triggerSync).toHaveBeenCalledTimes(1);
  });

  it("calls onProgress callback with progress steps", async () => {
    const backup = makeBackup({
      entries: [makeEntry()],
      photos: [makePhoto()],
      audio: [makeAudioItem()],
    });
    const file = makeFile(JSON.stringify(backup));
    const onProgress = vi.fn();

    await importJournalBackup(file, onProgress);

    expect(onProgress).toHaveBeenCalledWith("Reading file...");
    expect(onProgress).toHaveBeenCalledWith("Checking existing entries...");
    expect(onProgress).toHaveBeenCalledWith("Importing entries...");
    expect(onProgress).toHaveBeenCalledWith("Importing photos...");
    expect(onProgress).toHaveBeenCalledWith("Importing audio...");
  });

  it("handles empty backup with no entries", async () => {
    const backup = makeBackup({ entries: [], photos: [] });
    const file = makeFile(JSON.stringify(backup));

    const result = await importJournalBackup(file);

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.photosImported).toBe(0);
    expect(result.audioImported).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});
