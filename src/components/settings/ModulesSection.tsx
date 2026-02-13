import { Timer, Wind, Heart, Target, ListTodo, Trophy, Flower2, LayoutGrid } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { FeatureToggleItem } from '@/components/FeatureToggleItem';
import { isFeatureUnlocked } from '@/lib/onboardingFlow';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function ModulesSection() {
  const { t } = useLanguage();
  const { setFlag, isFeatureEnabled } = useFeatureFlags();

  return (
    <AccordionItem value="modules" className="bg-card rounded-2xl shadow-zen-sm border overflow-hidden">
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="p-2 zen-gradient-calm rounded-xl shadow-[0_4px_20px_-4px_hsl(200_40%_50%/0.25)]">
            <LayoutGrid className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">{t.settingsGroupModules}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-6 pb-6">
        <p className="text-xs text-muted-foreground mb-4">{t.settingsModulesDescription}</p>
        <div className="space-y-1 divide-y divide-border/50">
          {/* Core modules - always enabled */}
          <FeatureToggleItem
            icon={<span className="text-base">😊</span>}
            title={t.settingsModuleMood}
            description={t.settingsModuleMoodDesc}
            enabled={true}
            onToggle={() => {}}
            isCore={true}
          />
          <FeatureToggleItem
            icon={<span className="text-base">✅</span>}
            title={t.settingsModuleHabits}
            description={t.settingsModuleHabitsDesc}
            enabled={true}
            onToggle={() => {}}
            isCore={true}
          />

          {/* Toggleable modules */}
          <FeatureToggleItem
            icon={<Timer className="w-4 h-4 text-orange-500" />}
            title={t.settingsModuleFocus}
            description={t.settingsModuleFocusDesc}
            enabled={isFeatureEnabled('focusTimer')}
            onToggle={(enabled) => setFlag('focusTimer', enabled)}
            isLocked={!isFeatureUnlocked('focusTimer')}
            lockedMessage={t.settingsModuleUnlockHint}
          />
          <FeatureToggleItem
            icon={<Wind className="w-4 h-4 text-sky-500" />}
            title={t.settingsModuleBreathing}
            description={t.settingsModuleBreathingDesc}
            enabled={isFeatureEnabled('breathingExercise')}
            onToggle={(enabled) => setFlag('breathingExercise', enabled)}
          />
          <FeatureToggleItem
            icon={<Heart className="w-4 h-4 text-pink-500" />}
            title={t.settingsModuleGratitude}
            description={t.settingsModuleGratitudeDesc}
            enabled={isFeatureEnabled('gratitudeJournal')}
            onToggle={(enabled) => setFlag('gratitudeJournal', enabled)}
          />
          <FeatureToggleItem
            icon={<Target className="w-4 h-4 text-yellow-500" />}
            title={t.settingsModuleQuests}
            description={t.settingsModuleQuestsDesc}
            enabled={isFeatureEnabled('quests')}
            onToggle={(enabled) => setFlag('quests', enabled)}
            isLocked={!isFeatureUnlocked('quests')}
            lockedMessage={t.settingsModuleUnlockHint}
          />
          <FeatureToggleItem
            icon={<ListTodo className="w-4 h-4 text-blue-500" />}
            title={t.settingsModuleTasks}
            description={t.settingsModuleTasksDesc}
            enabled={isFeatureEnabled('tasks')}
            onToggle={(enabled) => setFlag('tasks', enabled)}
            isLocked={!isFeatureUnlocked('tasks')}
            lockedMessage={t.settingsModuleUnlockHint}
          />
          <FeatureToggleItem
            icon={<Trophy className="w-4 h-4 text-amber-500" />}
            title={t.settingsModuleChallenges}
            description={t.settingsModuleChallengesDesc}
            enabled={isFeatureEnabled('challenges')}
            onToggle={(enabled) => setFlag('challenges', enabled)}
            isLocked={!isFeatureUnlocked('challenges')}
            lockedMessage={t.settingsModuleUnlockHint}
          />
          <FeatureToggleItem
            icon={<Flower2 className="w-4 h-4 text-green-500" />}
            title={t.settingsModuleGarden}
            description={t.settingsModuleGardenDesc}
            enabled={isFeatureEnabled('innerWorld')}
            onToggle={(enabled) => setFlag('innerWorld', enabled)}
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
