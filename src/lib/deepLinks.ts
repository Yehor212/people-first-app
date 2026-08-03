/**
 * Deep Linking Handler
 *
 * Handles generic app URLs for:
 * - zenflow://diary/{route} - Open a supported diary destination
 * - com.zenflow.app://login-callback - OAuth callback (handled separately)
 *
 * Challenge invitations use the encoded `?data=` contract in
 * `useDeepLinkHandler`; ZenFlow has no short-ID challenge lookup contract.
 *
 * Usage: Call setupDeepLinks() once at app startup.
 */

import { App, URLOpenListenerEvent } from "@capacitor/app";
import { isNative } from "@/lib/platform";
import {
  hasPendingNativeDiaryDeepLink,
  markNativeDiaryDeepLinkRequested,
  NATIVE_DIARY_DEEP_LINK_EVENT,
} from "@/lib/nativeDiaryDeepLinkSignal";
import { logger } from "./logger";

export { hasPendingNativeDiaryDeepLink, NATIVE_DIARY_DEEP_LINK_EVENT };

// Event name for deep link navigation
export const DEEP_LINK_EVENT = "zenflow-deep-link";

const pendingDeepLinks: DeepLinkData[] = [];
let subscriberCount = 0;

export interface DeepLinkData {
  type: "diary" | "unknown";
  /** Sub-route for diary deep links: "mood" | "editor" */
  route?: string;
  params?: Record<string, string>;
}

function deepLinkKey(data: DeepLinkData): string {
  const params = data.params ? JSON.stringify(Object.entries(data.params).sort()) : "";
  return [data.type, data.route ?? "", params].join(":");
}

function describeDeepLinkUrl(url: string): Record<string, string> {
  try {
    const parsed = new URL(url);
    const route = parsed.pathname.split("/").filter(Boolean)[0] ?? "/";
    return {
      scheme: parsed.protocol.replace(/:$/, ""),
      host: parsed.host || "(none)",
      route,
    };
  } catch {
    return { scheme: "invalid", host: "(invalid)", route: "/" };
  }
}

/**
 * Parse a deep link URL into structured data
 */
export function parseDeepLink(url: string): DeepLinkData | null {
  try {
    const parsed = new URL(url);

    // Handle zenflow:// scheme
    if (parsed.protocol === "zenflow:") {
      const path = parsed.pathname.replace(/^\/+/, ""); // Remove leading slashes
      const host = parsed.host;

      // zenflow://diary/mood, zenflow://diary/editor, or zenflow:///diary/editor
      if (host === "diary" || path === "diary" || path.startsWith("diary/")) {
        const route = host === "diary" ? path : path.replace(/^diary\/?/, "");
        const validRoutes = ["mood", "editor"];
        const resolvedRoute = validRoutes.includes(route) ? route : "mood";
        return { type: "diary", route: resolvedRoute };
      }
    }

    logger.log("[DeepLinks] Unknown deep link format:", describeDeepLinkUrl(url));
    return { type: "unknown", params: Object.fromEntries(parsed.searchParams) };
  } catch (error) {
    logger.error("[DeepLinks] Failed to parse URL:", error);
    return null;
  }
}

/**
 * Dispatch a deep link event for the app to handle
 */
function dispatchDeepLinkEvent(data: DeepLinkData): void {
  logger.log("[DeepLinks] Dispatching deep link event:", data);
  if (subscriberCount === 0) {
    const key = deepLinkKey(data);
    if (!pendingDeepLinks.some((pending) => deepLinkKey(pending) === key)) {
      pendingDeepLinks.push(data);
      if (pendingDeepLinks.length > 5) pendingDeepLinks.shift();
    }
  }
  window.dispatchEvent(new CustomEvent(DEEP_LINK_EVENT, { detail: data }));
}

/**
 * Handle an incoming deep link URL
 */
function handleDeepLink(url: string): void {
  logger.log("[DeepLinks] Received deep link:", describeDeepLinkUrl(url));

  // Skip OAuth callbacks - they're handled separately
  if (url.includes("login-callback")) {
    logger.log("[DeepLinks] Skipping OAuth callback URL");
    return;
  }

  const data = parseDeepLink(url);
  if (data && data.type !== "unknown") {
    // Validate known schemes before dispatching
    if (data.type === "diary" && data.route && !["mood", "editor"].includes(data.route)) {
      logger.log("[DeepLinks] Invalid diary route:", data.route);
      return;
    }
    if (data.type === "diary") {
      markNativeDiaryDeepLinkRequested();
    }
    dispatchDeepLinkEvent(data);
  }
}

/**
 * Setup deep link listeners
 * Call this once at app startup
 */
export function setupDeepLinks(): void {
  if (!isNative) {
    logger.log("[DeepLinks] Not on native platform, skipping setup");
    return;
  }

  logger.log("[DeepLinks] Setting up deep link listeners");

  // Listen for app opened via URL
  const _urlOpenListener = App.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
    handleDeepLink(event.url);
  });

  // Check if app was launched with a URL
  App.getLaunchUrl()
    .then((result) => {
      if (result?.url) {
        logger.log("[DeepLinks] App launched with URL:", describeDeepLinkUrl(result.url));
        handleDeepLink(result.url);
      }
    })
    .catch((error) => {
      logger.error("[DeepLinks] Error getting launch URL:", error);
    });
}

/**
 * React hook helper to subscribe to deep link events
 * Returns a cleanup function
 */
export function subscribeToDeepLinks(callback: (data: DeepLinkData) => void): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<DeepLinkData>;
    callback(customEvent.detail);
  };

  subscriberCount += 1;
  window.addEventListener(DEEP_LINK_EVENT, handler);
  const replay = pendingDeepLinks.splice(0);
  for (const data of replay) callback(data);

  return () => {
    window.removeEventListener(DEEP_LINK_EVENT, handler);
    subscriberCount = Math.max(0, subscriberCount - 1);
  };
}
