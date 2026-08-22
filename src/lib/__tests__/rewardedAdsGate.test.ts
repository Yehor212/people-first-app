import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: harness.invoke,
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
}));

describe('rewarded ads service gate', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.useRealTimers();
    harness.invoke.mockReset();
    localStorage.clear();
  });

  it('accepts a bounded service-owned ON response without persisting it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T06:00:00.000Z'));
    harness.invoke.mockResolvedValueOnce({
      data: { enabled: true, revision: 'release-2.1-owner-checkpoint', validForSeconds: 120 },
      error: null,
    });
    const { refreshRewardedAdsGate, getRewardedAdsGateState } = await import('../rewardedAdsGate');

    await expect(refreshRewardedAdsGate()).resolves.toBe(true);
    expect(getRewardedAdsGateState()).toEqual({
      enabled: true,
      revision: 'release-2.1-owner-checkpoint',
      checkedAt: Date.now(),
      expiresAt: Date.now() + 120_000,
    });
    expect(localStorage.length).toBe(0);
  });

  it('caps an overlong server TTL and fails closed immediately after expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T06:00:00.000Z'));
    harness.invoke.mockResolvedValueOnce({
      data: { enabled: true, revision: 'r1', validForSeconds: 86_400 },
      error: null,
    });
    const { MAX_REWARDED_ADS_GATE_TTL_MS, refreshRewardedAdsGate, isRewardedAdsGateOpen } =
      await import('../rewardedAdsGate');

    await expect(refreshRewardedAdsGate()).resolves.toBe(true);
    vi.advanceTimersByTime(MAX_REWARDED_ADS_GATE_TTL_MS - 1);
    expect(isRewardedAdsGateOpen()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isRewardedAdsGateOpen()).toBe(false);
  });

  it.each([
    { data: null, error: new Error('offline') },
    { data: { enabled: true, revision: '', validForSeconds: 120 }, error: null },
    { data: { enabled: true, revision: 'r1', validForSeconds: 0 }, error: null },
    { data: { enabled: 'true', revision: 'r1', validForSeconds: 120 }, error: null },
  ])('clears a prior ON state on network or schema failure: %o', async response => {
    harness.invoke
      .mockResolvedValueOnce({
        data: { enabled: true, revision: 'r1', validForSeconds: 120 },
        error: null,
      })
      .mockResolvedValueOnce(response);
    const { refreshRewardedAdsGate, isRewardedAdsGateOpen } = await import('../rewardedAdsGate');
    await expect(refreshRewardedAdsGate()).resolves.toBe(true);

    await expect(refreshRewardedAdsGate({ force: true })).resolves.toBe(false);
    expect(isRewardedAdsGateOpen()).toBe(false);
  });

  it('treats an explicit service OFF as authoritative and short-lived', async () => {
    harness.invoke.mockResolvedValueOnce({
      data: { enabled: false, revision: 'incident-42', validForSeconds: 60 },
      error: null,
    });
    const { refreshRewardedAdsGate, getRewardedAdsGateState, isRewardedAdsGateOpen } =
      await import('../rewardedAdsGate');

    await expect(refreshRewardedAdsGate()).resolves.toBe(false);
    expect(isRewardedAdsGateOpen()).toBe(false);
    expect(getRewardedAdsGateState()).toMatchObject({
      enabled: false,
      revision: 'incident-42',
    });
  });

  it('coalesces concurrent refreshes and reuses only a still-fresh in-memory result', async () => {
    let resolveInvoke!: (value: {
      data: { enabled: boolean; revision: string; validForSeconds: number };
      error: null;
    }) => void;
    harness.invoke.mockReturnValueOnce(new Promise(resolve => {
      resolveInvoke = resolve;
    }));
    const { refreshRewardedAdsGate } = await import('../rewardedAdsGate');

    const first = refreshRewardedAdsGate();
    const second = refreshRewardedAdsGate();
    expect(harness.invoke).toHaveBeenCalledTimes(1);
    resolveInvoke({
      data: { enabled: true, revision: 'r2', validForSeconds: 120 },
      error: null,
    });

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    await expect(refreshRewardedAdsGate()).resolves.toBe(true);
    expect(harness.invoke).toHaveBeenCalledTimes(1);
  });
});
