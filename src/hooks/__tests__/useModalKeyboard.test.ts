/**
 * useModalKeyboard Hook Tests
 * Tests keyboard navigation, focus trapping, and accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalKeyboard } from '../useModalKeyboard';

describe('useModalKeyboard', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.removeChild(container);
  });

  describe('escape key handling', () => {
    it('calls onClose when Escape is pressed', () => {
      const onClose = vi.fn();

      renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          closeOnEscape: true,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when closeOnEscape is false', () => {
      const onClose = vi.fn();

      renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          closeOnEscape: false,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not call onClose when modal is closed', () => {
      const onClose = vi.fn();

      renderHook(() =>
        useModalKeyboard({
          isOpen: false,
          onClose,
          closeOnEscape: true,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('ignores other keys', () => {
      const onClose = vi.fn();

      renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          closeOnEscape: true,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      document.dispatchEvent(event);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('removes event listener on unmount', () => {
      const onClose = vi.fn();
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          closeOnEscape: true,
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });
  });

  describe('focus trap', () => {
    it('cycles Tab from last to first element', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          trapFocus: true,
        })
      );

      // Create modal with focusable elements
      const modal = document.createElement('div');
      const button1 = document.createElement('button');
      button1.textContent = 'First';
      const button2 = document.createElement('button');
      button2.textContent = 'Last';
      modal.appendChild(button1);
      modal.appendChild(button2);
      container.appendChild(modal);

      // Assign ref
      (result.current.modalRef as any).current = modal;

      // Focus last element
      button2.focus();
      expect(document.activeElement).toBe(button2);

      // Simulate Tab key
      const event = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(document.activeElement).toBe(button1);
    });

    it('cycles Shift+Tab from first to last element', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          trapFocus: true,
        })
      );

      // Create modal with focusable elements
      const modal = document.createElement('div');
      const button1 = document.createElement('button');
      button1.textContent = 'First';
      const button2 = document.createElement('button');
      button2.textContent = 'Last';
      modal.appendChild(button1);
      modal.appendChild(button2);
      container.appendChild(modal);

      // Assign ref
      (result.current.modalRef as any).current = modal;

      // Focus first element
      button1.focus();
      expect(document.activeElement).toBe(button1);

      // Simulate Shift+Tab key
      const event = {
        key: 'Tab',
        shiftKey: true,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(document.activeElement).toBe(button2);
    });

    it('does not trap focus when trapFocus is false', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          trapFocus: false,
        })
      );

      const modal = document.createElement('div');
      const button = document.createElement('button');
      modal.appendChild(button);
      container.appendChild(modal);

      (result.current.modalRef as any).current = modal;

      const event = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('ignores non-Tab keys', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          trapFocus: true,
        })
      );

      const event = {
        key: 'Enter',
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('focus restoration', () => {
    it('restores focus to previous element on close', async () => {
      const onClose = vi.fn();
      const originalButton = document.createElement('button');
      originalButton.textContent = 'Original';
      container.appendChild(originalButton);
      originalButton.focus();

      const { rerender } = renderHook(
        ({ isOpen }) =>
          useModalKeyboard({
            isOpen,
            onClose,
            restoreFocus: true,
          }),
        { initialProps: { isOpen: true } }
      );

      // Modal opens, should store previous element
      expect(document.activeElement).toBe(originalButton);

      // Close modal
      rerender({ isOpen: false });

      // Advance timers to allow focus restoration
      act(() => {
        vi.advanceTimersByTime(20);
      });

      expect(document.activeElement).toBe(originalButton);
    });

    it('does not restore focus when restoreFocus is false', () => {
      const onClose = vi.fn();
      const originalButton = document.createElement('button');
      originalButton.textContent = 'Original';
      container.appendChild(originalButton);
      originalButton.focus();

      // Create another element to move focus to
      const otherElement = document.createElement('button');
      container.appendChild(otherElement);

      const { rerender } = renderHook(
        ({ isOpen }) =>
          useModalKeyboard({
            isOpen,
            onClose,
            restoreFocus: false,
          }),
        { initialProps: { isOpen: true } }
      );

      // Move focus away
      otherElement.focus();

      // Close modal
      rerender({ isOpen: false });

      act(() => {
        vi.advanceTimersByTime(20);
      });

      // Focus should NOT be restored to originalButton
      expect(document.activeElement).toBe(otherElement);
    });
  });

  describe('auto-focus', () => {
    it('focuses close button when modal opens', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          trapFocus: true,
        })
      );

      const modal = document.createElement('div');
      const closeButton = document.createElement('button');
      closeButton.setAttribute('aria-label', 'Close modal');
      modal.appendChild(closeButton);
      container.appendChild(modal);

      (result.current.modalRef as any).current = modal;

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(document.activeElement).toBe(closeButton);
    });

    it('focuses first focusable element when no close button', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          trapFocus: true,
        })
      );

      const modal = document.createElement('div');
      const firstInput = document.createElement('input');
      const secondInput = document.createElement('input');
      modal.appendChild(firstInput);
      modal.appendChild(secondInput);
      container.appendChild(modal);

      (result.current.modalRef as any).current = modal;

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(document.activeElement).toBe(firstInput);
    });

    it('does not auto-focus when trapFocus is false', () => {
      const onClose = vi.fn();
      const originalFocus = document.createElement('button');
      container.appendChild(originalFocus);
      originalFocus.focus();

      const { result } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          trapFocus: false,
        })
      );

      const modal = document.createElement('div');
      const button = document.createElement('button');
      modal.appendChild(button);
      container.appendChild(modal);

      (result.current.modalRef as any).current = modal;

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Focus should not have moved
      expect(document.activeElement).toBe(originalFocus);
    });
  });

  describe('modalProps', () => {
    it('returns correct accessibility props', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
        })
      );

      expect(result.current.modalProps.role).toBe('dialog');
      expect(result.current.modalProps['aria-modal']).toBe(true);
      expect(result.current.modalProps.ref).toBe(result.current.modalRef);
      expect(result.current.modalProps.onKeyDown).toBe(result.current.handleKeyDown);
    });
  });

  describe('default options', () => {
    it('defaults to closeOnEscape: true', () => {
      const onClose = vi.fn();

      renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          // closeOnEscape not specified, should default to true
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(onClose).toHaveBeenCalled();
    });

    it('defaults to trapFocus: true', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          // trapFocus not specified, should default to true
        })
      );

      const modal = document.createElement('div');
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      modal.appendChild(button1);
      modal.appendChild(button2);
      container.appendChild(modal);

      (result.current.modalRef as any).current = modal;
      button2.focus();

      const event = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  describe('disabled elements', () => {
    it('excludes disabled buttons from focus trap', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          trapFocus: true,
        })
      );

      const modal = document.createElement('div');
      const button1 = document.createElement('button');
      const disabledButton = document.createElement('button');
      disabledButton.disabled = true;
      const button2 = document.createElement('button');
      modal.appendChild(button1);
      modal.appendChild(disabledButton);
      modal.appendChild(button2);
      container.appendChild(modal);

      (result.current.modalRef as any).current = modal;

      // Focus last enabled button
      button2.focus();

      const event = {
        key: 'Tab',
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event);
      });

      // Should cycle back to first button, not disabled one
      expect(document.activeElement).toBe(button1);
    });
  });
});
