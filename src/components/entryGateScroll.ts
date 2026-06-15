export function resetEntryGateScroll(testId: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const win = window;
  const doc = document;
  const isJsdom = win.navigator.userAgent.toLowerCase().includes("jsdom");

  const scrollElementToTop = (element: Element | Window | null | undefined) => {
    if (!element) return;

    const scrollTarget = element as Element & {
      scrollLeft?: number;
      scrollTo?: (options: ScrollToOptions) => void;
      scrollTop?: number;
    };

    if (!isJsdom && typeof scrollTarget.scrollTo === "function") {
      try {
        scrollTarget.scrollTo({ top: 0, left: 0, behavior: "auto" });
        return;
      } catch {
        // Fall back to direct scroll offsets for older WebViews.
      }
    }

    if ("scrollTop" in scrollTarget) scrollTarget.scrollTop = 0;
    if ("scrollLeft" in scrollTarget) scrollTarget.scrollLeft = 0;
  };

  const reset = () => {
    if (!doc.defaultView) return;
    scrollElementToTop(win);
    scrollElementToTop(doc.scrollingElement);
    scrollElementToTop(doc.documentElement);
    scrollElementToTop(doc.body);
    scrollElementToTop(doc.querySelector<HTMLElement>(`[data-testid="${testId}"]`));
  };

  reset();

  if (typeof win.requestAnimationFrame === "function") {
    const requestFrame = win.requestAnimationFrame.bind(win);
    requestFrame(reset);
    requestFrame(() => requestFrame(reset));
  }

  win.setTimeout(reset, 50);
}
