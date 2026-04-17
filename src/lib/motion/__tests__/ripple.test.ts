/**
 * Ripple verb tests — createRipple spawns, cleans up, handles edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { hapticTapMock } = vi.hoisted(() => ({
  hapticTapMock: vi.fn(async () => undefined),
}));

vi.mock('@/lib/haptics', () => ({
  hapticTap: hapticTapMock,
}));

import { createRipple, RIPPLE_DURATION_MS, RIPPLE_WAVE_CLASS } from '../ripple';

describe('createRipple', () => {
  let target: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    target = document.createElement('button');
    target.style.position = 'relative';
    Object.defineProperty(target, 'getBoundingClientRect', {
      value: () => ({
        width: 48,
        height: 48,
        left: 0,
        top: 0,
        right: 48,
        bottom: 48,
        x: 0,
        y: 0,
        toJSON: () => '',
      }),
    });
    document.body.appendChild(target);
    hapticTapMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    target.remove();
  });

  it('appends a ripple wave span to the target', () => {
    createRipple(target, { x: 24, y: 24 });
    const wave = target.querySelector(`.${RIPPLE_WAVE_CLASS}`);
    expect(wave).not.toBeNull();
    expect(wave!.tagName).toBe('SPAN');
  });

  it('defaults size to 2x max dimension', () => {
    createRipple(target, { x: 24, y: 24 });
    const wave = target.querySelector(`.${RIPPLE_WAVE_CLASS}`) as HTMLElement;
    expect(wave.style.width).toBe('96px');
    expect(wave.style.height).toBe('96px');
  });

  it('honours explicit size override', () => {
    createRipple(target, { x: 24, y: 24, size: 40 });
    const wave = target.querySelector(`.${RIPPLE_WAVE_CLASS}`) as HTMLElement;
    expect(wave.style.width).toBe('40px');
  });

  it('fires hapticTap', () => {
    createRipple(target, { x: 24, y: 24 });
    expect(hapticTapMock).toHaveBeenCalledTimes(1);
  });

  it('removes wave on animationend', () => {
    createRipple(target, { x: 24, y: 24 });
    const wave = target.querySelector(`.${RIPPLE_WAVE_CLASS}`)!;
    wave.dispatchEvent(new Event('animationend'));
    expect(target.querySelector(`.${RIPPLE_WAVE_CLASS}`)).toBeNull();
  });

  it('removes wave via safety timer even if animationend is missed', () => {
    createRipple(target, { x: 24, y: 24 });
    expect(target.querySelector(`.${RIPPLE_WAVE_CLASS}`)).not.toBeNull();
    vi.advanceTimersByTime(400);
    expect(target.querySelector(`.${RIPPLE_WAVE_CLASS}`)).toBeNull();
  });

  it('returns cleanup fn that cancels early', () => {
    const cleanup = createRipple(target, { x: 24, y: 24 });
    cleanup();
    expect(target.querySelector(`.${RIPPLE_WAVE_CLASS}`)).toBeNull();
  });

  it('is idempotent — calling cleanup twice does not throw', () => {
    const cleanup = createRipple(target, { x: 24, y: 24 });
    cleanup();
    expect(() => cleanup()).not.toThrow();
  });

  it('no-ops on disconnected target', () => {
    const orphan = document.createElement('div');
    const cleanup = createRipple(orphan, { x: 10, y: 10 });
    expect(orphan.childElementCount).toBe(0);
    expect(() => cleanup()).not.toThrow();
  });

  it('accepts a custom wave class', () => {
    createRipple(target, { x: 24, y: 24, className: 'custom-wave' });
    expect(target.querySelector('.custom-wave')).not.toBeNull();
  });
});

describe('ripple constants', () => {
  it('exports matching duration', () => {
    expect(RIPPLE_DURATION_MS).toBe(200);
  });

  it('exports stable wave class', () => {
    expect(RIPPLE_WAVE_CLASS).toBe('zen-ripple-wave');
  });
});
