/**
 * use-toast Hook Tests
 * Tests toast notification state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, toast, reducer } from '../use-toast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('returns initial state with empty toasts', () => {
      const { result } = renderHook(() => useToast());

      expect(result.current.toasts).toEqual([]);
      expect(typeof result.current.toast).toBe('function');
      expect(typeof result.current.dismiss).toBe('function');
    });
  });

  describe('toast function', () => {
    it('adds a toast to state', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Test Toast' });
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Test Toast');
      expect(result.current.toasts[0].open).toBe(true);
    });

    it('returns toast id, dismiss, and update functions', () => {
      const { result } = renderHook(() => useToast());

      let toastResult: ReturnType<typeof result.current.toast>;
      act(() => {
        toastResult = result.current.toast({ title: 'Test' });
      });

      expect(toastResult.id).toBeDefined();
      expect(typeof toastResult.dismiss).toBe('function');
      expect(typeof toastResult.update).toBe('function');
    });

    it('generates unique IDs', () => {
      const { result } = renderHook(() => useToast());

      let toast1: ReturnType<typeof result.current.toast>;
      let toast2: ReturnType<typeof result.current.toast>;

      act(() => {
        toast1 = result.current.toast({ title: 'Toast 1' });
        toast2 = result.current.toast({ title: 'Toast 2' });
      });

      expect(toast1.id).not.toBe(toast2.id);
    });

    it('limits toasts to TOAST_LIMIT', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Toast 1' });
        result.current.toast({ title: 'Toast 2' });
        result.current.toast({ title: 'Toast 3' });
      });

      // TOAST_LIMIT is 1
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Toast 3');
    });
  });

  describe('dismiss', () => {
    it('dismisses a specific toast by id', () => {
      const { result } = renderHook(() => useToast());

      let toastResult: ReturnType<typeof result.current.toast>;
      act(() => {
        toastResult = result.current.toast({ title: 'Test' });
      });

      expect(result.current.toasts[0].open).toBe(true);

      act(() => {
        result.current.dismiss(toastResult.id);
      });

      expect(result.current.toasts[0].open).toBe(false);
    });

    it('dismisses all toasts when no id provided', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Test' });
      });

      expect(result.current.toasts[0].open).toBe(true);

      act(() => {
        result.current.dismiss();
      });

      expect(result.current.toasts[0].open).toBe(false);
    });
  });

  describe('update', () => {
    it('updates a toast by id', () => {
      const { result } = renderHook(() => useToast());

      let toastResult: ReturnType<typeof result.current.toast>;
      act(() => {
        toastResult = result.current.toast({ title: 'Original' });
      });

      expect(result.current.toasts[0].title).toBe('Original');

      act(() => {
        toastResult.update({ title: 'Updated', id: toastResult.id });
      });

      expect(result.current.toasts[0].title).toBe('Updated');
    });
  });

  describe('onOpenChange', () => {
    it('dismisses toast when open changes to false', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Test' });
      });

      const toastItem = result.current.toasts[0];
      expect(toastItem.open).toBe(true);

      act(() => {
        toastItem.onOpenChange?.(false);
      });

      expect(result.current.toasts[0].open).toBe(false);
    });
  });

  describe('multiple listeners', () => {
    it('updates all hook instances', () => {
      const { result: result1 } = renderHook(() => useToast());
      const { result: result2 } = renderHook(() => useToast());

      act(() => {
        result1.current.toast({ title: 'Shared Toast' });
      });

      expect(result1.current.toasts).toHaveLength(1);
      expect(result2.current.toasts).toHaveLength(1);
    });
  });

  describe('cleanup', () => {
    it('removes listener on unmount', () => {
      const { result, unmount } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Test' });
      });

      unmount();

      // This shouldn't throw even after unmount
      act(() => {
        toast({ title: 'Another' });
      });
    });
  });
});

describe('reducer', () => {
  const initialState = { toasts: [] };

  describe('ADD_TOAST', () => {
    it('adds toast to beginning of array', () => {
      const newToast = { id: '1', title: 'Test', open: true };
      const result = reducer(initialState, {
        type: 'ADD_TOAST',
        toast: newToast,
      });

      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0]).toEqual(newToast);
    });

    it('prepends new toast', () => {
      const existingToast = { id: '1', title: 'First', open: true };
      const newToast = { id: '2', title: 'Second', open: true };
      const state = { toasts: [existingToast] };

      const result = reducer(state, {
        type: 'ADD_TOAST',
        toast: newToast,
      });

      expect(result.toasts[0]).toEqual(newToast);
    });
  });

  describe('UPDATE_TOAST', () => {
    it('updates existing toast', () => {
      const existingToast = { id: '1', title: 'Original', open: true };
      const state = { toasts: [existingToast] };

      const result = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'Updated' },
      });

      expect(result.toasts[0].title).toBe('Updated');
      expect(result.toasts[0].open).toBe(true);
    });

    it('does not update non-matching toast', () => {
      const existingToast = { id: '1', title: 'Original', open: true };
      const state = { toasts: [existingToast] };

      const result = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: '2', title: 'Updated' },
      });

      expect(result.toasts[0].title).toBe('Original');
    });
  });

  describe('DISMISS_TOAST', () => {
    it('sets open to false for specific toast', () => {
      const existingToast = { id: '1', title: 'Test', open: true };
      const state = { toasts: [existingToast] };

      const result = reducer(state, {
        type: 'DISMISS_TOAST',
        toastId: '1',
      });

      expect(result.toasts[0].open).toBe(false);
    });

    it('sets open to false for all toasts when no id', () => {
      const toast1 = { id: '1', title: 'Test 1', open: true };
      const toast2 = { id: '2', title: 'Test 2', open: true };
      const state = { toasts: [toast1, toast2] };

      const result = reducer(state, {
        type: 'DISMISS_TOAST',
      });

      expect(result.toasts[0].open).toBe(false);
      expect(result.toasts[1].open).toBe(false);
    });
  });

  describe('REMOVE_TOAST', () => {
    it('removes specific toast', () => {
      const toast1 = { id: '1', title: 'Test 1', open: true };
      const toast2 = { id: '2', title: 'Test 2', open: true };
      const state = { toasts: [toast1, toast2] };

      const result = reducer(state, {
        type: 'REMOVE_TOAST',
        toastId: '1',
      });

      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe('2');
    });

    it('removes all toasts when no id', () => {
      const toast1 = { id: '1', title: 'Test 1', open: true };
      const toast2 = { id: '2', title: 'Test 2', open: true };
      const state = { toasts: [toast1, toast2] };

      const result = reducer(state, {
        type: 'REMOVE_TOAST',
      });

      expect(result.toasts).toHaveLength(0);
    });
  });
});

describe('toast standalone function', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('can be called without hook', () => {
    let toastResult: ReturnType<typeof toast>;

    act(() => {
      toastResult = toast({ title: 'Standalone Toast' });
    });

    expect(toastResult.id).toBeDefined();
    expect(typeof toastResult.dismiss).toBe('function');
  });

  it('accepts description', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({
        title: 'Title',
        description: 'Description text',
      });
    });

    expect(result.current.toasts[0].description).toBe('Description text');
  });

  it('accepts variant', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({
        title: 'Error',
        variant: 'destructive',
      });
    });

    expect(result.current.toasts[0].variant).toBe('destructive');
  });
});
