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

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET"); // Secret for cron job authentication

// Allowed origins for CORS (production only - no http://localhost)
const ALLOWED_ORIGINS = [
  "https://zenflow.app",
  "https://www.zenflow.app",
  "capacitor://localhost", // Required for mobile app
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  };
};

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
  const { data, error } = await supabase
    .from('user_settings')
    .select('user_id, weekly_digest_enabled')
    .eq('weekly_digest_enabled', true);

  if (error) {
    console.error('[WeeklyDigest] Error fetching settings:', error);
    return [];
  }

  // Get user details for subscribed users
  const userIds = (data || []).map((s: { user_id: string }) => s.user_id);
  if (userIds.length === 0) return [];

  const { data: users, error: userError } = await supabase.auth.admin.listUsers();

  if (userError) {
    console.error('[WeeklyDigest] Error fetching users:', userError);
    return [];
  }

  return users.users
    .filter(u => userIds.includes(u.id) && u.email)
    .map(u => ({
      id: u.id,
      email: u.email!,
      display_name: u.user_metadata?.full_name || u.user_metadata?.name
    }));
}

async function getUserWeeklyStats(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<UserDigestData['weeklyStats']> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekAgoStr = oneWeekAgo.toISOString();

  // Get habits completed this week
  const { data: habits } = await supabase
    .from('habits')
    .select('id, name, completion_dates')
    .eq('user_id', userId);

  let habitsCompleted = 0;
  const topHabits: string[] = [];

  if (habits) {
    habits.forEach((habit: { completion_dates?: string[]; name: string }) => {
      const completions = (habit.completion_dates || [])
        .filter((d: string) => new Date(d) >= oneWeekAgo);
      if (completions.length > 0) {
        habitsCompleted += completions.length;
        if (completions.length >= 5) {
          topHabits.push(habit.name);
        }
      }
    });
  }

  // Get focus sessions this week
  const { data: focusSessions } = await supabase
    .from('focus_sessions')
    .select('duration')
    .eq('user_id', userId)
    .gte('created_at', weekAgoStr);

  const focusMinutes = (focusSessions || [])
    .reduce((sum: number, s: { duration: number }) => sum + (s.duration || 0), 0);

  // Get moods logged this week
  const { data: moods } = await supabase
    .from('mood_entries')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', weekAgoStr);

  // Get leaderboard data
  const { data: leaderboard } = await supabase
    .from('leaderboards')
    .select('weekly_xp, current_streak')
    .eq('user_id', userId)
    .single();

  return {
    habitsCompleted,
    habitsTotal: (habits || []).length * 7,
    focusMinutes,
    moodsLogged: (moods || []).length,
    currentStreak: leaderboard?.current_streak || 0,
    xpEarned: leaderboard?.weekly_xp || 0
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
          <a href="https://zenflow.app" style="display: inline-block; background: linear-gradient(135deg, #4a9d7c, #3b8d6f); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Continue Your Journey
          </a>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid #eee; padding-top: 24px; margin-top: 32px; text-align: center;">
          <p style="margin: 0 0 8px 0; color: #999; font-size: 12px;">
            You're receiving this because you subscribed to weekly digests.
          </p>
          <p style="margin: 0; color: #999; font-size: 12px;">
            <a href="https://zenflow.app/settings" style="color: #4a9d7c;">Manage preferences</a>
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
  const corsHeaders = getCorsHeaders(origin);

  const jsonResponse = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  // ============================================
  // AUTHENTICATION: Require cron secret or service role
  // ============================================
  const authHeader = req.headers.get("Authorization");
  const cronSecretHeader = req.headers.get("X-Cron-Secret");

  // Allow if: valid cron secret OR service role key
  const isAuthorized =
    (CRON_SECRET && cronSecretHeader === CRON_SECRET) ||
    (authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`);

  if (!isAuthorized) {
    console.warn("[WeeklyDigest] Unauthorized request attempt");
    return jsonResponse(401, { error: "Unauthorized" });
  }

  // Check configuration
  if (!RESEND_API_KEY) {
    console.error("[WeeklyDigest] RESEND_API_KEY not configured");
    return jsonResponse(500, { error: "Email service not configured" });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });

    // Get subscribed users
    const users = await getSubscribedUsers(supabase);
    console.log(`[WeeklyDigest] Found ${users.length} subscribed users`);

    if (users.length === 0) {
      return jsonResponse(200, { success: true, sent: 0, message: "No subscribed users" });
    }

    let sentCount = 0;
    const errors: string[] = [];

    // Process users (rate limit: 4 per hour for free tier)
    for (const user of users.slice(0, 4)) {
      try {
        // Get user stats
        const weeklyStats = await getUserWeeklyStats(supabase, user.id);
        const topHabits: string[] = []; // Simplified - could be enhanced

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
          console.log(`[WeeklyDigest] Sent to ${user.email}`);
        } else {
          const errorText = await resendResponse.text();
          errors.push(`${user.email}: ${errorText}`);
          console.error(`[WeeklyDigest] Failed for ${user.email}:`, errorText);
        }

        // Rate limiting - wait 1 second between emails
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (userError) {
        errors.push(`${user.email}: ${userError}`);
        console.error(`[WeeklyDigest] Error for ${user.email}:`, userError);
      }
    }

    return jsonResponse(200, {
      success: true,
      sent: sentCount,
      total: users.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("[WeeklyDigest] Error:", error);
    return jsonResponse(500, {
      error: "Internal error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
