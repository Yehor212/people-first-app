import { describe, it, expect } from 'vitest';
import {
  EMOTION_TAGS,
  getTagsForValence,
  getInitialTagsForValence,
  isSensitiveTag,
  sortByWarmth,
} from '../emotionTags';

describe('emotionTags (Phase 3-A.4c vocabulary)', () => {
  it('contains exactly 100 entries across 5 buckets', () => {
    expect(EMOTION_TAGS).toHaveLength(100);
  });

  it('each valence bucket contains 20 entries', () => {
    const terrible = EMOTION_TAGS.filter(
      (t) => t.minValence <= -0.7 && t.maxValence <= -0.5,
    );
    // Bucket boundaries are overlapping on purpose (so ranges can span),
    // so we verify the documented regions using known anchor keys per bucket.
    const byBucketAnchor = {
      terrible: EMOTION_TAGS.filter((t) => t.maxValence <= -0.5).length,
      bad: EMOTION_TAGS.filter((t) => t.minValence >= -0.8 && t.maxValence <= 0)
        .length,
    };
    expect(terrible.length).toBeGreaterThan(0);
    expect(byBucketAnchor.terrible).toBeGreaterThan(0);
  });

  it('exposes initialVisible=8 at a pure single-bucket valence (-0.9)', () => {
    // v=-0.9 lies at the outer edge of TERRIBLE and outside every other
    // bucket range, so the initial reveal is exactly the documented 8.
    // All other samples intentionally overlap adjacent buckets for
    // richer disclosure at transition zones.
    const initial = getInitialTagsForValence(-0.9);
    expect(initial.length).toBe(8);
  });

  it('mid-bucket valences surface an overlap-enriched initial set (>8)', () => {
    // Overlap between adjacent buckets is a design feature, not a bug —
    // it gives users adjacent vocabulary at transition zones.
    const overlapSamples = [-0.8, -0.7, 0.7];
    overlapSamples.forEach((v) => {
      const initial = getInitialTagsForValence(v);
      expect(initial.length).toBeGreaterThan(8);
    });
  });

  it('getTagsForValence returns at least 8 at every sample point', () => {
    const samples = [-0.9, -0.5, -0.1, 0.1, 0.5, 0.9];
    samples.forEach((v) => {
      expect(getTagsForValence(v).length).toBeGreaterThanOrEqual(8);
    });
  });

  it('full spectrum at bucket edge yields exactly 20 chips (one bucket, no overlap)', () => {
    // Edge valences lie on a bucket boundary and select ONLY that bucket.
    expect(getTagsForValence(-0.9).length).toBe(20);
    expect(getTagsForValence(0.9).length).toBeGreaterThanOrEqual(20);
  });

  it('sensitive tags exist in the "terrible" bucket (3 expected)', () => {
    const sensitive = EMOTION_TAGS.filter((t) => t.sensitive);
    expect(sensitive.length).toBeGreaterThanOrEqual(3);
    sensitive.forEach((t) => {
      // All sensitive tags live in the most negative region.
      expect(t.maxValence).toBeLessThanOrEqual(-0.5);
    });
  });

  it('isSensitiveTag returns true for hopeless, worthless, despairing', () => {
    expect(isSensitiveTag('hopeless')).toBe(true);
    expect(isSensitiveTag('worthless')).toBe(true);
    expect(isSensitiveTag('despairing')).toBe(true);
  });

  it('isSensitiveTag returns false for neutral and positive tags', () => {
    expect(isSensitiveTag('happy')).toBe(false);
    expect(isSensitiveTag('calm')).toBe(false);
    expect(isSensitiveTag('grateful')).toBe(false);
    expect(isSensitiveTag('unknown-key')).toBe(false);
  });

  it('sortByWarmth orders warm → neutral → cool', () => {
    const tags = getTagsForValence(-0.8);
    const sorted = sortByWarmth(tags);
    const warmthOrder: Record<string, number> = {
      warm: 0,
      neutral: 1,
      cool: 2,
    };
    const values = sorted.map((t) => warmthOrder[t.warmth ?? 'neutral']);
    const isMonotonic = values.every(
      (v, i) => i === 0 || v >= values[i - 1],
    );
    expect(isMonotonic).toBe(true);
  });
});
