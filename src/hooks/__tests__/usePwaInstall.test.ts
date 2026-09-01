/**
 * usePwaInstall Hook Tests
 * Tests PWA installation prompt and state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePwaInstall } from '../usePwaInstall';
import {
  initializePwaInstallPromptCapture,
  resetPwaInstallPromptCaptureForTests,
} from '@/lib/pwaInstallPrompt';

const desktopRuntimeMock = vi.hoisted(() => ({ enabled: false }));

vi.mock('@/lib/env', () => ({
  get IS_DESKTOP_RUNTIME() {
    return desktopRuntimeMock.enabled;
  },
}));

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

function setNavigatorValue(name: string, value: unknown) {
  Object.defineProperty(window.navigator, name, {
    configurable: true,
    value,
  });
}

describe('usePwaInstall', () => {
  beforeEach(() => {
    resetPwaInstallPromptCaptureForTests();
    desktopRuntimeMock.enabled = false;
    vi.clearAllMocks();
    // Default: not in standalone mode
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    setNavigatorValue('standalone', false);
    setNavigatorValue('userAgent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36');
    setNavigatorValue('vendor', 'Google Inc.');
    setNavigatorValue('platform', 'Linux x86_64');
    setNavigatorValue('maxTouchPoints', 0);
  });

  afterEach(() => {
    resetPwaInstallPromptCaptureForTests();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('returns initial state when not installed', () => {
      const { result } = renderHook(() => usePwaInstall());

      expect(result.current.isInstalled).toBe(false);
      expect(result.current.canInstall).toBe(false);
      expect(result.current.installKind).toBe('unavailable');
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
      expect(result.current.installKind).toBe('installed');
    });

    it('detects Safari standalone mode as installed even without display-mode support', () => {
      setNavigatorValue('standalone', true);
      setNavigatorValue('userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 Version/17.6 Safari/605.1.15');
      setNavigatorValue('vendor', 'Apple Computer, Inc.');
      setNavigatorValue('platform', 'MacIntel');

      const { result } = renderHook(() => usePwaInstall());

      expect(result.current.isInstalled).toBe(true);
      expect(result.current.canInstall).toBe(false);
      expect(result.current.installKind).toBe('installed');
    });

    it('offers truthful manual guidance for Safari on macOS outside installed mode', () => {
      setNavigatorValue('userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 Version/17.6 Safari/605.1.15');
      setNavigatorValue('vendor', 'Apple Computer, Inc.');
      setNavigatorValue('platform', 'MacIntel');

      const { result } = renderHook(() => usePwaInstall());

      expect(result.current.canInstall).toBe(false);
      expect(result.current.installKind).toBe('macos-safari-manual');
    });

    it('does not classify an iPad desktop user agent as macOS Safari', () => {
      setNavigatorValue('userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.6 Mobile/15E148 Safari/604.1');
      setNavigatorValue('vendor', 'Apple Computer, Inc.');
      setNavigatorValue('platform', 'MacIntel');
      setNavigatorValue('maxTouchPoints', 5);

      const { result } = renderHook(() => usePwaInstall());

      expect(result.current.installKind).toBe('unavailable');
    });

    it('does not expose browser-PWA installation inside the Tauri desktop runtime', () => {
      desktopRuntimeMock.enabled = true;
      setNavigatorValue('userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 Version/17.6 Safari/605.1.15');
      setNavigatorValue('vendor', 'Apple Computer, Inc.');
      setNavigatorValue('platform', 'MacIntel');

      const { result } = renderHook(() => usePwaInstall());

      expect(result.current.canInstall).toBe(false);
      expect(result.current.isInstalled).toBe(false);
      expect(result.current.installKind).toBe('unavailable');
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
    it('retains a prompt fired before the lazy settings hook mounts', () => {
      initializePwaInstallPromptCapture();
      const event = new Event('beforeinstallprompt') as any;
      event.prompt = vi.fn();
      event.userChoice = Promise.resolve({ outcome: 'accepted' as const });

      act(() => {
        window.dispatchEvent(event);
      });

      const { result } = renderHook(() => usePwaInstall());

      expect(result.current.canInstall).toBe(true);
      expect(result.current.installKind).toBe('prompt');
    });

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
      expect(result.current.installKind).toBe('prompt');
    });

    it('prevents default on beforeinstallprompt event', () => {
      renderHook(() => usePwaInstall());

      const preventDefault = vi.fn();
      const event = new Event('beforeinstallprompt') as any;
      event.preventDefault = preventDefault;
      event.prompt = vi.fn();
      event.userChoice = Promise.resolve({ outcome: 'accepted' as const });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefault).toHaveBeenCalled();
    });

    it('ignores malformed install events instead of exposing a broken action', () => {
      const { result } = renderHook(() => usePwaInstall());
      const preventDefault = vi.fn();
      const event = new Event('beforeinstallprompt');
      event.preventDefault = preventDefault;

      act(() => {
        window.dispatchEvent(event);
      });

      expect(preventDefault).not.toHaveBeenCalled();
      expect(result.current.canInstall).toBe(false);
      expect(result.current.installKind).toBe('unavailable');
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

    it('keeps installed terminal when a late install prompt arrives', () => {
      const { result } = renderHook(() => usePwaInstall());

      act(() => {
        window.dispatchEvent(new Event('appinstalled'));
      });

      const preventDefault = vi.fn();
      const event = new Event('beforeinstallprompt') as any;
      event.preventDefault = preventDefault;
      event.prompt = vi.fn();
      event.userChoice = Promise.resolve({ outcome: 'accepted' as const });

      act(() => {
        window.dispatchEvent(event);
      });

      expect(result.current.isInstalled).toBe(true);
      expect(result.current.canInstall).toBe(false);
      expect(result.current.installKind).toBe('installed');
      expect(preventDefault).not.toHaveBeenCalled();
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

    it('returns true on acceptance but waits for appinstalled before showing success', async () => {
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
      expect(result.current.isInstalled).toBe(false);
      expect(result.current.canInstall).toBe(false);
      expect(result.current.installKind).toBe('unavailable');

      act(() => {
        window.dispatchEvent(new Event('appinstalled'));
      });

      expect(result.current.isInstalled).toBe(true);
      expect(result.current.installKind).toBe('installed');
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
      expect(result.current.canInstall).toBe(false);
      expect(result.current.installKind).toBe('unavailable');
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
        '[PWA] Install prompt failed:',
        expect.any(Error)
      );
      expect(result.current.canInstall).toBe(false);
      expect(result.current.installKind).toBe('unavailable');
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
    it('keeps page-lifetime capture active when a lazy consumer unmounts', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => usePwaInstall());

      unmount();

      expect(removeEventListenerSpy).not.toHaveBeenCalledWith(
        'beforeinstallprompt',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).not.toHaveBeenCalledWith(
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
