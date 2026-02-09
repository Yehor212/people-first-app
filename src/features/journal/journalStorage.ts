import { db } from '@/storage/db';
import { generateId } from '@/lib/utils';
import type { JournalEntry, JournalPhoto } from './types';
import { MAX_PHOTOS_PER_ENTRY } from './types';

// ============================================
// JOURNAL ENTRIES CRUD
// ============================================

export async function getAllEntries(): Promise<JournalEntry[]> {
  return db.journalEntries.orderBy('createdAt').reverse().toArray();
}

export async function getEntriesByDate(date: string): Promise<JournalEntry[]> {
  return db.journalEntries.where('date').equals(date).reverse().sortBy('createdAt');
}

export async function getEntryById(id: string): Promise<JournalEntry | undefined> {
  return db.journalEntries.get(id);
}

export async function saveEntry(entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<JournalEntry> {
  const now = Date.now();
  const full: JournalEntry = {
    ...entry,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  await db.journalEntries.add(full);
  return full;
}

export async function updateEntry(id: string, changes: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>): Promise<void> {
  await db.journalEntries.update(id, { ...changes, updatedAt: Date.now() });
}

export async function deleteEntry(id: string): Promise<void> {
  // Delete associated photos first
  const photos = await db.journalPhotos.where('entryId').equals(id).toArray();
  await db.transaction('rw', [db.journalEntries, db.journalPhotos], async () => {
    if (photos.length) {
      await db.journalPhotos.bulkDelete(photos.map(p => p.id));
    }
    await db.journalEntries.delete(id);
  });
}

export async function getEntryCount(): Promise<number> {
  return db.journalEntries.count();
}

// ============================================
// PHOTO COMPRESSION + STORAGE
// ============================================

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.7;
const THUMB_WIDTH = 100;
const THUMB_QUALITY = 0.5;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function resizeAndCompress(
  img: HTMLImageElement,
  maxDim: number,
  quality: number,
): { dataUrl: string; width: number; height: number } {
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  ctx.drawImage(img, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width, height };
}

export async function compressAndStorePhoto(
  file: File,
  entryId: string,
): Promise<JournalPhoto> {
  // Check photo limit
  const existing = await db.journalPhotos.where('entryId').equals(entryId).count();
  if (existing >= MAX_PHOTOS_PER_ENTRY) {
    throw new Error(`Maximum ${MAX_PHOTOS_PER_ENTRY} photos per entry`);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const full = resizeAndCompress(img, MAX_DIMENSION, JPEG_QUALITY);
    const thumb = resizeAndCompress(img, THUMB_WIDTH, THUMB_QUALITY);

    const photo: JournalPhoto = {
      id: generateId(),
      entryId,
      data: full.dataUrl,
      thumbnail: thumb.dataUrl,
      width: full.width,
      height: full.height,
      createdAt: Date.now(),
    };

    await db.journalPhotos.add(photo);
    return photo;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function getPhotosForEntry(entryId: string): Promise<JournalPhoto[]> {
  return db.journalPhotos.where('entryId').equals(entryId).toArray();
}

export async function getPhotoById(id: string): Promise<JournalPhoto | undefined> {
  return db.journalPhotos.get(id);
}

export async function deletePhoto(id: string, entryId: string): Promise<void> {
  await db.transaction('rw', [db.journalEntries, db.journalPhotos], async () => {
    await db.journalPhotos.delete(id);
    // Remove photoId reference from entry
    const entry = await db.journalEntries.get(entryId);
    if (entry) {
      await db.journalEntries.update(entryId, {
        photoIds: entry.photoIds.filter(pid => pid !== id),
        updatedAt: Date.now(),
      });
    }
  });
}
