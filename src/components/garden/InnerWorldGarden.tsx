/**
 * InnerWorldGarden - Orchestrator component for the garden/inner world tab.
 * Composes TreatsBar, GardenCanvas (or EmptyGardenPrompt), CompanionCard,
 * and detail modals (PlantDetailModal, CreatureDetailModal) into a single
 * cohesive garden UI.
 *
 * Receives all props from the useInnerWorld hook via Index.tsx.
 */

import { useState, useCallback, memo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
import { TreatsBar } from './TreatsBar';
import { GardenCanvas } from './GardenCanvas';
import { EmptyGardenPrompt } from './EmptyGardenPrompt';
import { CompanionCard } from './CompanionCard';
import { PlantDetailModal } from './PlantDetailModal';
import { CreatureDetailModal } from './CreatureDetailModal';
import type { InnerWorld, GardenPlant, GardenCreature, MoodType } from '@/types';

interface InnerWorldGardenProps {
  world: InnerWorld;
  treatsBalance: number;
  isRestMode: boolean;
  isLoading: boolean;
  plantSeed: (sourceActivity: 'mood' | 'habit' | 'focus' | 'gratitude', mood?: MoodType) => GardenPlant;
  waterPlants: (sourceActivity: 'mood' | 'habit' | 'focus' | 'gratitude') => void;
  attractCreature: () => void;
  feedCreatures: () => void;
  petCompanion: () => void;
  feedCompanion: () => void;
  getPlantEmoji: (plant: GardenPlant) => string;
  getCreatureEmoji: (creature: GardenCreature) => string;
  getCompanionEmoji: () => string;
  feedCost: number;
}

export const InnerWorldGarden = memo(function InnerWorldGarden({
  world,
  treatsBalance,
  isRestMode,
  isLoading,
  plantSeed,
  waterPlants,
  attractCreature,
  feedCreatures,
  petCompanion,
  feedCompanion,
  getPlantEmoji,
  getCreatureEmoji,
  getCompanionEmoji,
  feedCost,
}: InnerWorldGardenProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  // --- State declarations BEFORE hooks that reference them (TDZ prevention) ---
  const [selectedPlant, setSelectedPlant] = useState<GardenPlant | null>(null);
  const [selectedCreature, setSelectedCreature] = useState<GardenCreature | null>(null);

  // --- Wrapped actions (plantSeed/waterPlants need sourceActivity param) ---
  const handlePlantSeed = useCallback(() => {
    plantSeed('gratitude'); // Default to 'gratitude' when planting from garden UI
  }, [plantSeed]);

  const handleWaterPlants = useCallback(() => {
    waterPlants('gratitude');
  }, [waterPlants]);

  // --- Callbacks ---
  const handleSelectPlant = useCallback((plant: GardenPlant) => {
    logger.log('[InnerWorldGarden] Plant selected:', plant.id);
    setSelectedPlant(plant);
  }, []);

  const handleSelectCreature = useCallback((creature: GardenCreature) => {
    logger.log('[InnerWorldGarden] Creature selected:', creature.id);
    setSelectedCreature(creature);
  }, []);

  const handleClosePlantModal = useCallback(() => {
    setSelectedPlant(null);
  }, []);

  const handleCloseCreatureModal = useCallback(() => {
    setSelectedCreature(null);
  }, []);

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-primary motion-safe:animate-spin" />
        <span className="text-sm text-muted-foreground">
          {ts.gardenLoading || 'Loading your garden...'}
        </span>
      </div>
    );
  }

  const { plants, creatures, weather, season, gardenStage, companion } = world;

  return (
    <div className="space-y-4 content-with-nav">
      {/* Treats bar with action buttons */}
      <TreatsBar
        treatsBalance={treatsBalance}
        onPlantSeed={handlePlantSeed}
        onWaterPlants={handleWaterPlants}
        onFeedCreatures={feedCreatures}
      />

      {/* Garden Canvas OR Empty Prompt */}
      {plants.length === 0 ? (
        <EmptyGardenPrompt
          onPlantSeed={handlePlantSeed}
          treatsBalance={treatsBalance}
        />
      ) : (
        <GardenCanvas
          plants={plants}
          creatures={creatures}
          weather={weather}
          season={season}
          gardenStage={gardenStage}
          onSelectPlant={handleSelectPlant}
          onSelectCreature={handleSelectCreature}
          getPlantEmoji={getPlantEmoji}
          getCreatureEmoji={getCreatureEmoji}
        />
      )}

      {/* Companion Card */}
      <CompanionCard
        companion={companion}
        treatsBalance={treatsBalance}
        feedCost={feedCost}
        onPet={petCompanion}
        onFeed={feedCompanion}
        getCompanionEmoji={getCompanionEmoji}
        isRestMode={isRestMode}
      />

      {/* Detail modals (conditionally rendered with AnimatePresence) */}
      <AnimatePresence>
        {selectedPlant && (
          <PlantDetailModal
            plant={selectedPlant}
            treatsBalance={treatsBalance}
            onWater={handleWaterPlants}
            onClose={handleClosePlantModal}
            getPlantEmoji={getPlantEmoji}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedCreature && (
          <CreatureDetailModal
            creature={selectedCreature}
            treatsBalance={treatsBalance}
            feedCost={feedCost}
            onFeed={feedCreatures}
            onClose={handleCloseCreatureModal}
            getCreatureEmoji={getCreatureEmoji}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

export default InnerWorldGarden;
