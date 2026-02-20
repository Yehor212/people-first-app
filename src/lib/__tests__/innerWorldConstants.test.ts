import { describe, it, expect } from 'vitest';

import {
  GROWTH_THRESHOLDS,
  CREATURE_THRESHOLDS,
  GARDEN_STAGE_THRESHOLDS,
  MOOD_COLORS,
  PLANT_EMOJIS,
  CREATURE_EMOJIS,
  COMPANION_EMOJIS,
} from '@/lib/innerWorldConstants';

import type {
  PlantType,
  PlantStage,
  CreatureType,
  CreatureStage,
  CompanionType,
  GardenStage,
  MoodType,
} from '@/types';

// ─── Type arrays for iteration ──────────────────────────────────
const plantStages: PlantStage[] = ['seed', 'sprout', 'growing', 'blooming', 'magnificent'];
const creatureStages: CreatureStage[] = ['egg', 'baby', 'young', 'adult', 'legendary'];
const plantTypes: PlantType[] = ['flower', 'tree', 'crystal', 'mushroom'];
const creatureTypes: CreatureType[] = ['butterfly', 'bird', 'firefly', 'spirit'];
const companionTypes: CompanionType[] = ['fox', 'cat', 'owl', 'rabbit', 'dragon'];
const gardenStages: GardenStage[] = ['empty', 'sprouting', 'growing', 'flourishing', 'magical', 'legendary'];
const moodTypes: MoodType[] = ['great', 'good', 'okay', 'bad', 'terrible'];

// ─── GROWTH_THRESHOLDS ──────────────────────────────────────────

describe('GROWTH_THRESHOLDS', () => {
  it('has all PlantStage keys', () => {
    plantStages.forEach((stage) => {
      expect(GROWTH_THRESHOLDS).toHaveProperty(stage);
    });
  });

  it('seed starts at 0 and values are ascending', () => {
    expect(GROWTH_THRESHOLDS.seed).toBe(0);
    expect(GROWTH_THRESHOLDS.sprout).toBeGreaterThan(0);
    for (let i = 1; i < plantStages.length; i++) {
      expect(GROWTH_THRESHOLDS[plantStages[i]]).toBeGreaterThan(
        GROWTH_THRESHOLDS[plantStages[i - 1]]
      );
    }
  });
});

// ─── CREATURE_THRESHOLDS ────────────────────────────────────────

describe('CREATURE_THRESHOLDS', () => {
  it('has all CreatureStage keys with ascending values', () => {
    creatureStages.forEach((stage) => {
      expect(CREATURE_THRESHOLDS).toHaveProperty(stage);
    });

    for (let i = 1; i < creatureStages.length; i++) {
      expect(CREATURE_THRESHOLDS[creatureStages[i]]).toBeGreaterThan(
        CREATURE_THRESHOLDS[creatureStages[i - 1]]
      );
    }
  });
});

// ─── GARDEN_STAGE_THRESHOLDS ────────────────────────────────────

describe('GARDEN_STAGE_THRESHOLDS', () => {
  it('has all GardenStage keys with ascending values', () => {
    gardenStages.forEach((stage) => {
      expect(GARDEN_STAGE_THRESHOLDS).toHaveProperty(stage);
    });

    for (let i = 1; i < gardenStages.length; i++) {
      expect(GARDEN_STAGE_THRESHOLDS[gardenStages[i]]).toBeGreaterThan(
        GARDEN_STAGE_THRESHOLDS[gardenStages[i - 1]]
      );
    }
  });
});

// ─── MOOD_COLORS ────────────────────────────────────────────────

describe('MOOD_COLORS', () => {
  it('has all 5 MoodType keys with hex color values', () => {
    moodTypes.forEach((mood) => {
      expect(MOOD_COLORS).toHaveProperty(mood);
      expect(MOOD_COLORS[mood]).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});

// ─── PLANT_EMOJIS ───────────────────────────────────────────────

describe('PLANT_EMOJIS', () => {
  it('has all 4 PlantType x 5 PlantStage combinations (no empty strings)', () => {
    plantTypes.forEach((type) => {
      expect(PLANT_EMOJIS).toHaveProperty(type);
      plantStages.forEach((stage) => {
        expect(PLANT_EMOJIS[type]).toHaveProperty(stage);
        expect(PLANT_EMOJIS[type][stage]).toBeTruthy();
        expect(PLANT_EMOJIS[type][stage].length).toBeGreaterThan(0);
      });
    });
  });
});

// ─── CREATURE_EMOJIS ────────────────────────────────────────────

describe('CREATURE_EMOJIS', () => {
  it('has all 4 CreatureType x 5 CreatureStage combinations', () => {
    creatureTypes.forEach((type) => {
      expect(CREATURE_EMOJIS).toHaveProperty(type);
      creatureStages.forEach((stage) => {
        expect(CREATURE_EMOJIS[type]).toHaveProperty(stage);
        expect(CREATURE_EMOJIS[type][stage]).toBeTruthy();
        expect(CREATURE_EMOJIS[type][stage].length).toBeGreaterThan(0);
      });
    });
  });
});

// ─── COMPANION_EMOJIS ───────────────────────────────────────────

describe('COMPANION_EMOJIS', () => {
  it('has all 5 CompanionType keys', () => {
    companionTypes.forEach((type) => {
      expect(COMPANION_EMOJIS).toHaveProperty(type);
      expect(COMPANION_EMOJIS[type]).toBeTruthy();
      expect(COMPANION_EMOJIS[type].length).toBeGreaterThan(0);
    });
  });
});

// ─── Cross-check: enum completeness ────────────────────────────

describe('completeness checks', () => {
  it('GROWTH_THRESHOLDS has exactly 5 entries (one per PlantStage)', () => {
    expect(Object.keys(GROWTH_THRESHOLDS)).toHaveLength(5);
  });

  it('CREATURE_THRESHOLDS has exactly 5 entries (one per CreatureStage)', () => {
    expect(Object.keys(CREATURE_THRESHOLDS)).toHaveLength(5);
  });

  it('GARDEN_STAGE_THRESHOLDS has exactly 6 entries (one per GardenStage)', () => {
    expect(Object.keys(GARDEN_STAGE_THRESHOLDS)).toHaveLength(6);
  });
});
