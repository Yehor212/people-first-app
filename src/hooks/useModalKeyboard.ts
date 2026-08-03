/**
 * useModalKeyboard
 *
 * Hook to handle keyboard navigation for custom modals:
 * - Escape key to close
 * - Focus trapping
 * - Focus restoration on close
 */

import { useEffect, useRef, useCallback, type RefObject } from 'react';

interface UseModalKeyboardOptions {
  isOpen: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  trapFocus?: boolean;
  restoreFocus?: boolean;
  restoreFocusTo?: RefObject<HTMLElement | null>;
}

const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const activeModalKeyboardStack: symbol[] = [];

function getVisibleFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS)).filter(
    (element) => {
      if (element.closest('[hidden], [aria-hidden="true"], [inert], .hidden')) return false;
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }
  );
}

function getConnectedFocusTarget(ref?: RefObject<HTMLElement | null>): HTMLElement | null {
  const target = ref?.current;
  return target?.isConnected ? target : null;
}

export function focusModalRecoveryAction(
  modal: HTMLElement | null,
  recoveryAction: HTMLElement | null,
): void {
  if (!modal || !recoveryAction || !modal.isConnected || !recoveryAction.isConnected) return;
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && modal.contains(activeElement)) return;
  recoveryAction.focus({ preventScroll: true });
}

export function useModalKeyboard({
  isOpen,
  onClose,
  closeOnEscape = true,
  trapFocus = true,
  restoreFocus = true,
  restoreFocusTo,
}: UseModalKeyboardOptions) {
  const modalRef = useRef<HTMLDivElement>(null);
  const modalKeyboardId = useRef(Symbol('modal-keyboard-layer'));
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Capture the opener and restore it both on close and conditional unmount.
  useEffect(() => {
    if (!isOpen || !restoreFocus) return;

    const target = restoreFocusTo?.current ?? (document.activeElement as HTMLElement);

    return () => {
      setTimeout(() => {
        const currentTarget = getConnectedFocusTarget(restoreFocusTo);
        const focusTarget = target?.isConnected
          ? target
          : currentTarget
            ? currentTarget
            : null;
        focusTarget?.focus();
      }, 10);
    };
  }, [isOpen, restoreFocus, restoreFocusTo]);

  // Keep nested dialogs ordered so Escape never closes a layer underneath the
  // active one. All open layers participate, including non-dismissible ones.
  useEffect(() => {
    if (!isOpen) return;

    const id = modalKeyboardId.current;
    activeModalKeyboardStack.push(id);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (activeModalKeyboardStack.at(-1) !== id || !closeOnEscape) return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const index = activeModalKeyboardStack.lastIndexOf(id);
      if (index >= 0) activeModalKeyboardStack.splice(index, 1);
    };
  }, [isOpen, closeOnEscape]);

  // Focus trap handler
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!trapFocus || event.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusableElements = getVisibleFocusableElements(modal);
      if (focusableElements.length === 0) {
        // Busy states can temporarily disable every interactive control while
        // keeping a programmatically focused status inside the dialog.
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift + Tab
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      }
      // Tab
      else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [trapFocus]
  );

  // Auto-focus first focusable element when modal opens
  useEffect(() => {
    if (!isOpen || !trapFocus) return;

    const timer = setTimeout(() => {
      const modal = modalRef.current;
      if (!modal) return;

      // A pointer, keyboard action, or busy-state transition may have already
      // moved focus to the right control before this deferred opener runs.
      // Preserve that more recent intent instead of stealing focus back to the
      // close button.
      if (document.activeElement instanceof HTMLElement && modal.contains(document.activeElement)) {
        return;
      }

      const focusableElements = getVisibleFocusableElements(modal);
      const closeButton = focusableElements.find((element) =>
        /close/i.test(element.getAttribute('aria-label') || '')
      );

      // Prefer close button, otherwise first focusable element
      if (closeButton) {
        closeButton.focus();
      } else if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, trapFocus]);

  return {
    modalRef,
    handleKeyDown,
    modalProps: {
      ref: modalRef,
      onKeyDown: handleKeyDown,
      role: 'dialog' as const,
      'aria-modal': true,
    },
  };
}

export default useModalKeyboard;
