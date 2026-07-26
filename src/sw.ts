/// <reference lib="webworker" />

// Background Sync API types (not yet in standard lib.webworker.d.ts)
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
}

/**
 * Custom Service Worker with Background Sync support
 *
 * Enables sync even after browser is closed
 * Uses Workbox BackgroundSyncQueue for reliable offline sync
 */

import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { RangeRequestsPlugin } from "workbox-range-requests";
import { setCacheNameDetails } from "workbox-core";
import { logger } from "@/lib/logger";

declare const self: ServiceWorkerGlobalScope;

const CLIENT_MESSAGE_TYPES = ["SKIP_WAITING", "CLEAR_CACHES", "REGISTER_SYNC", "WARM_RUNTIME_AUDIO_CACHE"] as const;
type ClientMessageType = (typeof CLIENT_MESSAGE_TYPES)[number];
const APP_SHELL_URL = "index.html";
const RUNTIME_AUDIO_CACHE_NAME = "zenflow-runtime-audio";
const APP_AUDIO_SW_CACHE_PATHS = [
  "sounds/feedback/feedback-complete.mp3",
  "sounds/feedback/feedback-milestone.mp3",
  "sounds/feedback/feedback-notification.mp3",
  "sounds/feedback/feedback-streak.mp3",
  "sounds/feedback/feedback-success.mp3",
  "sounds/gentle-water-bed.mp3",
  "sounds/hyperfocus/hyperfocus-fireplace-deep.mp3",
  "sounds/hyperfocus/hyperfocus-fireplace-intense.mp3",
  "sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
  "sounds/hyperfocus/hyperfocus-forest-deep.mp3",
  "sounds/hyperfocus/hyperfocus-forest-intense.mp3",
  "sounds/hyperfocus/hyperfocus-forest-soft.mp3",
  "sounds/hyperfocus/hyperfocus-ocean-deep.mp3",
  "sounds/hyperfocus/hyperfocus-ocean-intense.mp3",
  "sounds/hyperfocus/hyperfocus-ocean-soft.mp3",
  "sounds/hyperfocus/hyperfocus-rain-deep.mp3",
  "sounds/hyperfocus/hyperfocus-rain-intense.mp3",
  "sounds/hyperfocus/hyperfocus-rain-soft.mp3",
  "sounds/hyperfocus/hyperfocus-river-deep.mp3",
  "sounds/hyperfocus/hyperfocus-river-intense.mp3",
  "sounds/hyperfocus/hyperfocus-river-soft.mp3",
  "sounds/hyperfocus/hyperfocus-wind-deep.mp3",
  "sounds/hyperfocus/hyperfocus-wind-intense.mp3",
  "sounds/hyperfocus/hyperfocus-wind-soft.mp3",
  "sounds/soft-air-veil.mp3",
  "sounds/soft-rain-veil.mp3",
] as const;
const SAME_ORIGIN_RUNTIME_ASSET_DESTINATIONS = new Set<RequestDestination>([
  "font",
  "image",
  "script",
  "style",
]);
const AUDIO_CACHE_WARM_CONCURRENCY = 3;
const AUDIO_CACHE_WARM_FETCH_TIMEOUT_MS = 8000;
const NAVIGATION_NETWORK_TIMEOUT_MS = 4000;
let runtimeAudioCacheWarmPromise: Promise<void> | null = null;

interface ClientMessage {
  type: ClientMessageType;
}

function isClientMessageData(data: unknown): data is ClientMessage {
  if (!data || typeof data !== "object") return false;
  const type = (data as { type?: unknown }).type;
  return typeof type === "string" && CLIENT_MESSAGE_TYPES.includes(type as ClientMessageType);
}

function isWindowClient(source: ExtendableMessageEvent["source"]): source is WindowClient {
  return Boolean(
    source &&
      typeof source === "object" &&
      "url" in source &&
      typeof (source as { url?: unknown }).url === "string"
  );
}

function isTrustedClientMessage(event: ExtendableMessageEvent): event is ExtendableMessageEvent & {
  data: ClientMessage;
  source: WindowClient;
} {
  if (event.origin !== self.location.origin) return false;
  if (!isWindowClient(event.source)) return false;
  try {
    if (new URL(event.source.url).origin !== self.location.origin) return false;
  } catch {
    return false;
  }
  return isClientMessageData(event.data);
}

function makeScopedAudioRequest(publicPath: string): Request {
  return new Request(new URL(publicPath, self.registration.scope).toString(), {
    cache: "reload",
    credentials: "same-origin",
    mode: "same-origin",
  });
}

async function fetchAudioForWarmCache(request: Request): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = self.setTimeout(() => controller.abort(), AUDIO_CACHE_WARM_FETCH_TIMEOUT_MS);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    self.clearTimeout(timeoutId);
  }
}

async function warmRuntimeAudioCache(): Promise<void> {
  const cache = await caches.open(RUNTIME_AUDIO_CACHE_NAME);
  const outcomes: PromiseSettledResult<void>[] = [];

  for (let index = 0; index < APP_AUDIO_SW_CACHE_PATHS.length; index += AUDIO_CACHE_WARM_CONCURRENCY) {
    const batch = APP_AUDIO_SW_CACHE_PATHS.slice(index, index + AUDIO_CACHE_WARM_CONCURRENCY);
    const batchOutcomes = await Promise.allSettled(
      batch.map(async (publicPath) => {
        const request = makeScopedAudioRequest(publicPath);
        if (await cache.match(request, { ignoreVary: true })) return;

        const response = await fetchAudioForWarmCache(request);
        if (response.status !== 200) {
          throw new Error(publicPath + " returned HTTP " + response.status + " while warming audio cache");
        }

        await cache.put(request, response);
      })
    );
    outcomes.push(...batchOutcomes);
  }

  const failedCount = outcomes.filter((outcome) => outcome.status === "rejected").length;
  if (failedCount > 0) {
    logger.warn("[SW] Runtime audio cache warm completed with failures:", failedCount);
  }
}

function warmRuntimeAudioCacheOnce(): Promise<void> {
  runtimeAudioCacheWarmPromise ??= warmRuntimeAudioCache().finally(() => {
    runtimeAudioCacheWarmPromise = null;
  });
  return runtimeAudioCacheWarmPromise;
}

async function fetchNavigationWithTimeout(request: Request): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = self.setTimeout(() => controller.abort(), NAVIGATION_NETWORK_TIMEOUT_MS);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    self.clearTimeout(timeoutId);
  }
}
// Set cache name prefix
setCacheNameDetails({
  prefix: "zenflow",
  suffix: "v1",
});

// Precache all assets generated by Vite
precacheAndRoute(self.__WB_MANIFEST);

// Clean up old caches
cleanupOutdatedCaches();

// Cache language chunks on first use (excluded from precache to save install size).
// CacheFirst: serve from cache instantly after first network load.
// This ensures non-English users keep their language available offline.
registerRoute(
  ({ url, request }) =>
    request.destination === "script" &&
    url.pathname.includes("/assets/") &&
    /\/(uk|es|de|fr|ja|ar|he)-[A-Za-z0-9_-]+\.js$/.test(url.pathname),
  new CacheFirst({
    cacheName: "zenflow-lang-chunks",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 7,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Cache same-origin lazy chunks/assets on demand instead of during SW install.
// This keeps the install precache small enough for constrained browser quotas
// while retaining offline reuse after the asset was actually needed.
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    url.pathname.includes("/assets/") &&
    SAME_ORIGIN_RUNTIME_ASSET_DESTINATIONS.has(request.destination),
  new CacheFirst({
    cacheName: "zenflow-runtime-assets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 14 * 24 * 60 * 60, // 14 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);


// Cache shipped app audio with full 200 responses, then serve browser media
// Range requests from that complete cached body for installed/offline PWA use.
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    url.pathname.includes("/sounds/") &&
    (request.destination === "audio" || /\.mp3$/i.test(url.pathname)),
  new CacheFirst({
    cacheName: RUNTIME_AUDIO_CACHE_NAME,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [200],
      }),
      new RangeRequestsPlugin(),
      new ExpirationPlugin({
        maxEntries: 32,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Cache Supabase Storage (public assets only)
registerRoute(
  ({ url }) =>
    (url.hostname === "supabase.co" || url.hostname.endsWith(".supabase.co") || url.hostname === "api.zenflowapp.online") &&
    url.pathname.includes("/storage/v1/object/public/"),
  new CacheFirst({
    cacheName: "supabase-storage",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Cache Fluent Emoji 3D sticker images (immutable CDN assets)
registerRoute(
  ({ url }) => url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("fluent-emoji"),
  new CacheFirst({
    cacheName: "fluent-emoji-stickers",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Cache Google Fonts stylesheets
registerRoute(
  ({ url }) => url.hostname === "fonts.googleapis.com",
  new CacheFirst({
    cacheName: "google-fonts-stylesheets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Cache Google Fonts webfonts
registerRoute(
  ({ url }) => url.hostname === "fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// REMOVED: Supabase POST caching
// POST requests should NOT be cached/synced at Service Worker level because:
// 1. POST request bodies can only be read once - clone() fails after consumption
// 2. POST requests have side effects and shouldn't be replayed automatically
// 3. The app has its own offline queue system (src/lib/offlineQueue.ts)
// Error was: "Failed to execute 'clone' on 'Request': Request body is already used"

// Handle navigation requests — fetch fresh HTML while online, but keep installed
// PWA routes bootable offline by falling back to the versioned precached shell.
// The network response is not stored here, so online navigations still avoid
// stale-cache deadlocks with old version-check scripts.
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    (request.mode === "navigate" || request.destination === "document"),
  async ({ request }) => {
    try {
      return await fetchNavigationWithTimeout(request);
    } catch (error) {
      const appShell = await matchPrecache(APP_SHELL_URL);
      if (appShell) return appShell;

      logger.warn("[SW] Navigation fallback missing app shell", error);
      return Response.error();
    }
  }
);

// Listen for sync events (triggered when coming back online)
self.addEventListener("sync", (evt) => {
  const event = evt as SyncEvent;
  logger.log("[SW] Sync event received:", event.tag);

  if (event.tag === "zenflow-sync") {
    // Notify clients to process their offline queue
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "SYNC_REQUESTED" });
        });
      })
    );
  }
});

// Listen for messages from the main app (origin/source/type validated).
self.onmessage = (event) => {
  if (!isTrustedClientMessage(event)) return;

  if (event.data.type === "SKIP_WAITING") {
    logger.log("[SW] Skip waiting requested");
    void self.skipWaiting();
  }

  if (event.data.type === "CLEAR_CACHES") {
    // Clear all caches when app detects version mismatch
    logger.log("[SW] Clear caches requested");
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            logger.log("[SW] Deleting cache:", cacheName);
            return caches.delete(cacheName);
          })
        );
      })
    );
  }

  if (event.data.type === "REGISTER_SYNC") {
    // Register a sync event (will fire when online)
    self.registration.sync?.register("zenflow-sync").catch((err) => {
      logger.warn("[SW] Background sync registration failed:", err);
    });
  }

  if (event.data.type === "WARM_RUNTIME_AUDIO_CACHE") {
    logger.log("[SW] Runtime audio cache warm requested after app startup");
    event.waitUntil(warmRuntimeAudioCacheOnce());
  }
};

// Log service worker lifecycle
self.addEventListener("install", (event) => {
  logger.log("[SW] Installing — skip waiting for immediate activation");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  logger.log("[SW] Activating...");
  event.waitUntil(
    self.clients.claim().then(() => {
      // Notify all tabs that a new SW has activated — they should version-check
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "SW_UPDATED" });
        });
      });
    })
  );
});

logger.log("[SW] Service Worker loaded");
