import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.4";
import { createJsonResponse, createNoContentResponse, parseJsonBody } from "../_shared/http.ts";
import {
  type AccountDeletionServiceClient,
  executeRecoveryAccountDeletion,
} from "../delete-account/edgeOperation.ts";
import {
  hashAccountDeletionRecoverySecret,
  parseAccountDeletionCapability,
} from "../delete-account/operationProtocol.ts";
import {
  createRecoveryAdmissionRejectionResponse,
  parseRecoveryAdmission,
} from "./recoveryAdmission.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") return createNoContentResponse(origin);
  if (req.method !== "POST") {
    return createJsonResponse(origin, 405, { error: "Method not allowed" });
  }

  try {
    const [body, bodyError] = await parseJsonBody(req, origin, 1024);
    if (bodyError) return bodyError;
    const capability = parseAccountDeletionCapability(body);
    if (!capability) {
      return createJsonResponse(origin, 404, {
        error: "Deletion operation not found",
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const recoveryHash = await hashAccountDeletionRecoverySecret(capability.recoverySecret);
    const { data: admissionData, error: admissionError } = await supabase.rpc(
      "admit_account_deletion_recovery_attempt",
      {
        p_operation_id: capability.operationId,
        p_recovery_secret_hash: recoveryHash,
      }
    );
    if (admissionError) {
      throw new Error("Account deletion recovery admission unavailable");
    }
    const admission = parseRecoveryAdmission(admissionData);
    if (!admission) {
      throw new Error("Invalid account deletion recovery admission response");
    }
    const admissionRejection = createRecoveryAdmissionRejectionResponse(origin, admission);
    if (admissionRejection) return admissionRejection;

    const result = await executeRecoveryAccountDeletion(
      supabase as unknown as AccountDeletionServiceClient,
      capability
    );
    if (result.status === "invalid") {
      return createJsonResponse(origin, 404, {
        error: "Deletion operation not found",
      });
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
  } catch {
    return createJsonResponse(origin, 503, { error: "Deletion retry unavailable" });
  }
});
