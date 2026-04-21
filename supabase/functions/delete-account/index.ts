import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractBearerToken } from "../_shared/auth.ts";
import { createJsonResponse, createNoContentResponse } from "../_shared/http.ts";
import { deleteUserJournalMedia } from "./storageCleanup.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return createNoContentResponse(origin);
  }
  if (req.method !== "POST") {
    return createJsonResponse(origin, 405, { error: "Method not allowed" });
  }

  try {
    const token = extractBearerToken(req.headers.get("Authorization"));
    if (!token) return createJsonResponse(origin, 401, { error: "Unauthorized" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return createJsonResponse(origin, 401, { error: "Unauthorized" });
    }

    const userId = data.user.id;

    await deleteUserJournalMedia(supabase.storage, userId);

    // Pre-delete user data from tables that may not CASCADE automatically.
    // Individual failures are non-critical: auth.users ON DELETE CASCADE
    // handles remaining child rows in habits, moods, journal_entries, etc.
    try { await supabase.from("profiles").delete().eq("id", userId); } catch { /* cascade fallback */ }
    try { await supabase.from("user_backups").delete().eq("user_id", userId); } catch { /* cascade fallback */ }
    try { await supabase.from("push_subscriptions").delete().eq("user_id", userId); } catch { /* cascade fallback */ }

    // This is the critical operation — deletes auth.users row,
    // which CASCADE-deletes all child rows in user data tables.
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      return createJsonResponse(origin, 500, { error: "Failed to delete account" });
    }

    return createJsonResponse(origin, 200, { status: "deleted" });
  } catch (_err) {
    return createJsonResponse(origin, 500, { error: "Internal error" });
  }
});
