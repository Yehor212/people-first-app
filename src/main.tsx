import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Unregister any existing service workers and clear caches (fixes white screen on Capacitor after PWA was disabled)
try {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    }).catch(() => {});
  }
} catch (e) {
  // Ignore errors in environments where serviceWorker is not available
}

// Clear workbox/PWA caches
try {
  if (typeof window !== 'undefined' && 'caches' in window && window.caches) {
    window.caches.keys().then((names) => {
      names.forEach((name) => {
        if (name.includes('workbox') || name.includes('precache') || name.includes('runtime')) {
          window.caches.delete(name);
        }
      });
    }).catch(() => {});
  }
} catch (e) {
  // Ignore errors in environments where caches is not available
}

createRoot(document.getElementById("root")!).render(<App />);
