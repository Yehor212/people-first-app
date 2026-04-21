/**
 * useEntryTransition tests.
 *
 * Covers both code paths:
 *   - Legacy FSM (startTransition) — 100ms debounce + state machine
 *   - VT API path (startTransitionVT) — delegates to morph() with same FSM
 *
 * Also verifies supportsVT detection and rapid-tap reconciliation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const morphSpy = vi.fn();
vi.mock('@/lib/motion/morph', () => ({
  morph: (name: string, fn: () => void | Promise<void>) => {
    void morphSpy(name, fn);
    // Execute mutation synchronously so test observes state change.
    void fn();
    return Promise.resolve();
  },
  withTransitionName: (name: string) => ({ viewTransitionName: name }),
}));

import { useEntryTransition } from './useEntryTransition';

describe('useEntryTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    morphSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('FSM path (startTransition)', () => {
    it('starts in idle state', () => {
      const { result } = renderHook(() => useEntryTransition());
      expect(result.current.transitionState).toBe('idle');
      expect(result.current.transitionEntryId).toBeNull();
      expect(result.current.isMorphing).toBe(false);
    });

    it('advances to morphing-forward after 100ms debounce', () => {
      const { result } = renderHook(() => useEntryTransition());
      act(() => {
        result.current.startTransition('entry-1');
      });
      expect(result.current.transitionState).toBe('idle');
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current.transitionState).toBe('morphing-forward');
      expect(result.current.transitionEntryId).toBe('entry-1');
      expect(result.current.isMorphing).toBe(true);
    });

    it('rapid taps debounce to final id only', () => {
      const { result } = renderHook(() => useEntryTransition());
      act(() => {
        result.current.startTransition('entry-1');
        result.current.startTransition('entry-2');
        result.current.startTransition('entry-3');
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current.transitionEntryId).toBe('entry-3');
    });

    it('full lifecycle idle→forward→settled→reverse→idle', () => {
      const { result } = renderHook(() => useEntryTransition());
      act(() => {
        result.current.startTransition('e');
        vi.advanceTimersByTime(100);
      });
      expect(result.current.transitionState).toBe('morphing-forward');
      act(() => result.current.completeTransition());
      expect(result.current.transitionState).toBe('settled');
      act(() => result.current.reverseTransition());
      expect(result.current.transitionState).toBe('morphing-reverse');
      act(() => result.current.finishReverse());
      expect(result.current.transitionState).toBe('idle');
      expect(result.current.transitionEntryId).toBeNull();
    });

    it('cancelTransition clears pending debounce', () => {
      const { result } = renderHook(() => useEntryTransition());
      act(() => {
        result.current.startTransition('e');
        result.current.cancelTransition();
        vi.advanceTimersByTime(100);
      });
      expect(result.current.transitionState).toBe('idle');
      expect(result.current.transitionEntryId).toBeNull();
    });
  });

  describe('VT API path (startTransitionVT)', () => {
    it('delegates mutation through morph() with entry name', () => {
      const { result } = renderHook(() => useEntryTransition());
      const mutate = vi.fn();
      act(() => {
        result.current.startTransitionVT('entry-42', mutate);
        vi.advanceTimersByTime(100);
      });
      expect(morphSpy).toHaveBeenCalledTimes(1);
      expect(morphSpy.mock.calls[0][0]).toBe('entry-entry-42');
      expect(mutate).toHaveBeenCalledTimes(1);
    });

    it('advances FSM alongside morph invocation', () => {
      const { result } = renderHook(() => useEntryTransition());
      act(() => {
        result.current.startTransitionVT('x', () => undefined);
        vi.advanceTimersByTime(100);
      });
      expect(result.current.transitionState).toBe('morphing-forward');
      expect(result.current.transitionEntryId).toBe('x');
    });

    it('rapid VT taps coalesce to last id', () => {
      const { result } = renderHook(() => useEntryTransition());
      const m1 = vi.fn();
      const m2 = vi.fn();
      act(() => {
        result.current.startTransitionVT('a', m1);
        result.current.startTransitionVT('b', m2);
        vi.advanceTimersByTime(100);
      });
      expect(m1).not.toHaveBeenCalled();
      expect(m2).toHaveBeenCalledTimes(1);
      expect(result.current.transitionEntryId).toBe('b');
    });
  });

  describe('capability detection', () => {
    it('exposes supportsVT as a stable boolean', () => {
      const { result } = renderHook(() => useEntryTransition());
      expect(typeof result.current.supportsVT).toBe('boolean');
    });

    it('exposes withTransitionName helper returning viewTransitionName style', () => {
      const { result } = renderHook(() => useEntryTransition());
      const style = result.current.withTransitionName('foo');
      expect(style).toMatchObject({ viewTransitionName: 'foo' });
    });
  });
});
