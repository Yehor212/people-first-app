import { useState, useCallback } from 'react';
import type {
  Habit,
  HabitReminder,
  HabitCategory,
  HabitNumericalEntryMode,
  LoopHabitType,
  TargetType,
  HabitFrequencyRatio,
  HabitScheduleMode,
} from '@/types';
import { generateId, getToday } from '@/lib/utils';
import {
  habitTemplates,
  mapTemplateCategoryToHabitCategory,
  resolveHabitTemplateSetup,
} from '@/lib/habitTemplates';
import {
  getNumericalAdjustmentStep,
  resolveNumericalEntryMode,
} from '@/lib/habitNumericalInteraction';
import { calculateHabitEndDate } from '@/lib/habitPlan';
import {
  createHabitSchedule,
  getDefaultReminderDaysForSchedule,
  getFrequencyFromSchedule,
  getSuggestedDueDays,
  getWeeklyTargetCountFromFrequency,
  isDailyFrequency,
  normalizeDueDays,
  normalizeHabitSchedule,
} from '@/lib/habitScheduling';
import { hapticTap } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';

// ============================================
// CONSTANTS (shared with HabitCreationForm)
// ============================================

export const habitIcons = ['💧', '🏃', '📚', '🧘', '💊', '🥗', '😴', '✌️', '🎵', '🌿', '🚭', '🍷', '🗣️', '💪', '🧠'];

export const habitCategories: { id: HabitCategory; icon: string; color: string }[] = [
  { id: 'health', icon: '💪', color: 'from-emerald-500 to-teal-500' },
  { id: 'mindfulness', icon: '🧘', color: 'from-violet-500 to-purple-500' },
  { id: 'productivity', icon: '🎯', color: 'from-blue-500 to-cyan-500' },
  { id: 'social', icon: '👥', color: 'from-pink-500 to-rose-500' },
  { id: 'creativity', icon: '🎨', color: 'from-amber-500 to-orange-500' },
  { id: 'finance', icon: '💰', color: 'from-green-500 to-emerald-500' },
  { id: 'self-care', icon: '🛀', color: 'from-fuchsia-500 to-pink-500' },
  { id: 'other', icon: '✦', color: 'from-slate-500 to-gray-500' },
];

/** Frequency presets — i18nKey resolved at render time via ts[key] */
export const frequencyPresets: { label: string; i18nKey: string; ratio: HabitFrequencyRatio }[] = [
  { label: 'Daily', i18nKey: 'habitFrequencyDaily', ratio: { numerator: 1, denominator: 1 } },
  { label: '3x / week', i18nKey: 'habitFrequency3xWeek', ratio: { numerator: 3, denominator: 7 } },
  { label: '2x / week', i18nKey: 'habitFrequency2xWeek', ratio: { numerator: 2, denominator: 7 } },
  { label: 'Weekly', i18nKey: 'habitFrequencyWeekly', ratio: { numerator: 1, denominator: 7 } },
];

// ============================================
// HOOK
// ============================================

interface UseHabitFormOptions {
  onAddHabit: (habit: Habit) => void;
  onUpdateHabit?: (habit: Habit) => void;
}

export function useHabitForm({ onAddHabit, onUpdateHabit }: UseHabitFormOptions) {
  const { language, t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  // Form visibility
  const [isAdding, setIsAdding] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [settingsMode, setSettingsMode] = useState<'simple' | 'advanced'>('simple');

  // Core fields
  const [newHabitName, setNewHabitName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(habitIcons[0]);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<HabitCategory>('health');

  // Loop fields
  const [habitType, setHabitType] = useState<LoopHabitType>('boolean');
  const [frequency, setFrequencyState] = useState<HabitFrequencyRatio>({ numerator: 1, denominator: 1 });
  const [scheduleMode, setScheduleMode] = useState<HabitScheduleMode>('daily');
  const [scheduleDueDays, setScheduleDueDays] = useState<number[]>([]);
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');

  // Numerical fields
  const [targetValue, setTargetValue] = useState(1);
  const [targetType, setTargetType] = useState<TargetType>('atLeast');
  const [unit, setUnit] = useState('');
  const [targetStep, setTargetStep] = useState(1);
  const [quickEntryMode, setQuickEntryMode] =
    useState<HabitNumericalEntryMode>('completeTarget');

  // Optional program window
  const [hasDurationLimit, setHasDurationLimit] = useState(false);
  const [durationDays, setDurationDays] = useState(30);

  // Reminders
  const [reminders, setReminders] = useState<HabitReminder[]>([]);

  // Identity cluster (ZenFlow extension)
  const [identityCluster, setIdentityCluster] = useState('');
  const [identityVerb, setIdentityVerb] = useState('');
  const [identityIcon, setIdentityIcon] = useState('');

  const resetForm = useCallback(() => {
    setNewHabitName('');
    setSelectedIcon(habitIcons[0]);
    setSelectedColorIndex(0);
    setSelectedCategory('health');
    setHabitType('boolean');
    setFrequencyState({ numerator: 1, denominator: 1 });
    setScheduleMode('daily');
    setScheduleDueDays([]);
    setQuestion('');
    setDescription('');
    setTargetValue(1);
    setTargetType('atLeast');
    setUnit('');
    setTargetStep(1);
    setQuickEntryMode('completeTarget');
    setHasDurationLimit(false);
    setDurationDays(30);
    setReminders([]);
    setIdentityCluster('');
    setIdentityVerb('');
    setIdentityIcon('');
    setEditingHabit(null);
    setSelectedTemplateId(null);
    setSettingsMode('simple');
    setIsAdding(false);
    setShowCustomForm(false);
  }, []);

  const syncReminderDays = useCallback((
    nextFrequency: HabitFrequencyRatio,
    nextMode: HabitScheduleMode,
    nextDueDays: number[],
  ) => {
    const nextDays = getDefaultReminderDaysForSchedule(nextFrequency, nextMode, nextDueDays);
    setReminders((prev) =>
      prev.map((reminder) => ({
        ...reminder,
        days: nextDays,
      })),
    );
  }, []);

  const handleFrequencyChange = useCallback((nextFrequency: HabitFrequencyRatio) => {
    setFrequencyState(nextFrequency);
    if (isDailyFrequency(nextFrequency)) {
      setScheduleMode('daily');
      setScheduleDueDays([]);
      syncReminderDays(nextFrequency, 'daily', []);
      return;
    }

    const nextTargetCount = getWeeklyTargetCountFromFrequency(nextFrequency);
    setScheduleMode((currentMode) => {
      const nextMode = currentMode === 'specificDays' ? 'specificDays' : 'flexiblePerPeriod';
      setScheduleDueDays((currentDays) => {
        const nextDays =
          nextMode === 'specificDays'
            ? normalizeDueDays(currentDays).slice(0, nextTargetCount)
            : currentDays;
        const effectiveDays =
          nextMode === 'specificDays' && nextDays.length === 0
            ? getSuggestedDueDays(nextTargetCount)
            : nextDays;
        syncReminderDays(nextFrequency, nextMode, effectiveDays);
        return effectiveDays;
      });
      return nextMode;
    });
  }, [syncReminderDays]);

  const handleScheduleModeChange = useCallback((nextMode: HabitScheduleMode) => {
    if (nextMode === 'daily') {
      handleFrequencyChange({ numerator: 1, denominator: 1 });
      return;
    }

    const normalizedMode: HabitScheduleMode = nextMode === 'specificDays'
      ? 'specificDays'
      : 'flexiblePerPeriod';
    const targetCount = getWeeklyTargetCountFromFrequency(frequency);
    const nextDueDays =
      normalizedMode === 'specificDays'
        ? (scheduleDueDays.length > 0 ? normalizeDueDays(scheduleDueDays) : getSuggestedDueDays(targetCount))
        : scheduleDueDays;
    setScheduleMode(normalizedMode);
    setScheduleDueDays(nextDueDays);
    syncReminderDays(frequency, normalizedMode, nextDueDays);
  }, [frequency, handleFrequencyChange, scheduleDueDays, syncReminderDays]);

  const handleScheduleDueDaysChange = useCallback((nextDays: number[]) => {
    const normalizedDays = normalizeDueDays(nextDays);
    setScheduleDueDays(normalizedDays);
    syncReminderDays(frequency, scheduleMode, normalizedDays);
  }, [frequency, scheduleMode, syncReminderDays]);

  const handleTemplateUnitChange = useCallback((nextUnit: string) => {
    setUnit(nextUnit);
    const template = selectedTemplateId
      ? habitTemplates.find((item) => item.id === selectedTemplateId)
      : undefined;
    if (!template) return;
    const resolved = resolveHabitTemplateSetup(template, nextUnit);
    setTargetValue(resolved.targetValue);
    setTargetType(resolved.targetType);
    setTargetStep(resolved.targetStep);
    setQuickEntryMode(resolved.quickEntryMode);
  }, [selectedTemplateId]);

  const startFromTemplate = useCallback((templateId: string) => {
    const template = habitTemplates.find((item) => item.id === templateId);
    if (!template) return;

    const name = template.names[language] || template.names.en;
    const resolved = resolveHabitTemplateSetup(template);

    setSelectedTemplateId(template.id);
    setEditingHabit(null);
    setNewHabitName(name);
    setSelectedIcon(template.icon);
    setSelectedColorIndex(template.color);
    setSelectedCategory(mapTemplateCategoryToHabitCategory(template.category));
    setHabitType(template.habitType || 'boolean');
    setFrequencyState({ numerator: 1, denominator: 1 });
    setScheduleMode('daily');
    setScheduleDueDays([]);
    setQuestion('');
    setDescription('');
    setTargetValue(template.habitType === 'numerical' ? resolved.targetValue : 1);
    setTargetType(resolved.targetType);
    setUnit(template.habitType === 'numerical' ? resolved.unit : '');
    setTargetStep(resolved.targetStep);
    setQuickEntryMode(resolved.quickEntryMode);
    setHasDurationLimit(false);
    setDurationDays(30);
    setReminders(
      template.defaultTime
        ? [{ enabled: true, time: template.defaultTime, days: [0, 1, 2, 3, 4, 5, 6] }]
        : [],
    );
    setIdentityCluster('');
    setIdentityVerb('');
    setIdentityIcon('');
    setSettingsMode('simple');
    setIsAdding(true);
    setShowCustomForm(true);
  }, [language]);

  const handleEditHabit = useCallback((habit: Habit) => {
    const template = habit.templateId
      ? habitTemplates.find((item) => item.id === habit.templateId)
      : undefined;
    const resolved = template
      ? resolveHabitTemplateSetup(template, habit.unit || undefined)
      : null;
    const resolvedSchedule = normalizeHabitSchedule(habit);

    setEditingHabit(habit);
    setSelectedTemplateId(habit.templateId || null);
    setNewHabitName(habit.name);
    setSelectedIcon(habit.icon);
    setSelectedColorIndex(habit.color);
    setSelectedCategory(habit.category || 'health');
    setHabitType(habit.habitType || 'boolean');
    setFrequencyState(habit.schedule ? getFrequencyFromSchedule(resolvedSchedule) : (habit.frequency || { numerator: 1, denominator: 1 }));
    setScheduleMode(resolvedSchedule.mode);
    setScheduleDueDays(normalizeDueDays(resolvedSchedule.dueDays));
    setQuestion(habit.question || '');
    setDescription(habit.description || '');
    setTargetValue(habit.targetValue ?? 1);
    setTargetType(habit.targetType || 'atLeast');
    setUnit(habit.unit || '');
    setTargetStep(
      habit.habitType === 'numerical'
        ? getNumericalAdjustmentStep(habit)
        : (resolved?.targetStep ?? 1),
    );
    setQuickEntryMode(
      habit.habitType === 'numerical'
        ? resolveNumericalEntryMode(habit)
        : (resolved?.quickEntryMode ?? 'completeTarget'),
    );
    setHasDurationLimit(Boolean(habit.durationDays));
    setDurationDays(habit.durationDays || 30);
    setReminders(habit.reminders || []);
    setIdentityCluster(habit.identityCluster || '');
    setIdentityVerb(habit.identityVerb || '');
    setIdentityIcon(habit.identityIcon || '');
    setSettingsMode('simple');
    setIsAdding(true);
    setShowCustomForm(true);
  }, []);

  const handleAddHabit = useCallback(() => {
    if (!newHabitName.trim()) return;

    const normalizedDurationDays = hasDurationLimit
      ? Math.max(1, Math.round(durationDays || 1))
      : undefined;
    const planStartDate = normalizedDurationDays
      ? (
          editingHabit?.durationDays && editingHabit.startDate
            ? editingHabit.startDate
            : getToday()
        )
      : undefined;
    const planEndDate = normalizedDurationDays && planStartDate
      ? calculateHabitEndDate(planStartDate, normalizedDurationDays)
      : undefined;

    const identityFields = {
      ...(identityCluster.trim() && { identityCluster: identityCluster.trim() }),
      ...(identityVerb.trim() && { identityVerb: identityVerb.trim() }),
      ...(identityIcon && { identityIcon }),
    };
    const habitSchedule = createHabitSchedule(frequency, scheduleMode, scheduleDueDays);
    const persistedFrequency = getFrequencyFromSchedule(habitSchedule);

    if (editingHabit && onUpdateHabit) {
      const updatedHabit: Habit = {
        ...editingHabit,
        name: newHabitName.trim(),
        icon: selectedIcon,
        color: selectedColorIndex,
        category: selectedCategory,
        habitType,
        frequency: persistedFrequency,
        schedule: habitSchedule,
        question: question.trim(),
        description: description.trim(),
        targetValue: habitType === 'numerical' ? targetValue : 0,
        targetType: habitType === 'numerical' ? targetType : 'atLeast',
        unit: habitType === 'numerical' ? unit.trim() : '',
        targetStep: habitType === 'numerical' ? targetStep : undefined,
        quickEntryMode: habitType === 'numerical' ? quickEntryMode : undefined,
        durationDays: normalizedDurationDays,
        startDate: planStartDate,
        endDate: planEndDate,
        reminders,
        templateId: selectedTemplateId || editingHabit.templateId,
        ...identityFields,
        updatedAt: new Date().toISOString(),
      };

      if (!identityCluster.trim()) delete updatedHabit.identityCluster;
      if (!identityVerb.trim()) delete updatedHabit.identityVerb;
      if (!identityIcon) delete updatedHabit.identityIcon;

      if (editingHabit.habitType && editingHabit.habitType !== habitType) {
        const hasEntries = Object.keys(editingHabit.entries || {}).length > 0;
        if (hasEntries && !window.confirm(ts.confirmTypeChangeDeletesHistory || 'Changing the habit type will delete all tracking history. Continue?')) {
          return;
        }
        updatedHabit.entries = {};
      }

      onUpdateHabit(updatedHabit);
    } else {
      const habit: Habit = {
        id: generateId(),
        name: newHabitName.trim(),
        icon: selectedIcon,
        color: selectedColorIndex,
        position: Date.now(),
        createdAt: Date.now(),
        habitType,
        frequency: persistedFrequency,
        schedule: habitSchedule,
        question: question.trim(),
        description: description.trim(),
        isArchived: false,
        targetValue: habitType === 'numerical' ? targetValue : 0,
        targetType: habitType === 'numerical' ? targetType : 'atLeast',
        unit: habitType === 'numerical' ? unit.trim() : '',
        ...(habitType === 'numerical' ? { targetStep } : {}),
        ...(habitType === 'numerical' ? { quickEntryMode } : {}),
        ...(normalizedDurationDays
          ? {
              durationDays: normalizedDurationDays,
              startDate: planStartDate,
              endDate: planEndDate,
            }
          : {}),
        entries: {},
        reminders,
        category: selectedCategory,
        ...(selectedTemplateId && { templateId: selectedTemplateId }),
        ...identityFields,
      };
      onAddHabit(habit);
      void hapticTap();
    }

    resetForm();
  }, [
    newHabitName,
    hasDurationLimit,
    durationDays,
    editingHabit,
    onUpdateHabit,
    onAddHabit,
    resetForm,
    selectedIcon,
    selectedColorIndex,
    selectedCategory,
    habitType,
    frequency,
    scheduleMode,
    scheduleDueDays,
    question,
    description,
    targetValue,
    targetType,
    unit,
    targetStep,
    quickEntryMode,
    reminders,
    identityCluster,
    identityVerb,
    identityIcon,
    selectedTemplateId,
    ts,
  ]);

  const handleQuickAdd = useCallback((templateId: string) => {
    void hapticTap();
    startFromTemplate(templateId);
  }, [startFromTemplate]);

  const handleAddReminder = useCallback(() => {
    const days = getDefaultReminderDaysForSchedule(frequency, scheduleMode, scheduleDueDays);
    setReminders(prev => [...prev, { enabled: true, time: '09:00', days }]);
  }, [frequency, scheduleDueDays, scheduleMode]);

  const handleRemoveReminder = useCallback((index: number) => {
    setReminders(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleReminderChange = useCallback(<K extends keyof HabitReminder>(
    index: number,
    field: K,
    value: HabitReminder[K],
  ) => {
    setReminders(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  return {
    isAdding, showCustomForm, editingHabit, selectedTemplateId, settingsMode,
    newHabitName, selectedIcon, selectedColorIndex, selectedCategory,
    habitType, frequency, scheduleMode, scheduleDueDays, question, description,
    targetValue, targetType, unit, targetStep, quickEntryMode,
    hasDurationLimit, durationDays,
    reminders,
    identityCluster, identityVerb, identityIcon,
    setIsAdding, setShowCustomForm, setSettingsMode,
    setNewHabitName, setSelectedIcon, setSelectedColorIndex,
    setSelectedCategory,
    setHabitType, setFrequency: handleFrequencyChange, setScheduleMode: handleScheduleModeChange, setScheduleDueDays: handleScheduleDueDaysChange, setQuestion, setDescription,
    setTargetValue, setTargetType, setUnit, setQuickEntryMode,
    setHasDurationLimit, setDurationDays,
    setIdentityCluster, setIdentityVerb, setIdentityIcon,
    resetForm, handleEditHabit, handleAddHabit, handleQuickAdd, handleTemplateUnitChange, startFromTemplate,
    handleAddReminder, handleRemoveReminder, handleReminderChange,
  };
}
