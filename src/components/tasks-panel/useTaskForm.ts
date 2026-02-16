import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { taskNameSchema, safeParseInt } from '@/lib/validation';
import { sanitizeString } from '@/lib/sanitize';
import type { Task } from '@/lib/taskMomentum';

interface TaskFormState {
  name: string;
  minutes: number;
  minutesInput: string;
  breakTime: number;
  breakInput: string;
  urgent: boolean;
  interest: number;
  interestInput: string;
  show: boolean;
}

const INITIAL_FORM: TaskFormState = {
  name: '',
  minutes: 15,
  minutesInput: '15',
  breakTime: 5,
  breakInput: '5',
  urgent: false,
  interest: 5,
  interestInput: '5',
  show: false,
};

interface UseTaskFormOptions {
  onAdd: (task: Task) => void;
}

interface UseTaskFormReturn {
  form: TaskFormState;
  setField: <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) => void;
  handleBlurMinutes: (value: string) => void;
  handleBlurBreak: (value: string) => void;
  handleBlurInterest: (value: string) => void;
  handleAddTask: () => void;
  showForm: () => void;
  hideForm: () => void;
}

export function useTaskForm({ onAdd }: UseTaskFormOptions): UseTaskFormReturn {
  const [form, setForm] = useState<TaskFormState>(INITIAL_FORM);

  const setField = useCallback(<K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleBlurMinutes = useCallback((value: string) => {
    const validated = safeParseInt(value, 15, 1, 480);
    setForm(prev => ({ ...prev, minutes: validated, minutesInput: String(validated) }));
  }, []);

  const handleBlurBreak = useCallback((value: string) => {
    const validated = safeParseInt(value, 5, 0, 60);
    setForm(prev => ({ ...prev, breakTime: validated, breakInput: String(validated) }));
  }, []);

  const handleBlurInterest = useCallback((value: string) => {
    const validated = safeParseInt(value, 5, 1, 10);
    setForm(prev => ({ ...prev, interest: validated, interestInput: String(validated) }));
  }, []);

  const handleAddTask = useCallback(() => {
    const trimmedName = form.name.trim();
    if (!trimmedName) return;

    const validationResult = taskNameSchema.safeParse(trimmedName);
    if (!validationResult.success) {
      logger.warn('[TasksPanel] Invalid task name:', validationResult.error.message);
      return;
    }

    const sanitizedName = sanitizeString(validationResult.data);

    const newTask: Task = {
      id: Date.now().toString(),
      name: sanitizedName,
      urgent: form.urgent,
      estimatedMinutes: form.minutes,
      userRating: form.interest,
      completed: false,
      breakMinutes: form.breakTime > 0 ? form.breakTime : undefined,
      createdAt: Date.now(),
    };

    onAdd(newTask);
    setForm(INITIAL_FORM);
  }, [form, onAdd]);

  const showForm = useCallback(() => setForm(prev => ({ ...prev, show: true })), []);
  const hideForm = useCallback(() => setForm(prev => ({ ...prev, show: false })), []);

  return { form, setField, handleBlurMinutes, handleBlurBreak, handleBlurInterest, handleAddTask, showForm, hideForm };
}
