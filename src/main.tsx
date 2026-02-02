import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupAudioUnlock } from "./lib/ambientSounds";
import { initAudioManager } from "./lib/audioManager";
import { initAndroidBackHandler } from "./lib/androidBackHandler";
import { logger } from "./lib/logger";
import { setupDeepLinks } from "./lib/deepLinks";

// Global error handlers for unhandled exceptions and promise rejections
// These catch errors that escape React's error boundary
window.addEventListener('unhandledrejection', (event) => {
  logger.error('[Global] Unhandled promise rejection:', event.reason);
  // Prevent the default browser behavior (console error)
  // but still log it for debugging
});

window.addEventListener('error', (event) => {
  logger.error('[Global] Uncaught error:', event.error || event.message);
});

// Setup audio unlock for iOS - attaches to first user interaction
setupAudioUnlock();

// Initialize audio manager - loads mute/volume settings from localStorage
initAudioManager();

// Initialize Android back button handler (double-tap to exit + modal handling)
initAndroidBackHandler();

// Initialize deep link handler for challenge invites and other app URLs
setupDeepLinks();

// Only unregister service workers on Capacitor (native apps don't need PWA)
// Web PWA keeps SW for offline support
const isCapacitor = typeof window !== 'undefined' &&
  (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

if (isCapacitor) {
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      }).catch(() => {});
    }
    // Clear workbox/PWA caches on Capacitor only
    if ('caches' in window && window.caches) {
      window.caches.keys().then((names) => {
        names.forEach((name) => {
          if (name.includes('workbox') || name.includes('precache') || name.includes('runtime')) {
            window.caches.delete(name);
          }
        });
      }).catch(() => {});
    }
  } catch (e) {
    // Ignore errors
  }
}

createRoot(document.getElementById("root")!).render(<App />);
