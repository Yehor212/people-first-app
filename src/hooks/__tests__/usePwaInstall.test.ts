/**
 * usePwaInstall Hook Tests
 * Tests PWA installation prompt and state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePwaInstall } from '../usePwaInstall';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock matchMedia
const mockMatchMedia = vi.fn();
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

describe('usePwaInstall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: not in standalone mode
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('returns initial state when not installed', () => {
      const { result } = renderHook(() => usePwaInstall());

      expect(result.current.isInstalled).toBe(false);
      expect(result.current.canInstall).toBe(false);
    });

    it('detects standalone mode as installed', () => {
      mockMatchMedia.mockReturnValue({
        matches: true, // standalone mode
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      const { result } = renderHook(() => usePwaInstall());

      expect(result.current.isInstalled).toBe(true);
      expect(result.current.canInstall).toBe(false);
    });

    it('sets up event listeners', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => usePwaInstall());

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeinstallprompt',
        expect.any(Function)
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'appinstalled',
        expect.any(Function)
      );
    });
  });

  describe('beforeinstallprompt event', () => {
    it('captures deferred prompt from beforeinstallprompt event', () => {
      const { result } = renderHook(() => usePwaInstall());

      const mockPrompt = {
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const }),
        preventDefault: vi.fn(),
      };

      act(() => {
        const event = new Event('beforeinstallprompt') as any;
        Object.assign(event, mockPrompt);
        window.dispatchEvent(event);
      });

      expect(result.current.canInstall).toBe(true);
    });

    it('prevents default on beforeinstallprompt event', () => {
      renderHook(() => usePwaInstall());

      const preventDefault = vi.fn();
      const event = new Event('beforeinstallprompt');
      event.preventDefault = preventDefault;

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefault).toHaveBeenCalled();
    });
  });

  describe('appinstalled event', () => {
    it('marks as installed on appinstalled event', () => {
      const { result } = renderHook(() => usePwaInstall());

      act(() => {
        window.dispatchEvent(new Event('appinstalled'));
      });

      expect(result.current.isInstalled).toBe(true);
      expect(result.current.canInstall).toBe(false);
    });

    it('clears deferred prompt on appinstalled', () => {
      const { result } = renderHook(() => usePwaInstall());

      // First capture the prompt
      act(() => {
        const event = new Event('beforeinstallprompt') as any;
        event.prompt = vi.fn();
        event.userChoice = Promise.resolve({ outcome: 'accepted' as const });
        window.dispatchEvent(event);
      });

      expect(result.current.canInstall).toBe(true);

      // Then app gets installed
      act(() => {
        window.dispatchEvent(new Event('appinstalled'));
      });

      expect(result.current.canInstall).toBe(false);
    });
  });

  describe('promptInstall', () => {
    it('returns false when no deferred prompt', async () => {
      const { result } = renderHook(() => usePwaInstall());

      let installResult: boolean | undefined;
      await act(async () => {
        installResult = await result.current.promptInstall();
      });

      expect(installResult).toBe(false);
    });

    it('calls prompt() on deferred prompt', async () => {
      const mockPrompt = vi.fn();
      const mockUserChoice = Promise.resolve({ outcome: 'accepted' as const });

      const { result } = renderHook(() => usePwaInstall());

      act(() => {
        const event = new Event('beforeinstallprompt') as any;
        event.prompt = mockPrompt;
        event.userChoice = mockUserChoice;
        window.dispatchEvent(event);
      });

      await act(async () => {
        await result.current.promptInstall();
      });

      expect(mockPrompt).toHaveBeenCalled();
    });

    it('returns true and sets installed when user accepts', async () => {
      const mockPrompt = vi.fn();
      const mockUserChoice = Promise.resolve({ outcome: 'accepted' as const });

      const { result } = renderHook(() => usePwaInstall());

      act(() => {
        const event = new Event('beforeinstallprompt') as any;
        event.prompt = mockPrompt;
        event.userChoice = mockUserChoice;
        window.dispatchEvent(event);
      });

      let installResult: boolean | undefined;
      await act(async () => {
        installResult = await result.current.promptInstall();
      });

      expect(installResult).toBe(true);
      expect(result.current.isInstalled).toBe(true);
      expect(result.current.canInstall).toBe(false);
    });

    it('returns false when user dismisses', async () => {
      const mockPrompt = vi.fn();
      const mockUserChoice = Promise.resolve({ outcome: 'dismissed' as const });

      const { result } = renderHook(() => usePwaInstall());

      act(() => {
        const event = new Event('beforeinstallprompt') as any;
        event.prompt = mockPrompt;
        event.userChoice = mockUserChoice;
        window.dispatchEvent(event);
      });

      let installResult: boolean | undefined;
      await act(async () => {
        installResult = await result.current.promptInstall();
      });

      expect(installResult).toBe(false);
      expect(result.current.isInstalled).toBe(false);
    });

    it('handles prompt errors gracefully', async () => {
      const { logger } = await import('@/lib/logger');
      const mockPrompt = vi.fn().mockRejectedValue(new Error('Prompt failed'));

      const { result } = renderHook(() => usePwaInstall());

      act(() => {
        const event = new Event('beforeinstallprompt') as any;
        event.prompt = mockPrompt;
        event.userChoice = Promise.resolve({ outcome: 'accepted' as const });
        window.dispatchEvent(event);
      });

      let installResult: boolean | undefined;
      await act(async () => {
        installResult = await result.current.promptInstall();
      });

      expect(installResult).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        '[PWA] Error prompting install:',
        expect.any(Error)
      );
    });
  });

  describe('canInstall', () => {
    it('is true when prompt is available and not installed', () => {
      const { result } = renderHook(() => usePwaInstall());

      act(() => {
        const event = new Event('beforeinstallprompt') as any;
        event.prompt = vi.fn();
        event.userChoice = Promise.resolve({ outcome: 'accepted' as const });
        window.dispatchEvent(event);
      });

      expect(result.current.canInstall).toBe(true);
    });

    it('is false when prompt is available but already installed', () => {
      const { result } = renderHook(() => usePwaInstall());

      // Capture prompt
      act(() => {
        const event = new Event('beforeinstallprompt') as any;
        event.prompt = vi.fn();
        event.userChoice = Promise.resolve({ outcome: 'accepted' as const });
        window.dispatchEvent(event);
      });

      // Then install
      act(() => {
        window.dispatchEvent(new Event('appinstalled'));
      });

      expect(result.current.canInstall).toBe(false);
    });

    it('is false when no prompt available', () => {
      const { result } = renderHook(() => usePwaInstall());

      expect(result.current.canInstall).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => usePwaInstall());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeinstallprompt',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'appinstalled',
        expect.any(Function)
      );
    });

    it('does not add listeners when in standalone mode', () => {
      mockMatchMedia.mockReturnValue({
        matches: true, // standalone mode
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => usePwaInstall());

      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'beforeinstallprompt',
        expect.any(Function)
      );
    });
  });
});
