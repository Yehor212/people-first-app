/**
 * Wraps document.startViewTransition with graceful fallback.
 * On browsers without View Transitions API, calls the callback directly.
 */
export function startViewTransition(callback: () => void): void {
  if ("startViewTransition" in document) {
    (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(
      callback
    );
  } else {
    callback();
  }
}
