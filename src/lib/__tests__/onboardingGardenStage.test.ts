import { describe, it, expect } from 'vitest';
import {
  computeGardenGateStage,
  getFeaturesForGardenStage,
  getGardenGateInfo,
} from '@/lib/onboardingFlow';
import type { GardenGateStage, FeatureId } from '@/lib/onboardingFlow';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stats(overrides: {
  habitsCompleted?: number;
  focusSessionsCompleted?: number;
  journalEntries?: number;
  daysActive?: number;
}) {
  return {
    habitsCompleted: overrides.habitsCompleted ?? 0,
    focusSessionsCompleted: overrides.focusSessionsCompleted ?? 0,
    journalEntries: overrides.journalEntries ?? 0,
    daysActive: overrides.daysActive ?? 1,
  };
}

// ---------------------------------------------------------------------------
// computeGardenGateStage
// ---------------------------------------------------------------------------

describe('computeGardenGateStage', () => {
  it('returns seed for a fresh user with no activity', () => {
    expect(computeGardenGateStage(stats({}))).toBe('seed');
  });

  it('returns seed when habitsCompleted is below the sprout threshold (< 3)', () => {
    expect(computeGardenGateStage(stats({ habitsCompleted: 2 }))).toBe('seed');
  });

  it('returns sprout after completing 3 habits', () => {
    expect(computeGardenGateStage(stats({ habitsCompleted: 3 }))).toBe('sprout');
  });

  it('returns sprout when habits are 3 but focus is 0 (growing not yet reached)', () => {
    expect(computeGardenGateStage(stats({ habitsCompleted: 3, focusSessionsCompleted: 0 }))).toBe('sprout');
  });

  it('returns sprout when focus sessions >= 1 but habits < 5 (growing not yet reached)', () => {
    expect(computeGardenGateStage(stats({ habitsCompleted: 4, focusSessionsCompleted: 1 }))).toBe('sprout');
  });

  it('returns growing after 1 focus session and 5 habits completed', () => {
    expect(
      computeGardenGateStage(stats({ focusSessionsCompleted: 1, habitsCompleted: 5 }))
    ).toBe('growing');
  });

  it('returns growing when habits > 5 and focus >= 1, but journal and days do not meet blooming', () => {
    expect(
      computeGardenGateStage(stats({ focusSessionsCompleted: 2, habitsCompleted: 10, journalEntries: 1, daysActive: 5 }))
    ).toBe('growing');
  });

  it('returns blooming after 3 journal entries and 7 days active', () => {
    expect(
      computeGardenGateStage(stats({
        journalEntries: 3,
        daysActive: 7,
        focusSessionsCompleted: 1,
        habitsCompleted: 5,
      }))
    ).toBe('blooming');
  });

  it('returns growing when journal entries >= 3 but daysActive < 7', () => {
    expect(
      computeGardenGateStage(stats({
        journalEntries: 3,
        daysActive: 6,
        focusSessionsCompleted: 1,
        habitsCompleted: 5,
      }))
    ).toBe('growing');
  });

  it('returns growing when daysActive >= 7 but journalEntries < 3 (blooming not reached)', () => {
    expect(
      computeGardenGateStage(stats({
        journalEntries: 2,
        daysActive: 7,
        focusSessionsCompleted: 1,
        habitsCompleted: 5,
      }))
    ).toBe('growing');
  });

  it('returns flourishing after 14 days active regardless of other stats', () => {
    expect(computeGardenGateStage(stats({ daysActive: 14 }))).toBe('flourishing');
  });

  it('returns flourishing even with no other activity when daysActive is 14', () => {
    expect(
      computeGardenGateStage(stats({
        daysActive: 14,
        habitsCompleted: 0,
        focusSessionsCompleted: 0,
        journalEntries: 0,
      }))
    ).toBe('flourishing');
  });

  it('returns flourishing for daysActive > 14', () => {
    expect(computeGardenGateStage(stats({ daysActive: 30 }))).toBe('flourishing');
  });

  it('flourishing takes priority over blooming when both conditions are met', () => {
    expect(
      computeGardenGateStage(stats({
        daysActive: 14,
        journalEntries: 5,
        focusSessionsCompleted: 3,
        habitsCompleted: 10,
      }))
    ).toBe('flourishing');
  });
});

// ---------------------------------------------------------------------------
// getFeaturesForGardenStage
// ---------------------------------------------------------------------------

describe('getFeaturesForGardenStage', () => {
  it('seed stage returns only mood and habits', () => {
    const features = getFeaturesForGardenStage('seed');
    expect(features).toContain('mood');
    expect(features).toContain('habits');
    expect(features).toHaveLength(2);
  });

  it('sprout stage includes seed features plus focusTimer', () => {
    const features = getFeaturesForGardenStage('sprout');
    expect(features).toContain('mood');
    expect(features).toContain('habits');
    expect(features).toContain('focusTimer');
  });

  it('growing stage includes all previous features plus companion', () => {
    const features = getFeaturesForGardenStage('growing');
    expect(features).toContain('mood');
    expect(features).toContain('habits');
    expect(features).toContain('focusTimer');
    expect(features).toContain('companion');
  });

  it('blooming stage includes all previous features plus challenges and quests', () => {
    const features = getFeaturesForGardenStage('blooming');
    expect(features).toContain('mood');
    expect(features).toContain('habits');
    expect(features).toContain('focusTimer');
    expect(features).toContain('companion');
    expect(features).toContain('challenges');
    expect(features).toContain('quests');
  });

  it('flourishing returns all features across all stages', () => {
    const features = getFeaturesForGardenStage('flourishing');
    const allExpected: FeatureId[] = [
      'mood', 'habits', 'focusTimer', 'companion', 'challenges', 'quests', 'tasks', 'xp',
    ];
    for (const f of allExpected) {
      expect(features).toContain(f);
    }
  });

  it('flourishing stage returns all eight feature ids', () => {
    const features = getFeaturesForGardenStage('flourishing');
    expect(features).toHaveLength(8);
  });

  it('stages are cumulative — each stage is a superset of the previous one', () => {
    const stageOrder: GardenGateStage[] = ['seed', 'sprout', 'growing', 'blooming', 'flourishing'];
    for (let i = 1; i < stageOrder.length; i++) {
      const prev = getFeaturesForGardenStage(stageOrder[i - 1]);
      const curr = getFeaturesForGardenStage(stageOrder[i]);
      for (const f of prev) {
        expect(curr).toContain(f);
      }
    }
  });

  it('each subsequent stage has more features than the previous', () => {
    const stageOrder: GardenGateStage[] = ['seed', 'sprout', 'growing', 'blooming', 'flourishing'];
    for (let i = 1; i < stageOrder.length; i++) {
      const prev = getFeaturesForGardenStage(stageOrder[i - 1]);
      const curr = getFeaturesForGardenStage(stageOrder[i]);
      expect(curr.length).toBeGreaterThan(prev.length);
    }
  });

  it('sprout stage does not include companion or later features', () => {
    const features = getFeaturesForGardenStage('sprout');
    expect(features).not.toContain('companion');
    expect(features).not.toContain('challenges');
    expect(features).not.toContain('quests');
    expect(features).not.toContain('tasks');
    expect(features).not.toContain('xp');
  });

  it('growing stage does not include challenges, quests, tasks, or xp', () => {
    const features = getFeaturesForGardenStage('growing');
    expect(features).not.toContain('challenges');
    expect(features).not.toContain('quests');
    expect(features).not.toContain('tasks');
    expect(features).not.toContain('xp');
  });
});

// ---------------------------------------------------------------------------
// getGardenGateInfo
// ---------------------------------------------------------------------------

describe('getGardenGateInfo', () => {
  describe('seed stage', () => {
    it('returns the sprout icon 🌱', () => {
      expect(getGardenGateInfo('seed').icon).toBe('🌱');
    });

    it('returns a non-empty companion message', () => {
      const { companionMessage } = getGardenGateInfo('seed');
      expect(typeof companionMessage).toBe('string');
      expect(companionMessage.length).toBeGreaterThan(0);
    });

    it('has nextStage = sprout', () => {
      expect(getGardenGateInfo('seed').nextStage).toBe('sprout');
    });

    it('has a nextCondition string', () => {
      const { nextCondition } = getGardenGateInfo('seed');
      expect(typeof nextCondition).toBe('string');
      expect(nextCondition?.length).toBeGreaterThan(0);
    });
  });

  describe('sprout stage', () => {
    it('returns the sprout icon 🌿', () => {
      expect(getGardenGateInfo('sprout').icon).toBe('🌿');
    });

    it('has nextStage = growing', () => {
      expect(getGardenGateInfo('sprout').nextStage).toBe('growing');
    });
  });

  describe('growing stage', () => {
    it('returns the tree icon 🌳', () => {
      expect(getGardenGateInfo('growing').icon).toBe('🌳');
    });

    it('has nextStage = blooming', () => {
      expect(getGardenGateInfo('growing').nextStage).toBe('blooming');
    });
  });

  describe('blooming stage', () => {
    it('returns the blossom icon 🌸', () => {
      expect(getGardenGateInfo('blooming').icon).toBe('🌸');
    });

    it('has nextStage = flourishing', () => {
      expect(getGardenGateInfo('blooming').nextStage).toBe('flourishing');
    });
  });

  describe('flourishing stage', () => {
    it('returns the house icon 🏡', () => {
      expect(getGardenGateInfo('flourishing').icon).toBe('🏡');
    });

    it('has no nextStage (undefined)', () => {
      expect(getGardenGateInfo('flourishing').nextStage).toBeUndefined();
    });

    it('has no nextCondition (undefined)', () => {
      expect(getGardenGateInfo('flourishing').nextCondition).toBeUndefined();
    });

    it('companionMessage is a non-empty string', () => {
      const { companionMessage } = getGardenGateInfo('flourishing');
      expect(typeof companionMessage).toBe('string');
      expect(companionMessage.length).toBeGreaterThan(0);
    });
  });

  describe('all stages return the expected structure', () => {
    const allStages: GardenGateStage[] = ['seed', 'sprout', 'growing', 'blooming', 'flourishing'];

    for (const stage of allStages) {
      it(`${stage}: always returns icon and companionMessage`, () => {
        const info = getGardenGateInfo(stage);
        expect(typeof info.icon).toBe('string');
        expect(info.icon.length).toBeGreaterThan(0);
        expect(typeof info.companionMessage).toBe('string');
        expect(info.companionMessage.length).toBeGreaterThan(0);
      });
    }

    it('non-final stages all have a defined nextStage and nextCondition', () => {
      const nonFinal: GardenGateStage[] = ['seed', 'sprout', 'growing', 'blooming'];
      for (const stage of nonFinal) {
        const info = getGardenGateInfo(stage);
        expect(info.nextStage).toBeDefined();
        expect(info.nextCondition).toBeDefined();
      }
    });

    it('nextStage chain is seed→sprout→growing→blooming→flourishing', () => {
      expect(getGardenGateInfo('seed').nextStage).toBe('sprout');
      expect(getGardenGateInfo('sprout').nextStage).toBe('growing');
      expect(getGardenGateInfo('growing').nextStage).toBe('blooming');
      expect(getGardenGateInfo('blooming').nextStage).toBe('flourishing');
      expect(getGardenGateInfo('flourishing').nextStage).toBeUndefined();
    });
  });
});
