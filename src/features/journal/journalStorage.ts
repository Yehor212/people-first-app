import { db } from '@/storage/db';
import { generateId } from '@/lib/utils';
import type { JournalEntry, JournalPhoto, JournalAudio } from './types';
import { MAX_PHOTOS_PER_ENTRY, MAX_AUDIO_PER_ENTRY } from './types';
import {
  uploadPhoto,
  uploadAudio as uploadAudioToStorage,
  deletePhotoFromStorage,
  deleteAudioFromStorage,
  deleteEntryMediaFromStorage,
} from '@/storage/journalStorageService';
import {
  syncJournalEntry,
  deleteJournalEntryFromCloud,
  syncJournalPhoto,
  syncJournalAudio,
  deleteJournalPhotoFromCloud,
  deleteJournalAudioFromCloud,
} from '@/storage/realtimeSync';
import { triggerSync } from '@/storage/cloudSync';
import { logger } from '@/lib/logger';

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

  // Granular sync to cloud (non-blocking)
  syncJournalEntry(full).catch(err => logger.warn('[JournalSync]', 'Entry sync failed:', err));
  triggerSync();

  return full;
}

export async function updateEntry(id: string, changes: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>): Promise<void> {
  await db.journalEntries.update(id, { ...changes, updatedAt: Date.now() });

  // Granular sync to cloud (non-blocking) — re-read full entry for sync
  void db.journalEntries.get(id).then(updated => {
    if (updated) syncJournalEntry(updated).catch(err => logger.warn('[JournalSync]', 'Entry update sync failed:', err));
  });
  triggerSync();
}

export async function deleteEntry(id: string): Promise<void> {
  // Collect associated media before deleting
  const photos = await db.journalPhotos.where('entryId').equals(id).toArray();
  const audios = await db.journalAudio.where('entryId').equals(id).toArray();

  // Delete from local IndexedDB (photos + audio + entry)
  await db.transaction('rw', [db.journalEntries, db.journalPhotos, db.journalAudio], async () => {
    if (photos.length) {
      await db.journalPhotos.bulkDelete(photos.map(p => p.id));
    }
    if (audios.length) {
      await db.journalAudio.bulkDelete(audios.map(a => a.id));
    }
    await db.journalEntries.delete(id);
  });

  // Clean up from Supabase Storage (fire-and-forget, non-blocking)
  void deleteEntryMediaFromStorage(
    photos.map(p => p.id),
    audios.map(a => a.id),
  );

  // Delete from cloud tables (fire-and-forget)
  deleteJournalEntryFromCloud(id).catch(err => logger.warn('[JournalSync]', 'Entry delete sync failed:', err));
  triggerSync();
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

    // Background upload to Supabase Storage (non-blocking)
    void uploadPhoto(photo.id, full.dataUrl).then(async (result) => {
      if (result) {
        await db.journalPhotos.update(photo.id, {
          storagePath: result.path,
          storageUrl: result.signedUrl,
        });
        // Sync photo metadata with storage path to cloud table
        const updated = await db.journalPhotos.get(photo.id);
        if (updated) syncJournalPhoto(updated).catch(err => logger.warn('[JournalSync]', 'Photo sync failed:', err));
      }
    }).catch(err => logger.error('[Journal]', 'Photo upload failed:', err));

    // Sync photo metadata (without storagePath yet — will be updated after upload)
    syncJournalPhoto(photo).catch(err => logger.warn('[JournalSync]', 'Photo metadata sync failed:', err));

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
    const entry = await db.journalEntries.get(entryId);
    if (entry) {
      await db.journalEntries.update(entryId, {
        photoIds: entry.photoIds.filter(pid => pid !== id),
        updatedAt: Date.now(),
      });
    }
  });
  // Clean up from Supabase Storage + cloud table (fire-and-forget)
  void deletePhotoFromStorage(id);
  deleteJournalPhotoFromCloud(id).catch(err => logger.warn('[JournalSync]', 'Photo delete sync failed:', err));
}

// ============================================
// AUDIO RECORDINGS
// ============================================

export async function storeAudio(
  entryId: string,
  data: string,
  duration: number,
  mimeType: string,
): Promise<JournalAudio> {
  const existing = await db.journalAudio.where('entryId').equals(entryId).count();
  if (existing >= MAX_AUDIO_PER_ENTRY) {
    throw new Error(`Maximum ${MAX_AUDIO_PER_ENTRY} audio recordings per entry`);
  }

  const audio: JournalAudio = {
    id: generateId(),
    entryId,
    data,
    duration,
    mimeType,
    createdAt: Date.now(),
  };

  await db.journalAudio.add(audio);

  // Background upload to Supabase Storage (non-blocking)
  void uploadAudioToStorage(audio.id, data, mimeType).then(async (result) => {
    if (result) {
      await db.journalAudio.update(audio.id, {
        storagePath: result.path,
        storageUrl: result.signedUrl,
      });
      // Sync audio metadata with storage path to cloud table
      const updated = await db.journalAudio.get(audio.id);
      if (updated) syncJournalAudio(updated).catch(err => logger.warn('[JournalSync]', 'Audio sync failed:', err));
    }
  }).catch(err => logger.error('[Journal]', 'Audio upload failed:', err));

  // Sync audio metadata (without storagePath yet — will be updated after upload)
  syncJournalAudio(audio).catch(err => logger.warn('[JournalSync]', 'Audio metadata sync failed:', err));

  return audio;
}

export async function getAudioForEntry(entryId: string): Promise<JournalAudio[]> {
  return db.journalAudio.where('entryId').equals(entryId).toArray();
}

export async function getAudioById(id: string): Promise<JournalAudio | undefined> {
  return db.journalAudio.get(id);
}

export async function deleteAudio(id: string, entryId: string): Promise<void> {
  await db.transaction('rw', [db.journalEntries, db.journalAudio], async () => {
    await db.journalAudio.delete(id);
    const entry = await db.journalEntries.get(entryId);
    if (entry && entry.audioIds) {
      await db.journalEntries.update(entryId, {
        audioIds: entry.audioIds.filter(aid => aid !== id),
        updatedAt: Date.now(),
      });
    }
  });
  // Clean up from Supabase Storage + cloud table (fire-and-forget)
  void deleteAudioFromStorage(id);
  deleteJournalAudioFromCloud(id).catch(err => logger.warn('[JournalSync]', 'Audio delete sync failed:', err));
}
