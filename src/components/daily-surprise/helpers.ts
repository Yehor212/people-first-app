import { Gift, Sparkles, Brain, Target, Heart, Lightbulb } from 'lucide-react';
import type { SurpriseType } from './surprisesData';

// Helper function to get icon for surprise type - avoids module-level const with component refs
export function getTypeIcon(type: SurpriseType) {
  switch (type) {
    case 'quote': return Sparkles;
    case 'fact': return Brain;
    case 'challenge': return Target;
    case 'tip': return Lightbulb;
    case 'affirmation': return Heart;
    default: return Gift;
  }
}

// Helper function to get color for surprise type
export function getTypeColor(type: SurpriseType) {
  switch (type) {
    case 'quote': return 'from-purple-500/20 to-pink-500/20 border-purple-500/30';
    case 'fact': return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30';
    case 'challenge': return 'from-orange-500/20 to-amber-500/20 border-orange-500/30';
    case 'tip': return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
    case 'affirmation': return 'from-rose-500/20 to-pink-500/20 border-rose-500/30';
    default: return 'from-purple-500/20 to-pink-500/20 border-purple-500/30';
  }
}
