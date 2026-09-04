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
import { SplashScreen } from "@/components/SplashScreen";
import { UpdateRequiredDialog } from "@/components/UpdateRequiredDialog";
import { JournalMagicLinkConfirmGate } from "@/components/auth/JournalMagicLinkConfirmGate";
import Index from "./pages/Index";
import { useLanguage } from "@/contexts/LanguageContext";
import { preloadShareCardAssets } from "@/lib/shareCards";
import { useFontScaleInit } from "@/hooks/useFontScale";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useBatteryState } from "@/hooks/useBatteryState";
import { setLowBatteryMirror } from "@/lib/animationUtils";
import { isAndroid } from "@/lib/platform";
import { useDesignFlagStore } from "@/stores/designFlagStore";
import { scheduleIdle } from "@/lib/scheduleIdle";
import { AppBackgroundMusicProvider } from "@/components/navigation-v2/AppBackgroundMusicProvider";

const LOW_BATTERY_THRESHOLD = 0.15;

const ANDROID_MOTION_BENCHMARK_ENABLED =
  typeof __ANDROID_MOTION_BENCHMARK__ !== "undefined" &&
  __ANDROID_MOTION_BENCHMARK__;

function isAndroidMotionLoaderProbeAllowed(location: Location): boolean {
  const searchParams = new URLSearchParams(location.search);
  return (
    ANDROID_MOTION_BENCHMARK_ENABLED &&
    location.protocol === "https:" &&
    location.hostname === "localhost" &&
    searchParams.get("androidMotionProbe") === "loader"
  );
}

function AndroidMotionLoaderProbe() {
  const { t } = useLanguage();
  return (
    <SplashScreen
      loadingFadeOut={false}
      subtitle={t.initializingApp || "Preparing your zen space..."}
    />
  );
}

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
 * Uses the shared accessibility/power motion source of truth, which combines three inputs
 * with AND-logic (WCAG 2.3.3 compliant, Law 9):
 *   1. In-app Reduce motion preference.
 *   2. OS `prefers-reduced-motion` (system accessibility kill-switch).
 *   3. Low battery (<15% AND not charging) — power-aware downgrade.
 *
 * On native Android, runtime strain is intentionally excluded from this global
 * accessibility gate. It remains available through `data-runtime-perf` for
 * scoped decorative downgrades; it must not stop loaders, navigation, or
 * interaction feedback. Other platforms retain their existing behavior.
 *
 * Effects when "animate=false":
 *   - `body.reduce-motion` class toggled (CSS kill-switch in index.css).
 *   - `documentElement[data-reduced-motion="true"]` attribute for downstream
 *     selectors.
 *   - `MotionConfig reducedMotion="always"` — Framer Motion disables transform
 *     and layout motion; components still avoid independent opacity fades when
 *     an opaque surface is required from the first rendered frame.
 *   - Static mirror in `animationUtils.setLowBatteryMirror` so non-React
 *     call sites (audioManager, haptics) observe the same gate.
 *
 * The system preference remains the accessibility kill-switch even when the
 * in-app preference allows motion.
 */
function AnimationGate({ children }: { children: ReactNode }) {
  const battery = useBatteryState();
  const animate = useShouldAnimate({ respectRuntimePerformance: !isAndroid });

  // Apply stored font scale on mount (sets --font-scale CSS custom property)
  useFontScaleInit();

  const lowBattery =
    battery !== null && !battery.charging && battery.level < LOW_BATTERY_THRESHOLD;

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

const App = () => {
  const showAndroidMotionLoaderProbe =
    typeof window !== "undefined" && isAndroidMotionLoaderProbeAllowed(window.location);

  return (
    <RootErrorBoundary>
      <AnimationGate>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            {showAndroidMotionLoaderProbe ? (
              <AndroidMotionLoaderProbe />
            ) : (
              <FeatureFlagsProvider>
                <EmotionThemeProvider>
                  <AICoachProvider>
                    <XpPopupProvider>
                      <FlyingEmojiProvider>
                        <ErrorBoundary>
                          <TooltipProvider>
                            <DatabaseRecoveryDialog />
                            <UpdateRequiredDialog />
                            <JournalMagicLinkConfirmGate>
                              <AppBackgroundMusicProvider>
                                <Index />
                              </AppBackgroundMusicProvider>
                            </JournalMagicLinkConfirmGate>
                          </TooltipProvider>
                        </ErrorBoundary>
                      </FlyingEmojiProvider>
                    </XpPopupProvider>
                  </AICoachProvider>
                </EmotionThemeProvider>
              </FeatureFlagsProvider>
            )}
          </LanguageProvider>
        </QueryClientProvider>
      </AnimationGate>
    </RootErrorBoundary>
  );
};

export default App;
