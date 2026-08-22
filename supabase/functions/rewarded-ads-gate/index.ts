import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.4";
import { extractBearerToken } from "../_shared/auth.ts";
import { createJsonResponse, createNoContentResponse } from "../_shared/http.ts";
import { buildRewardedAdsGatePayload } from "./gateResponse.ts";

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    return createNoContentResponse(origin);
  }
  if (request.method !== "POST") {
    return createJsonResponse(origin, 405, { error: "Method not allowed" });
  }

  const token = extractBearerToken(request.headers.get("Authorization"));
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return createJsonResponse(origin, 401, { error: "Unauthorized" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return createJsonResponse(origin, 401, { error: "Unauthorized" });
    }

    const payload = buildRewardedAdsGatePayload({
      ZENFLOW_REWARDED_ADS_ENABLED: Deno.env.get("ZENFLOW_REWARDED_ADS_ENABLED"),
      ZENFLOW_REWARDED_ADS_REVISION: Deno.env.get("ZENFLOW_REWARDED_ADS_REVISION"),
      ZENFLOW_REWARDED_ADS_TTL_SECONDS: Deno.env.get("ZENFLOW_REWARDED_ADS_TTL_SECONDS"),
    });

    return createJsonResponse(origin, 200, { ...payload });
  } catch {
    return createJsonResponse(origin, 503, { error: "Service gate unavailable" });
  }
});
