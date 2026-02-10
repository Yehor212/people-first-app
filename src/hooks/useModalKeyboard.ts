/**
 * useModalKeyboard
 *
 * Hook to handle keyboard navigation for custom modals:
 * - Escape key to close
 * - Focus trapping
 * - Focus restoration on close
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseModalKeyboardOptions {
  isOpen: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  trapFocus?: boolean;
  restoreFocus?: boolean;
}

const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useModalKeyboard({
  isOpen,
  onClose,
  closeOnEscape = true,
  trapFocus = true,
  restoreFocus = true,
}: UseModalKeyboardOptions) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store the previously focused element when modal opens
  useEffect(() => {
    if (isOpen && restoreFocus) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    }
  }, [isOpen, restoreFocus]);

  // Restore focus when modal closes
  useEffect(() => {
    if (!isOpen && restoreFocus && previousActiveElement.current) {
      // Small delay to ensure modal is fully closed
      const timer = setTimeout(() => {
        previousActiveElement.current?.focus();
        previousActiveElement.current = null;
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen, restoreFocus]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // Focus trap handler
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!trapFocus || event.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusableElements = modal.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
      if (focusableElements.length === 0) return;

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

      const focusableElements = modal.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
      const closeButton = modal.querySelector<HTMLElement>('[aria-label*="Close"], [aria-label*="close"]');

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
