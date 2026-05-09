import { useEffect, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { EmotionThemeProvider } from "@/contexts/EmotionThemeContext";
import { AICoachProvider } from "@/contexts/AICoachContext";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { XpPopupProvider } from "@/components/XpPopup";
import { FlyingEmojiProvider } from "@/components/FlyingMoodEmoji";
import { ErrorBoundary, RootErrorBoundary } from "@/components/ErrorBoundary";

import { DatabaseRecoveryDialog } from "@/components/DatabaseRecoveryDialog";
import { UpdateRequiredDialog } from "@/components/UpdateRequiredDialog";
import Index from "./pages/Index";
import { preloadShareCardAssets } from "@/lib/shareCards";
import { useDopamineSettings } from "@/components/DopamineSettings";
import { useFontScaleInit } from "@/hooks/useFontScale";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useBatteryState } from "@/hooks/useBatteryState";
import { setLowBatteryMirror } from "@/lib/animationUtils";
import { useDesignFlagStore } from "@/stores/designFlagStore";
import { scheduleIdle } from "@/lib/scheduleIdle";

const LOW_BATTERY_THRESHOLD = 0.15;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

// Defer DOMPurify preload to idle time — keeps it off the critical rendering path.
// preloadShareCardAssets runs DOMPurify init which blocks main thread 10-50ms during module eval.
scheduleIdle(() => void preloadShareCardAssets(), 5000, 3500);

// Phase 2-B: bootstrap design-system rollout flags from Supabase at idle time.
// The store's persist middleware rehydrates cached flags synchronously so the
// first render is not blocked; this fetch only refreshes the cache. Failure is
// silent — offline-first (Law 25) degradation keeps the last cached values.
scheduleIdle(() => void useDesignFlagStore.getState().fetchFlags(), 5000, 3500);

/**
 * AnimationGate — single point of control for ALL animation layers.
 *
 * Combines three inputs with AND-logic (WCAG 2.3.3 compliant, Law 9):
 *   1. In-app Dopamine toggle (primary user preference).
 *   2. OS `prefers-reduced-motion` (system accessibility kill-switch).
 *   3. Low battery (<15% AND not charging) — power-aware downgrade.
 *
 * Effects when "animate=false":
 *   - `body.reduce-motion` class toggled (CSS kill-switch in index.css).
 *   - `documentElement[data-reduced-motion="true"]` attribute for downstream
 *     selectors.
 *   - `MotionConfig reducedMotion="always"` — Framer Motion collapses all
 *     transitions to instant.
 *   - Static mirror in `animationUtils.setLowBatteryMirror` so non-React
 *     call sites (audioManager, haptics) observe the same gate.
 *
 * Behaviour change vs. prior versions: users with Dopamine=on + OS reduce=on
 * now see animations OFF (previously ON). Intentional per WCAG 2.3.3.
 */
function AnimationGate({ children }: { children: ReactNode }) {
  const dopamine = useDopamineSettings();
  const osPrefersReduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const battery = useBatteryState();

  // Apply stored font scale on mount (sets --font-scale CSS custom property)
  useFontScaleInit();

  const lowBattery =
    battery !== null && !battery.charging && battery.level < LOW_BATTERY_THRESHOLD;
  const animate = dopamine.animations && !osPrefersReduce && !lowBattery;

  useEffect(() => {
    // Keep the module-level mirror in sync for non-React consumers.
    setLowBatteryMirror(lowBattery);
    return () => setLowBatteryMirror(false);
  }, [lowBattery]);

  useEffect(() => {
    if (animate) {
      document.body.classList.remove("reduce-motion");
      document.documentElement.dataset.reducedMotion = "false";
    } else {
      document.body.classList.add("reduce-motion");
      document.documentElement.dataset.reducedMotion = "true";
    }
    return () => {
      document.body.classList.remove("reduce-motion");
      delete document.documentElement.dataset.reducedMotion;
    };
  }, [animate]);

  return (
    <MotionConfig reducedMotion={animate ? "never" : "always"}>{children}</MotionConfig>
  );
}

/** RTL dir attribute — sets dir="rtl" for Arabic/Hebrew, dir="ltr" for others */
function RtlDirectionManager({ children }: { children: ReactNode }) {
  const { language } = useLanguage();

  useEffect(() => {
    const rtlLocales = ["ar", "he"];
    document.documentElement.dir = rtlLocales.includes(language) ? "rtl" : "ltr";
  }, [language]);

  return <>{children}</>;
}

const App = () => (
  <RootErrorBoundary>
    <AnimationGate>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <RtlDirectionManager>
            <FeatureFlagsProvider>
              <EmotionThemeProvider>
                <AICoachProvider>
                  <XpPopupProvider>
                    <FlyingEmojiProvider>
                      <ErrorBoundary>
                        <TooltipProvider>
                          <DatabaseRecoveryDialog />
                          <UpdateRequiredDialog />
                          <Index />
                        </TooltipProvider>
                      </ErrorBoundary>
                    </FlyingEmojiProvider>
                  </XpPopupProvider>
                </AICoachProvider>
              </EmotionThemeProvider>
            </FeatureFlagsProvider>
          </RtlDirectionManager>
        </LanguageProvider>
      </QueryClientProvider>
    </AnimationGate>
  </RootErrorBoundary>
);

export default App;
