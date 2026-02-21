/**
 * useModalA11y
 *
 * Composite hook that wires both keyboard accessibility (Escape key,
 * focus trapping) and Android hardware back button for modals/overlays.
 *
 * Use this for new modals instead of calling useModalKeyboard + useBackHandler separately.
 */

import { useModalKeyboard } from './useModalKeyboard';
import { useBackHandler } from './useBackHandler';

export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const keyboard = useModalKeyboard({ isOpen, onClose });
  useBackHandler(isOpen, onClose);
  return keyboard;
}
