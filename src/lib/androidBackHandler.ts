/**
 * Android Back Button Handler
 * Implements double-tap-to-exit functionality and proper navigation handling
 */

import { App, type PluginListenerHandle } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { logger } from './logger';

// Track last back button press timestamp
let lastBackPress = 0;
const DOUBLE_TAP_DELAY = 2000; // 2 seconds

// Store listener handle for targeted removal (instead of removeAllListeners)
let backButtonListenerHandle: PluginListenerHandle | null = null;

// Track if we're showing exit toast
let isShowingExitToast = false;
let toastTimeoutId: ReturnType<typeof setTimeout> | null = null;
let toastFadeTimeoutId: ReturnType<typeof setTimeout> | null = null;
let toastStyleAdded = false;

// Modal close callback registry for React state-based modals
type ModalCloseCallback = () => boolean; // returns true if modal was closed
const modalCloseCallbacks: ModalCloseCallback[] = [];

/**
 * Register a callback to be called when back button is pressed.
 * Callbacks are called in reverse order (LIFO - last registered first).
 * Return true from callback if you handled the back press.
 * Returns an unregister function.
 */
export function registerModalCloseCallback(callback: ModalCloseCallback): () => void {
  modalCloseCallbacks.push(callback);
  return () => {
    const index = modalCloseCallbacks.indexOf(callback);
    if (index > -1) modalCloseCallbacks.splice(index, 1);
  };
}

/**
 * Show toast notification (simple implementation without dependencies)
 */
function showExitToast(message: string) {
  if (isShowingExitToast) return;

  isShowingExitToast = true;

  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'android-exit-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: calc(80px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 12px 24px;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    animation: toast-slide-up 0.3s ease-out;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  // Add animation keyframes only once
  if (!toastStyleAdded) {
    const style = document.createElement('style');
    style.id = 'android-toast-styles';
    style.textContent = `
      @keyframes toast-slide-up {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      @keyframes toast-fade-out {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    toastStyleAdded = true;
  }

  document.body.appendChild(toast);

  // Clear any existing timeouts
  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  if (toastFadeTimeoutId) clearTimeout(toastFadeTimeoutId);

  // Remove toast after delay
  toastTimeoutId = setTimeout(() => {
    // Check if toast still exists in DOM before animating
    if (!toast.parentNode) {
      isShowingExitToast = false;
      return;
    }
    toast.style.animation = 'toast-fade-out 0.2s ease-out';
    toastFadeTimeoutId = setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      isShowingExitToast = false;
    }, 200);
  }, DOUBLE_TAP_DELAY);
}

/**
 * Check if user is on root route (main app screen)
 */
function isOnRootRoute(): boolean {
  const path = window.location.pathname;
  return path === '/' || path === '/index.html';
}

/**
 * Check if an element is truly visible (not just has dimensions)
 * Checks computed styles for opacity, display, visibility
 */
function isElementVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();

  // Must have dimensions
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  // Check computed styles
  const styles = window.getComputedStyle(element);

  // Must not be hidden
  if (styles.display === 'none') return false;
  if (styles.visibility === 'hidden') return false;
  if (styles.opacity === '0') return false;

  // Check if element is within viewport (not scrolled away)
  const inViewport = (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );

  return inViewport;
}

/**
 * Check if any modal/dialog is open
 * Improved selectors and visibility checks
 */
function isModalOpen(): boolean {
  // More specific modal selectors
  // - [data-state="open"] is now scoped to specific Radix components
  // - Added specific Radix dialog/sheet selectors
  const modalSelectors = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '.modal',
    '.dialog',
    '.drawer',
    // Radix UI specific - more targeted than generic [data-state="open"]
    '[data-radix-dialog-content]',
    '[data-radix-alert-dialog-content]',
    '[data-radix-sheet-content]',
    '[data-radix-drawer-content]',
    // Radix popover/dropdown only if they have overlay (true modals)
    '[data-radix-popper-content-wrapper][data-side]',
  ];

  for (const selector of modalSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of Array.from(elements)) {
      // Use comprehensive visibility check
      if (isElementVisible(element)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Try to close the topmost modal
 */
function closeTopModal(): boolean {
  // First, try registered callbacks (for React state-based modals)
  // Iterate in reverse order (LIFO) so the most recently opened modal closes first
  for (let i = modalCloseCallbacks.length - 1; i >= 0; i--) {
    if (modalCloseCallbacks[i]()) {
      logger.log('[AndroidBackHandler] Modal closed via registered callback');
      return true;
    }
  }

  // Fallback: Try to find and click close buttons in DOM
  const closeButtonSelectors = [
    '[data-radix-dismissable-layer] button[aria-label*="close" i]',
    '[role="dialog"] button[aria-label*="close" i]',
    '[role="dialog"] button[aria-label*="закрыть" i]',
    '[role="dialog"] button:first-child', // Usually close button
    '.dialog-close',
    '.modal-close',
    '[data-close-button]',
  ];

  for (const selector of closeButtonSelectors) {
    const button = document.querySelector(selector);
    if (button && button.offsetParent !== null) {
      button.click();
      return true;
    }
  }

  // Try ESC key as fallback
  const escEvent = new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(escEvent);

  return false;
}

/**
 * Get translation for "Press again to exit" message
 */
function getExitMessage(): string {
  try {
    const lang = localStorage.getItem('zenflow-language') || 'en';
    const messages: Record<string, string> = {
      en: 'Press again to exit',
      uk: 'Натисніть ще раз для виходу',
      es: 'Presiona de nuevo para salir',
      de: 'Erneut drücken zum Beenden',
      fr: 'Appuyez à nouveau pour quitter',
      ja: 'もう一度押すと終了します',
      ar: 'اضغط مرة أخرى للخروج',
      he: 'לחץ שוב כדי לצאת',
    };
    return messages[lang] || messages.en;
  } catch {
    return 'Press again to exit';
  }
}

/**
 * Initialize Android back button handler
 */
export async function initAndroidBackHandler(): Promise<void> {
  // Only run on Android
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }

  // Prevent double registration
  if (backButtonListenerHandle) {
    logger.log('[AndroidBackHandler] Already initialized, skipping');
    return;
  }

  logger.log('[AndroidBackHandler] Initializing...');

  // Store handle for targeted removal later
  backButtonListenerHandle = await App.addListener('backButton', ({ canGoBack }) => {
    logger.log('[AndroidBackHandler] Back button pressed, canGoBack:', canGoBack);

    // Priority 1: Try to close modal via callbacks or DOM detection
    // closeTopModal() first tries registered callbacks, then DOM-based closing
    if (modalCloseCallbacks.length > 0 || isModalOpen()) {
      logger.log('[AndroidBackHandler] Modal/panel may be open, attempting to close');
      if (closeTopModal()) {
        return;
      }
    }

    // Priority 2: Navigate back if not on root route
    if (!isOnRootRoute()) {
      logger.log('[AndroidBackHandler] Not on root route, navigating back');
      window.history.back();
      return;
    }

    // Priority 3: Double-tap to exit on root route
    const now = Date.now();
    const timeSinceLastPress = now - lastBackPress;

    if (timeSinceLastPress < DOUBLE_TAP_DELAY) {
      // Second tap within delay - exit app
      logger.log('[AndroidBackHandler] Double tap detected, exiting app');
      void App.exitApp();
    } else {
      // First tap - show toast and update timestamp
      logger.log('[AndroidBackHandler] First tap, showing exit toast');
      lastBackPress = now;
      showExitToast(getExitMessage());
    }
  });

  logger.log('[AndroidBackHandler] Back button handler registered');
}

/**
 * Remove back button listener (cleanup)
 * Only removes backButton listener, not ALL Capacitor App listeners
 * This preserves pause/resume listeners registered in main.tsx
 */
export async function removeAndroidBackHandler(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }

  if (backButtonListenerHandle) {
    await backButtonListenerHandle.remove();
    backButtonListenerHandle = null;
    logger.log('[AndroidBackHandler] Back button handler removed');
  }
}
