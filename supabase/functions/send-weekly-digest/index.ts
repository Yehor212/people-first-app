/**
 * Retired weekly digest endpoint.
 *
 * The previous implementation inferred mood trends from check-in frequency and
 * could emit progress facts after partial backend failures. Keeping an
 * authenticated no-send endpoint makes any remaining cron invocation harmless
 * while deployment owners remove the schedule.
 */

import { isAuthorizedRequest } from "../_shared/auth.ts";
import {
  createJsonResponse,
  createNoContentResponse,
} from "../_shared/http.ts";

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return createNoContentResponse(origin);
  }
  if (req.method !== "POST") {
    return createJsonResponse(origin, 405, { error: "Method not allowed" });
  }

  const authorized = isAuthorizedRequest({
    authHeader: req.headers.get("Authorization"),
    cronSecretHeader: req.headers.get("X-Cron-Secret"),
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    cronSecret: CRON_SECRET,
  });
  if (!authorized) {
    return createJsonResponse(origin, 401, { error: "Unauthorized" });
  }

  return createJsonResponse(origin, 200, {
    success: true,
    retired: true,
    sent: 0,
    message: "Weekly digest is retired",
  });
});
