/**
 * Supabase Edge Function: Send Feedback Email
 *
 * Sends email notification to admin when new feedback is submitted.
 * Uses Resend API (free tier: 100 emails/day).
 *
 * Required secrets:
 *   - RESEND_API_KEY: Get from https://resend.com/api-keys
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_ANON_KEY: For JWT verification
 *
 * Optional environment variables:
 *   - ADMIN_EMAIL: Email to receive feedback (default: zenflowtrack@gmail.com)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { extractBearerToken } from "../_shared/auth.ts";
import {
  createJsonResponse,
  createNoContentResponse,
} from "../_shared/http.ts";
import { redactError } from "../_shared/redaction.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") || "ZenFlow <onboarding@resend.dev>";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "zenflowtrack@gmail.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Rate limiting - 10 requests per minute per user
const RATE_LIMIT = 10;
const RATE_WINDOW = 60000; // 1 minute in ms
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Message length limit
const MAX_MESSAGE_LENGTH = 2000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  // Cleanup old entries periodically (simple garbage collection)
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

interface FeedbackPayload {
  category: string;
  message: string;
  email?: string | null;
  device_info?: {
    platform?: string;
    appVersion?: string;
    userAgent?: string;
    screenSize?: string;
    language?: string;
  };
  app_version?: string;
}

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
  // AUTHENTICATION: Require valid JWT token
  // ============================================
  const authHeader = req.headers.get("Authorization");
  const token = extractBearerToken(authHeader);
  if (!token) {
    console.warn("[FeedbackEmail] Missing authorization header");
    return createJsonResponse(origin, 401, { error: "Unauthorized" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.warn("[FeedbackEmail] Invalid token:", redactError(authError));
    return createJsonResponse(origin, 401, { error: "Invalid token" });
  }

  // Rate limiting check
  if (!checkRateLimit(user.id)) {
    console.warn("[FeedbackEmail] Rate limit exceeded");
    return createJsonResponse(origin, 429, {
      error: "Too many requests. Please wait a minute.",
    });
  }

  // Check if Resend is configured
  if (!RESEND_API_KEY) {
    console.error("[FeedbackEmail] RESEND_API_KEY not configured");
    return createJsonResponse(origin, 500, {
      error: "Email service not configured",
    });
  }

  try {
    const body: FeedbackPayload = await req.json();
    const { category, message, email, device_info, app_version } = body;

    if (!message) {
      return createJsonResponse(origin, 400, { error: "Message is required" });
    }

    // Validate message length to prevent abuse
    if (message.length > MAX_MESSAGE_LENGTH) {
      return createJsonResponse(origin, 400, {
        error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    // Format category for display
    const categoryLabels: Record<string, string> = {
      bug: "🐛 Bug Report",
      feature: "💡 Feature Request",
      other: "❓ Other",
    };
    const categoryLabel = categoryLabels[category] || category;

    // Build email HTML
    const deviceInfoHtml = device_info
      ? `
      <h3>Device Information</h3>
      <ul style="margin: 0; padding-left: 20px; color: #666;">
        <li><strong>Platform:</strong> ${escapeHtml(device_info.platform || "Unknown")}</li>
        <li><strong>App Version:</strong> ${escapeHtml(device_info.appVersion || app_version || "Unknown")}</li>
        <li><strong>Screen Size:</strong> ${escapeHtml(device_info.screenSize || "Unknown")}</li>
        <li><strong>Language:</strong> ${escapeHtml(device_info.language || "Unknown")}</li>
        <li><strong>User Agent:</strong> ${escapeHtml(device_info.userAgent || "Unknown")}</li>
      </ul>
    `
      : "";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #4a9d7c; margin: 0; font-size: 24px;">ZenFlow Feedback</h1>
            <p style="color: #888; margin: 8px 0 0 0; font-size: 14px;">${categoryLabel}</p>
          </div>

          <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #333;">Message</h3>
            <p style="margin: 0; color: #444; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message)}</p>
          </div>

          ${
            email
              ? `
          <div style="margin-bottom: 20px;">
            <h3 style="margin: 0 0 8px 0; color: #333;">Reply To</h3>
            <a href="mailto:${escapeHtml(email)}" style="color: #4a9d7c; text-decoration: none;">${escapeHtml(email)}</a>
          </div>
          `
              : ""
          }

          ${deviceInfoHtml}

          <div style="border-top: 1px solid #eee; padding-top: 16px; margin-top: 20px; text-align: center;">
            <p style="margin: 0; color: #888; font-size: 12px;">
              App Version: ${escapeHtml(app_version || "Unknown")} |
              ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} MSK
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email via Resend API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: ADMIN_EMAIL,
        reply_to: email || undefined,
        subject: `[ZenFlow] ${categoryLabel}`,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("[FeedbackEmail] Resend API error:", errorText);
      return createJsonResponse(origin, 500, {
        error: "Failed to send email",
      });
    }

    const result = await resendResponse.json();
    console.log("[FeedbackEmail] Email sent successfully:", result.id);

    return createJsonResponse(origin, 200, {
      success: true,
      emailId: result.id,
    });
  } catch (error) {
    console.error("[FeedbackEmail] Error:", error);
    return createJsonResponse(origin, 500, { error: "Internal error" });
  }
});

// Helper function to escape HTML entities
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
