import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { MessageSquare, Bug, Lightbulb, HelpCircle, Send, Loader2, X } from 'lucide-react';
import { APP_VERSION } from '@/lib/appVersion';
import { Capacitor } from '@capacitor/core';
import { logger } from '@/lib/logger';
import { safeLocalStorageGet } from '@/lib/safeJson';
import { supabase } from '@/lib/supabaseClient';
import { emailSchema } from '@/lib/validation';

interface FeedbackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FeedbackCategory = 'bug' | 'feature' | 'other';

export const FeedbackForm = ({ open, onOpenChange }: FeedbackFormProps) => {
  const { t } = useLanguage();
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  if (!open) return null;

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close when clicking directly on the overlay (not children)
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleOverlayTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    // Only close when touching directly on the overlay (not children)
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;

    // Validate email if provided
    if (email.trim()) {
      const emailValidation = emailSchema.safeParse(email.trim());
      if (!emailValidation.success) {
        setEmailError(t.feedbackInvalidEmail || 'Invalid email format');
        return;
      }
    }
    setEmailError(null);

    setStatus('sending');

    try {
      // Collect device info
      const deviceInfo = {
        platform: Capacitor.getPlatform(),
        appVersion: APP_VERSION,
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        language: navigator.language
      };

      const feedbackData = {
        category,
        message: message.trim(),
        email: email.trim() || null,
        device_info: deviceInfo,
        app_version: APP_VERSION
      };

      logger.log('[Feedback] Submitting:', feedbackData);

      // Always save to localStorage as backup first
      const saveToLocalStorage = () => {
        try {
          const stored = safeLocalStorageGet<Record<string, unknown>[]>('zenflow_feedback', []);
          stored.push({ ...feedbackData, created_at: new Date().toISOString() });
          localStorage.setItem('zenflow_feedback', JSON.stringify(stored.slice(-20)));
          logger.log('[Feedback] Saved to localStorage backup');
        } catch (e) {
          logger.warn('[Feedback] Failed to save to localStorage:', e);
        }
      };

      // Try to send to Supabase
      if (supabase) {
        try {
          const { error } = await supabase
            .from('feedback')
            .insert([feedbackData]);

          if (error) {
            // Log specific error for debugging
            logger.error('[Feedback] Supabase error:', {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint
            });
            // Save locally as fallback
            saveToLocalStorage();
          } else {
            logger.log('[Feedback] Sent to Supabase successfully');

            // Send email notification via Edge Function (non-blocking)
            supabase.functions.invoke('send-feedback-email', {
              body: feedbackData
            }).then(({ error: emailError }) => {
              if (emailError) {
                logger.warn('[Feedback] Email notification failed (non-critical):', emailError);
              } else {
                logger.log('[Feedback] Email notification sent');
              }
            }).catch((err) => {
              logger.warn('[Feedback] Email notification error (non-critical):', err);
            });
          }
        } catch (supabaseErr) {
          logger.error('[Feedback] Supabase exception:', supabaseErr);
          saveToLocalStorage();
        }
      } else {
        // Supabase not configured, store locally
        logger.log('[Feedback] Supabase not configured, storing locally');
        saveToLocalStorage();
      }

      // Always show success if we saved at least locally
      // Feedback is captured even if cloud sync failed
      setStatus('success');

      // Reset form after success
      setTimeout(() => {
        setMessage('');
        setEmail('');
        setCategory('bug');
        setStatus('idle');
        onOpenChange(false);
      }, 2000);

    } catch (error) {
      logger.error('[Feedback] Failed to submit:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const categories: { value: FeedbackCategory; icon: React.ReactNode; label: string }[] = [
    { value: 'bug', icon: <Bug className="w-4 h-4" />, label: t.feedbackCategoryBug },
    { value: 'feature', icon: <Lightbulb className="w-4 h-4" />, label: t.feedbackCategoryFeature },
    { value: 'other', icon: <HelpCircle className="w-4 h-4" />, label: t.feedbackCategoryOther },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 flex items-end justify-center"
      onMouseDown={handleOverlayMouseDown}
      onTouchEnd={handleOverlayTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-form-title"
    >
      <div
        className="w-full max-w-lg bg-background rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <div>
            <h2 id="feedback-form-title" className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              {t.feedbackTitle}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t.feedbackSubtitle}
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label={t.close || 'Close'}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 pb-6">
          {/* Category Selection */}
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                  category === cat.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-muted'
                }`}
              >
                {cat.icon}
                <span className="hidden sm:inline">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Message Input */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.feedbackMessagePlaceholder}
            className="w-full h-32 p-3 rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={status === 'sending'}
          />

          {/* Email Input (Optional) */}
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null); // Clear error when user types
              }}
              placeholder={t.feedbackEmailPlaceholder}
              className={`w-full p-3 rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
                emailError ? 'ring-2 ring-red-500 focus:ring-red-500' : 'focus:ring-primary'
              }`}
              disabled={status === 'sending'}
            />
            {emailError && (
              <p className="text-sm text-red-500 mt-1">{emailError}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!message.trim() || status === 'sending'}
            className="w-full py-6 rounded-xl text-base font-semibold"
          >
            {status === 'sending' ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {t.feedbackSending}
              </>
            ) : status === 'success' ? (
              t.feedbackSuccess
            ) : status === 'error' ? (
              t.feedbackError
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                {t.feedbackSubmit}
              </>
            )}
          </Button>

          {/* Version Info */}
          <p className="text-xs text-muted-foreground text-center">
            v{APP_VERSION} | {Capacitor.getPlatform()}
          </p>
        </div>
      </div>
    </div>
  );
};
