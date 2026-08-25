import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdProvider, useAds } from '@/contexts/AdContext';

const adController = vi.hoisted(() => ({
  state: {
    initialized: false,
    sdkAvailable: false,
    canRequestAds: false,
    privacyOptionsRequired: false,
  },
  refreshAdPrivacyOptionsStatus: vi.fn(async () => {
    adController.state = {
      ...adController.state,
      canRequestAds: false,
      privacyOptionsRequired: true,
    };
    return {
      canRequestAds: false,
      privacyOptionsRequired: true,
    };
  }),
  disableAds: vi.fn(),
}));

vi.mock('@/lib/adController', () => ({
  isBannerAdsSupported: vi.fn(() => false),
  initializeAds: vi.fn(async () => false),
  getAdState: vi.fn(() => adController.state),
  showAdPrivacyOptions: vi.fn(async () => ({
    opened: false,
    canRequestAds: false,
    privacyOptionsRequired: adController.state.privacyOptionsRequired,
  })),
  refreshAdPrivacyOptionsStatus: adController.refreshAdPrivacyOptionsStatus,
  disableAds: adController.disableAds,
  showHabitsBanner: vi.fn(async () => ({ shown: false })),
  hideHabitsBanner: vi.fn(async () => undefined),
  removeHabitsBanner: vi.fn(async () => undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

function Probe() {
  const ads = useAds();

  return <div data-testid="privacy-required">{String(ads.privacyOptionsRequired)}</div>;
}

describe('AdContext UMP privacy options', () => {
  it('keeps the UMP privacy-options entry available when local ad consent is off', async () => {
    render(
      <AdProvider adConsent={false} isPremium={false}>
        <Probe />
      </AdProvider>,
    );

    await waitFor(() => {
      expect(adController.disableAds).toHaveBeenCalledWith({ clearPrivacyOptions: false });
      expect(adController.refreshAdPrivacyOptionsStatus).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('privacy-required')).toHaveTextContent('true');
  });
});
