/**
 * Deep Linking Handler
 *
 * Handles app URLs for:
 * - zenflow://challenge/{id} - Open challenge invites
 * - com.zenflow.app://login-callback - OAuth callback (handled separately)
 *
 * Usage: Call setupDeepLinks() once at app startup.
 */

import { App, URLOpenListenerEvent } from "@capacitor/app";
import { isNative } from "@/lib/platform";
import { logger } from "./logger";

// Event name for deep link navigation
export const DEEP_LINK_EVENT = "zenflow-deep-link";

export interface DeepLinkData {
  type: "challenge" | "unknown";
  id?: string;
  params?: Record<string, string>;
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

      // zenflow://challenge/{id}
      if (host === "challenge" || path.startsWith("challenge")) {
        const id =
          path.replace("challenge/", "").replace("challenge", "") || parsed.searchParams.get("id");
        if (id && /^[A-Za-z0-9]{4,12}$/.test(id)) {
          return { type: "challenge", id };
        }
      }
    }

    // Handle https://zenflow.app/ links (future web deep links)
    if (parsed.host === "zenflow.app" || parsed.host === "www.zenflow.app") {
      const pathParts = parsed.pathname.split("/").filter(Boolean);

      if (
        pathParts[0] === "challenge" &&
        pathParts[1] &&
        /^[A-Za-z0-9]{4,12}$/.test(pathParts[1])
      ) {
        return { type: "challenge", id: pathParts[1] };
      }
    }

    logger.log("[DeepLinks] Unknown deep link format:", url);
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
  window.dispatchEvent(new CustomEvent(DEEP_LINK_EVENT, { detail: data }));
}

/**
 * Handle an incoming deep link URL
 */
function handleDeepLink(url: string): void {
  logger.log("[DeepLinks] Received deep link:", url);

  // Skip OAuth callbacks - they're handled separately
  if (url.includes("login-callback")) {
    logger.log("[DeepLinks] Skipping OAuth callback URL");
    return;
  }

  const data = parseDeepLink(url);
  if (data && data.type !== "unknown") {
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
        logger.log("[DeepLinks] App launched with URL:", result.url);
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

  window.addEventListener(DEEP_LINK_EVENT, handler);

  return () => {
    window.removeEventListener(DEEP_LINK_EVENT, handler);
  };
}
