import { useLanguage } from '@/contexts/LanguageContext';

interface NoteStepProps {
  value: string;
  onChange: (value: string) => void;
}

const MAX_NOTE_LENGTH = 500;

/**
 * Optional note text area for State of Mind entry.
 * Law 7 (Zero Trust): input length limited, sanitized before save.
 * Law 20 (Copy): placeholder text via i18n, character count shown.
 */
export function NoteStep({ value, onChange }: NoteStepProps) {
  const { t } = useLanguage();

  return (
    <div className="px-1">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_NOTE_LENGTH))}
        placeholder={t.somNotePlaceholder}
        maxLength={MAX_NOTE_LENGTH}
        rows={4}
        className={[
          'w-full rounded-xl bg-card ring-1 ring-black/5 dark:ring-white/10',
          'px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50',
          'resize-none focus:outline-none focus:ring-2 focus:ring-primary/50',
          'transition-shadow',
        ].join(' ')}
        aria-label={t.somAddNote}
      />
      <div className="text-end mt-1">
        <span className="text-xs text-muted-foreground/50">
          {value.length}/{MAX_NOTE_LENGTH}
        </span>
      </div>
    </div>
  );
}
