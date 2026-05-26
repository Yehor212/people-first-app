export const CONTROL_STATE_BINDING = "CONTROL_STATE";
export const CONTROL_STATE_KV_PLACEHOLDER = "REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID";

export interface KvSetupSummary {
  status: "PASS" | "UNVERIFIED" | "FAIL";
  evidence: string[];
}

export function validateKvNamespaceId(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return ["KV namespace id is empty"];
  }
  if (!/^[a-f0-9]{32}$/i.test(trimmed)) {
    return ["KV namespace id must be a 32-character hexadecimal Cloudflare id"];
  }
  return [];
}

export function extractKvNamespaceIdFromWranglerOutput(output: string): string | null {
  const match = output.match(/["']id["']\s*[:=]\s*["']([a-f0-9]{32})["']/i);
  return match?.[1] ?? null;
}

export function summarizeControlStateKvConfig(configText: string): KvSetupSummary {
  if (!configText.trim()) {
    return {
      status: "FAIL",
      evidence: ["wrangler.jsonc is missing or empty"],
    };
  }

  if (configText.includes(CONTROL_STATE_KV_PLACEHOLDER)) {
    return {
      status: "UNVERIFIED",
      evidence: ["wrangler.jsonc still contains REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID"],
    };
  }

  if (!configText.includes(`"binding": "${CONTROL_STATE_BINDING}"`)) {
    return {
      status: "FAIL",
      evidence: ["wrangler.jsonc does not contain the CONTROL_STATE KV binding"],
    };
  }

  return {
    status: "PASS",
    evidence: ["wrangler.jsonc has a non-placeholder CONTROL_STATE KV namespace id"],
  };
}

export function replaceControlStateKvNamespaceId(configText: string, namespaceId: string): string {
  const validationErrors = validateKvNamespaceId(namespaceId);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join("; "));
  }

  const placeholderCount = countOccurrences(configText, CONTROL_STATE_KV_PLACEHOLDER);
  if (placeholderCount !== 1) {
    throw new Error(
      `Expected exactly one ${CONTROL_STATE_KV_PLACEHOLDER} placeholder, found ${placeholderCount}`,
    );
  }

  if (!configText.includes(`"binding": "${CONTROL_STATE_BINDING}"`)) {
    throw new Error("wrangler.jsonc does not contain the CONTROL_STATE KV binding");
  }

  return configText.replace(CONTROL_STATE_KV_PLACEHOLDER, namespaceId);
}

export function redactedKvNamespaceId(namespaceId: string): string {
  const value = namespaceId.trim();
  if (value.length <= 8) {
    return `${value.length} chars`;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)} (${value.length} chars)`;
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}
