import { supabase } from './supabaseClient';
import { logger } from './logger';

interface QuickFeedbackData {
  type: string;
  message: string;
  app_version: string;
  platform: string;
  user_agent: string;
  created_at: string;
}

interface DetailedFeedbackData {
  category: string;
  message: string;
  email: string | null;
  device_info: Record<string, string>;
  app_version: string;
}

/**
 * Submit quick feedback to 'feedback' table (used by FeedbackButton)
 * Maps QuickFeedbackData fields to the feedback table schema.
 * Returns true if sent to Supabase, false if failed (caller handles local fallback)
 */
export async function submitQuickFeedback(data: QuickFeedbackData): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('feedback')
    .insert({
      category: data.type,
      message: data.message,
      app_version: data.app_version,
      device_info: {
        platform: data.platform,
        userAgent: data.user_agent,
      },
    });

  if (error) {
    logger.warn('[FeedbackService] Quick feedback error:', error.message);
    return false;
  }

  return true;
}

/**
 * Submit detailed feedback to 'feedback' table + send email notification (used by FeedbackForm)
 * Returns true if insert succeeded, false otherwise. Email is non-blocking.
 */
export async function submitDetailedFeedback(data: DetailedFeedbackData): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('feedback')
      .insert({
        category: data.category,
        message: data.message,
        email: data.email,
        device_info: data.device_info,
        app_version: data.app_version,
      });

    if (error) {
      logger.error('[FeedbackService] Detailed feedback error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return false;
    }

    logger.log('[FeedbackService] Feedback sent to Supabase');

    // Send email notification via Edge Function (non-blocking)
    supabase.functions.invoke('send-feedback-email', {
      body: data
    }).then(({ error: emailError }) => {
      if (emailError) {
        logger.warn('[FeedbackService] Email notification failed (non-critical):', emailError);
      } else {
        logger.log('[FeedbackService] Email notification sent');
      }
    }).catch((err) => {
      logger.warn('[FeedbackService] Email notification error (non-critical):', err);
    });

    return true;
  } catch (err) {
    logger.error('[FeedbackService] Exception:', err);
    return false;
  }
}
