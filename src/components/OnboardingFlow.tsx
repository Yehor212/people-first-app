import { useState, useRef } from 'react';
import { ChevronRight, Sparkles, Check, Timer, Wind, Heart, Target, ListTodo, Trophy, Flower2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFeatureFlags, ToggleableFeature } from '@/contexts/FeatureFlagsContext';
import { cn } from '@/lib/utils';

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
  emoji: string;
  gradient: string;
}

// Floating particles component
function FloatingParticles() {
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full animate-float-particle opacity-30"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            backgroundColor: ['#4a9d7c', '#e8a849', '#6366f1', '#ec4899', '#22c55e'][i % 5],
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${8 + Math.random() * 4}s`,
          }}
        />
      ))}
    </div>
  );
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { t } = useLanguage();
  const { setFlag } = useFeatureFlags();

  // All modules enabled by default
  const [selectedModules, setSelectedModules] = useState<ToggleableFeature[]>([
    'focusTimer',
    'breathingExercise',
    'gratitudeJournal',
    'quests',
    'tasks',
    'challenges',
    'innerWorld',
  ]);
  const [animatingModule, setAnimatingModule] = useState<string | null>(null);

  // Module definitions
  const modules: ModuleItem[] = [
    {
      id: 'focusTimer',
      icon: <Timer className="w-5 h-5" />,
      emoji: '🕐',
      gradient: 'from-orange-500 to-red-500'
    },
    {
      id: 'breathingExercise',
      icon: <Wind className="w-5 h-5" />,
      emoji: '💨',
      gradient: 'from-sky-400 to-blue-500'
    },
    {
      id: 'gratitudeJournal',
      icon: <Heart className="w-5 h-5" />,
      emoji: '❤️',
      gradient: 'from-pink-500 to-rose-500'
    },
    {
      id: 'quests',
      icon: <Target className="w-5 h-5" />,
      emoji: '🎯',
      gradient: 'from-yellow-500 to-amber-500'
    },
    {
      id: 'tasks',
      icon: <ListTodo className="w-5 h-5" />,
      emoji: '📋',
      gradient: 'from-blue-500 to-indigo-500'
    },
    {
      id: 'challenges',
      icon: <Trophy className="w-5 h-5" />,
      emoji: '🏆',
      gradient: 'from-amber-500 to-yellow-600'
    },
    {
      id: 'innerWorld',
      icon: <Flower2 className="w-5 h-5" />,
      emoji: '🌸',
      gradient: 'from-green-500 to-emerald-500'
    },
  ];

  // Get module name translation
  const getModuleName = (id: ToggleableFeature): string => {
    const names: Record<ToggleableFeature, string> = {
      focusTimer: t.moduleFocus || t.settingsModuleFocus || 'Focus Timer',
      breathingExercise: t.moduleBreathing || t.settingsModuleBreathing || 'Breathing',
      gratitudeJournal: t.moduleGratitude || t.settingsModuleGratitude || 'Gratitude',
      quests: t.moduleQuests || t.settingsModuleQuests || 'Quests',
      tasks: t.moduleTasks || t.settingsModuleTasks || 'Tasks',
      challenges: t.moduleChallenges || t.settingsModuleChallenges || 'Challenges',
      innerWorld: t.moduleGarden || t.settingsModuleGarden || 'Garden',
      aiCoach: 'AI Coach', // Not shown
    };
    return names[id];
  };

  // Get module description translation
  const getModuleDesc = (id: ToggleableFeature): string => {
    const descs: Record<ToggleableFeature, string> = {
      focusTimer: t.moduleFocusDesc || t.settingsModuleFocusDesc || 'Pomodoro timer for deep work',
      breathingExercise: t.moduleBreathingDesc || t.settingsModuleBreathingDesc || 'Relaxation techniques',
      gratitudeJournal: t.moduleGratitudeDesc || t.settingsModuleGratitudeDesc || 'Daily gratitude practice',
      quests: t.moduleQuestsDesc || t.settingsModuleQuestsDesc || 'Daily challenges & goals',
      tasks: t.moduleTasksDesc || t.settingsModuleTasksDesc || 'Task management',
      challenges: t.moduleChallengesDesc || t.settingsModuleChallengesDesc || 'Compete with friends',
      innerWorld: t.moduleGardenDesc || t.settingsModuleGardenDesc || 'Virtual companion & garden',
      aiCoach: '', // Not shown
    };
    return descs[id];
  };

  const toggleModule = (moduleId: ToggleableFeature) => {
    setAnimatingModule(moduleId);
    setTimeout(() => setAnimatingModule(null), 400);

    setSelectedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleSkip = () => {
    // Enable all modules by default when skipping
    modules.forEach(m => setFlag(m.id, true));
    onComplete({ skipped: true, modules: modules.map(m => m.id) });
  };

  const transitionLockRef = useRef(false);

  const handleComplete = () => {
    if (transitionLockRef.current) return;
    transitionLockRef.current = true;

    // Save module preferences to feature flags
    modules.forEach(m => {
      setFlag(m.id, selectedModules.includes(m.id));
    });

    onComplete({ modules: selectedModules });
  };

  return (
    <div className="screen-overlay bg-gradient-to-br from-background via-primary/5 to-accent/5 overflow-hidden">
      <FloatingParticles />

      <div className="screen-centered px-3 sm:px-4">
        <div className="w-full max-w-md relative z-10">

          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t.modulesOnboardingTitle || 'Choose Features'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t.modulesOnboardingSubtitle || 'You can change this later in settings'}
            </p>
          </div>

          {/* Modules Grid */}
          <div className="bg-card/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl shadow-primary/10 border border-primary/10">
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
              {modules.map((module, index) => {
                const isSelected = selectedModules.includes(module.id);
                const isAnimating = animatingModule === module.id;

                return (
                  <button
                    key={module.id}
                    onClick={() => toggleModule(module.id)}
                    className={cn(
                      "relative p-4 rounded-xl flex flex-col items-center gap-2 transition-all duration-200 text-center overflow-hidden",
                      isSelected
                        ? `bg-gradient-to-br ${module.gradient} shadow-lg`
                        : "bg-secondary/50 hover:bg-secondary",
                      isAnimating && "animate-selection-pop"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Emoji */}
                    <span className={cn(
                      "text-3xl transition-transform",
                      isSelected && "scale-110"
                    )}>
                      {module.emoji}
                    </span>

                    {/* Name */}
                    <span className={cn(
                      "text-sm font-semibold",
                      isSelected ? "text-white" : "text-foreground"
                    )}>
                      {getModuleName(module.id)}
                    </span>

                    {/* Description */}
                    <span className={cn(
                      "text-[10px] leading-tight",
                      isSelected ? "text-white/80" : "text-muted-foreground"
                    )}>
                      {getModuleDesc(module.id)}
                    </span>

                    {/* Check mark */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/30 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selection count */}
            <div className="mt-4 flex items-center justify-center gap-2 py-2 bg-primary/10 rounded-xl">
              <span className="text-sm font-medium text-primary">
                {selectedModules.length} {t.modulesSelected || 'features selected'}
              </span>
            </div>
          </div>

          {/* Note about core features */}
          <p className="text-xs text-center text-muted-foreground mt-3">
            {t.coreModulesNote || 'Mood Tracker and Habits are always enabled'}
          </p>

          {/* Actions */}
          <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
            <button
              onClick={handleSkip}
              className="flex-1 py-3 sm:py-4 bg-secondary/50 backdrop-blur-sm text-secondary-foreground rounded-xl sm:rounded-2xl font-semibold hover:bg-secondary transition-colors text-sm sm:text-base"
            >
              {t.skip || 'Skip'}
            </button>
            <button
              onClick={handleComplete}
              className="flex-1 py-3 sm:py-4 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl sm:rounded-2xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30 text-sm sm:text-base"
            >
              {t.getStarted || 'Start'}
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
