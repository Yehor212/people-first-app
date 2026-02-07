import { useEffect, useCallback } from 'react';
import { registerModalCloseCallback } from '@/lib/androidBackHandler';

/**
 * Hook to register a modal/dialog/drawer with the Android back button handler.
 * When the modal is open and the user presses the hardware back button,
 * the onClose callback is called instead of navigating away.
 *
 * @param isOpen - Whether the modal is currently open
 * @param onClose - Callback to close the modal
 */
export function useBackHandler(isOpen: boolean, onClose: () => void) {
  const stableOnClose = useCallback(() => {
    onClose();
    return true;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    return registerModalCloseCallback(stableOnClose);
  }, [isOpen, stableOnClose]);
}
