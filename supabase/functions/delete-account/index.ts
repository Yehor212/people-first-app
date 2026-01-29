import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  const jsonResponse = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return jsonResponse(401, { error: "Unauthorized" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const userId = data.user.id;
    const tables = [
      "user_backups",
      "user_reminder_settings",
      "push_subscriptions",
      "push_device_tokens",
      "push_logs"
    ];

    for (const table of tables) {
      await supabase.from(table).delete().eq("user_id", userId);
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      return jsonResponse(500, { error: "Failed to delete account" });
    }

    return jsonResponse(200, { status: "deleted" });
  } catch (_err) {
    return jsonResponse(500, { error: "Internal error" });
  }
});
