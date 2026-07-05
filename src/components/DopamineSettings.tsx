import { useState, useEffect, useCallback } from "react";
import { safeJsonParse, safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import {
  Award,
  Brush,
  Flame,
  Lightbulb,
  Moon,
  PartyPopper,
  Scale,
  Sparkles,
  Vibrate,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { SettingToggle } from "@/components/SettingToggle";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";

export interface DopamineSettings {
  intensity: "minimal" | "normal" | "adhd";
  animations: boolean;
  sounds: boolean;
  haptics: boolean;
  confetti: boolean;
  streakFire: boolean;
  moodDrivenUI: boolean;
}

/**
 * Respect OS prefers-reduced-motion as the baseline default (WCAG 2.1 §2.3.3).
 * When the user has NOT explicitly saved feedback settings, the OS preference
 * determines the animations default. Once saved, the user's choice takes over.
 */
function getOSPrefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const DEFAULT_SETTINGS: DopamineSettings = {
  intensity: "normal",
  animations: true,
  sounds: true,
  haptics: false,
  confetti: true,
  streakFire: true,
  moodDrivenUI: true,
};

/** Returns defaults with OS prefers-reduced-motion applied when no user preference is stored */
function getDefaultsWithOSPreference(): DopamineSettings {
  if (getOSPrefersReducedMotion()) {
    return { ...DEFAULT_SETTINGS, animations: false, confetti: false, streakFire: false };
  }
  return DEFAULT_SETTINGS;
}

interface DopamineSettingsProps {
  onClose: () => void;
}

export function DopamineSettingsComponent({ onClose }: DopamineSettingsProps) {
  const { t } = useLanguage();

  const { modalRef, handleKeyDown } = useModalA11y(true, onClose);
  useScrollLock(true);

  const [settings, setSettings] = useState<DopamineSettings>(getDefaultsWithOSPreference);

  // Load feedback settings from localStorage
  useEffect(() => {
    const parsed = safeLocalStorageGet<DopamineSettings | null>(SK.DOPAMINE_SETTINGS, null);
    if (parsed) {
      setSettings({ ...DEFAULT_SETTINGS, ...parsed });
    } else {
      // No stored preference — apply OS prefers-reduced-motion as baseline
      setSettings(getDefaultsWithOSPreference());
    }
  }, []);

  // Save settings to localStorage and dispatch event
  const updateSettings = useCallback((newSettings: Partial<DopamineSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      safeLocalStorageSet(SK.DOPAMINE_SETTINGS, updated);
      // Dispatch custom event for same-tab updates
      window.dispatchEvent(new CustomEvent("dopamine-settings-change", { detail: updated }));
      return updated;
    });
  }, []);

  const handleIntensityChange = useCallback(
    (intensity: DopamineSettings["intensity"]) => {
      if (intensity === "adhd") {
        // High-feedback preset keeps optional effects on.
        updateSettings({
          intensity,
          animations: true,
          sounds: true,
          haptics: true,
          confetti: true,
          streakFire: true,
          moodDrivenUI: true,
        });
      } else if (intensity === "minimal") {
        // Quiet preset reduces sensory load.
        updateSettings({
          intensity,
          animations: false,
          sounds: false,
          haptics: false,
          confetti: false,
          streakFire: false,
          moodDrivenUI: false,
        });
      } else {
        // Balanced preset keeps useful feedback without turning haptics on by default.
        updateSettings({
          intensity,
          animations: true,
          sounds: true,
          haptics: false,
          confetti: true,
          streakFire: true,
          moodDrivenUI: true,
        });
      }
    },
    [updateSettings]
  );

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center bg-background/70 p-3 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)] sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dopamine-settings-title"
        aria-describedby="dopamine-settings-description"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        ref={modalRef}
        onKeyDown={handleKeyDown}
        onTouchEnd={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto scroll-pt-[80px] rounded-[8px] border border-border bg-card shadow-2xl"
          // A11Y-OK: non-interactive container — stopPropagation prevents backdrop-close, outer div has role="dialog"
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-card border-b border-border p-6 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-[8px] border border-primary/20 bg-primary/10 p-2 text-primary">
                  <Sparkles className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="dopamine-settings-title" className="text-xl font-bold">
                    {t.dopamineSettings || "Feedback & motion"}
                  </h2>
                  <p id="dopamine-settings-description" className="text-sm text-muted-foreground">
                    {t.dopamineSettingsDesc ||
                      "Choose how much animation, sound, and haptics ZenFlow uses."}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label={t.close || "Close"}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[8px] text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Intensity Presets */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" aria-hidden="true" />
                {t.dopamineIntensity || "Feedback level"}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleIntensityChange("minimal")}
                  aria-label={t.dopamineMinimal || "Quiet"}
                  aria-pressed={settings.intensity === "minimal"}
                  className={cn(
                    "min-h-[44px] rounded-[8px] p-3 text-sm font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    settings.intensity === "minimal"
                      ? "bg-primary text-primary-foreground zen-shadow"
                      : "bg-muted hover:bg-muted/70"
                  )}
                >
                  <div className="text-center">
                    <Moon className="mx-auto mb-1 h-5 w-5" aria-hidden="true" />
                    <div>{t.dopamineMinimal || "Quiet"}</div>
                  </div>
                </button>

                <button
                  onClick={() => handleIntensityChange("normal")}
                  aria-label={t.dopamineNormal || "Balanced"}
                  aria-pressed={settings.intensity === "normal"}
                  className={cn(
                    "min-h-[44px] rounded-[8px] p-3 text-sm font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    settings.intensity === "normal"
                      ? "bg-primary text-primary-foreground zen-shadow"
                      : "bg-muted hover:bg-muted/70"
                  )}
                >
                  <div className="text-center">
                    <Scale className="mx-auto mb-1 h-5 w-5" aria-hidden="true" />
                    <div>{t.dopamineNormal || "Balanced"}</div>
                  </div>
                </button>

                <button
                  onClick={() => handleIntensityChange("adhd")}
                  aria-label={t.dopamineADHD || "High feedback"}
                  aria-pressed={settings.intensity === "adhd"}
                  className={cn(
                    "min-h-[44px] rounded-[8px] p-3 text-sm font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    settings.intensity === "adhd"
                      ? "bg-primary text-primary-foreground zen-shadow"
                      : "bg-muted hover:bg-muted/70"
                  )}
                >
                  <div className="text-center">
                    <Zap className="mx-auto mb-1 h-5 w-5" aria-hidden="true" />
                    <div>{t.dopamineADHD || "High feedback"}</div>
                  </div>
                </button>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                {settings.intensity === "minimal" &&
                  (t.dopamineMinimalDesc || "Reduced motion and fewer celebration effects.")}
                {settings.intensity === "normal" &&
                  (t.dopamineNormalDesc || "A steady mix of helpful feedback.")}
                {settings.intensity === "adhd" &&
                  (t.dopamineADHDDesc ||
                    "All optional effects are on; you can turn any off below.")}
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Individual Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Award className="w-4 h-4" aria-hidden="true" />
                {t.dopamineCustomize || "Fine-tune feedback"}
              </h3>

              <SettingToggle
                icon={<Sparkles className="w-5 h-5 text-primary" />}
                label={t.dopamineAnimations || "Animations"}
                description={
                  t.dopamineAnimationsDesc || "Motion used for state changes and transitions"
                }
                checked={settings.animations}
                onCheckedChange={(checked) => updateSettings({ animations: checked })}
              />
              <SettingToggle
                icon={
                  settings.sounds ? (
                    <Volume2 className="w-5 h-5 text-primary" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-muted-foreground" />
                  )
                }
                label={t.dopamineSounds || "Sounds"}
                description={t.dopamineSoundsDesc || "Confirmation sounds and audio feedback"}
                checked={settings.sounds}
                onCheckedChange={(checked) => updateSettings({ sounds: checked })}
              />
              <SettingToggle
                icon={<Vibrate className="w-5 h-5 text-primary" data-testid="dopamine-haptics-icon" />}
                label={t.dopamineHaptics || "Haptics"}
                description={t.dopamineHapticsDesc || "Vibration feedback (mobile only)"}
                checked={settings.haptics}
                onCheckedChange={(checked) => updateSettings({ haptics: checked })}
              />
              <SettingToggle
                icon={<PartyPopper className="w-5 h-5 text-primary" />}
                label={t.dopamineConfetti || "Confetti"}
                description={
                  t.dopamineConfettiDesc || "Optional celebration effects after completions"
                }
                checked={settings.confetti}
                onCheckedChange={(checked) => updateSettings({ confetti: checked })}
              />
              <SettingToggle
                icon={<Flame className="w-5 h-5 text-primary" />}
                label={t.dopamineStreakFire || "Streak Fire"}
                description={t.dopamineStreakFireDesc || "Animated streak emphasis"}
                checked={settings.streakFire}
                onCheckedChange={(checked) => updateSettings({ streakFire: checked })}
              />
              <SettingToggle
                icon={<Brush className="w-5 h-5 text-primary" />}
                label={t.dopamineMoodDrivenUI || "Mood Visuals"}
                description={
                  t.dopamineMoodDrivenUIDesc || "Color and atmosphere can follow your mood"
                }
                checked={settings.moodDrivenUI}
                onCheckedChange={(checked) => updateSettings({ moodDrivenUI: checked })}
              />
            </div>

            {/* Info Box */}
            <div className="rounded-[8px] border border-primary/20 bg-primary/5 p-4">
              <div className="flex gap-3">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="text-sm">
                  <div className="font-medium mb-1">{t.dopamineTip || "Comfort note"}</div>
                  <div className="text-muted-foreground">
                    {t.dopamineTipText ||
                      "Start with Quiet if effects feel distracting. Increase feedback only when it helps you stay oriented."}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-card border-t border-border p-4">
            <button
              onClick={onClose}
              aria-label={t.dopamineSave || t.close || "Done"}
              className="flex min-h-[44px] w-full items-center justify-center rounded-[8px] border border-border bg-secondary px-4 py-3 font-medium text-secondary-foreground hover:bg-muted motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t.dopamineSave || t.close || "Done"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Hook to use feedback settings in components
export function useDopamineSettings(): DopamineSettings {
  const [settings, setSettings] = useState<DopamineSettings>(() => {
    // Initialize from localStorage on first render
    if (typeof window !== "undefined") {
      const parsed = safeLocalStorageGet<DopamineSettings | null>(SK.DOPAMINE_SETTINGS, null);
      if (parsed) {
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    }
    // No stored preference — respect OS prefers-reduced-motion as baseline (WCAG 2.1 §2.3.3)
    return getDefaultsWithOSPreference();
  });

  useEffect(() => {
    // Listen for cross-tab storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SK.DOPAMINE_SETTINGS && e.newValue) {
        const parsed = safeJsonParse(e.newValue, DEFAULT_SETTINGS);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    };

    // Listen for same-tab custom event
    const handleCustomChange = (e: CustomEvent<DopamineSettings>) => {
      setSettings(e.detail);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("dopamine-settings-change", handleCustomChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("dopamine-settings-change", handleCustomChange as EventListener);
    };
  }, []);

  return settings;
}
