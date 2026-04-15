import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startViewTransition } from '../viewTransitions';

describe('startViewTransition', () => {
  beforeEach(() => {
    // Clean up any mock on document
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (document as any).startViewTransition;
  });

  it('calls document.startViewTransition when API is available', () => {
    const mockTransition = vi.fn((cb: () => void) => cb());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).startViewTransition = mockTransition;

    const callback = vi.fn();
    startViewTransition(callback);

    expect(mockTransition).toHaveBeenCalledOnce();
    expect(mockTransition).toHaveBeenCalledWith(callback);
  });

  it('calls callback directly when API is not available', () => {
    // Ensure startViewTransition is absent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((document as any).startViewTransition).toBeUndefined();

    const callback = vi.fn();
    startViewTransition(callback);

    expect(callback).toHaveBeenCalledOnce();
  });
});
