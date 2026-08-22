import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUIStore, useUserDataStore, getModalToggle } from "@/stores";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { dismissUpdate } from "@/lib/appUpdateManager";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { FeatureUnlock } from "@/components/FeatureUnlock";
import { WelcomeBackModal } from "@/components/WelcomeBackModal";
import { StorageErrorBanner } from "@/components/StorageErrorBanner";
import { MoodEntry } from "@/types";
import type { TreatSource } from "@/types";
import type { XpAction } from "@/lib/gamification";
import { generateUuid, getToday } from "@/lib/utils";
import { triggerSync } from "@/storage/cloudSync";
import { syncMood } from "@/storage/realtimeSync";
import { logger } from "@/lib/logger";

interface OverlayLayerProps {
  awardXp: (action: XpAction) => void;
  earnTreats: (
    source: TreatSource,
    baseAmount: number,
    description?: string
  ) => { earned: number; bonus: number; multiplier: number; newBalance: number };
}

const setShowWelcomeOverlay = getModalToggle("showWelcomeOverlay");
const setShowWelcomeBack = getModalToggle("showWelcomeBack");
export const OverlayLayer = memo(function OverlayLayer({ awardXp, earnTreats }: OverlayLayerProps) {
  // UI store — single subscription (was 9 individual)
  const {
    confettiBurst, setConfettiBurst, showWelcomeOverlay,
    featureToUnlock, setFeatureToUnlock, showWelcomeBack, welcomeBackData,
    updateState, setUpdateState,
  } = useUIStore(useShallow((s) => ({
    confettiBurst: s.confettiBurst,
    setConfettiBurst: s.setConfettiBurst,
    showWelcomeOverlay: s.showWelcomeOverlay,
    featureToUnlock: s.featureToUnlock,
    setFeatureToUnlock: s.setFeatureToUnlock,
    showWelcomeBack: s.showWelcomeBack,
    welcomeBackData: s.welcomeBackData,
    updateState: s.updateState,
    setUpdateState: s.setUpdateState,
  })));

  // User data — single subscription (was 4 individual)
  const setMoods = useUserDataStore((s) => s.setMoods);

  return (
    <>
      {/* Confetti burst on habit completion */}
      {confettiBurst && (
        <ConfettiBurst
          x={confettiBurst.x}
          y={confettiBurst.y}
          onComplete={() => setConfettiBurst(null)}
        />
      )}

      {/* App Update Banner - shows when Google Play update is available */}
      {updateState && updateState.available && (
        <UpdatePrompt
          updateState={updateState}
          onDismiss={() => {
            dismissUpdate();
            setUpdateState(null);
          }}
        />
      )}

      {/* Progressive Onboarding - Welcome overlay for new users */}
      {showWelcomeOverlay && <OnboardingOverlay onClose={() => setShowWelcomeOverlay(false)} />}

      {/* Feature Unlock Celebration */}
      {featureToUnlock && (
        <FeatureUnlock feature={featureToUnlock} onClose={() => setFeatureToUnlock(null)} />
      )}

      {/* Re-engagement - Welcome Back Modal (3+ day absence) */}
      {showWelcomeBack && welcomeBackData && (
        <WelcomeBackModal
          daysAway={welcomeBackData.daysAway}
          streakBroken={welcomeBackData.streakBroken}
          currentStreak={welcomeBackData.currentStreak}
          topHabits={welcomeBackData.topHabits}
          onClose={() => setShowWelcomeBack(false)}
          onQuickMoodLog={(mood) => {
            // Quick mood logging from welcome back modal
            const newMood: MoodEntry = {
              id: generateUuid(),
              mood,
              date: getToday(),
              timestamp: Date.now(),
            };
            setMoods((prev) => [...prev, newMood]);
            awardXp("mood");
            earnTreats("mood", 5, "Welcome back mood");
            triggerSync();
            void syncMood(newMood).catch((err) =>
              logger.warn("[WelcomeBack] Mood sync failed:", err)
            );
          }}
        />
      )}

      {/* Storage error banner - shows when localStorage/IndexedDB fails */}
      <StorageErrorBanner />
    </>
  );
});
