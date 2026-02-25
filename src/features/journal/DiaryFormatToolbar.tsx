/**
 * DiaryFormatToolbar — WYSIWYG formatting toolbar for contenteditable editor.
 *
 * Uses document.execCommand for bold/italic/underline/strikethrough/quote/code/link.
 * Detects active formatting state and highlights corresponding buttons.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface DiaryFormatToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
}

const FORMAT_ACTIONS = [
  { cmd: 'bold', icon: 'B', style: 'font-bold' },
  { cmd: 'italic', icon: 'I', style: 'italic' },
  { cmd: 'underline', icon: 'U', style: 'underline' },
  { cmd: 'strikeThrough', icon: 'S', style: 'line-through' },
  { cmd: 'formatBlock:blockquote', icon: '❝', style: '' },
  { cmd: 'insertHTML:<code>', icon: '</>', style: 'font-mono text-[11px]' },
  { cmd: 'createLink', icon: '🔗', style: '' },
] as const;

export function DiaryFormatToolbar({ editorRef }: DiaryFormatToolbarProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const checkActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    try {
      if (document.queryCommandState('bold')) formats.add('bold');
      if (document.queryCommandState('italic')) formats.add('italic');
      if (document.queryCommandState('underline')) formats.add('underline');
      if (document.queryCommandState('strikeThrough')) formats.add('strikeThrough');
    } catch {
      // queryCommandState may fail in some contexts
    }
    setActiveFormats(formats);
  }, []);

  // Listen for selection changes to update active state
  useEffect(() => {
    document.addEventListener('selectionchange', checkActiveFormats);
    return () => document.removeEventListener('selectionchange', checkActiveFormats);
  }, [checkActiveFormats]);

  const execFormat = useCallback((cmd: string) => {
    if (cmd === 'createLink') {
      const url = prompt(ts.journalFormatLinkPrompt || 'URL:');
      if (url) document.execCommand('createLink', false, url);
    } else if (cmd === 'insertHTML:<code>') {
      // Toggle code formatting
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const parent = range.commonAncestorContainer.parentElement;
        if (parent?.tagName === 'CODE') {
          // Unwrap code
          const text = parent.textContent || '';
          parent.replaceWith(text);
        } else {
          const selectedText = range.toString();
          if (selectedText) {
            document.execCommand('insertHTML', false, `<code>${selectedText}</code>`);
          }
        }
      }
    } else if (cmd.startsWith('formatBlock:')) {
      document.execCommand('formatBlock', false, cmd.split(':')[1]);
    } else {
      document.execCommand(cmd, false);
    }
    // Refocus editor
    editorRef.current?.focus();
    checkActiveFormats();
  }, [editorRef, checkActiveFormats, ts]);

  return (
    <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/5 flex-shrink-0">
      {FORMAT_ACTIONS.map(action => {
        const baseCmdName = action.cmd.includes(':') ? action.cmd.split(':')[0] : action.cmd;
        const isActive = activeFormats.has(baseCmdName === 'formatBlock' ? 'formatBlock' : action.cmd);
        return (
          <motion.button
            key={action.cmd}
            whileTap={{ scale: 0.9 }}
            onClick={() => execFormat(action.cmd)}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all',
              action.style,
              isActive
                ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
                : 'text-slate-400 hover:bg-white/10 hover:text-slate-50',
            )}
            aria-label={action.icon}
          >
            {action.icon}
          </motion.button>
        );
      })}
    </div>
  );
}
