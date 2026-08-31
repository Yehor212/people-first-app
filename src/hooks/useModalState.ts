import { useState, useCallback } from "react";
import { useModalA11y } from "@/hooks/useModalA11y";

interface UseModalStateOptions {
  /** Optional callback invoked after the modal closes */
  onClose?: () => void;
}

/**
 * Shared hook that replaces the repeated modal boilerplate:
 *   const [isOpen, setIsOpen] = useState(false);
 *   useModalA11y(isOpen, close);
 *
 * Returns isOpen state + open/close/toggle helpers + a11yProps from useModalA11y.
 */
export function useModalState(options: UseModalStateOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const { onClose } = options;

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const a11yProps = useModalA11y(isOpen, close);

  return { isOpen, open, close, toggle, setIsOpen, a11yProps };
}

/**
 * Lightweight variant for components that already have their own open/close state
 * (e.g. always-open modals receiving onClose as prop, or prop-controlled modals).
 *
 * Replaces the repeated pair:
 *   useModalA11y(isOpen, onClose);
 *
 * Returns a11yProps from useModalA11y (modalRef, handleKeyDown, modalProps).
 */
export function useModalClose(isOpen: boolean, onClose: () => void) {
  return useModalA11y(isOpen, onClose);
}
