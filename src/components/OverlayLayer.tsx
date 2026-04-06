import { memo } from "react";
import { useUIStore, useUserDataStore, getModalToggle } from "@/stores";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { ConsentBanner } from "@/components/ConsentBanner";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { dismissUpdate } from "@/lib/appUpdateManager";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { FeatureUnlock } from "@/components/FeatureUnlock";
import { WelcomeBackModal } from "@/components/WelcomeBackModal";
import { StorageErrorBanner } from "@/components/StorageErrorBanner";
import { MoodEntry } from "@/types";
import { generateId, getToday } from "@/lib/utils";
import { triggerSync } from "@/storage/cloudSync";
import { syncMood } from "@/storage/realtimeSync";
import { logger } from "@/lib/logger";

interface OverlayLayerProps {
  awardXp: (activity: string) => void;
  earnTreats: (source: string, amount: number, reason?: string) => { earned: number };
}

const setShowWelcomeOverlay = getModalToggle("showWelcomeOverlay");
const setShowWelcomeBack = getModalToggle("showWelcomeBack");
export const OverlayLayer = memo(function OverlayLayer({ awardXp, earnTreats }: OverlayLayerProps) {
  const confettiBurst = useUIStore((s) => s.confettiBurst);
  const setConfettiBurst = useUIStore((s) => s.setConfettiBurst);
  const showWelcomeOverlay = useUIStore((s) => s.showWelcomeOverlay);
  const featureToUnlock = useUIStore((s) => s.featureToUnlock);
  const setFeatureToUnlock = useUIStore((s) => s.setFeatureToUnlock);
  const showWelcomeBack = useUIStore((s) => s.showWelcomeBack);
  const welcomeBackData = useUIStore((s) => s.welcomeBackData);
  const updateState = useUIStore((s) => s.updateState);
  const setUpdateState = useUIStore((s) => s.setUpdateState);
  const privacy = useUserDataStore((s) => s.privacy);
  const setPrivacy = useUserDataStore((s) => s.setPrivacy);
  const onboardingComplete = useUserDataStore((s) => s.onboardingComplete);
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

      {/* GDPR Consent Banner - shows once after onboarding */}
      {!privacy.consentShown && onboardingComplete && (
        <ConsentBanner
          onConsent={(analyticsAllowed) => {
            setPrivacy({
              ...privacy,
              analytics: analyticsAllowed,
              noTracking: !analyticsAllowed,
              consentShown: true,
            });
          }}
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
              id: generateId(),
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
