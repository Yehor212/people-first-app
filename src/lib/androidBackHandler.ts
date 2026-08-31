/**
 * Android Back ownership for the Capacitor WebView.
 *
 * AndroidX owns gesture lifecycle and emits JavaScript only for a committed
 * Back. ZenFlow owns the visual stack in deterministic overlay/navigation
 * layers and disables native interception at the unobstructed Orb root.
 */

import type { PluginListenerHandle } from "@capacitor/core";
import { isAndroid, isNative } from "@/lib/platform";
import { AndroidBackBridge, type AndroidBackInvokedEvent } from "./androidBackBridge";
import { logger } from "./logger";

type BackOwnerLayer = "overlay" | "navigation";
type BackOwnerCallback = (event: AndroidBackInvokedEvent) => boolean;

interface BackOwnerRegistration {
  callback: BackOwnerCallback;
  layer: BackOwnerLayer;
  visualElement: Element | null;
}

interface BackOwnerRegistrationOptions {
  /** Primary navigation always stays below modal, sheet, editor, and menu owners. */
  layer?: BackOwnerLayer;
}

interface NativeBackState {
  canConsume: boolean;
  hasVisibleLayer: boolean;
}

const RAPID_BACK_COMMIT_GUARD_MS = 350;
const backOwners: BackOwnerRegistration[] = [];

let backListenerHandle: PluginListenerHandle | null = null;
let modalObserver: MutationObserver | null = null;
let navigationIsRoot = true;
let committedBackLocked = false;
let committedBackUnlockTimer: ReturnType<typeof setTimeout> | null = null;
let desiredNativeState: NativeBackState | null = null;
let publishedNativeState: NativeBackState | null = null;
let nativeStateFlush: Promise<void> | null = null;

function sameNativeState(left: NativeBackState | null, right: NativeBackState): boolean {
  return left?.canConsume === right.canConsume && left.hasVisibleLayer === right.hasVisibleLayer;
}

function isElementVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const styles = window.getComputedStyle(element);
  if (styles.display === "none" || styles.visibility === "hidden" || styles.opacity === "0") {
    return false;
  }

  return (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

const TRANSIENT_VISUAL_BACK_SELECTORS = ['[role="menu"]'];

const MODAL_VISUAL_BACK_SELECTORS = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  ".modal",
  ".dialog",
  ".drawer",
  "[data-radix-dialog-content]",
  "[data-radix-alert-dialog-content]",
  "[data-radix-sheet-content]",
  "[data-radix-drawer-content]",
];

function visibleVisualBackLayers(
  selectors = [...TRANSIENT_VISUAL_BACK_SELECTORS, ...MODAL_VISUAL_BACK_SELECTORS]
): Element[] {
  if (typeof document === "undefined" || selectors.length === 0) return [];

  return Array.from(document.querySelectorAll(selectors.join(","))).filter(isElementVisible);
}

function isVisualBackLayerOpen(
  selectors = [...TRANSIENT_VISUAL_BACK_SELECTORS, ...MODAL_VISUAL_BACK_SELECTORS]
): boolean {
  return visibleVisualBackLayers(selectors).length > 0;
}

function claimCurrentModalVisualLayer(): Element | null {
  const claimedLayers = new Set(
    backOwners
      .map((owner) => owner.visualElement)
      .filter((element): element is Element => !!element)
  );
  return (
    visibleVisualBackLayers(MODAL_VISUAL_BACK_SELECTORS).find(
      (element) => !claimedLayers.has(element)
    ) ?? null
  );
}

function currentModalVisualLayer(): Element | null {
  const visibleLayers = visibleVisualBackLayers(MODAL_VISUAL_BACK_SELECTORS);
  if (visibleLayers.length === 0) return null;

  const activeLayer =
    document.activeElement instanceof Element
      ? document.activeElement.closest(MODAL_VISUAL_BACK_SELECTORS.join(","))
      : null;
  if (activeLayer && visibleLayers.includes(activeLayer)) return activeLayer;

  // Portalled modal layers are appended in visual stack order. Focus is the
  // primary signal; DOM order is the deterministic fallback during transitions.
  return visibleLayers[visibleLayers.length - 1] ?? null;
}

function computeNativeBackState(): NativeBackState {
  const hasVisibleLayer =
    backOwners.some((owner) => owner.layer === "overlay") || isVisualBackLayerOpen();
  return {
    canConsume: !navigationIsRoot || backOwners.length > 0 || hasVisibleLayer,
    hasVisibleLayer,
  };
}

async function flushNativeBackState(): Promise<void> {
  if (!isNative || !isAndroid || !backListenerHandle) return;
  desiredNativeState = computeNativeBackState();

  if (nativeStateFlush) {
    await nativeStateFlush;
    return;
  }

  nativeStateFlush = (async () => {
    while (desiredNativeState && !sameNativeState(publishedNativeState, desiredNativeState)) {
      const next = desiredNativeState;
      await AndroidBackBridge.setState(next);
      publishedNativeState = next;
    }
  })().catch((error) => {
    // Do not recursively retry a rejected bridge call: that can starve the
    // WebView forever. Forget the uncertain snapshot, warn once, and let the
    // next concrete UI/navigation state change make one fresh attempt.
    desiredNativeState = null;
    publishedNativeState = null;
    logger.warn("[AndroidBackHandler] Failed to publish ownership state", error);
  });

  try {
    await nativeStateFlush;
  } finally {
    nativeStateFlush = null;
    if (desiredNativeState && !sameNativeState(publishedNativeState, desiredNativeState)) {
      await flushNativeBackState();
    }
  }
}

function requestNativeBackStateSync(): void {
  void flushNativeBackState().catch((error) => {
    logger.warn("[AndroidBackHandler] Failed to publish ownership state", error);
  });
}

function lockCommittedBack(): boolean {
  if (committedBackLocked) return false;
  committedBackLocked = true;
  if (committedBackUnlockTimer) clearTimeout(committedBackUnlockTimer);
  committedBackUnlockTimer = setTimeout(() => {
    committedBackLocked = false;
    committedBackUnlockTimer = null;
  }, RAPID_BACK_COMMIT_GUARD_MS);
  return true;
}

/**
 * Register one currently active Back owner. Overlay owners resolve before
 * primary navigation, and each layer remains last-in-first-out.
 */
export function registerModalCloseCallback(
  callback: BackOwnerCallback,
  { layer = "overlay" }: BackOwnerRegistrationOptions = {}
): () => void {
  const registration: BackOwnerRegistration = {
    callback,
    layer,
    visualElement: layer === "overlay" ? claimCurrentModalVisualLayer() : null,
  };
  backOwners.push(registration);
  requestNativeBackStateSync();

  return () => {
    const index = backOwners.indexOf(registration);
    if (index >= 0) backOwners.splice(index, 1);
    requestNativeBackStateSync();
  };
}

/** Publish whether the active V2 destination is the system root. */
export async function publishAndroidBackNavigationState({
  isRoot,
}: {
  isRoot: boolean;
}): Promise<void> {
  navigationIsRoot = isRoot;
  await flushNativeBackState();
}

function closeRegisteredBackOwner(layer: BackOwnerLayer, event: AndroidBackInvokedEvent): boolean {
  for (let index = backOwners.length - 1; index >= 0; index -= 1) {
    const owner = backOwners[index];
    if (owner.layer === layer && owner.callback(event)) {
      logger.log("[AndroidBackHandler] Back consumed by", layer, "owner");
      return true;
    }
  }

  return false;
}

function closeRegisteredVisualOwner(
  visualElement: Element,
  event: AndroidBackInvokedEvent
): boolean {
  for (let index = backOwners.length - 1; index >= 0; index -= 1) {
    const owner = backOwners[index];
    if (
      owner.layer === "overlay" &&
      owner.visualElement === visualElement &&
      owner.callback(event)
    ) {
      logger.log("[AndroidBackHandler] Back consumed by registered visual owner");
      return true;
    }
  }

  return false;
}

function closeTopBackOwner(event: AndroidBackInvokedEvent): boolean {
  const dispatchVisualEscape = () => {
    const escapeTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : document;
    escapeTarget.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        bubbles: true,
        cancelable: true,
      })
    );
  };

  if (isVisualBackLayerOpen(TRANSIENT_VISUAL_BACK_SELECTORS)) {
    // A semantic menu is a transient child above its registered editor or
    // modal. Listboxes are not inferred here: ZenFlow also has persistent
    // listboxes, so transient listboxes register an explicit state owner.
    dispatchVisualEscape();
    return true;
  }

  const visualModal = currentModalVisualLayer();
  if (visualModal) {
    // A registered modal gets its exact callback, avoiding a global Radix
    // Escape that can cascade through a registered stack. An unclaimed legacy
    // modal stays above every lower registered overlay/navigation owner.
    if (closeRegisteredVisualOwner(visualModal, event)) return true;
    dispatchVisualEscape();
    return true;
  }

  if (closeRegisteredBackOwner("overlay", event)) return true;

  return closeRegisteredBackOwner("navigation", event);
}

export async function initAndroidBackHandler(): Promise<void> {
  if (!isNative || !isAndroid) return;
  if (backListenerHandle) {
    logger.log("[AndroidBackHandler] Already initialized");
    return;
  }

  backListenerHandle = await AndroidBackBridge.addListener("backInvoked", (event) => {
    if (!lockCommittedBack()) {
      logger.log("[AndroidBackHandler] Ignored rapid duplicate commit");
      return;
    }

    // Some WebView layers can disappear between native commit and JS delivery.
    // The native snapshot prevents the same Back from also traversing history.
    const hasRegisteredOverlayOwner = backOwners.some((owner) => owner.layer === "overlay");
    if (event.hadVisibleLayer && !hasRegisteredOverlayOwner && !isVisualBackLayerOpen()) {
      requestNativeBackStateSync();
      return;
    }

    if (closeTopBackOwner(event)) {
      requestNativeBackStateSync();
      return;
    }

    if (!navigationIsRoot && event.canGoBack) {
      window.history.back();
      return;
    }

    // A root commit can arrive only while ownership state is crossing the
    // bridge. Consume this one commit and disable interception for the next.
    requestNativeBackStateSync();
  });

  if (typeof MutationObserver !== "undefined" && typeof document !== "undefined" && document.body) {
    modalObserver = new MutationObserver(requestNativeBackStateSync);
    modalObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "open", "aria-hidden", "data-state"],
    });
  }

  await flushNativeBackState();
  logger.log("[AndroidBackHandler] Registered deterministic AndroidX owner");
}

export async function removeAndroidBackHandler(): Promise<void> {
  if (!isNative || !isAndroid) return;

  backOwners.length = 0;
  navigationIsRoot = true;
  if (backListenerHandle) {
    try {
      await flushNativeBackState();
    } catch (error) {
      logger.warn("[AndroidBackHandler] Failed to release native Back ownership", error);
    }
    const listenerHandle = backListenerHandle;
    backListenerHandle = null;
    await listenerHandle.remove();
  }
  modalObserver?.disconnect();
  modalObserver = null;
  if (committedBackUnlockTimer) clearTimeout(committedBackUnlockTimer);
  committedBackUnlockTimer = null;
  committedBackLocked = false;
  desiredNativeState = null;
  publishedNativeState = null;
  nativeStateFlush = null;
}
