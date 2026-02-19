import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThrottledCallback } from '../useThrottledCallback';

describe('useThrottledCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes the first call immediately', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 1000));

    act(() => {
      result.current();
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('blocks subsequent calls within the delay period', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 1000));

    act(() => {
      result.current();
    });
    act(() => {
      result.current();
    });
    act(() => {
      result.current();
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('allows a new call after the delay has elapsed', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 1000));

    act(() => {
      result.current();
    });
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    act(() => {
      result.current();
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('passes arguments through to the original callback', () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useThrottledCallback(callback, 1000)
    );

    act(() => {
      result.current('arg1', 'arg2');
    });

    expect(callback).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('picks up the latest callback reference', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { result, rerender } = renderHook(
      ({ cb }) => useThrottledCallback(cb, 1000),
      { initialProps: { cb: callback1 } }
    );

    // First call uses callback1
    act(() => {
      result.current();
    });
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).not.toHaveBeenCalled();

    // Rerender with callback2
    rerender({ cb: callback2 });

    // Advance past delay
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Second call should use callback2 (ref updated)
    act(() => {
      result.current();
    });
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('uses default delay of 1000ms when not specified', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback));

    act(() => {
      result.current();
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // Still blocked at 999ms
    act(() => {
      vi.advanceTimersByTime(999);
    });
    act(() => {
      result.current();
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // Allowed at 1000ms
    act(() => {
      vi.advanceTimersByTime(1);
    });
    act(() => {
      result.current();
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
