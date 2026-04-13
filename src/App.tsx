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
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { DatabaseRecoveryDialog } from "@/components/DatabaseRecoveryDialog";
import { UpdateRequiredDialog } from "@/components/UpdateRequiredDialog";
import Index from "./pages/Index";
import { preloadShareCardAssets } from "@/lib/shareCards";
import { useDopamineSettings } from "@/components/DopamineSettings";
import { useFontScaleInit } from "@/hooks/useFontScale";
import { useLanguage } from "@/contexts/LanguageContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

// Defer DOMPurify preload to idle time — keeps it off the critical rendering path
// ROOT-CAUSE: preloadShareCardAssets runs DOMPurify init which blocks main thread 10-50ms during module eval
if ("requestIdleCallback" in window) {
  requestIdleCallback(() => void preloadShareCardAssets());
} else {
  // ROOT-CAUSE: requestIdleCallback not supported in Safari <16.4 — setTimeout(2s) is the standard polyfill
  setTimeout(() => void preloadShareCardAssets(), 2000);
}

/**
 * AnimationGate — single point of control for ALL animation layers.
 * Only the in-app Dopamine toggle decides; OS prefers-reduced-motion is ignored
 * so iOS users always get full visual fidelity.
 */
function AnimationGate({ children }: { children: ReactNode }) {
  const dopamine = useDopamineSettings();

  // Apply stored font scale on mount (sets --font-scale CSS custom property)
  useFontScaleInit();

  useEffect(() => {
    if (dopamine.animations) {
      document.body.classList.remove("reduce-motion");
    } else {
      document.body.classList.add("reduce-motion");
    }
    return () => document.body.classList.remove("reduce-motion");
  }, [dopamine.animations]);

  return (
    <MotionConfig reducedMotion={dopamine.animations ? "never" : "always"}>{children}</MotionConfig>
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
);

export default App;
