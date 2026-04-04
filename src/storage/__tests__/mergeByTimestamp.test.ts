import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/storage/db';
import { mergeByTimestamp } from '@/storage/backup';


describe('mergeByTimestamp', () => {
  beforeEach(async () => {
    await db.open();
    await db.moods.clear();
  });

  it('adds new remote items when no local exists', async () => {
    const incoming = [
      { id: 'mood-1', mood: 'good', date: '2026-04-04', timestamp: 1000, updatedAt: 2000 },
    ];

    await mergeByTimestamp(
      db.moods,
      incoming as any,
      (m: any) => m.updatedAt || m.timestamp || 0,
    );

    const stored = await db.moods.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('mood-1');
  });

  it('keeps local when local is newer', async () => {
    // Pre-populate local with newer timestamp
    await db.moods.put({
      id: 'mood-1', mood: 'great', date: '2026-04-04', timestamp: 3000, updatedAt: 5000,
    } as any);

    const incoming = [
      { id: 'mood-1', mood: 'bad', date: '2026-04-04', timestamp: 1000, updatedAt: 2000 },
    ];

    await mergeByTimestamp(
      db.moods,
      incoming as any,
      (m: any) => m.updatedAt || m.timestamp || 0,
    );

    const stored = await db.moods.toArray();
    expect(stored).toHaveLength(1);
    expect((stored[0] as any).mood).toBe('great'); // Local kept
  });

  it('uses remote when remote is newer', async () => {
    await db.moods.put({
      id: 'mood-1', mood: 'okay', date: '2026-04-04', timestamp: 1000, updatedAt: 1000,
    } as any);

    const incoming = [
      { id: 'mood-1', mood: 'good', date: '2026-04-04', timestamp: 3000, updatedAt: 5000 },
    ];

    await mergeByTimestamp(
      db.moods,
      incoming as any,
      (m: any) => m.updatedAt || m.timestamp || 0,
    );

    const stored = await db.moods.toArray();
    expect(stored).toHaveLength(1);
    expect((stored[0] as any).mood).toBe('good'); // Remote wins
  });

  it('remote wins on ties (cloud authority)', async () => {
    await db.moods.put({
      id: 'mood-1', mood: 'okay', date: '2026-04-04', timestamp: 2000, updatedAt: 2000,
    } as any);

    const incoming = [
      { id: 'mood-1', mood: 'good', date: '2026-04-04', timestamp: 2000, updatedAt: 2000 },
    ];

    await mergeByTimestamp(
      db.moods,
      incoming as any,
      (m: any) => m.updatedAt || m.timestamp || 0,
    );

    const stored = await db.moods.toArray();
    expect((stored[0] as any).mood).toBe('good'); // Remote wins on tie
  });

  it('filters out deleted IDs', async () => {
    const incoming = [
      { id: 'mood-del', mood: 'bad', date: '2026-04-04', timestamp: 1000, updatedAt: 5000 },
      { id: 'mood-keep', mood: 'good', date: '2026-04-04', timestamp: 1000, updatedAt: 5000 },
    ];
    const deletedIds = new Set(['mood-del']);

    await mergeByTimestamp(
      db.moods,
      incoming as any,
      (m: any) => m.updatedAt || m.timestamp || 0,
      deletedIds,
    );

    const stored = await db.moods.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('mood-keep');
  });

  it('handles empty incoming array', async () => {
    await db.moods.put({ id: 'existing', mood: 'good', date: '2026-04-04', timestamp: 1000 } as any);

    await mergeByTimestamp(db.moods, [], (m: any) => m.updatedAt || 0);

    const stored = await db.moods.toArray();
    expect(stored).toHaveLength(1); // Unchanged
  });

  it('falls back to timestamp when updatedAt is missing', async () => {
    await db.moods.put({
      id: 'mood-1', mood: 'okay', date: '2026-04-04', timestamp: 5000,
      // No updatedAt
    } as any);

    const incoming = [
      { id: 'mood-1', mood: 'good', date: '2026-04-04', timestamp: 2000 },
    ];

    await mergeByTimestamp(
      db.moods,
      incoming as any,
      (m: any) => m.updatedAt || m.timestamp || 0,
    );

    const stored = await db.moods.toArray();
    expect((stored[0] as any).mood).toBe('okay'); // Local timestamp 5000 > remote 2000
  });
});
