import { motion } from 'framer-motion';
import { Settings2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { habitTemplates } from '@/lib/habitTemplates';
import type { Habit } from '@/types';

interface TemplatePickerProps {
  isPrimaryCTA: boolean;
  habits: Habit[];
  language: string;
  t: Record<string, string>;
  handleQuickAdd: (templateId: string) => void;
  setShowCustomForm: (show: boolean) => void;
}

export function TemplatePicker({
  isPrimaryCTA,
  habits,
  language,
  t,
  handleQuickAdd,
  setShowCustomForm,
}: TemplatePickerProps) {
  return (
    <motion.div
      className={cn(
        "mb-4 p-4 rounded-2xl",
        isPrimaryCTA
          ? "bg-foreground/5 backdrop-blur-sm border border-foreground/10"
          : "bg-secondary"
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <p className={cn(
        "text-sm font-medium mb-3",
        isPrimaryCTA ? "text-slate-700 dark:text-foreground/80" : "text-foreground"
      )}>{t.quickAdd || 'Quick Add'}</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {habitTemplates
          .filter(template => !habits.some(h => h.name === (template.names[language] || template.names.en)))
          .slice(0, 6)
          .map((template, index) => (
            isPrimaryCTA ? (
              <motion.button
                key={template.id}
                onClick={() => handleQuickAdd(template.id)}
                className="flex items-center gap-2 px-3 py-3 min-h-[52px] rounded-xl bg-foreground/5 border border-foreground/10 text-foreground/80 hover:bg-foreground/10 hover:text-foreground transition-all text-start"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-xl">{template.icon}</span>
                <span className="truncate text-sm font-medium">
                  {template.names[language] || template.names.en}
                </span>
              </motion.button>
            ) : (
              <Button
                key={template.id}
                variant="outline"
                size="default"
                onClick={() => handleQuickAdd(template.id)}
                className="justify-start gap-2 min-h-[48px]"
              >
                <span className="text-xl">{template.icon}</span>
                <span className="truncate">
                  {template.names[language] || template.names.en}
                </span>
              </Button>
            )
          ))}
      </div>
      <Button
        variant="outline"
        onClick={() => setShowCustomForm(true)}
        className="w-full justify-between min-h-[48px]"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary" />
          <span>{t.createCustomHabit || 'Create custom habit'}</span>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </Button>
    </motion.div>
  );
}
