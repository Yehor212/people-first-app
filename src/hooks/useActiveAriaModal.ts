import { useEffect, useState } from "react";

const ACTIVE_MODAL_SELECTOR =
  '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';

function isVisuallyInactive(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;

  while (current) {
    if (
      current.hidden ||
      current.getAttribute("aria-hidden") === "true"
    ) {
      return true;
    }

    const style = window.getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      (current === element && current.classList.contains("pointer-events-none"))
    ) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

function documentHasActiveAriaModal(): boolean {
  if (typeof document === "undefined") return false;

  return Array.from(document.querySelectorAll<HTMLElement>(ACTIVE_MODAL_SELECTOR)).some(
    (element) => !isVisuallyInactive(element),
  );
}

/**
 * Tracks rendered modal dialogs so global banners and recovery rails do not
 * remain interactive outside the modal boundary. Closed transition shells
 * explicitly marked hidden or pointer-inert are ignored. A mounted modal owns
 * interaction from its first entrance frame, even while its opacity is zero.
 */
export function useActiveAriaModal(): boolean {
  const [hasActiveModal, setHasActiveModal] = useState(documentHasActiveAriaModal);

  useEffect(() => {
    const update = () => setHasActiveModal(documentHasActiveAriaModal());
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-hidden", "aria-modal", "class", "hidden", "style"],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return hasActiveModal;
}
