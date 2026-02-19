import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock registerModalCloseCallback
const mockUnregister = vi.fn();
const mockRegister = vi.fn().mockReturnValue(mockUnregister);

vi.mock('@/lib/androidBackHandler', () => ({
  registerModalCloseCallback: (...args: unknown[]) => mockRegister(...args),
}));

import { useBackHandler } from '../useBackHandler';

describe('useBackHandler', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers a callback when isOpen is true', () => {
    const onClose = vi.fn();
    renderHook(() => useBackHandler(true, onClose));

    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledWith(expect.any(Function));
  });

  it('does not register a callback when isOpen is false', () => {
    const onClose = vi.fn();
    renderHook(() => useBackHandler(false, onClose));

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('calls onClose when the registered callback is invoked', () => {
    const onClose = vi.fn();
    renderHook(() => useBackHandler(true, onClose));

    // Get the callback that was passed to registerModalCloseCallback
    const registeredCallback = mockRegister.mock.calls[0][0];
    const result = registeredCallback();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('calls unregister on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useBackHandler(true, onClose));

    unmount();

    expect(mockUnregister).toHaveBeenCalled();
  });

  it('re-registers when isOpen changes from false to true', () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ isOpen }) => useBackHandler(isOpen, onClose),
      { initialProps: { isOpen: false } }
    );

    expect(mockRegister).not.toHaveBeenCalled();

    rerender({ isOpen: true });

    expect(mockRegister).toHaveBeenCalledTimes(1);
  });
});
