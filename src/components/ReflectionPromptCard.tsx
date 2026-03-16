/**
 * ReflectionPromptCard — Interactive micro-reflection UI (IA Blueprint Phase 3)
 *
 * Shows contextual prompts with lightweight input:
 * - nano depth: single-line input ("One word...")
 * - micro depth: 2-line textarea ("1-2 sentences...")
 * - "Expand to journal" button → navigates to Garden tab journal section
 *
 * Persists responses as MicroReflection records via userDataStore.
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MessageCircle, BookOpen, Send } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppStore, useUserDataStore } from '@/stores';
import { motionPresets } from '@/lib/animationUtils';
import { haptics } from '@/lib/haptics';
import { getToday } from '@/lib/utils';
import type { ReflectionPrompt } from '@/hooks/useReflectionPrompts';
import type { MicroReflection } from '@/types';

interface ReflectionPromptCardProps {
  prompt: ReflectionPrompt;
}

export function ReflectionPromptCard({ prompt }: ReflectionPromptCardProps) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const setMicroReflections = useUserDataStore(s => s.setMicroReflections);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const reflection: MicroReflection = {
      id: `mr-${Date.now()}`,
      text: trimmed,
      depth: prompt.depth,
      trigger: prompt.trigger,
      date: getToday(),
      timestamp: Date.now(),
      linkedMoodId: prompt.context?.moodId,
      linkedHabitIds: prompt.context?.habitIds,
      linkedFocusSessionId: prompt.context?.focusSessionId,
    };

    setMicroReflections((prev) => [...prev, reflection]);
    void haptics.light();
    setSubmitted(true);
  }, [text, prompt, setMicroReflections]);

  const handleExpandToJournal = useCallback(() => {
    void haptics.light();
    setActiveTab('garden');
    // After tab switch, scroll to journal section
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById('journal-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    });
  }, [setActiveTab]);

  const DepthIcon = prompt.depth === 'nano' ? Sparkles : MessageCircle;

  if (submitted) {
    return (
      <motion.div
        {...motionPresets.scaleIn}
        className="rounded-xl bg-card p-4"
      >
        <p className="text-sm text-emerald-600 dark:text-emerald-400 text-center">
          {t.reflectionNoted || 'Noted. Keep growing.'}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      {...motionPresets.slideUp}
      className="rounded-xl bg-card p-4 space-y-3"
    >
      {/* Prompt text */}
      <div className="flex items-start gap-2">
        <DepthIcon className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
        <p className="text-sm text-foreground leading-relaxed">
          {prompt.text}
        </p>
      </div>

      {/* Input area */}
      <div className="flex gap-2">
        {prompt.depth === 'nano' ? (
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={t.reflectionPlaceholderNano || 'One word...'}
            maxLength={50}
            className="flex-1 rounded-lg bg-secondary/60 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.reflectionPlaceholderMicro || '1-2 sentences...'}
            maxLength={280}
            rows={2}
            className="flex-1 rounded-lg bg-secondary/60 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
          />
        )}
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="self-end rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed p-2 transition-colors"
          aria-label={t.reflectionSubmitLabel || 'Submit reflection'}
        >
          <Send className="w-4 h-4 text-white rtl:scale-x-[-1]" />
        </button>
      </div>

      {/* Expand to journal */}
      <button
        onClick={handleExpandToJournal}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5" />
        {t.reflectionExpandJournal || 'Expand to journal'}
      </button>
    </motion.div>
  );
}
