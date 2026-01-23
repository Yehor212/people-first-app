/**
 * Android Back Button Handler
 * Implements double-tap-to-exit functionality and proper navigation handling
 */

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Track last back button press timestamp
let lastBackPress = 0;
const DOUBLE_TAP_DELAY = 2000; // 2 seconds

// Track if we're showing exit toast
let isShowingExitToast = false;

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

  // Add animation keyframes
  const style = document.createElement('style');
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

  document.body.appendChild(toast);

  // Remove toast after delay
  setTimeout(() => {
    toast.style.animation = 'toast-fade-out 0.2s ease-out';
    setTimeout(() => {
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
 * Check if any modal/dialog is open
 */
function isModalOpen(): boolean {
  // Check for common modal/dialog selectors
  const modalSelectors = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '.modal',
    '.dialog',
    '[data-state="open"]',
    '.drawer',
  ];

  for (const selector of modalSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of Array.from(elements)) {
      // Check if element is visible
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
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
  // Try to find and click close buttons
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
    const button = document.querySelector(selector) as HTMLButtonElement;
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
      ru: 'Нажмите ещё раз для выхода',
      uk: 'Натисніть ще раз для виходу',
      es: 'Presiona de nuevo para salir',
      de: 'Erneut drücken zum Beenden',
      fr: 'Appuyez à nouveau pour quitter',
    };
    return messages[lang] || messages.en;
  } catch {
    return 'Press again to exit';
  }
}

/**
 * Initialize Android back button handler
 */
export function initAndroidBackHandler() {
  // Only run on Android
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }

  console.log('[AndroidBackHandler] Initializing...');

  App.addListener('backButton', ({ canGoBack }) => {
    console.log('[AndroidBackHandler] Back button pressed, canGoBack:', canGoBack);

    // Priority 1: Close modal if open
    if (isModalOpen()) {
      console.log('[AndroidBackHandler] Modal detected, attempting to close');
      closeTopModal();
      return;
    }

    // Priority 2: Navigate back if not on root route
    if (!isOnRootRoute()) {
      console.log('[AndroidBackHandler] Not on root route, navigating back');
      window.history.back();
      return;
    }

    // Priority 3: Double-tap to exit on root route
    const now = Date.now();
    const timeSinceLastPress = now - lastBackPress;

    if (timeSinceLastPress < DOUBLE_TAP_DELAY) {
      // Second tap within delay - exit app
      console.log('[AndroidBackHandler] Double tap detected, exiting app');
      App.exitApp();
    } else {
      // First tap - show toast and update timestamp
      console.log('[AndroidBackHandler] First tap, showing exit toast');
      lastBackPress = now;
      showExitToast(getExitMessage());
    }
  });

  console.log('[AndroidBackHandler] Back button handler registered');
}

/**
 * Remove back button listener (cleanup)
 */
export async function removeAndroidBackHandler() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }

  await App.removeAllListeners();
  console.log('[AndroidBackHandler] Back button handler removed');
}
