import { useCallback, useRef } from "react";
import { type TabType } from "@/stores";

interface UseSectionNavigationParams {
  setActiveTab: (tab: TabType) => void;
  startTransition: (callback: () => void) => void;
  quickActionTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

export interface UseSectionNavigationReturn {
  moodRef: React.RefObject<HTMLDivElement>;
  focusRef: React.RefObject<HTMLDivElement>;
  handleNavigateToSection: (section: "mood" | "habits" | "focus") => void;
  handleQuickAction: (action: string) => void;
}

/**
 * Manages section-level navigation within tabs (scroll-to-section, quick actions).
 * Extracted from Index.tsx to reduce orchestrator size.
 */
export function useSectionNavigation({
  setActiveTab,
  startTransition,
  quickActionTimeoutRef,
}: UseSectionNavigationParams): UseSectionNavigationReturn {
  const moodRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);

  const handleNavigateToSection = useCallback(
    (section: "mood" | "habits" | "focus") => {
      if (section === "habits") {
        startTransition(() => setActiveTab("mindmap"));
        return;
      }
      const refs = { mood: moodRef, focus: focusRef };
      refs[section]?.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    },
    [setActiveTab, startTransition]
  );

  const handleQuickAction = useCallback(
    (action: string) => {
      startTransition(() => setActiveTab("home"));
      quickActionTimeoutRef.current = setTimeout(() => {
        if (action === "logMood") moodRef.current?.scrollIntoView({ behavior: "smooth" });
        if (action === "startFocus") focusRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    },
    [setActiveTab, startTransition, quickActionTimeoutRef]
  );

  return {
    moodRef,
    focusRef,
    handleNavigateToSection,
    handleQuickAction,
  };
}
