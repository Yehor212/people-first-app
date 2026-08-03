import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.4";
import { extractBearerToken } from "../_shared/auth.ts";
import { createJsonResponse, createNoContentResponse, parseJsonBody } from "../_shared/http.ts";
import { deletionRequestMatchesAuthenticatedOwner } from "./requestContract.ts";
import {
  type AccountDeletionServiceClient,
  executeInitialAccountDeletion,
} from "./edgeOperation.ts";
import { parseAccountDeletionCapability } from "./operationProtocol.ts";

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
    const [body, bodyError] = await parseJsonBody<{
      expectedOwnerUserId?: string;
      operationId?: string;
      recoverySecret?: string;
    }>(
      req,
      origin,
      1024,
    );
    if (bodyError) return bodyError;
    if (!deletionRequestMatchesAuthenticatedOwner(body?.expectedOwnerUserId, userId)) {
      return createJsonResponse(origin, 409, { error: "Account changed before deletion" });
    }
    const capability = parseAccountDeletionCapability(body, [
      "expectedOwnerUserId",
    ]);
    if (!capability) {
      return createJsonResponse(origin, 400, { error: "Invalid deletion request" });
    }

    const result = await executeInitialAccountDeletion(
      supabase as unknown as AccountDeletionServiceClient,
      capability,
      userId,
    );

    if (result.status === "invalid") {
      return createJsonResponse(origin, 404, { error: "Deletion operation not found" });
    }
    if (result.status === "pending") {
      const response = createJsonResponse(origin, 202, {
        status: "pending",
        operationId: capability.operationId,
      });
      response.headers.set("Retry-After", "2");
      return response;
    }
    return createJsonResponse(origin, 200, {
      status: "deleted",
      operationId: capability.operationId,
    });
  } catch (_err) {
    return createJsonResponse(origin, 500, { error: "Internal error" });
  }
});
