import { motion } from 'framer-motion';
import { X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { BUILTIN_TEMPLATES, generateTemplateContent, type JournalTemplate } from './journalTemplates';
import { StickerRenderer } from './StickerRenderer';

interface JournalTemplatePickerProps {
  onSelect: (content: string, templateId: string | null) => void;
  onClose: () => void;
}

export function JournalTemplatePicker({ onSelect, onClose }: JournalTemplatePickerProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  useBackHandler(true, onClose);
  useScrollLock(true);

  const handleSelectTemplate = (template: JournalTemplate) => {
    const content = generateTemplateContent(template, ts);
    onSelect(content, template.id);
  };

  const handleBlank = () => {
    onSelect('', null);
  };

  return (
    <>
      <div className="fixed inset-0 z-[64] bg-black/30 animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed bottom-0 left-0 right-0 z-[65] animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1 bg-card rounded-t-2xl">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        <div className="bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[70dvh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-foreground">
              {ts.journalTemplates || 'Templates'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={ts.close || 'Close'}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Blank entry */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleBlank}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl min-h-[100px]',
                'bg-muted/30 border border-border/20',
                'hover:bg-muted/50 transition-colors',
              )}
            >
              <FileText className="w-6 h-6 text-muted-foreground/60" />
              <div className="text-center">
                <p className="text-xs font-medium text-foreground">
                  {ts.journalTemplateBlank || 'Blank Entry'}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {ts.journalTemplateBlankDesc || 'Start from scratch'}
                </p>
              </div>
            </motion.button>

            {/* Built-in templates */}
            {BUILTIN_TEMPLATES.map((template, i) => (
              <motion.button
                key={template.id}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleSelectTemplate(template)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl min-h-[100px]',
                  'bg-card/60 border border-border/15',
                  'hover:bg-card/80 hover:border-primary/20',
                  'transition-all duration-200',
                )}
              >
                <StickerRenderer emoji={template.icon} size="sm" />
                <div className="text-center">
                  <p className="text-xs font-medium text-foreground">
                    {ts[template.nameKey] || template.id.replace(/-/g, ' ')}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-2">
                    {ts[template.descriptionKey] || `${template.sections.length} sections`}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
