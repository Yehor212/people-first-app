import { useEffect } from "react";

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

// Controls reduce-motion class on body based on Dopamine Settings
function ReduceMotionController() {
  const dopamine = useDopamineSettings();

  useEffect(() => {
    // Check user preference AND system preference
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const shouldReduce = !dopamine.animations || prefersReducedMotion;

    if (shouldReduce) {
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('reduce-motion');
    };
  }, [dopamine.animations]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <FeatureFlagsProvider>
        <EmotionThemeProvider>
          <AICoachProvider>
            <XpPopupProvider>
              <FlyingEmojiProvider>
                <ErrorBoundary>
                  <TooltipProvider>
                    <ReduceMotionController />


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
);

export default App;
