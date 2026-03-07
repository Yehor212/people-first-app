/**
 * Supabase Edge Function: Send Weekly Digest
 * Part of v1.3.0 "Harmony" - Enhanced Engagement
 *
 * Sends personalized weekly progress summary to subscribed users.
 * Uses Resend API (free tier: 100 emails/day, 4 per hour).
 *
 * Required secrets:
 *   - RESEND_API_KEY: Get from https://resend.com/api-keys
 *   - SUPABASE_SERVICE_ROLE_KEY: For accessing user data
 *
 * Trigger:
 *   - Via cron job (pg_cron) every Sunday at 10:00 UTC
 *   - Manual trigger via POST request
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { isAuthorizedRequest } from "../_shared/auth.ts";
import { createJsonResponse, createNoContentResponse } from "../_shared/http.ts";
import { redactEmail, redactUserRef, redactError } from "../_shared/redaction.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET"); // Secret for cron job authentication

// ============================================
// TYPES
// ============================================

interface UserDigestData {
  userId: string;
  email: string;
  displayName: string;
  weeklyStats: {
    habitsCompleted: number;
    habitsTotal: number;
    focusMinutes: number;
    moodsLogged: number;
    currentStreak: number;
    xpEarned: number;
  };
  topHabits: string[];
  moodTrend: 'improving' | 'stable' | 'declining' | 'unknown';
  achievements: string[];
}

// ============================================
// DATA FETCHING
// ============================================

async function getSubscribedUsers(supabase: ReturnType<typeof createClient>): Promise<{ id: string; email: string; display_name?: string }[]> {
  // Query key-value user_settings for weekly_digest_enabled = true
  const { data, error } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('key', 'weekly_digest_enabled')
    .eq('value', true);

  if (error) {
    console.error('[WeeklyDigest] Error fetching settings:', error);
    return [];
  }

  const userIds = (data || []).map((s: { user_id: string }) => s.user_id);
  if (userIds.length === 0) return [];

  // Fetch user details individually (avoids listUsers pagination issues)
  const users: { id: string; email: string; display_name?: string }[] = [];
  for (const userId of userIds) {
    try {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      if (userError || !userData?.user?.email) continue;
      users.push({
        id: userData.user.id,
        email: userData.user.email,
        display_name: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name,
      });
    } catch {
      console.warn(`[WeeklyDigest] Failed to fetch user ${redactUserRef(userId)}`);
    }
  }

  return users;
}

async function getUserWeeklyStats(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ weeklyStats: UserDigestData['weeklyStats']; topHabits: string[] }> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekAgoStr = oneWeekAgo.toISOString();
  const weekAgoDate = weekAgoStr.slice(0, 10);

  // Load active habits
  const { data: habits, error: habitsError } = await supabase
    .from('habits')
    .select('id, name')
    .eq('user_id', userId)
    .eq('is_archived', false);

  if (habitsError) {
    throw new Error('Failed to load habits');
  }

  let habitsCompleted = 0;
  const completionByHabitId = new Map<string, number>();
  const topHabits: string[] = [];
  const habitIds = (habits || []).map((habit: { id: string }) => habit.id);

  if (habitIds.length > 0) {
    const { data: completions, error: completionsError } = await supabase
      .from('habit_completions')
      .select('habit_id, count, date')
      .eq('user_id', userId)
      .gte('date', weekAgoDate);

    if (completionsError) {
      throw new Error('Failed to load habit completions');
    }

    for (const completion of completions || []) {
      const count = Math.max(1, completion.count || 1);
      habitsCompleted += count;
      completionByHabitId.set(
        completion.habit_id,
        (completionByHabitId.get(completion.habit_id) || 0) + count,
      );
    }
  }

  for (const habit of habits || []) {
    const total = completionByHabitId.get(habit.id) || 0;
    if (total >= 5) {
      topHabits.push(habit.name);
    }
  }

  // Get focus sessions this week
  const { data: focusSessions, error: focusError } = await supabase
    .from('focus_sessions')
    .select('duration')
    .eq('user_id', userId)
    .gte('created_at', weekAgoStr);

  if (focusError) {
    throw new Error('Failed to load focus sessions');
  }

  const focusMinutes = (focusSessions || [])
    .reduce((sum: number, s: { duration: number }) => sum + (s.duration || 0), 0);

  // Get moods logged this week
  const { data: moods, error: moodsError } = await supabase
    .from('moods')
    .select('id')
    .eq('user_id', userId)
    .gte('date', weekAgoDate);

  if (moodsError) {
    throw new Error('Failed to load moods');
  }

  // Get leaderboard data
  const { data: leaderboard, error: leaderboardError } = await supabase
    .from('leaderboards')
    .select('weekly_xp, current_streak')
    .eq('user_id', userId)
    .maybeSingle();

  // User may not have a leaderboard row yet — use defaults
  if (leaderboardError) {
    console.warn(`[WeeklyDigest] Leaderboard not found for ${redactUserRef(userId)}`);
  }

  return {
    weeklyStats: {
      habitsCompleted,
      habitsTotal: (habits || []).length * 7,
      focusMinutes,
      moodsLogged: (moods || []).length,
      currentStreak: leaderboard?.current_streak || 0,
      xpEarned: leaderboard?.weekly_xp || 0,
    },
    topHabits,
  };
}

function calculateMoodTrend(moodsLogged: number): UserDigestData['moodTrend'] {
  // Simple heuristic - in a real app, would analyze actual mood values
  if (moodsLogged >= 14) return 'improving';
  if (moodsLogged >= 7) return 'stable';
  if (moodsLogged >= 3) return 'declining';
  return 'unknown';
}

// ============================================
// EMAIL GENERATION
// ============================================

function generateEmailHtml(data: UserDigestData): string {
  const habitPercentage = data.weeklyStats.habitsTotal > 0
    ? Math.round((data.weeklyStats.habitsCompleted / data.weeklyStats.habitsTotal) * 100)
    : 0;

  const moodEmoji = {
    improving: '📈',
    stable: '➡️',
    declining: '📉',
    unknown: '❓'
  }[data.moodTrend];

  const moodText = {
    improving: 'Your mood is trending up! Great work!',
    stable: 'Your mood has been stable this week.',
    declining: 'Consider some self-care this week.',
    unknown: 'Log more moods to see your trends!'
  }[data.moodTrend];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f0fdf4;">
      <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(74, 157, 124, 0.15);">

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #4a9d7c; margin: 0; font-size: 28px;">Your Weekly Progress</h1>
          <p style="color: #666; margin: 8px 0 0 0;">Hey ${escapeHtml(data.displayName || 'there')}! Here's your week in review.</p>
        </div>

        <!-- Stats Grid -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">

          <!-- Habits -->
          <div style="background: linear-gradient(135deg, #4a9d7c15, #4a9d7c05); border-radius: 12px; padding: 20px; text-align: center;">
            <div style="font-size: 32px; margin-bottom: 8px;">✨</div>
            <div style="font-size: 28px; font-weight: bold; color: #4a9d7c;">${data.weeklyStats.habitsCompleted}</div>
            <div style="color: #666; font-size: 14px;">Habits Completed</div>
            <div style="color: #4a9d7c; font-size: 12px; margin-top: 4px;">${habitPercentage}% completion</div>
          </div>

          <!-- Focus Time -->
          <div style="background: linear-gradient(135deg, #3b82f615, #3b82f605); border-radius: 12px; padding: 20px; text-align: center;">
            <div style="font-size: 32px; margin-bottom: 8px;">🎯</div>
            <div style="font-size: 28px; font-weight: bold; color: #3b82f6;">${data.weeklyStats.focusMinutes}</div>
            <div style="color: #666; font-size: 14px;">Focus Minutes</div>
            <div style="color: #3b82f6; font-size: 12px; margin-top: 4px;">${Math.round(data.weeklyStats.focusMinutes / 60)}h total</div>
          </div>

          <!-- Streak -->
          <div style="background: linear-gradient(135deg, #f9731615, #f9731605); border-radius: 12px; padding: 20px; text-align: center;">
            <div style="font-size: 32px; margin-bottom: 8px;">🔥</div>
            <div style="font-size: 28px; font-weight: bold; color: #f97316;">${data.weeklyStats.currentStreak}</div>
            <div style="color: #666; font-size: 14px;">Day Streak</div>
            <div style="color: #f97316; font-size: 12px; margin-top: 4px;">Keep it going!</div>
          </div>

          <!-- XP -->
          <div style="background: linear-gradient(135deg, #8b5cf615, #8b5cf605); border-radius: 12px; padding: 20px; text-align: center;">
            <div style="font-size: 32px; margin-bottom: 8px;">⭐</div>
            <div style="font-size: 28px; font-weight: bold; color: #8b5cf6;">${data.weeklyStats.xpEarned}</div>
            <div style="color: #666; font-size: 14px;">XP Earned</div>
            <div style="color: #8b5cf6; font-size: 12px; margin-top: 4px;">This week</div>
          </div>
        </div>

        <!-- Mood Trend -->
        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">${moodEmoji}</span>
            <div>
              <div style="font-weight: 600; color: #333;">Mood Check-in</div>
              <div style="color: #666; font-size: 14px;">${moodText}</div>
            </div>
          </div>
        </div>

        <!-- Top Habits -->
        ${data.topHabits.length > 0 ? `
        <div style="margin-bottom: 24px;">
          <h3 style="color: #333; margin: 0 0 12px 0; font-size: 16px;">Your Star Habits This Week</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${data.topHabits.map(h => `
              <span style="background: #4a9d7c15; color: #4a9d7c; padding: 6px 12px; border-radius: 20px; font-size: 14px;">
                ⭐ ${escapeHtml(h)}
              </span>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- CTA -->
        <div style="text-align: center; margin-top: 32px;">
          <a href="https://yehor212.github.io/people-first-app/" style="display: inline-block; background: linear-gradient(135deg, #4a9d7c, #3b8d6f); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Continue Your Journey
          </a>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #eee; padding-top: 24px; margin-top: 32px; text-align: center;">
          <p style="margin: 0 0 8px 0; color: #999; font-size: 12px;">
            You're receiving this because you subscribed to weekly digests.
          </p>
          <p style="margin: 0; color: #999; font-size: 12px;">
            <a href="https://yehor212.github.io/people-first-app/" style="color: #4a9d7c;">Manage preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return createNoContentResponse(origin);
  }

  if (req.method !== "POST") {
    return createJsonResponse(origin, 405, { error: "Method not allowed" });
  }

  // ============================================
  // AUTHENTICATION: Require cron secret or service role
  // ============================================
  const authHeader = req.headers.get("Authorization");
  const cronSecretHeader = req.headers.get("X-Cron-Secret");

  // Allow if: valid cron secret OR service role key
  const isAuthorized = isAuthorizedRequest({
    authHeader,
    cronSecretHeader,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    cronSecret: CRON_SECRET,
  });

  if (!isAuthorized) {
    console.warn("[WeeklyDigest] Unauthorized request attempt");
    return createJsonResponse(origin, 401, { error: "Unauthorized" });
  }

  // Check configuration
  if (!RESEND_API_KEY) {
    console.error("[WeeklyDigest] RESEND_API_KEY not configured");
    return createJsonResponse(origin, 500, { error: "Email service not configured" });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    // Get subscribed users
    const users = await getSubscribedUsers(supabase);
    console.log(`[WeeklyDigest] Found ${users.length} subscribed users`);

    if (users.length === 0) {
      return createJsonResponse(origin, 200, { success: true, sent: 0, message: "No subscribed users" });
    }

    let sentCount = 0;
    const errors: string[] = [];

    // Process all subscribed users (1s delay between emails for Resend rate limit)
    for (const user of users) {
      try {
        // Get user stats
        const { weeklyStats, topHabits } = await getUserWeeklyStats(supabase, user.id);

        const digestData: UserDigestData = {
          userId: user.id,
          email: user.email,
          displayName: user.display_name || 'Zen User',
          weeklyStats,
          topHabits,
          moodTrend: calculateMoodTrend(weeklyStats.moodsLogged),
          achievements: []
        };

        // Generate and send email
        const emailHtml = generateEmailHtml(digestData);

        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "ZenFlow <onboarding@resend.dev>",
            to: user.email,
            subject: `Your Weekly ZenFlow Progress Report`,
            html: emailHtml
          })
        });

        if (resendResponse.ok) {
          sentCount++;
          console.log(`[WeeklyDigest] Sent to ${redactUserRef(user.id)} (${redactEmail(user.email)})`);
        } else {
          const errorText = await resendResponse.text();
          const userRef = redactUserRef(user.id);
          errors.push(`${userRef}: send_failed`);
          console.error(`[WeeklyDigest] Failed for ${userRef}:`, errorText);
        }

        // Rate limiting - wait 1 second between emails
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (userError) {
        const userRef = redactUserRef(user.id);
        errors.push(`${userRef}: processing_failed`);
        console.error(`[WeeklyDigest] Error for ${userRef}:`, userError);
      }
    }

    return createJsonResponse(origin, 200, {
      success: true,
      sent: sentCount,
      total: users.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("[WeeklyDigest] Error:", error);
    return createJsonResponse(origin, 500, {
      error: "Internal error",
      requestId: redactError(error),
    });
  }
});
