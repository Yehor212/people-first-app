import { useState, useEffect, useCallback } from "react";
import { safeJsonParse, safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { Volume2, VolumeX, Sparkles, Zap, Award, Music } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { SettingToggle } from "@/components/SettingToggle";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useBackHandler } from "@/hooks/useBackHandler";

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
 * When the user has NOT explicitly saved dopamine settings, the OS preference
 * determines the animations default. Once saved, the user's choice takes over.
 */
function getOSPrefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
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

  useModalA11y(true, onClose);
  useScrollLock(true);
  useBackHandler(true, onClose);

  const [settings, setSettings] = useState<DopamineSettings>(getDefaultsWithOSPreference);

  // Load settings from localStorage
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
        // ADHD mode = EVERYTHING ON!
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
        // Minimal mode = quiet experience
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
        // Normal mode = balanced
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
      {/* Desktop backdrop */}
      <div
        className="hidden md:block fixed inset-0 z-[59] bg-black/50 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 md:mx-auto md:my-6 md:max-w-lg md:rounded-2xl md:shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dopamine-settings-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        onTouchEnd={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
      <div
        className="bg-card rounded-2xl shadow-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto scroll-pt-[80px]"
        // A11Y-OK: non-interactive container — stopPropagation prevents backdrop-close, outer div has role="dialog"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 zen-gradient rounded-xl">
                <Sparkles className="w-6 h-6 text-white" aria-hidden="true" />
              </div>
              <div>
                <h2 id="dopamine-settings-title" className="text-xl font-bold">
                  {t.dopamineSettings || "Dopamine Dashboard"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t.dopamineSettingsDesc || "Customize your feedback experience"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label={t.close || "Close"}
              className="p-2 hover:bg-muted rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Intensity Presets */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" aria-hidden="true" />
              {t.dopamineIntensity || "Intensity Level"}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleIntensityChange("minimal")}
                aria-label={t.dopamineMinimal || "Minimal"}
                aria-pressed={settings.intensity === "minimal"}
                className={cn(
                  "p-3 rounded-xl text-sm font-medium transition-all",
                  settings.intensity === "minimal"
                    ? "bg-primary text-primary-foreground zen-shadow"
                    : "bg-muted hover:bg-muted/70"
                )}
              >
                <div className="text-center">
                  <div className="text-lg mb-1">🌙</div>
                  <div>{t.dopamineMinimal || "Minimal"}</div>
                </div>
              </button>

              <button
                onClick={() => handleIntensityChange("normal")}
                aria-label={t.dopamineNormal || "Normal"}
                aria-pressed={settings.intensity === "normal"}
                className={cn(
                  "p-3 rounded-xl text-sm font-medium transition-all",
                  settings.intensity === "normal"
                    ? "bg-primary text-primary-foreground zen-shadow"
                    : "bg-muted hover:bg-muted/70"
                )}
              >
                <div className="text-center">
                  <div className="text-lg mb-1">⚖️</div>
                  <div>{t.dopamineNormal || "Normal"}</div>
                </div>
              </button>

              <button
                onClick={() => handleIntensityChange("adhd")}
                aria-label={t.dopamineADHD || "ADHD"}
                aria-pressed={settings.intensity === "adhd"}
                className={cn(
                  "p-3 rounded-xl text-sm font-medium transition-all",
                  settings.intensity === "adhd"
                    ? "zen-gradient text-white zen-shadow-xl"
                    : "bg-muted hover:bg-muted/70"
                )}
              >
                <div className="text-center">
                  <div className="text-lg mb-1">🚀</div>
                  <div>{t.dopamineADHD || "ADHD"}</div>
                </div>
              </button>
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              {settings.intensity === "minimal" &&
                (t.dopamineMinimalDesc || "Quiet, distraction-free experience")}
              {settings.intensity === "normal" &&
                (t.dopamineNormalDesc || "Balanced feedback and motivation")}
              {settings.intensity === "adhd" &&
                (t.dopamineADHDDesc || "Maximum dopamine! All effects enabled 🎉")}
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Individual Settings */}
          <div className="space-y-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Award className="w-4 h-4" aria-hidden="true" />
              {t.dopamineCustomize || "Fine-tune Settings"}
            </h3>

            <SettingToggle
              icon={<Sparkles className="w-5 h-5 text-primary" />}
              label={t.dopamineAnimations || "Animations"}
              description={t.dopamineAnimationsDesc || "Smooth transitions and effects"}
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
              description={t.dopamineSoundsDesc || "Success sounds and audio feedback"}
              checked={settings.sounds}
              onCheckedChange={(checked) => updateSettings({ sounds: checked })}
            />
            <SettingToggle
              icon={<Music className="w-5 h-5 text-primary" />}
              label={t.dopamineHaptics || "Haptics"}
              description={t.dopamineHapticsDesc || "Vibration feedback (mobile only)"}
              checked={settings.haptics}
              onCheckedChange={(checked) => updateSettings({ haptics: checked })}
            />
            <SettingToggle
              icon={<span className="text-lg leading-none">🎉</span>}
              label={t.dopamineConfetti || "Confetti"}
              description={t.dopamineConfettiDesc || "Celebrate habit completions"}
              checked={settings.confetti}
              onCheckedChange={(checked) => updateSettings({ confetti: checked })}
            />
            <SettingToggle
              icon={<span className="text-lg leading-none">🔥</span>}
              label={t.dopamineStreakFire || "Streak Fire"}
              description={t.dopamineStreakFireDesc || "Animated fire for streaks"}
              checked={settings.streakFire}
              onCheckedChange={(checked) => updateSettings({ streakFire: checked })}
            />
            <SettingToggle
              icon={<span className="text-lg leading-none">🎨</span>}
              label={t.dopamineMoodDrivenUI || "Mood Visuals"}
              description={t.dopamineMoodDrivenUIDesc || "UI adapts to your mood"}
              checked={settings.moodDrivenUI}
              onCheckedChange={(checked) => updateSettings({ moodDrivenUI: checked })}
            />
          </div>

          {/* Info Box */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex gap-3">
              <div className="text-2xl">💡</div>
              <div className="text-sm">
                <div className="font-medium mb-1">{t.dopamineTip || "ADHD Tip"}</div>
                <div className="text-muted-foreground">
                  {t.dopamineTipText ||
                    "ADHD brains need more dopamine! Try ADHD mode for maximum motivation and feedback. You can always adjust individual settings."}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border p-4">
          <button
            onClick={onClose}
            aria-label={t.dopamineSave || "Save & Close"}
            className="w-full py-3 zen-gradient text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            {t.dopamineSave || "Save & Close"}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

// Hook to use dopamine settings in components
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
