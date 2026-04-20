import { useState, useCallback } from 'react';
import type {
  Habit,
  HabitReminder,
  HabitCategory,
  LoopHabitType,
  TargetType,
  HabitFrequencyRatio,
} from '@/types';
import { generateId } from '@/lib/utils';
import {
  habitTemplates,
  mapTemplateCategoryToHabitCategory,
  resolveHabitTemplateSetup,
} from '@/lib/habitTemplates';
import { hapticTap } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';

// ============================================
// CONSTANTS (shared with HabitCreationForm)
// ============================================

export const habitIcons = ['рџ’§', 'рџЏѓ', 'рџ“љ', 'рџ§', 'рџ’Љ', 'рџҐ—', 'рџґ', 'вњЌпёЏ', 'рџЋµ', 'рџЊї', 'рџљ­', 'рџЌ·', 'рџ—ЈпёЏ', 'рџ’Є', 'рџ§ '];

export const habitCategories: { id: HabitCategory; icon: string; color: string }[] = [
  { id: 'health', icon: 'рџ’Є', color: 'from-emerald-500 to-teal-500' },
  { id: 'mindfulness', icon: 'рџ§', color: 'from-violet-500 to-purple-500' },
  { id: 'productivity', icon: 'рџљЂ', color: 'from-blue-500 to-cyan-500' },
  { id: 'social', icon: 'рџ‘Ґ', color: 'from-pink-500 to-rose-500' },
  { id: 'creativity', icon: 'рџЋЁ', color: 'from-amber-500 to-orange-500' },
  { id: 'finance', icon: 'рџ’°', color: 'from-green-500 to-emerald-500' },
  { id: 'self-care', icon: 'рџЊё', color: 'from-fuchsia-500 to-pink-500' },
  { id: 'other', icon: 'вњЁ', color: 'from-slate-500 to-gray-500' },
];

/** Frequency presets вЂ” i18nKey resolved at render time via ts[key] */
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
  const [frequency, setFrequency] = useState<HabitFrequencyRatio>({ numerator: 1, denominator: 1 });
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');

  // Numerical fields
  const [targetValue, setTargetValue] = useState(1);
  const [targetType, setTargetType] = useState<TargetType>('atLeast');
  const [unit, setUnit] = useState('');
  const [targetStep, setTargetStep] = useState(1);

  // Reminders
  const [reminders, setReminders] = useState<HabitReminder[]>([]);

  // Identity cluster (ZenFlow extension)
  const [identityCluster, setIdentityCluster] = useState('');
  const [identityVerb, setIdentityVerb] = useState('');
  const [identityIcon, setIdentityIcon] = useState('');

  // Reset form to defaults
  const resetForm = useCallback(() => {
    setNewHabitName('');
    setSelectedIcon(habitIcons[0]);
    setSelectedColorIndex(0);
    setSelectedCategory('health');
    setHabitType('boolean');
    setFrequency({ numerator: 1, denominator: 1 });
    setQuestion('');
    setDescription('');
    setTargetValue(1);
    setTargetType('atLeast');
    setUnit('');
    setTargetStep(1);
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
    setFrequency({ numerator: 1, denominator: 1 });
    setQuestion('');
    setDescription('');
    setTargetValue(template.habitType === 'numerical' ? resolved.targetValue : 1);
    setTargetType(resolved.targetType);
    setUnit(template.habitType === 'numerical' ? resolved.unit : '');
    setTargetStep(resolved.targetStep);
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

  // Populate form for editing
  const handleEditHabit = useCallback((habit: Habit) => {
    const template = habit.templateId
      ? habitTemplates.find((item) => item.id === habit.templateId)
      : undefined;
    const resolved = template
      ? resolveHabitTemplateSetup(template, habit.unit || undefined)
      : null;

    setEditingHabit(habit);
    setSelectedTemplateId(habit.templateId || null);
    setNewHabitName(habit.name);
    setSelectedIcon(habit.icon);
    setSelectedColorIndex(habit.color);
    setSelectedCategory(habit.category || 'health');
    setHabitType(habit.habitType || 'boolean');
    setFrequency(habit.frequency || { numerator: 1, denominator: 1 });
    setQuestion(habit.question || '');
    setDescription(habit.description || '');
    setTargetValue(habit.targetValue ?? 1);
    setTargetType(habit.targetType || 'atLeast');
    setUnit(habit.unit || '');
    setTargetStep(resolved?.targetStep ?? 1);
    setReminders(habit.reminders || []);
    setIdentityCluster(habit.identityCluster || '');
    setIdentityVerb(habit.identityVerb || '');
    setIdentityIcon(habit.identityIcon || '');
    setSettingsMode('simple');
    setIsAdding(true);
    setShowCustomForm(true);
  }, []);

  // Submit: create or update habit
  const handleAddHabit = useCallback(() => {
    if (!newHabitName.trim()) return;

    // Identity fields вЂ” only include when user filled them
    const identityFields = {
      ...(identityCluster.trim() && { identityCluster: identityCluster.trim() }),
      ...(identityVerb.trim() && { identityVerb: identityVerb.trim() }),
      ...(identityIcon && { identityIcon }),
    };

    if (editingHabit && onUpdateHabit) {
      const updatedHabit: Habit = {
        ...editingHabit,
        name: newHabitName.trim(),
        icon: selectedIcon,
        color: selectedColorIndex,
        category: selectedCategory,
        habitType,
        frequency,
        question: question.trim(),
        description: description.trim(),
        targetValue: habitType === 'numerical' ? targetValue : 0,
        targetType: habitType === 'numerical' ? targetType : 'atLeast',
        unit: habitType === 'numerical' ? unit.trim() : '',
        reminders,
        templateId: selectedTemplateId || editingHabit.templateId,
        ...identityFields,
        updatedAt: new Date().toISOString(),
      };
      // Clear identity fields if user removed them
      if (!identityCluster.trim()) delete updatedHabit.identityCluster;
      if (!identityVerb.trim()) delete updatedHabit.identityVerb;
      if (!identityIcon) delete updatedHabit.identityIcon;

      // Clear entries when habit type changes вЂ” old values are incompatible
      // Guard: require explicit confirmation to prevent accidental data loss
      if (editingHabit.habitType && editingHabit.habitType !== habitType) {
        const hasEntries = Object.keys(editingHabit.entries || {}).length > 0;
        if (hasEntries && !window.confirm(ts.confirmTypeChangeDeletesHistory || 'Changing the habit type will delete all tracking history. Continue?')) {
          return; // User cancelled вЂ” abort save
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
        position: Date.now(), // new habits at end, will be sorted
        createdAt: Date.now(),
        habitType,
        frequency,
        question: question.trim(),
        description: description.trim(),
        isArchived: false,
        targetValue: habitType === 'numerical' ? targetValue : 0,
        targetType: habitType === 'numerical' ? targetType : 'atLeast',
        unit: habitType === 'numerical' ? unit.trim() : '',
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
    editingHabit,
    onUpdateHabit,
    onAddHabit,
    resetForm,
    selectedIcon,
    selectedColorIndex,
    selectedCategory,
    habitType,
    frequency,
    question,
    description,
    targetValue,
    targetType,
    unit,
    reminders,
    identityCluster,
    identityVerb,
    identityIcon,
    selectedTemplateId,
    ts,
  ]);

  // Template quick-start now opens a lightweight setup pass instead of instantly adding.
  const handleQuickAdd = useCallback((templateId: string) => {
    void hapticTap();
    startFromTemplate(templateId);
  }, [startFromTemplate]);

  // Reminder CRUD
  const handleAddReminder = useCallback(() => {
    setReminders(prev => [...prev, { enabled: true, time: '09:00', days: [1, 2, 3, 4, 5] }]);
  }, []);

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
    // State
    isAdding, showCustomForm, editingHabit, selectedTemplateId, settingsMode,
    newHabitName, selectedIcon, selectedColorIndex, selectedCategory,
    habitType, frequency, question, description,
    targetValue, targetType, unit, targetStep,
    reminders,
    identityCluster, identityVerb, identityIcon,
    // Setters
    setIsAdding, setShowCustomForm, setSettingsMode,
    setNewHabitName, setSelectedIcon, setSelectedColorIndex,
    setSelectedCategory,
    setHabitType, setFrequency, setQuestion, setDescription,
    setTargetValue, setTargetType, setUnit,
    setIdentityCluster, setIdentityVerb, setIdentityIcon,
    // Actions
    resetForm, handleEditHabit, handleAddHabit, handleQuickAdd, handleTemplateUnitChange, startFromTemplate,
    handleAddReminder, handleRemoveReminder, handleReminderChange,
  };
}
