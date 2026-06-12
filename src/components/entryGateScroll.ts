export function resetEntryGateScroll(testId: string) {
  if (typeof window === "undefined") return;

  const scrollElementToTop = (element: Element | Window | null | undefined) => {
    if (!element) return;

    const isJsdom = window.navigator.userAgent.toLowerCase().includes("jsdom");
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
    scrollElementToTop(window);
    scrollElementToTop(document.scrollingElement);
    scrollElementToTop(document.documentElement);
    scrollElementToTop(document.body);
    scrollElementToTop(document.querySelector<HTMLElement>(`[data-testid="${testId}"]`));
  };

  reset();

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(reset);
    window.requestAnimationFrame(() => window.requestAnimationFrame(reset));
  }

  window.setTimeout(reset, 50);
}
