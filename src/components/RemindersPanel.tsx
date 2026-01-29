import { Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ReminderSettings, Habit } from '@/types';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface RemindersPanelProps {
  reminders: ReminderSettings;
  onUpdateReminders: (value: ReminderSettings | ((prev: ReminderSettings) => ReminderSettings)) => void;
  habits: Habit[];
}

export function RemindersPanel({ reminders, onUpdateReminders, habits }: RemindersPanelProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!reminders.enabled) {
    return null;
  }

  return (
    <div className="bg-card rounded-2xl p-4 zen-shadow-card animate-fade-in">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 zen-gradient rounded-xl">
            <Bell className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-foreground text-sm">{t.remindersTitle || 'Reminders'}</h3>
            <p className="text-xs text-muted-foreground">{t.remindersActive || 'Active'}</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          {/* Mood - 3 times */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">{t.moodReminder || 'Mood'} 😊</span>
            <div className="flex items-center justify-between pl-4">
              <span className="text-xs text-muted-foreground">{t.morning || 'Morning'}</span>
              <span className="text-xs text-muted-foreground">{reminders.moodTimeMorning || '09:00'}</span>
            </div>
            <div className="flex items-center justify-between pl-4">
              <span className="text-xs text-muted-foreground">{t.afternoon || 'Afternoon'}</span>
              <span className="text-xs text-muted-foreground">{reminders.moodTimeAfternoon || '14:00'}</span>
            </div>
            <div className="flex items-center justify-between pl-4">
              <span className="text-xs text-muted-foreground">{t.evening || 'Evening'}</span>
              <span className="text-xs text-muted-foreground">{reminders.moodTimeEvening || '20:00'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">{t.habitReminder || 'Habits'} ✨</span>
            <span className="text-sm text-muted-foreground">{reminders.habitTime}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">{t.focusReminder || 'Focus'} 🎯</span>
            <span className="text-sm text-muted-foreground">{reminders.focusTime}</span>
          </div>
        </div>
      )}
    </div>
  );
}
