/**
 * Android Back Button Handler
 * Publishes owned-layer state to the AndroidX predictive Back bridge.
 */

import type { PluginListenerHandle } from "@capacitor/core";
import { isNative, isAndroid } from "@/lib/platform";
import { AndroidBackBridge, type AndroidBackInvokedEvent } from "./androidBackBridge";
import { logger } from "./logger";

// Store listener handle for targeted removal (instead of removeAllListeners)
let backButtonListenerHandle: PluginListenerHandle | null = null;
let modalObserver: MutationObserver | null = null;
// Public entry/auth screens and the hydrated Orb shell are system-root unless
// a navigation owner explicitly publishes otherwise. Native starts
// conservative until this module initializes, then Android owns back-to-home.
let navigationIsRoot = true;

// Modal close callback registry for React state-based modals
type ModalCloseCallback = (event: AndroidBackInvokedEvent) => boolean;
type BackOwnerLayer = "overlay" | "navigation";

interface BackOwnerRegistration {
  callback: ModalCloseCallback;
  layer: BackOwnerLayer;
}

interface BackOwnerRegistrationOptions {
  /**
   * Navigation is deliberately below every modal/sheet/dialog owner. React
   * child effects can register before their shell parent, so registration
   * order alone cannot express Android's visual Back stack.
   */
  layer?: BackOwnerLayer;
}

const modalCloseCallbacks: BackOwnerRegistration[] = [];

/**
 * Register a callback to be called when back button is pressed.
 * Callbacks are called in reverse order (LIFO - last registered first).
 * Return true from callback if you handled the back press.
 * Returns an unregister function.
 */
export function registerModalCloseCallback(
  callback: ModalCloseCallback,
  { layer = "overlay" }: BackOwnerRegistrationOptions = {},
): () => void {
  const registration: BackOwnerRegistration = { callback, layer };
  modalCloseCallbacks.push(registration);
  void syncNativeBackState();
  return () => {
    const index = modalCloseCallbacks.indexOf(registration);
    if (index > -1) modalCloseCallbacks.splice(index, 1);
    void syncNativeBackState();
  };
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
  if (styles.display === "none") return false;
  if (styles.visibility === "hidden") return false;
  if (styles.opacity === "0") return false;

  // Check if element is within viewport (not scrolled away)
  const inViewport =
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0;

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
    ".modal",
    ".dialog",
    ".drawer",
    // Radix UI specific - more targeted than generic [data-state="open"]
    "[data-radix-dialog-content]",
    "[data-radix-alert-dialog-content]",
    "[data-radix-sheet-content]",
    "[data-radix-drawer-content]",
    // Radix popover/dropdown only if they have overlay (true modals)
    "[data-radix-popper-content-wrapper][data-side]",
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
 * Publish whether ZenFlow currently owns an in-app Back destination.
 */
async function syncNativeBackState(): Promise<void> {
  if (!isNative || !isAndroid || !backButtonListenerHandle) return;
  const hasVisibleLayer = typeof document !== "undefined" && isModalOpen();
  await AndroidBackBridge.setState({
    canConsume: !navigationIsRoot || modalCloseCallbacks.length > 0 || hasVisibleLayer,
    hasVisibleLayer,
  });
}

export async function publishAndroidBackNavigationState({
  isRoot,
}: {
  isRoot: boolean;
}): Promise<void> {
  navigationIsRoot = isRoot;
  await syncNativeBackState();
}

/**
 * Try to close the topmost modal or let the registered navigation owner act.
 */
function closeTopModal(event: AndroidBackInvokedEvent): boolean {
  // Overlay ownership always precedes primary navigation, independent of
  // incidental React effect order. Owners remain LIFO within each layer.
  const layers: readonly BackOwnerLayer[] = ["overlay", "navigation"];
  for (const layer of layers) {
    for (let i = modalCloseCallbacks.length - 1; i >= 0; i--) {
      const owner = modalCloseCallbacks[i];
      if (owner.layer === layer && owner.callback(event)) {
        logger.log("[AndroidBackHandler] Back consumed by registered owner");
        return true;
      }
    }
  }

  // A visible unregistered layer may still own Escape (for example a Radix
  // dialog). Dispatching Escape lets its own top-layer stack decide what closes;
  // clicking a DOM-selected close button could close a lower nested layer.
  // Consume this Back press so it cannot also navigate history or exit.
  if (isModalOpen()) {
    const escEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(escEvent);
    return true;
  }

  return false;
}

/**
 * Initialize Android back button handler
 */
export async function initAndroidBackHandler(): Promise<void> {
  // Only run on Android
  if (!isNative || !isAndroid) {
    return;
  }

  // Prevent double registration
  if (backButtonListenerHandle) {
    logger.log("[AndroidBackHandler] Already initialized, skipping");
    return;
  }

  logger.log("[AndroidBackHandler] Initializing...");

  // AndroidX invokes this only after a committed gesture. A cancelled predictive
  // gesture produces no JavaScript side effect.
  backButtonListenerHandle = await AndroidBackBridge.addListener("backInvoked", (event) => {
    const { canGoBack } = event;
    logger.log("[AndroidBackHandler] Back button pressed, canGoBack:", canGoBack);

    // WebView/Radix/Vaul may dismiss a visible layer before the Capacitor
    // listener receives the same committed Back. The native dispatch snapshot
    // fences that action so it cannot also traverse history or exit.
    if (event.hadVisibleLayer && !isModalOpen()) {
      logger.log("[AndroidBackHandler] Layer already dismissed by committed Back");
      void syncNativeBackState();
      return;
    }

    if (modalCloseCallbacks.length > 0 || isModalOpen()) {
      logger.log("[AndroidBackHandler] Modal/panel may be open, attempting to close");
      if (closeTopModal(event)) {
        void syncNativeBackState();
        return;
      }
    }

    if (!navigationIsRoot && canGoBack) {
      logger.log("[AndroidBackHandler] Navigating WebView history");
      window.history.back();
      return;
    }

    // A root event can arrive only during the brief state-publication window.
    // Consume this committed event without exiting, then hand subsequent root
    // gestures back to Android. A no-history non-root owner is expected to move
    // the shell to Orb through its registered callback.
    void syncNativeBackState();
  });

  if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
    modalObserver = new MutationObserver(() => {
      void syncNativeBackState();
    });
    modalObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden", "data-state"],
    });
  }

  await syncNativeBackState();

  logger.log("[AndroidBackHandler] Back button handler registered");
}

/**
 * Remove back button listener (cleanup)
 * Removes only the ZenFlow bridge listener and observer.
 */
export async function removeAndroidBackHandler(): Promise<void> {
  if (!isNative || !isAndroid) {
    return;
  }

  if (backButtonListenerHandle) {
    await backButtonListenerHandle.remove();
    backButtonListenerHandle = null;
    modalObserver?.disconnect();
    modalObserver = null;
    navigationIsRoot = true;
    logger.log("[AndroidBackHandler] Back button handler removed");
  }
}
