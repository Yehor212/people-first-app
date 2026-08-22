import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';

export const MAX_REWARDED_ADS_GATE_TTL_MS = 5 * 60 * 1000;
const MIN_REWARDED_ADS_GATE_TTL_SECONDS = 1;
const GATE_FUNCTION_NAME = 'rewarded-ads-gate';

export interface RewardedAdsGateState {
  enabled: boolean;
  revision: string;
  checkedAt: number;
  expiresAt: number;
}

interface RewardedAdsGatePayload {
  enabled: boolean;
  revision: string;
  validForSeconds: number;
}

let gateState: RewardedAdsGateState | null = null;
let refreshPromise: Promise<boolean> | null = null;

function isGatePayload(value: unknown): value is RewardedAdsGatePayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RewardedAdsGatePayload>;
  return (
    typeof candidate.enabled === 'boolean' &&
    typeof candidate.revision === 'string' &&
    candidate.revision.trim().length > 0 &&
    candidate.revision.length <= 128 &&
    typeof candidate.validForSeconds === 'number' &&
    Number.isSafeInteger(candidate.validForSeconds) &&
    candidate.validForSeconds >= MIN_REWARDED_ADS_GATE_TTL_SECONDS
  );
}

function clearGateState(): void {
  gateState = null;
}

export function getRewardedAdsGateState(): RewardedAdsGateState | null {
  return gateState ? { ...gateState } : null;
}

export function isRewardedAdsGateOpen(now = Date.now()): boolean {
  return gateState?.enabled === true && now < gateState.expiresAt;
}

async function requestRewardedAdsGate(): Promise<boolean> {
  if (!supabase) {
    clearGateState();
    return false;
  }

  try {
    const { data, error } = await supabase.functions.invoke(GATE_FUNCTION_NAME, {
      body: {},
    });
    if (error || !isGatePayload(data)) {
      clearGateState();
      logger.warn('[Ads] Rewarded-ads service gate unavailable; ads disabled');
      return false;
    }

    const checkedAt = Date.now();
    const requestedTtlMs = data.validForSeconds * 1000;
    gateState = {
      enabled: data.enabled,
      revision: data.revision,
      checkedAt,
      expiresAt: checkedAt + Math.min(requestedTtlMs, MAX_REWARDED_ADS_GATE_TTL_MS),
    };
    return isRewardedAdsGateOpen(checkedAt);
  } catch (error) {
    clearGateState();
    logger.warn('[Ads] Rewarded-ads service gate refresh failed; ads disabled', error);
    return false;
  }
}

export async function refreshRewardedAdsGate(
  options: { force?: boolean } = {},
): Promise<boolean> {
  if (!options.force && gateState && Date.now() < gateState.expiresAt) {
    return gateState.enabled;
  }
  if (refreshPromise) return refreshPromise;

  refreshPromise = requestRewardedAdsGate().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export function resetRewardedAdsGateForTests(): void {
  gateState = null;
  refreshPromise = null;
}
