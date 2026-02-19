import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScrollLock } from '../useScrollLock';

describe('useScrollLock', () => {
  let originalOverflow: string;
  let originalPosition: string;
  let originalWidth: string;
  let originalTop: string;

  beforeEach(() => {
    // Save and reset body styles
    originalOverflow = document.body.style.overflow;
    originalPosition = document.body.style.position;
    originalWidth = document.body.style.width;
    originalTop = document.body.style.top;

    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';

    // Mock scrollY and scrollTo
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    document.body.style.overflow = originalOverflow;
    document.body.style.position = originalPosition;
    document.body.style.width = originalWidth;
    document.body.style.top = originalTop;
  });

  it('sets body overflow to hidden when locked', () => {
    renderHook(() => useScrollLock(true));

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.width).toBe('100%');
  });

  it('does not modify body styles when not locked', () => {
    renderHook(() => useScrollLock(false));

    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.position).toBe('');
  });

  it('restores original styles on unmount', () => {
    document.body.style.overflow = 'auto';
    document.body.style.position = 'relative';
    document.body.style.width = '50%';
    document.body.style.top = '10px';

    const { unmount } = renderHook(() => useScrollLock(true));

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.position).toBe('relative');
    expect(document.body.style.width).toBe('50%');
    expect(document.body.style.top).toBe('10px');
  });

  it('preserves scroll position via top offset', () => {
    Object.defineProperty(window, 'scrollY', { value: 200, writable: true, configurable: true });

    renderHook(() => useScrollLock(true));

    expect(document.body.style.top).toBe('-200px');
  });

  it('restores scroll position on unmount', () => {
    Object.defineProperty(window, 'scrollY', { value: 150, writable: true, configurable: true });

    const { unmount } = renderHook(() => useScrollLock(true));
    unmount();

    expect(window.scrollTo).toHaveBeenCalledWith(0, 150);
  });

  it('restores styles when isLocked changes from true to false', () => {
    document.body.style.overflow = 'scroll';

    const { rerender } = renderHook(
      ({ locked }) => useScrollLock(locked),
      { initialProps: { locked: true } }
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender({ locked: false });

    expect(document.body.style.overflow).toBe('scroll');
  });
});
