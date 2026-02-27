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

const queryClient = new QueryClient();

// Preload DOMPurify in the background to speed up share card sanitization
void preloadShareCardAssets();

/**
 * AnimationGate — single point of control for ALL animation layers.
 * Only the in-app Dopamine toggle decides; OS prefers-reduced-motion is ignored
 * so iOS users always get full visual fidelity.
 */
function AnimationGate({ children }: { children: ReactNode }) {
  const dopamine = useDopamineSettings();

  useEffect(() => {
    if (dopamine.animations) {
      document.body.classList.remove('reduce-motion');
    } else {
      document.body.classList.add('reduce-motion');
    }
    return () => document.body.classList.remove('reduce-motion');
  }, [dopamine.animations]);

  return (
    <MotionConfig reducedMotion={dopamine.animations ? 'never' : 'always'}>
      {children}
    </MotionConfig>
  );
}

const App = () => (
  <AnimationGate>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
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
      </LanguageProvider>
    </QueryClientProvider>
  </AnimationGate>
);

export default App;
