import { Star, Heart, Sparkles } from 'lucide-react';

// Particle shape types for variety
export type ParticleShape = 'circle' | 'star' | 'heart' | 'sparkle';

export interface Particle {
  id: number;
  shape: ParticleShape;
  color: string;
  angle: number;
  distance: number;
  size: number;
  delay: number;
}

// Generate varied particles for celebration
export function generateParticles(baseColor: string): Particle[] {
  const shapes: ParticleShape[] = ['circle', 'star', 'heart', 'sparkle'];
  const colors = [
    '#FFD700', // Gold
    '#FFA500', // Orange
    '#FF6347', // Tomato
    '#00CED1', // Cyan
    '#9370DB', // Purple
    '#32CD32', // Green
    baseColor, // Habit color
  ];

  return Array.from({ length: 20 }, (_, i) => ({
    id: i,
    shape: shapes[i % shapes.length],
    color: colors[i % colors.length],
    angle: i * 18 + Math.random() * 10, // Spread evenly with some randomness
    distance: 50 + Math.random() * 40,
    size: 6 + Math.random() * 8,
    delay: i * 25,
  }));
}

// Render different particle shapes
export function ParticleIcon({ shape, size, color }: { shape: ParticleShape; size: number; color: string }) {
  switch (shape) {
    case 'star':
      return <Star className="fill-current" style={{ width: size, height: size, color }} />;
    case 'heart':
      return <Heart className="fill-current" style={{ width: size, height: size, color }} />;
    case 'sparkle':
      return <Sparkles style={{ width: size, height: size, color }} />;
    default:
      return (
        <div
          className="rounded-full"
          style={{ width: size, height: size, backgroundColor: color }}
        />
      );
  }
}
