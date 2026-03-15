/**
 * Unit tests for canvasPause — module-level pause flag for Canvas rAF
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setCanvasPaused, isCanvasPaused } from '../canvasPause';

describe('canvasPause', () => {
  beforeEach(() => {
    // Reset to default unpaused state before each test
    setCanvasPaused(false);
  });

  it('defaults to not paused', () => {
    expect(isCanvasPaused()).toBe(false);
  });

  it('can be set to paused', () => {
    setCanvasPaused(true);
    expect(isCanvasPaused()).toBe(true);
  });

  it('can be unpaused after being paused', () => {
    setCanvasPaused(true);
    expect(isCanvasPaused()).toBe(true);
    setCanvasPaused(false);
    expect(isCanvasPaused()).toBe(false);
  });

  it('handles multiple pause calls idempotently', () => {
    setCanvasPaused(true);
    setCanvasPaused(true);
    expect(isCanvasPaused()).toBe(true);
  });

  it('handles multiple unpause calls idempotently', () => {
    setCanvasPaused(false);
    setCanvasPaused(false);
    expect(isCanvasPaused()).toBe(false);
  });

  it('toggles back and forth correctly', () => {
    setCanvasPaused(true);
    setCanvasPaused(false);
    setCanvasPaused(true);
    expect(isCanvasPaused()).toBe(true);
    setCanvasPaused(false);
    expect(isCanvasPaused()).toBe(false);
  });

  it('returns a boolean from isCanvasPaused', () => {
    expect(typeof isCanvasPaused()).toBe('boolean');
  });

  it('returns boolean true, not truthy', () => {
    setCanvasPaused(true);
    expect(isCanvasPaused()).toStrictEqual(true);
  });
});
