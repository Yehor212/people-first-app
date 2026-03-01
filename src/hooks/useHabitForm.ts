import { useState, useCallback } from 'react';
import type { Habit, HabitReminder, HabitCategory, LoopHabitType, TargetType, HabitFrequencyRatio } from '@/types';
import { generateId } from '@/lib/utils';
import { habitTemplates } from '@/lib/habitTemplates';
import { hapticTap } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';

// ============================================
// CONSTANTS (shared with HabitCreationForm)
// ============================================

export const habitIcons = ['💧', '🏃', '📚', '🧘', '💊', '🥗', '😴', '✍️', '🎵', '🌿', '🚭', '🍷', '🇬🇧', '💪', '🧠'];

export const habitCategories: { id: HabitCategory; icon: string; color: string }[] = [
  { id: 'health', icon: '💪', color: 'from-emerald-500 to-teal-500' },
  { id: 'mindfulness', icon: '🧘', color: 'from-violet-500 to-purple-500' },
  { id: 'productivity', icon: '🚀', color: 'from-blue-500 to-cyan-500' },
  { id: 'social', icon: '👥', color: 'from-pink-500 to-rose-500' },
  { id: 'creativity', icon: '🎨', color: 'from-amber-500 to-orange-500' },
  { id: 'finance', icon: '💰', color: 'from-green-500 to-emerald-500' },
  { id: 'self-care', icon: '🌸', color: 'from-fuchsia-500 to-pink-500' },
  { id: 'other', icon: '✨', color: 'from-slate-500 to-gray-500' },
];

/** Frequency presets */
export const frequencyPresets: { label: string; ratio: HabitFrequencyRatio }[] = [
  { label: 'Daily', ratio: { numerator: 1, denominator: 1 } },
  { label: '3x / week', ratio: { numerator: 3, denominator: 7 } },
  { label: '2x / week', ratio: { numerator: 2, denominator: 7 } },
  { label: 'Weekly', ratio: { numerator: 1, denominator: 7 } },
];

// ============================================
// HOOK
// ============================================

interface UseHabitFormOptions {
  onAddHabit: (habit: Habit) => void;
  onUpdateHabit?: (habit: Habit) => void;
}

export function useHabitForm({ onAddHabit, onUpdateHabit }: UseHabitFormOptions) {
  const { language } = useLanguage();

  // Form visibility
  const [isAdding, setIsAdding] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

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
    setReminders([]);
    setIdentityCluster('');
    setIdentityVerb('');
    setIdentityIcon('');
    setEditingHabit(null);
    setIsAdding(false);
    setShowCustomForm(false);
  }, []);

  // Populate form for editing
  const handleEditHabit = useCallback((habit: Habit) => {
    setEditingHabit(habit);
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
    setReminders(habit.reminders || []);
    setIdentityCluster(habit.identityCluster || '');
    setIdentityVerb(habit.identityVerb || '');
    setIdentityIcon(habit.identityIcon || '');
    setIsAdding(true);
    setShowCustomForm(true);
  }, []);

  // Submit: create or update habit
  const handleAddHabit = useCallback(() => {
    if (!newHabitName.trim()) return;

    // Identity fields — only include when user filled them
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
        ...identityFields,
        updatedAt: new Date().toISOString(),
      };
      // Clear identity fields if user removed them
      if (!identityCluster.trim()) delete updatedHabit.identityCluster;
      if (!identityVerb.trim()) delete updatedHabit.identityVerb;
      if (!identityIcon) delete updatedHabit.identityIcon;

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
        ...identityFields,
      };
      onAddHabit(habit);
      void hapticTap();
    }

    resetForm();
  }, [
    newHabitName, editingHabit, onUpdateHabit, onAddHabit, resetForm,
    selectedIcon, selectedColorIndex, selectedCategory,
    habitType, frequency, question, description,
    targetValue, targetType, unit, reminders,
    identityCluster, identityVerb, identityIcon,
  ]);

  // Create habit immediately from template (true quick-add)
  const handleQuickAdd = useCallback((templateId: string) => {
    const template = habitTemplates.find(t => t.id === templateId);
    if (!template) return;

    const name = template.names[language] || template.names.en;
    const colorVal = typeof template.color === 'number' ? template.color : 0;
    const type: LoopHabitType = (template as any).habitType || 'boolean';

    const habit: Habit = {
      id: generateId(),
      name,
      icon: template.icon,
      color: colorVal,
      position: Date.now(),
      createdAt: Date.now(),
      habitType: type,
      frequency: { numerator: 1, denominator: 1 },
      question: '',
      description: '',
      isArchived: false,
      targetValue: 0,
      targetType: 'atLeast',
      unit: '',
      entries: {},
      reminders: [],
      category: (template as any).category || 'health',
    };

    onAddHabit(habit);
    void hapticTap();
    resetForm();
  }, [language, onAddHabit, resetForm]);

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
    value: HabitReminder[K]
  ) => {
    setReminders(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  return {
    // State
    isAdding, showCustomForm, editingHabit,
    newHabitName, selectedIcon, selectedColorIndex, selectedCategory,
    habitType, frequency, question, description,
    targetValue, targetType, unit,
    reminders,
    identityCluster, identityVerb, identityIcon,
    // Setters
    setIsAdding, setShowCustomForm,
    setNewHabitName, setSelectedIcon, setSelectedColorIndex,
    setSelectedCategory,
    setHabitType, setFrequency, setQuestion, setDescription,
    setTargetValue, setTargetType, setUnit,
    setIdentityCluster, setIdentityVerb, setIdentityIcon,
    // Actions
    resetForm, handleEditHabit, handleAddHabit, handleQuickAdd,
    handleAddReminder, handleRemoveReminder, handleReminderChange,
  };
}
