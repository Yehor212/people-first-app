import { memo, Suspense, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { logger } from "@/lib/logger";
import { useUIStore, useUserDataStore } from "@/stores";
import type { FocusSession } from "@/types";
import type { FocusCommitBoundary } from "@/types/focusTimerTypes";

const FocusTimer = lazyWithRetry(
  () => import("@/components/FocusTimer").then((m) => ({ default: m.FocusTimer })),
  "FocusTimer"
);

interface PlanningPageProps {
  onCompleteFocusSession?: (
    session: FocusSession,
    boundary?: FocusCommitBoundary
  ) => void | Promise<void>;
}

export const PlanningPage = memo(function PlanningPage({
  onCompleteFocusSession,
}: PlanningPageProps) {
  const { t, isRTL } = useLanguage();
  const focusSessions = useUserDataStore((s) => s.focusSessions);
  const isLoading = useUserDataStore((s) => s.isLoading);
  const setCurrentFocusMinutes = useUIStore((s) => s.setCurrentFocusMinutes);

  const handleCompleteFocusSession = useCallback(
    async (session: FocusSession, boundary?: FocusCommitBoundary): Promise<void> => {
      if (onCompleteFocusSession) {
        await onCompleteFocusSession(session, boundary);
        return;
      }
      logger.warn("[Planning] Focus session completed without a V2 completion handler");
    },
    [onCompleteFocusSession]
  );

  const loading = (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[180px] items-center justify-center rounded-2xl border border-border/45 bg-card px-4 text-sm font-medium text-muted-foreground"
    >
      {t.navV2PlanningLoading}
    </div>
  );

  return (
    <main
      id="main-content-v2"
      tabIndex={-1}
      data-testid="planning-page"
      data-planning-theme="v1-dark"
      data-v2-readable-page="planning"
      dir={isRTL ? "rtl" : undefined}
      aria-label={t.navV2Planning}
      className="dark main-content-v2 v2-fullscreen-page v2-readable-page v2-readable-page--standard relative min-h-[var(--app-viewport-height)] overflow-x-hidden bg-background px-4 pb-[calc(var(--safe-bottom)_+_5rem)] pt-[calc(var(--safe-top)_+_4.75rem)] outline-none md:px-6 md:pt-10 lg:px-10"
    >
      <div className="relative z-10 mx-auto w-full max-w-2xl">
        {isLoading ? (
          loading
        ) : (
          <section data-testid="planning-focus-section" aria-label={t.focus} className="min-w-0">
            <Suspense fallback={loading}>
              <FocusTimer
                sessions={focusSessions}
                onCompleteSession={handleCompleteFocusSession}
                onMinuteUpdate={setCurrentFocusMinutes}
                isPrimaryCTA
              />
            </Suspense>
          </section>
        )}
      </div>
    </main>
  );
});
