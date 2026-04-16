import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startViewTransition } from '../viewTransitions';

describe('startViewTransition', () => {
  beforeEach(() => {
    // Clean up any mock on document
    delete (document as unknown as Record<string, unknown>).startViewTransition;
  });

  it('calls document.startViewTransition when API is available', () => {
    const mockTransition = vi.fn((cb: () => void) => cb());
    (document as unknown as Record<string, unknown>).startViewTransition = mockTransition;

    const callback = vi.fn();
    startViewTransition(callback);

    expect(mockTransition).toHaveBeenCalledOnce();
    expect(mockTransition).toHaveBeenCalledWith(callback);
  });

  it('calls callback directly when API is not available', () => {
    expect((document as unknown as Record<string, unknown>).startViewTransition).toBeUndefined();

    const callback = vi.fn();
    startViewTransition(callback);

    expect(callback).toHaveBeenCalledOnce();
  });
});
