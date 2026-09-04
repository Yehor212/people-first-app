const THEME_TRANSITION_ENTER_FALLBACK_MS = 128;
const THEME_TRANSITION_RELEASE_FALLBACK_MS = 220;
const THEME_TRANSITION_VEIL_ATTRIBUTE = "data-theme-transition-veil";
const THEME_TRANSITION_PHASE_ATTRIBUTE = "data-theme-transition-phase";
const THEME_TRANSITION_BLUR_RELEASE_CLASS = "theme-transition-blur-released";
const THEME_TRANSITION_ATOMIC_CLASS = "theme-transition-palette-atomic";
const ANDROID_DRAWER_BLUR_SELECTOR = [
  ".drawer-v2-backdrop-partitioned",
  ".drawer-v2-panel-partitioned",
].join(",");

export interface ThemeTransitionHandle {
  readonly animated: boolean;
  readonly cancelled: boolean;
  readonly committed: boolean;
  cancel: () => void;
}

let activeTransition: ThemeTransitionHandle | null = null;

function prefersReducedMotion(): boolean {
  if (typeof document !== "undefined" && document.documentElement.dataset.reducedMotion === "true") {
    return true;
  }
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function runWithoutAnimation(commit: () => void): ThemeTransitionHandle {
  commit();
  let cancelled = false;
  return {
    animated: false,
    get cancelled() {
      return cancelled;
    },
    committed: true,
    cancel: () => {
      cancelled = true;
    },
  };
}

function releaseAndroidDrawerBlur(root: HTMLElement): HTMLElement[] {
  if (root.dataset.platform !== "android") return [];
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(ANDROID_DRAWER_BLUR_SELECTOR),
  );
  nodes.forEach((node) => node.classList.add(THEME_TRANSITION_BLUR_RELEASE_CLASS));
  return nodes;
}

function restoreAndroidDrawerBlur(nodes: HTMLElement[]): void {
  nodes.forEach((node) => node.classList.remove(THEME_TRANSITION_BLUR_RELEASE_CLASS));
}

export function cancelActiveThemeTransition(): void {
  activeTransition?.cancel();
  activeTransition = null;
}

export function runThemeTransition(commit: () => void): ThemeTransitionHandle {
  cancelActiveThemeTransition();
  if (
    typeof document === "undefined" ||
    typeof window === "undefined" ||
    !document.body ||
    typeof window.requestAnimationFrame !== "function" ||
    prefersReducedMotion()
  ) {
    return runWithoutAnimation(commit);
  }

  const root = document.documentElement;
  const oldBackground = getComputedStyle(root).getPropertyValue("--background").trim();
  if (!oldBackground) return runWithoutAnimation(commit);
  root.classList.add(THEME_TRANSITION_ATOMIC_CLASS);

  const veil = document.createElement("div");
  veil.className = "theme-transition-veil";
  veil.setAttribute(THEME_TRANSITION_VEIL_ATTRIBUTE, "");
  veil.setAttribute(THEME_TRANSITION_PHASE_ATTRIBUTE, "enter");
  veil.setAttribute("aria-hidden", "true");
  veil.style.setProperty("--theme-transition-background", oldBackground);
  document.body.append(veil);

  const releasedBlurNodes = releaseAndroidDrawerBlur(root);

  // Commit the transparent starting frame before the compositor begins the
  // outgoing fade. Only this one transient node is synchronously measured.
  void veil.offsetWidth;

  let cancelled = false;
  let committed = false;
  let cleaned = false;
  let enterFrameId: number | null = null;
  let releaseFrameId: number | null = null;
  let enterFallbackTimer: number | null = null;
  let releaseFallbackTimer: number | null = null;

  const clearScheduledWork = () => {
    if (enterFrameId !== null) window.cancelAnimationFrame(enterFrameId);
    if (releaseFrameId !== null) window.cancelAnimationFrame(releaseFrameId);
    if (enterFallbackTimer !== null) window.clearTimeout(enterFallbackTimer);
    if (releaseFallbackTimer !== null) window.clearTimeout(releaseFallbackTimer);
    enterFrameId = null;
    releaseFrameId = null;
    enterFallbackTimer = null;
    releaseFallbackTimer = null;
  };

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearScheduledWork();
    veil.removeEventListener("transitionend", handleTransitionEnd);
    veil.remove();
    root.classList.remove(THEME_TRANSITION_ATOMIC_CLASS);
    restoreAndroidDrawerBlur(releasedBlurNodes);
    if (activeTransition === handle) activeTransition = null;
  };

  const beginRelease = () => {
    releaseFrameId = null;
    if (cancelled || cleaned || activeTransition !== handle) return;
    veil.setAttribute(THEME_TRANSITION_PHASE_ATTRIBUTE, "release");
    veil.classList.remove("theme-transition-veil--enter");
    veil.classList.add("theme-transition-veil--release");
    releaseFallbackTimer = window.setTimeout(cleanup, THEME_TRANSITION_RELEASE_FALLBACK_MS);
  };

  const commitAtMidpoint = () => {
    if (cancelled || cleaned || committed || activeTransition !== handle) return;
    committed = true;
    if (enterFallbackTimer !== null) window.clearTimeout(enterFallbackTimer);
    enterFallbackTimer = null;
    veil.setAttribute(THEME_TRANSITION_PHASE_ATTRIBUTE, "midpoint");

    try {
      commit();
    } catch (error) {
      cleanup();
      throw error;
    }

    // Allow the new atomic palette to reach the render tree while the outgoing
    // background still covers it, then reveal on the following frame.
    releaseFrameId = window.requestAnimationFrame(beginRelease);
  };

  function handleTransitionEnd(event: TransitionEvent): void {
    if (event.target !== veil || event.propertyName !== "opacity") return;
    const phase = veil.getAttribute(THEME_TRANSITION_PHASE_ATTRIBUTE);
    if (phase === "enter") {
      commitAtMidpoint();
    } else if (phase === "release") {
      cleanup();
    }
  }

  const handle: ThemeTransitionHandle = {
    animated: true,
    get cancelled() {
      return cancelled;
    },
    get committed() {
      return committed;
    },
    cancel: () => {
      if (cancelled || cleaned) return;
      cancelled = true;
      cleanup();
    },
  };

  veil.addEventListener("transitionend", handleTransitionEnd);
  activeTransition = handle;
  enterFrameId = window.requestAnimationFrame(() => {
    enterFrameId = null;
    if (cancelled || cleaned || activeTransition !== handle) return;
    veil.classList.add("theme-transition-veil--enter");
    enterFallbackTimer = window.setTimeout(
      commitAtMidpoint,
      THEME_TRANSITION_ENTER_FALLBACK_MS,
    );
  });
  return handle;
}
