import { motion, useReducedMotion } from "framer-motion";
import { X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  BUILTIN_TEMPLATES,
  generateTemplateContent,
  type JournalTemplate,
} from "./journalTemplates";
import { getJournalIcon } from "./journalHubIcons";

interface JournalTemplatePickerProps {
  onSelect: (content: string, templateId: string | null) => void;
  onClose: () => void;
}

export function JournalTemplatePicker({ onSelect, onClose }: JournalTemplatePickerProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const reducedMotion = useReducedMotion();
  const { modalRef, handleKeyDown } = useModalA11y(true, onClose);
  useScrollLock(true);

  const handleSelectTemplate = (template: JournalTemplate) => {
    const content = generateTemplateContent(template, ts);
    onSelect(content, template.id);
  };

  const handleBlank = () => {
    onSelect("", null);
  };

  return (
    <>
      {/* // A11Y-OK: backdrop is decorative overlay dismissed by click — aria-hidden excludes from AT tree */}
      <div
        className="fixed inset-0 z-[64] bg-black/30 motion-safe:animate-fade-in"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={modalRef}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={ts.ariaTemplatePicker || "Template picker"}
        className="fixed bottom-0 inset-x-0 z-[65] flex max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)] flex-col overflow-hidden motion-safe:animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex shrink-0 justify-center pt-2 pb-1 bg-card rounded-t-2xl">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card ps-[max(1rem,var(--safe-inline-start))] pe-[max(1rem,var(--safe-inline-end))] pt-4 pb-[max(1rem,var(--safe-bottom))] scroll-pb-[max(1rem,var(--safe-bottom))]">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
            <h3 className="min-w-0 whitespace-normal break-words text-base font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word]">
              {ts.journalTemplates || "Templates"}
            </h3>
            <button
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-2 hover:bg-muted/50"
              aria-label={ts.close || "Close"}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="zf-auto-fit-grid-9 grid gap-2.5">
            {/* Blank entry */}
            <motion.button
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              onClick={handleBlank}
              className={cn(
                "flex h-auto min-h-[100px] min-w-0 flex-col items-center gap-2 rounded-xl p-4",
                "bg-muted/30 border border-border/20",
                "hover:bg-muted/50 motion-safe:transition-colors"
              )}
            >
              <FileText className="w-6 h-6 text-muted-foreground/60" />
              <div className="min-w-0 text-center">
                <p className="min-w-0 whitespace-normal break-words text-xs font-medium text-foreground [hyphens:manual] [overflow-wrap:break-word]">
                  {ts.journalTemplateBlank || "Blank Entry"}
                </p>
                <p className="mt-0.5 min-w-0 whitespace-normal break-words text-xs text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
                  {ts.journalTemplateBlankDesc || "Start from scratch"}
                </p>
              </div>
            </motion.button>

            {/* Built-in templates */}
            {BUILTIN_TEMPLATES.map((template, i) => {
              const TemplateIcon = getJournalIcon(template.iconKey);

              return (
                <motion.button
                  key={template.id}
                  whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { delay: i * 0.05 }}
                  onClick={() => handleSelectTemplate(template)}
                  className={cn(
                    "flex h-auto min-h-[100px] min-w-0 flex-col items-center gap-2 rounded-xl p-4",
                    "bg-card/60 border border-border/15",
                    "hover:bg-card/80 hover:border-primary/20",
                    "motion-safe:transition-all motion-safe:duration-200"
                  )}
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                    <TemplateIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 text-center">
                    <p className="min-w-0 whitespace-normal break-words text-xs font-medium text-foreground [hyphens:manual] [overflow-wrap:break-word]">
                      {ts[template.nameKey] || template.id.replace(/-/g, " ")}
                    </p>
                    <p className="mt-0.5 min-w-0 whitespace-normal break-words text-xs text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
                      {ts[template.descriptionKey] || `${template.sections.length} sections`}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
