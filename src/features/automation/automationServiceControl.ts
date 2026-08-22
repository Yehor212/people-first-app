import { z } from "zod";

import { supabase } from "@/lib/supabaseClient";
import {
  resolveAutomationServiceGate,
  type AutomationServiceGateResult,
} from "./automationGate";

const AUTOMATION_SERVICE_FLAG_KEY = "automation.connected-records.v1";
const AUTOMATION_SERVICE_CONTROL_TTL_MS = 60_000;

const serviceFlagRowSchema = z
  .object({
    enabled: z.boolean(),
    rollout_percent: z.number().int().min(0).max(100),
    killswitch: z.boolean(),
  })
  .strict();

interface ServiceFlagQueryResult {
  data: unknown;
  error: unknown;
}

interface ServiceFlagClient {
  from(name: "design_flags"): {
    select(columns: string): {
      eq(column: "key", value: string): {
        maybeSingle(): PromiseLike<ServiceFlagQueryResult>;
      };
    };
  };
}

export async function resolveFreshAutomationServiceGate(): Promise<AutomationServiceGateResult> {
  if (typeof navigator === "undefined" || !navigator.onLine || !supabase) {
    return { allowed: false, code: "SERVICE_REFRESH_UNAVAILABLE" };
  }

  let response: ServiceFlagQueryResult;
  try {
    response = await (supabase as unknown as ServiceFlagClient)
      .from("design_flags")
      .select("enabled, rollout_percent, killswitch")
      .eq("key", AUTOMATION_SERVICE_FLAG_KEY)
      .maybeSingle();
  } catch {
    return { allowed: false, code: "SERVICE_REFRESH_UNAVAILABLE" };
  }
  if (response.error) {
    return { allowed: false, code: "SERVICE_REFRESH_UNAVAILABLE" };
  }
  if (response.data === null) {
    return { allowed: false, code: "SERVICE_CONTROL_MISSING" };
  }
  const parsed = serviceFlagRowSchema.safeParse(response.data);
  if (!parsed.success) {
    return { allowed: false, code: "SERVICE_CONTROL_INVALID" };
  }

  const fetchedAt = Date.now();
  return resolveAutomationServiceGate({
    now: fetchedAt,
    fetchState: "success",
    control: {
      schemaVersion: 1,
      enabled: parsed.data.enabled && parsed.data.rollout_percent === 100,
      fetchedAt,
      expiresAt: fetchedAt + AUTOMATION_SERVICE_CONTROL_TTL_MS,
    },
    emergencyDisabled: parsed.data.killswitch,
  });
}
