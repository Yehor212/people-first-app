import { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  Check,
  Timer,
  Wind,
  Heart,
  Target,
  ClipboardList,
  Trophy,
  Flower2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFeatureFlags, ToggleableFeature } from "@/contexts/FeatureFlagsContext";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

interface OnboardingResult {
  skipped?: boolean;
  modules: ToggleableFeature[];
}

interface OnboardingFlowProps {
  onComplete: (result: OnboardingResult) => void;
}

// Module definition
interface ModuleItem {
  id: ToggleableFeature;
  icon: React.ReactNode;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { t } = useLanguage();
  const { setFlag } = useFeatureFlags();

  // All modules enabled by default
  const [selectedModules, setSelectedModules] = useState<ToggleableFeature[]>([
    "focusTimer",
    "breathingExercise",
    "gratitudeJournal",
    "quests",
    "tasks",
    "challenges",
    "innerWorld",
  ]);
  const [animatingModule, setAnimatingModule] = useState<string | null>(null);
  const [clickAttempts, setClickAttempts] = useState(0);
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fallback: If user clicks multiple times and nothing happens, force complete
  useEffect(() => {
    if (clickAttempts < 3) return;
    logger.log("[OnboardingFlow] Multiple click attempts detected, forcing completion");
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
    }
    completionTimeoutRef.current = setTimeout(() => {
      logger.log("[OnboardingFlow] Force completing onboarding");
      onComplete({ modules: selectedModules });
    }, 1000);
    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }
    };
  }, [clickAttempts, onComplete, selectedModules]);

  useEffect(() => {
    return () => {
      if (animatingTimerRef.current) {
        clearTimeout(animatingTimerRef.current);
        animatingTimerRef.current = null;
      }
      if (lockResetTimeoutRef.current) {
        clearTimeout(lockResetTimeoutRef.current);
        lockResetTimeoutRef.current = null;
      }
    };
  }, []);

  // Module definitions
  const modules: ModuleItem[] = [
    {
      id: "focusTimer",
      icon: <Timer className="w-5 h-5" />,
    },
    {
      id: "breathingExercise",
      icon: <Wind className="w-5 h-5" />,
    },
    {
      id: "gratitudeJournal",
      icon: <Heart className="w-5 h-5" />,
    },
    {
      id: "quests",
      icon: <Target className="w-5 h-5" />,
    },
    {
      id: "tasks",
      icon: <ClipboardList className="w-5 h-5" />,
    },
    {
      id: "challenges",
      icon: <Trophy className="w-5 h-5" />,
    },
    {
      id: "innerWorld",
      icon: <Flower2 className="w-5 h-5" />,
    },
  ];

  // Get module name translation
  const getModuleName = (id: ToggleableFeature): string => {
    const names: Record<ToggleableFeature, string> = {
      focusTimer: t.moduleFocus || t.settingsModuleFocus || "Focus Timer",
      breathingExercise: t.moduleBreathing || t.settingsModuleBreathing || "Breathing",
      gratitudeJournal: t.moduleGratitude || t.settingsModuleGratitude || "Gratitude",
      quests: t.moduleQuests || t.settingsModuleQuests || "Quests",
      tasks: t.moduleTasks || t.settingsModuleTasks || "Tasks",
      challenges: t.moduleChallenges || t.settingsModuleChallenges || "Challenges",
      innerWorld: t.moduleGarden || t.settingsModuleGarden || "Garden",
      aiCoach: "AI Coach", // Not shown
      deltaSync: "Sync",
    };
    return names[id];
  };

  // Get module description translation
  const getModuleDesc = (id: ToggleableFeature): string => {
    const descs: Record<ToggleableFeature, string> = {
      focusTimer: t.moduleFocusDesc || t.settingsModuleFocusDesc || "Pomodoro timer for deep work",
      breathingExercise:
        t.moduleBreathingDesc || t.settingsModuleBreathingDesc || "Relaxation techniques",
      gratitudeJournal:
        t.moduleGratitudeDesc || t.settingsModuleGratitudeDesc || "Daily gratitude practice",
      quests: t.moduleQuestsDesc || t.settingsModuleQuestsDesc || "Daily challenges & goals",
      tasks: t.moduleTasksDesc || t.settingsModuleTasksDesc || "Task management",
      challenges:
        t.moduleChallengesDesc || t.settingsModuleChallengesDesc || "Compete with friends",
      innerWorld: t.moduleGardenDesc || t.settingsModuleGardenDesc || "Virtual companion & garden",
      aiCoach: "", // Not shown
      deltaSync: "Cross-device sync",
    };
    return descs[id];
  };

  const toggleModule = (moduleId: ToggleableFeature) => {
    setAnimatingModule(moduleId);
    if (animatingTimerRef.current) clearTimeout(animatingTimerRef.current);
    animatingTimerRef.current = setTimeout(() => {
      setAnimatingModule(null);
      animatingTimerRef.current = null;
    }, 400);

    setSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    );
  };

  const transitionLockRef = useRef(false);

  const handleSkip = () => {
    logger.log("[OnboardingFlow] handleSkip called, transitionLockRef:", transitionLockRef.current);
    setClickAttempts((prev) => prev + 1);

    if (transitionLockRef.current) {
      logger.log("[OnboardingFlow] handleSkip blocked by transitionLockRef");
      return;
    }
    transitionLockRef.current = true;

    // Safety: reset lock after 2s in case component doesn't unmount
    if (lockResetTimeoutRef.current) clearTimeout(lockResetTimeoutRef.current);
    lockResetTimeoutRef.current = setTimeout(() => {
      transitionLockRef.current = false;
    }, 2000);

    try {
      logger.log("[OnboardingFlow] Skipping without changing feature preferences");
      onComplete({ skipped: true, modules: [] });
      logger.log("[OnboardingFlow] onComplete called successfully");
    } catch (error) {
      logger.error("[OnboardingFlow] Error in handleSkip:", error);
      transitionLockRef.current = false;
      if (lockResetTimeoutRef.current) clearTimeout(lockResetTimeoutRef.current);
    }
  };

  const handleComplete = () => {
    logger.log(
      "[OnboardingFlow] handleComplete called, transitionLockRef:",
      transitionLockRef.current
    );
    setClickAttempts((prev) => prev + 1);

    if (transitionLockRef.current) {
      logger.log("[OnboardingFlow] handleComplete blocked by transitionLockRef");
      return;
    }
    transitionLockRef.current = true;

    // Safety: reset lock after 2s in case component doesn't unmount
    if (lockResetTimeoutRef.current) clearTimeout(lockResetTimeoutRef.current);
    lockResetTimeoutRef.current = setTimeout(() => {
      transitionLockRef.current = false;
    }, 2000);

    try {
      logger.log("[OnboardingFlow] Setting flags for selected modules:", selectedModules);
      modules.forEach((m) => {
        setFlag(m.id, selectedModules.includes(m.id));
      });

      logger.log("[OnboardingFlow] Calling onComplete with modules:", selectedModules);
      onComplete({ modules: selectedModules });
      logger.log("[OnboardingFlow] onComplete called successfully");
    } catch (error) {
      logger.error("[OnboardingFlow] Error in handleComplete:", error);
      transitionLockRef.current = false;
      if (lockResetTimeoutRef.current) clearTimeout(lockResetTimeoutRef.current);
    }
  };

  return (
    <div className="screen-overlay overflow-y-auto overscroll-contain bg-background">
      <div className="flex-1 flex flex-col items-center justify-start pt-6 sm:pt-10 px-3 sm:px-4 pb-4">
        <div className="w-full max-w-md relative z-10">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="break-words text-2xl font-bold text-foreground [hyphens:manual] [overflow-wrap:break-word] mb-2">
              {t.modulesOnboardingTitle || "Choose Features"}
            </h2>
            <p className="break-words text-muted-foreground text-sm [hyphens:manual] [overflow-wrap:break-word]">
              {t.modulesOnboardingSubtitle || "Choose the tools that should appear first"}
            </p>
          </div>

          {/* Modules Grid */}
          <div>
            <div className="grid max-h-[45dvh] grid-cols-[repeat(auto-fit,minmax(min(100%,calc(10rem*var(--font-scale,1))),1fr))] gap-3 overflow-y-auto overscroll-contain pe-1">
              {modules.map((module, index) => {
                const isSelected = selectedModules.includes(module.id);
                const isAnimating = animatingModule === module.id;

                return (
                  <button
                    key={module.id}
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={getModuleName(module.id)}
                    onClick={() => toggleModule(module.id)}
                    className={cn(
                      "relative flex h-auto min-h-12 min-w-0 flex-col items-center gap-2 overflow-hidden rounded-xl border p-4 text-center text-foreground motion-safe:transition-colors motion-safe:duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-muted",
                      isAnimating && "motion-safe:animate-selection-pop"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Module identity */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-8 w-8 items-center justify-center motion-safe:transition-transform",
                        isSelected ? "scale-110 text-primary" : "text-muted-foreground",
                      )}
                    >
                      {module.icon}
                    </span>

                    {/* Name */}
                    <span
                      className="min-w-0 whitespace-normal break-words text-sm font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word]"
                    >
                      {getModuleName(module.id)}
                    </span>

                    {/* Description */}
                    <span className="min-w-0 whitespace-normal break-words text-xs leading-relaxed text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
                      {getModuleDesc(module.id)}
                    </span>

                    {/* Check mark */}
                    {isSelected && (
                      <div className="absolute end-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selection count */}
            <div className="mt-4 flex items-center justify-center gap-2 py-1">
              <span aria-live="polite" className="min-w-0 break-words text-center text-sm font-medium text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
                {selectedModules.length} {t.modulesSelected || "features selected"}
              </span>
            </div>
          </div>

          {/* Note about core features */}
          <p className="break-words text-xs text-center text-muted-foreground [hyphens:manual] [overflow-wrap:break-word] mt-3">
            {t.coreModulesNote || "Mood Tracker and Habits are always enabled"}
          </p>

          {/* Actions */}
          <div className="mt-4 flex flex-col gap-2 pb-[calc(0.5rem+var(--safe-bottom))] sm:mt-6 sm:flex-row sm:gap-3">
            <button
              type="button"
              onClick={() => {
                logger.log("[OnboardingFlow] Skip button clicked");
                handleSkip();
              }}
              className="h-auto min-h-12 w-full min-w-0 flex-1 whitespace-normal break-words rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:transition-colors sm:rounded-2xl sm:py-4 sm:text-base"
            >
              {t.skip || "Skip"}
            </button>
            <button
              type="button"
              onClick={() => {
                logger.log("[OnboardingFlow] Start button clicked");
                handleComplete();
              }}
              className="flex h-auto min-h-12 w-full min-w-0 flex-1 items-center justify-center gap-2 whitespace-normal break-words rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground [hyphens:manual] [overflow-wrap:break-word] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:transition-colors sm:rounded-2xl sm:py-4 sm:text-base"
            >
              {t.getStarted || "Start"}
              <ChevronRight className="h-4 w-4 shrink-0 rtl:scale-x-[-1] sm:h-5 sm:w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
