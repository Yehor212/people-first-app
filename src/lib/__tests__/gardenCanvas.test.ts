import { describe, it, expect } from 'vitest';
import { PLANT_ICON_MAP, CREATURE_ICON_MAP, STAGE_SCALE } from '@/components/GardenCanvas';
import type { PlantType, PlantStage, CreatureType } from '@/types';

describe('GardenCanvas icon mappings', () => {
  const ALL_PLANT_TYPES: PlantType[] = [
    'flower', 'tree', 'crystal', 'mushroom', 'story', 'air_plant', 'rest_flower',
  ];

  const ALL_CREATURE_TYPES: CreatureType[] = [
    'butterfly', 'bird', 'firefly', 'spirit',
  ];

  const ALL_PLANT_STAGES: PlantStage[] = [
    'seed', 'sprout', 'growing', 'blooming', 'magnificent',
  ];

  it('should have a lucide icon for every PlantType', () => {
    for (const type of ALL_PLANT_TYPES) {
      expect(PLANT_ICON_MAP[type], `Missing icon for plant type "${type}"`).toBeDefined();
      expect(PLANT_ICON_MAP[type]).toBeTruthy();
    }
  });

  it('should have a lucide icon for every CreatureType', () => {
    for (const type of ALL_CREATURE_TYPES) {
      expect(CREATURE_ICON_MAP[type], `Missing icon for creature type "${type}"`).toBeDefined();
      expect(CREATURE_ICON_MAP[type]).toBeTruthy();
    }
  });

  it('should have scale/opacity for every PlantStage', () => {
    for (const stage of ALL_PLANT_STAGES) {
      const config = STAGE_SCALE[stage];
      expect(config, `Missing scale config for stage "${stage}"`).toBeDefined();
      expect(config.scale).toBeGreaterThan(0);
      expect(config.opacity).toBeGreaterThan(0);
      expect(config.opacity).toBeLessThanOrEqual(1);
    }
  });

  it('should have increasing scale from seed to magnificent', () => {
    let prevScale = 0;
    for (const stage of ALL_PLANT_STAGES) {
      expect(STAGE_SCALE[stage].scale).toBeGreaterThan(prevScale);
      prevScale = STAGE_SCALE[stage].scale;
    }
  });

  it('should have increasing opacity from seed to blooming', () => {
    const stagesUpToBlooming: PlantStage[] = ['seed', 'sprout', 'growing', 'blooming'];
    let prevOpacity = 0;
    for (const stage of stagesUpToBlooming) {
      expect(STAGE_SCALE[stage].opacity).toBeGreaterThan(prevOpacity);
      prevOpacity = STAGE_SCALE[stage].opacity;
    }
  });
});
