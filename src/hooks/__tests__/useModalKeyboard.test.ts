/**
 * useModalKeyboard Hook Tests
 * Tests keyboard navigation, focus trapping, and accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { focusModalRecoveryAction, useModalKeyboard } from '../useModalKeyboard';

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

    it('closes only the topmost modal and restores Escape handling to its parent', () => {
      const closeParent = vi.fn();
      const closeChild = vi.fn();
      const parent = renderHook(() =>
        useModalKeyboard({ isOpen: true, onClose: closeParent })
      );
      const child = renderHook(() =>
        useModalKeyboard({ isOpen: true, onClose: closeChild })
      );

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(closeChild).toHaveBeenCalledTimes(1);
      expect(closeParent).not.toHaveBeenCalled();

      child.unmount();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(closeParent).toHaveBeenCalledTimes(1);
      parent.unmount();
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

  describe('dynamic recovery focus', () => {
    it('focuses a replacement recovery action only after focus leaves the open dialog', () => {
      const modal = document.createElement('div');
      const retry = document.createElement('button');
      const preserved = document.createElement('button');
      const outside = document.createElement('button');
      modal.append(retry, preserved);
      container.append(modal, outside);

      outside.focus();
      focusModalRecoveryAction(modal, retry);
      expect(retry).toHaveFocus();

      preserved.focus();
      focusModalRecoveryAction(modal, retry);
      expect(preserved).toHaveFocus();
    });
  });

  describe('focus restoration target', () => {
    it('restores an explicitly supplied opener even when focus moved before effects ran', () => {
      const opener = document.createElement('button');
      const mountedInput = document.createElement('input');
      container.append(opener, mountedInput);
      opener.focus();
      const restoreFocusTo = { current: opener };
      let open = true;

      const { rerender } = renderHook(() =>
        useModalKeyboard({
          isOpen: open,
          onClose: vi.fn(),
          restoreFocusTo,
        })
      );

      mountedInput.focus();
      open = false;
      rerender();
      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(opener).toHaveFocus();
    });

    it('restores the opener when an open modal unmounts conditionally', () => {
      const opener = document.createElement('button');
      const modalInput = document.createElement('input');
      container.append(opener, modalInput);
      opener.focus();
      const restoreFocusTo = { current: opener };

      const { unmount } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose: vi.fn(),
          restoreFocusTo,
        })
      );

      modalInput.focus();
      unmount();
      act(() => {
        vi.runAllTimers();
      });

      expect(opener).toHaveFocus();
    });

    it('restores focus to a remounted explicit opener when the original node was removed', () => {
      const originalOpener = document.createElement('button');
      const replacementOpener = document.createElement('button');
      const modalInput = document.createElement('input');
      container.append(originalOpener, modalInput);
      originalOpener.focus();
      const restoreFocusTo = { current: originalOpener };

      const { unmount } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose: vi.fn(),
          restoreFocusTo,
        })
      );

      modalInput.focus();
      originalOpener.remove();
      container.appendChild(replacementOpener);
      restoreFocusTo.current = replacementOpener;
      unmount();
      act(() => {
        vi.runAllTimers();
      });

      expect(replacementOpener).toHaveFocus();
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

    it('does not override focus that already moved inside the modal', () => {
      const { result } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose: vi.fn(),
          trapFocus: true,
        })
      );

      const modal = document.createElement('div');
      const closeButton = document.createElement('button');
      closeButton.setAttribute('aria-label', 'Close modal');
      const activeControl = document.createElement('button');
      modal.append(closeButton, activeControl);
      container.appendChild(modal);
      (result.current.modalRef as any).current = modal;

      activeControl.focus();
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(document.activeElement).toBe(activeControl);
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

    it('skips controls hidden by an ancestor for autofocus and focus trapping', () => {
      const onClose = vi.fn();
      const { result } = renderHook(() =>
        useModalKeyboard({
          isOpen: true,
          onClose,
          trapFocus: true,
        })
      );

      const modal = document.createElement('div');
      const hiddenGroup = document.createElement('div');
      hiddenGroup.className = 'hidden';
      hiddenGroup.setAttribute('aria-hidden', 'true');
      const hiddenButton = document.createElement('button');
      const visibleButton = document.createElement('button');
      hiddenGroup.appendChild(hiddenButton);
      modal.appendChild(hiddenGroup);
      modal.appendChild(visibleButton);
      container.appendChild(modal);
      (result.current.modalRef as any).current = modal;

      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(document.activeElement).toBe(visibleButton);
    });
  });
});
