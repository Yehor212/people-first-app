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
  initializeAds: vi.fn(async () => false),
}));

vi.mock('@/lib/adController', () => ({
  isBannerAdsSupported: vi.fn(() => false),
  initializeAds: adController.initializeAds,
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
  it('does not contact UMP when age eligibility is unknown', async () => {
    render(
      <AdProvider adConsent adAgeEligibility="unknown" isPremium={false}>
        <Probe />
      </AdProvider>,
    );

    await waitFor(() => {
      expect(adController.disableAds).toHaveBeenCalledWith({ clearPrivacyOptions: true });
    });
    expect(adController.initializeAds).not.toHaveBeenCalled();
    expect(adController.refreshAdPrivacyOptionsStatus).not.toHaveBeenCalled();
    expect(screen.getByTestId('privacy-required')).toHaveTextContent('false');
  });

  it('refreshes UMP privacy choices for an adult even when the optional banner is off', async () => {
    render(
      <AdProvider adConsent={false} adAgeEligibility="adult" isPremium={false}>
        <Probe />
      </AdProvider>,
    );

    await waitFor(() => {
      expect(adController.disableAds).toHaveBeenCalledWith({ clearPrivacyOptions: false });
    });
    expect(adController.initializeAds).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(adController.refreshAdPrivacyOptionsStatus).toHaveBeenCalledWith({
        ageEligibility: 'adult',
      });
      expect(screen.getByTestId('privacy-required')).toHaveTextContent('true');
    });
  });
});
