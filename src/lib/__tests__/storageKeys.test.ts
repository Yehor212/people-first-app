import { describe, it, expect } from 'vitest';
import { SK, SSK } from '@/lib/storageKeys';

// ─── Helpers ─────────────────────────────────────────────────

function getStaticEntries(obj: Record<string, unknown>): [string, string][] {
  return Object.entries(obj).filter(
    ([, value]) => typeof value === 'string'
  ) as [string, string][];
}

function getDynamicBuilders(obj: Record<string, unknown>): [string, (...args: string[]) => string][] {
  return Object.entries(obj).filter(
    ([, value]) => typeof value === 'function'
  ) as [string, (...args: string[]) => string][];
}

// ─── SK (localStorage keys) ─────────────────────────────────

describe('SK — localStorage keys', () => {
  const staticEntries = getStaticEntries(SK);
  const dynamicBuilders = getDynamicBuilders(SK);

  it('has at least 60 static string properties', () => {
    expect(staticEntries.length).toBeGreaterThanOrEqual(60);
  });

  it('has exactly 2 dynamic builders (journalDraft, whatsNewDismissed)', () => {
    const builderNames = dynamicBuilders.map(([key]) => key).sort();
    expect(builderNames).toEqual(['journalDraft', 'whatsNewDismissed']);
  });

  it('all static values are non-empty strings', () => {
    for (const [key, value] of staticEntries) {
      expect(value, `SK.${key} should be a non-empty string`).toBeTruthy();
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('no duplicate values among static keys', () => {
    const values = staticEntries.map(([, v]) => v);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('journalDraft returns a string containing the provided id', () => {
    const result = SK.journalDraft('id1');
    expect(typeof result).toBe('string');
    expect(result).toContain('id1');
  });

  it('journalDraft returns unique keys for different inputs', () => {
    const a = SK.journalDraft('abc');
    const b = SK.journalDraft('xyz');
    expect(a).not.toBe(b);
  });

  it('whatsNewDismissed returns a string containing the version', () => {
    const result = SK.whatsNewDismissed('1.0');
    expect(typeof result).toBe('string');
    expect(result).toContain('1.0');
  });

  it('whatsNewDismissed returns unique keys for different versions', () => {
    const a = SK.whatsNewDismissed('1.0');
    const b = SK.whatsNewDismissed('2.0');
    expect(a).not.toBe(b);
  });

  it('dynamic builders return values different from any static key', () => {
    const staticValues = new Set(staticEntries.map(([, v]) => v));
    expect(staticValues.has(SK.journalDraft('test'))).toBe(false);
    expect(staticValues.has(SK.whatsNewDismissed('1.0'))).toBe(false);
  });
});

// ─── SSK (sessionStorage keys) ───────────────────────────────

describe('SSK — sessionStorage keys', () => {
  const staticEntries = getStaticEntries(SSK);
  const dynamicBuilders = getDynamicBuilders(SSK);

  it('has at least 6 static string properties', () => {
    expect(staticEntries.length).toBeGreaterThanOrEqual(6);
  });

  it('has exactly 1 dynamic builder (chunkReload)', () => {
    const builderNames = dynamicBuilders.map(([key]) => key);
    expect(builderNames).toEqual(['chunkReload']);
  });

  it('all static values are non-empty strings', () => {
    for (const [key, value] of staticEntries) {
      expect(value, `SSK.${key} should be a non-empty string`).toBeTruthy();
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('no duplicate values among static keys', () => {
    const values = staticEntries.map(([, v]) => v);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('chunkReload returns a string containing the module name', () => {
    const result = SSK.chunkReload('module');
    expect(typeof result).toBe('string');
    expect(result).toContain('module');
  });

  it('chunkReload returns unique keys for different inputs', () => {
    const a = SSK.chunkReload('moduleA');
    const b = SSK.chunkReload('moduleB');
    expect(a).not.toBe(b);
  });
});
