import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { RewardedAdPrompt } from '@/components/ads/RewardedAdPrompt';

const repoRoot = process.cwd();
const rewardedPromptPath = 'src/components/ads/RewardedAdPrompt.tsx';
const adJourneyPath = 'docs/AD_SYSTEM_JOURNEY.md';
const adConfigPath = 'src/lib/adConfig.ts';
const adPressurePattern = /left today|remaining today|restantes aujourd'hui|verbleibend|残り|متبق|נותרו היום|залишилось сьогодні|need treats\? watch|needs treats|can't (feed|water)|needs you|care failure|streak harm|countdown|support us/i;

function collectSourceFiles(dir: string): string[] {
  return readdirSync(join(repoRoot, dir), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') return [];
      return collectSourceFiles(relativePath);
    }

    if (!entry.isFile()) return [];
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [relativePath];
  });
}

const adState = vi.hoisted(() => ({
  watchRewardedAd: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/contexts/AdContext', () => ({
  useAds: () => ({
    adsAvailable: true,
    canShowRewarded: true,
    remainingToday: 2,
    watchRewardedAd: adState.watchRewardedAd,
    rewardTreats: 20,
    rewardXp: 5,
    setCurrentMood: vi.fn(),
  }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      adWatchToEarn: 'Optional ad: watch for a small bonus',
      adWatch: 'Watch optional ad',
      adRewardLabel: '+{treats} treats',
      adRemainingToday: 'Daily optional limit applies',
      treats: 'treats',
    },
  }),
}));

describe('RewardedAdPrompt UX contract', () => {
  it('does not allow generic rewarded-ad placement contexts', () => {
    const source = readFileSync(rewardedPromptPath, 'utf8');
    const adConfig = readFileSync(adConfigPath, 'utf8');

    expect(source).not.toContain("'general'");
    expect(source).not.toContain("'settings'");
    expect(source).toContain("'optional_rewards'");
    expect(adConfig).not.toMatch(/'settings'\s*,\s*\/\/ Settings page/);
    expect(adConfig).toContain("'optional_rewards'");
  });

  it('keeps rewarded playback out of privacy control surfaces', () => {
    const privacySurfaces = [
      'src/components/settings/PrivacySection.tsx',
      'src/pages/nav-v2/settings/V2SettingsDataPanels.tsx',
      'src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx',
    ];

    for (const path of privacySurfaces) {
      const source = readFileSync(join(repoRoot, path), 'utf8');
      expect(source).not.toContain('RewardedAdPrompt');
      expect(source).not.toContain('watchRewardedAd');
    }
  });

  it('keeps rewarded ad playback behind the opt-in prompt UI', () => {
    const sourceRoots = ['src/components', 'src/features', 'src/pages']
      .filter((dir) => statSync(join(repoRoot, dir), { throwIfNoEntry: false })?.isDirectory());
    const bypasses = sourceRoots
      .flatMap(collectSourceFiles)
      .filter((path) => path !== rewardedPromptPath)
      .flatMap((path) => {
        const source = readFileSync(join(repoRoot, path), 'utf8');
        const controllerPlaybackApi = /\bshowRewardedAd\b/.test(source);
        const contextPlaybackApi = /\bwatchRewardedAd\b/.test(source);

        return controllerPlaybackApi || contextPlaybackApi ? [path] : [];
      });

    expect(bypasses).toEqual([]);
  });

  it('uses explicit optional-ad copy and a 44px compact touch target', () => {
    render(<RewardedAdPrompt context="post_focus" compact />);

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Optional ad');
    expect(button.className).toContain('min-h-[44px]');
    expect(button).not.toHaveTextContent('left today');
  });

  it('does not use rewarded-ad quota, countdown, or pressure copy', () => {
    const promptSource = readFileSync(rewardedPromptPath, 'utf8');
    const adJourney = readFileSync(adJourneyPath, 'utf8');
    const adConfig = readFileSync(adConfigPath, 'utf8');
    const languageSources = readdirSync(join(repoRoot, 'src/i18n/languages'))
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .map((file) => readFileSync(join(repoRoot, 'src/i18n/languages', file), 'utf8'));

    const implementationAndPolicyCopy = [promptSource, adJourney, adConfig]
      .flatMap((source) => source.split('\n'))
      .filter((line) => /adRemaining|adWatch|adReward|RewardedAdPrompt|rewarded ad|optional ad|AD_SAFE_ZONES|companion/i.test(line))
      .join('\n');
    const localizedAdCopy = languageSources
      .flatMap((source) => source.split('\n'))
      .filter((line) => /adRemaining|adWatch|adReward|rewarded ad|optional ad/i.test(line))
      .join('\n');
    const adSpecificCopy = `${implementationAndPolicyCopy}\n${localizedAdCopy}`;

    expect(adSpecificCopy).not.toMatch(adPressurePattern);
  });

  it('keeps the watch action user-initiated', () => {
    render(<RewardedAdPrompt context="daily_rewards" compact />);

    expect(adState.watchRewardedAd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button'));
    expect(adState.watchRewardedAd).toHaveBeenCalledTimes(1);
    expect(adState.watchRewardedAd).toHaveBeenCalledWith('daily_rewards');
  });
});
