/**
 * Feedback Button Component
 *
 * Floating button that opens a feedback form.
 * Submits feedback to Supabase (if configured) or stores locally.
 */

import { useState } from 'react';
import { MessageSquarePlus, Send, X, Bug, Lightbulb, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { Capacitor } from '@capacitor/core';
import { haptics } from '@/lib/haptics';
import { toast } from 'sonner';

type FeedbackType = 'bug' | 'feature' | 'other';

interface FeedbackButtonProps {
  /** Position of the button */
  position?: 'bottom-right' | 'bottom-left';
  /** Custom className */
  className?: string;
}

export function FeedbackButton({
  position = 'bottom-right',
  className,
}: FeedbackButtonProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpen = () => {
    haptics.light();
    setIsOpen(true);
  };

  const handleClose = () => {
    haptics.light();
    setIsOpen(false);
    setMessage('');
    setType('bug');
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;

    haptics.medium();
    setIsSubmitting(true);

    try {
      const feedbackData = {
        type,
        message: message.trim(),
        app_version: (window as { __APP_VERSION__?: string }).__APP_VERSION__ || 'unknown',
        platform: Capacitor.getPlatform(),
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString(),
      };

      // Try to submit to Supabase if available
      if (supabase) {
        const { error } = await supabase
          .from('user_feedback')
          .insert(feedbackData);

        if (error) {
          // If table doesn't exist, store locally
          console.warn('[Feedback] Supabase error, storing locally:', error.message);
          storeFeedbackLocally(feedbackData);
        }
      } else {
        // No Supabase, store locally
        storeFeedbackLocally(feedbackData);
      }

      toast.success(t.feedbackSent || 'Thanks for your feedback!');
      handleClose();
    } catch (error) {
      console.error('[Feedback] Error:', error);
      toast.error(t.feedbackError || 'Failed to send feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackTypes: { value: FeedbackType; icon: typeof Bug; label: string }[] = [
    { value: 'bug', icon: Bug, label: t.feedbackBug || 'Bug' },
    { value: 'feature', icon: Lightbulb, label: t.feedbackFeature || 'Feature' },
    { value: 'other', icon: HelpCircle, label: t.feedbackOther || 'Other' },
  ];

  const positionClasses = position === 'bottom-right'
    ? 'right-4 bottom-20'
    : 'left-4 bottom-20';

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className={cn(
            'fixed z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg',
            'hover:bg-primary/90 active:scale-95 transition-all',
            positionClasses,
            className
          )}
          style={{ bottom: 'calc(var(--nav-height) + var(--safe-bottom) + 1rem)' }}
          aria-label={t.sendFeedback || 'Send feedback'}
        >
          <MessageSquarePlus className="w-6 h-6" />
        </button>
      )}

      {/* Feedback Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-black/50">
          <div
            className="w-full max-w-md bg-card rounded-2xl shadow-xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {t.sendFeedback || 'Send Feedback'}
              </h2>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Type Selection */}
              <div className="flex gap-2">
                {feedbackTypes.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setType(value)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border transition-all',
                      type === value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 border-border hover:border-primary/50'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>

              {/* Message Input */}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.feedbackPlaceholder || 'Describe your feedback...'}
                className="w-full h-32 p-3 rounded-xl border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={1000}
              />

              {/* Character count */}
              <p className="text-xs text-muted-foreground text-right">
                {message.length}/1000
              </p>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || isSubmitting}
                className={cn(
                  'w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all',
                  message.trim()
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                <Send className="w-4 h-4" />
                {isSubmitting
                  ? (t.sending || 'Sending...')
                  : (t.send || 'Send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Store feedback locally when Supabase is unavailable
function storeFeedbackLocally(data: Record<string, unknown>): void {
  try {
    const stored = localStorage.getItem('zenflow_pending_feedback');
    const pending = stored ? JSON.parse(stored) : [];
    pending.push(data);
    localStorage.setItem('zenflow_pending_feedback', JSON.stringify(pending));
  } catch (error) {
    console.error('[Feedback] Failed to store locally:', error);
  }
}
