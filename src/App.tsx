import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { EmotionThemeProvider } from "@/contexts/EmotionThemeContext";
import { XpPopupProvider } from "@/components/XpPopup";
import { FlyingEmojiProvider } from "@/components/FlyingMoodEmoji";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { preloadShareCardAssets } from "@/lib/shareCards";

const queryClient = new QueryClient();

// Preload html2canvas in the background to speed up share modal
preloadShareCardAssets();

// Determine basename: use "/" for Capacitor/native, or BASE_URL for web
const getBasename = () => {
  const baseUrl = import.meta.env.BASE_URL;
  // If BASE_URL is relative (./ or empty), we're in Capacitor - use "/"
  if (!baseUrl || baseUrl === './' || baseUrl === '.') {
    return '/';
  }
  return baseUrl;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <EmotionThemeProvider>
        <XpPopupProvider>
          <FlyingEmojiProvider>
            <ErrorBoundary>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter basename={getBasename()}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </ErrorBoundary>
          </FlyingEmojiProvider>
        </XpPopupProvider>
      </EmotionThemeProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
