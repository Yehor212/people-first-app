export const DEFAULT_REWARDED_ADS_GATE_TTL_SECONDS = 60;
export const MAX_REWARDED_ADS_GATE_TTL_SECONDS = 300;

const UNCONFIGURED_REVISION = "unconfigured";
const REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PLACEHOLDER_REVISIONS = new Set([
  UNCONFIGURED_REVISION,
  "placeholder",
  "changeme",
  "replace-me",
]);

export interface RewardedAdsGateEnvironment {
  ZENFLOW_REWARDED_ADS_ENABLED?: string;
  ZENFLOW_REWARDED_ADS_REVISION?: string;
  ZENFLOW_REWARDED_ADS_TTL_SECONDS?: string;
}

export interface RewardedAdsGatePayload {
  enabled: boolean;
  revision: string;
  validForSeconds: number;
}

function parseRevision(rawRevision: string | undefined): string {
  const revision = rawRevision?.trim() ?? "";
  if (!REVISION_PATTERN.test(revision)) return UNCONFIGURED_REVISION;
  if (PLACEHOLDER_REVISIONS.has(revision.toLowerCase())) return UNCONFIGURED_REVISION;
  return revision;
}

function parseTtlSeconds(rawTtl: string | undefined): number {
  if (!rawTtl || !/^\d+$/.test(rawTtl)) {
    return DEFAULT_REWARDED_ADS_GATE_TTL_SECONDS;
  }

  const parsed = Number(rawTtl);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return DEFAULT_REWARDED_ADS_GATE_TTL_SECONDS;
  }

  return Math.min(parsed, MAX_REWARDED_ADS_GATE_TTL_SECONDS);
}

export function buildRewardedAdsGatePayload(
  environment: RewardedAdsGateEnvironment,
): RewardedAdsGatePayload {
  const revision = parseRevision(environment.ZENFLOW_REWARDED_ADS_REVISION);
  const enabled = environment.ZENFLOW_REWARDED_ADS_ENABLED === "true" &&
    revision !== UNCONFIGURED_REVISION;

  return {
    enabled,
    revision,
    validForSeconds: parseTtlSeconds(environment.ZENFLOW_REWARDED_ADS_TTL_SECONDS),
  };
}
