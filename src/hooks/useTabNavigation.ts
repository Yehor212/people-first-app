import { useCallback, useEffect, useRef, useTransition } from "react";
import { useAppStore, type TabType } from "@/stores";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useLanguage } from "@/contexts/LanguageContext";

/** Feature flags (kill-switches for tab rollout) */
const CANVAS_ENABLED = false;
const HABIT_HUB_ENABLED = true;

/** Ordered tabs available for swipe navigation */
const SWIPE_TABS: TabType[] = [
  "home",
  ...(HABIT_HUB_ENABLED ? ["mindmap" as TabType] : []),
  "garden",
  "stats",
  "settings",
];

export interface UseTabNavigationReturn {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  settingsOpenSection: string | undefined;
  handleTabChange: (tab: TabType) => void;
  startTransition: (callback: () => void) => void;
  mainRef: React.RefObject<HTMLElement>;
  swipeProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  swipeContainerRef: React.RefObject<HTMLDivElement>;
  quickActionTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  CANVAS_ENABLED: boolean;
  HABIT_HUB_ENABLED: boolean;
}

/**
 * Manages tab navigation state, focus management, swipe gestures, and feature flags.
 * Extracted from Index.tsx to reduce orchestrator size.
 */
export function useTabNavigation(): UseTabNavigationReturn {
  const { isRTL } = useLanguage();

  // Navigation state from Zustand
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const settingsOpenSection = useAppStore((s) => s.settingsOpenSection);
  const quickActionTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Concurrent mode: defer heavy tab content renders so interactions stay responsive (INP)
  const [, startTransition] = useTransition();

  // Focus management: move focus to main content on tab change (WCAG 2.1 2.4.3)
  const mainRef = useRef<HTMLElement>(null);
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (prevTabRef.current !== activeTab && mainRef.current) {
      mainRef.current.focus();
      prevTabRef.current = activeTab;
    }
  }, [activeTab]);

  // Scroll-to-top on re-tap of active tab (iOS / Telegram convention)
  const handleTabChange = useCallback(
    (tab: TabType) => {
      if (tab === activeTab) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      startTransition(() => setActiveTab(tab));
    },
    [activeTab, setActiveTab]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    const ref = quickActionTimeoutRef.current;
    return () => {
      if (ref) clearTimeout(ref);
    };
  }, []);

  // Swipe navigation for mobile tab switching (disabled on mindmap tab -- canvas handles its own gestures)
  const { containerProps: swipeProps, containerRef: swipeContainerRef } = useSwipeNavigation({
    activeTab,
    onTabChange: (tab: TabType) => startTransition(() => setActiveTab(tab)),
    tabs: SWIPE_TABS,
    threshold: 50,
    velocityThreshold: 0.3,
    isRTL,
    enabled: HABIT_HUB_ENABLED || activeTab !== "mindmap",
  });

  return {
    activeTab,
    setActiveTab,
    settingsOpenSection,
    handleTabChange,
    startTransition,
    mainRef,
    swipeProps,
    swipeContainerRef,
    quickActionTimeoutRef,
    CANVAS_ENABLED,
    HABIT_HUB_ENABLED,
  };
}
