import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractBearerToken } from "../_shared/auth.ts";
import { createJsonResponse, createNoContentResponse, parseJsonBody } from "../_shared/http.ts";
import { deleteUserJournalMedia } from "./storageCleanup.ts";
import { runAccountDeletionBarrier } from "./deletionBarrier.ts";
import { deletionRequestMatchesAuthenticatedOwner } from "./requestContract.ts";
import { deleteAccountOwnedRows } from "./rowCleanup.ts";

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
    const [body, bodyError] = await parseJsonBody<{ expectedOwnerUserId?: string }>(
      req,
      origin,
      1024,
    );
    if (bodyError) return bodyError;
    if (!deletionRequestMatchesAuthenticatedOwner(body?.expectedOwnerUserId, userId)) {
      return createJsonResponse(origin, 409, { error: "Account changed before deletion" });
    }

    await runAccountDeletionBarrier({
      blockStorageWrites: async () => {
        const { error: blockError } = await supabase
          .from("account_deletion_blocks")
          .upsert({ user_id: userId, blocked_at: new Date().toISOString() });
        if (blockError) throw new Error("Failed to block account storage writes");
      },
      purgeMedia: () => deleteUserJournalMedia(supabase.storage, userId),
      purgeRows: () => deleteAccountOwnedRows(supabase, userId),
      deleteAuthUser: async () => {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
        if (deleteError) throw new Error("Failed to delete account");
      },
      releaseStorageBlock: async () => {
        const { error: releaseError } = await supabase
          .from("account_deletion_blocks")
          .delete()
          .eq("user_id", userId);
        if (releaseError) throw new Error("Failed to release account storage block");
      },
    });

    return createJsonResponse(origin, 200, { status: "deleted", userId });
  } catch (_err) {
    return createJsonResponse(origin, 500, { error: "Internal error" });
  }
});
