import { useState, useCallback } from 'react';
import { Habit, HabitType, HabitReminder, HabitFrequency, HabitCategory } from '@/types';
import { getToday, generateId } from '@/lib/utils';
import { habitTemplates } from '@/lib/habitTemplates';
import { hapticTap } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';

// ============================================
// CONSTANTS (shared with HabitCreationForm)
// ============================================

export const habitIcons = ['💧', '🏃', '📚', '🧘', '💊', '🥗', '😴', '✍️', '🎵', '🌿', '🚭', '🍷', '🇬🇧', '💪', '🧠'];
export const habitColors = [
  'bg-primary',
  'bg-accent',
  'bg-mood-good',
  'bg-mood-okay',
  'bg-mood-great',
];

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

  // Field values
  const [newHabitName, setNewHabitName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(habitIcons[0]);
  const [selectedColor, setSelectedColor] = useState(habitColors[0]);
  const [selectedType, setSelectedType] = useState<HabitType>('daily');
  const [selectedCategory, setSelectedCategory] = useState<HabitCategory>('health');
  const [dailyTarget, setDailyTarget] = useState(1);
  const [reminders, setReminders] = useState<HabitReminder[]>([]);

  // Frequency & duration
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [requiresDuration, setRequiresDuration] = useState(false);
  const [targetDuration, setTargetDuration] = useState(15);

  // Reset form to defaults
  const resetForm = useCallback(() => {
    setNewHabitName('');
    setSelectedIcon(habitIcons[0]);
    setSelectedColor(habitColors[0]);
    setSelectedType('daily');
    setSelectedCategory('health');
    setDailyTarget(1);
    setReminders([]);
    setFrequency('daily');
    setCustomDays([1, 2, 3, 4, 5]);
    setRequiresDuration(false);
    setTargetDuration(15);
    setEditingHabit(null);
    setIsAdding(false);
    setShowCustomForm(false);
  }, []);

  // Populate form for editing
  const handleEditHabit = useCallback((habit: Habit) => {
    setEditingHabit(habit);
    setNewHabitName(habit.name);
    setSelectedIcon(habit.icon);
    setSelectedColor(habit.color);
    setSelectedType(habit.type || 'daily');
    setSelectedCategory(habit.category || 'health');
    setDailyTarget(habit.dailyTarget ?? habit.targetCount ?? 1);
    setReminders(habit.reminders || []);
    setFrequency(habit.frequency || 'daily');
    setCustomDays(habit.customDays || [1, 2, 3, 4, 5]);
    setRequiresDuration(habit.requiresDuration || false);
    setTargetDuration(habit.targetDuration || 15);
    setIsAdding(true);
    setShowCustomForm(true);
  }, []);

  // Submit: create or update habit
  const handleAddHabit = useCallback(() => {
    if (!newHabitName.trim()) return;

    const today = getToday();

    if (editingHabit && onUpdateHabit) {
      const updatedHabit: Habit = {
        ...editingHabit,
        name: newHabitName.trim(),
        icon: selectedIcon,
        color: selectedColor,
        type: selectedType,
        category: selectedCategory,
        reminders,
        frequency,
        ...(frequency === 'custom' && { customDays }),
        ...(requiresDuration && { requiresDuration: true, targetDuration }),
        ...(selectedType === 'multiple' && { dailyTarget }),
        ...(selectedType === 'reduce' && { targetCount: dailyTarget }),
      };
      onUpdateHabit(updatedHabit);
    } else {
      const habit: Habit = {
        id: generateId(),
        name: newHabitName.trim(),
        icon: selectedIcon,
        color: selectedColor,
        category: selectedCategory,
        completedDates: [],
        createdAt: Date.now(),
        type: selectedType,
        reminders,
        frequency,
        ...(frequency === 'custom' && { customDays }),
        ...(requiresDuration && { requiresDuration: true, targetDuration, durationByDate: {} }),
        ...(selectedType === 'multiple' && { dailyTarget, completionsByDate: {} }),
        ...(selectedType === 'continuous' && { startDate: today, failedDates: [] }),
        ...(selectedType === 'reduce' && { progressByDate: {}, targetCount: dailyTarget }),
      };
      onAddHabit(habit);
      void hapticTap();
    }

    resetForm();
  }, [
    newHabitName, editingHabit, onUpdateHabit, onAddHabit, resetForm,
    selectedIcon, selectedColor, selectedType, selectedCategory,
    reminders, frequency, customDays, requiresDuration, targetDuration, dailyTarget,
  ]);

  // Pre-fill form from template
  const handleQuickAdd = useCallback((templateId: string) => {
    const template = habitTemplates.find(t => t.id === templateId);
    if (!template) return;

    setNewHabitName(template.names[language] || template.names.en);
    setSelectedIcon(template.icon);
    setSelectedColor(template.color);
    setSelectedType(template.type);
    if (template.type === 'multiple' && template.dailyTarget) {
      setDailyTarget(template.dailyTarget);
    } else {
      setDailyTarget(1);
    }
    setReminders([]);
    setFrequency('daily');
    setShowCustomForm(true);
  }, [language]);

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
    newHabitName, selectedIcon, selectedColor, selectedType, selectedCategory,
    dailyTarget, reminders, frequency, customDays, requiresDuration, targetDuration,
    // Setters
    setIsAdding, setShowCustomForm,
    setNewHabitName, setSelectedIcon, setSelectedColor,
    setSelectedType, setSelectedCategory, setDailyTarget,
    setFrequency, setCustomDays, setRequiresDuration, setTargetDuration,
    // Actions
    resetForm, handleEditHabit, handleAddHabit, handleQuickAdd,
    handleAddReminder, handleRemoveReminder, handleReminderChange,
  };
}
