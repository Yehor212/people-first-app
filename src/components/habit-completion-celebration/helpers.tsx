import { Star, Heart, Sparkles } from "lucide-react";

// Particle shape types for variety
export type ParticleShape = "circle" | "star" | "heart" | "sparkle";

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
  const shapes: ParticleShape[] = ["circle", "star", "heart", "sparkle"];
  // Theme-aware particle colors via CSS custom properties (no hardcoded hex)
  const root =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement)
      : null;
  const accent = root?.getPropertyValue("--accent")?.trim() || "142 71% 45%";
  const primary = root?.getPropertyValue("--primary")?.trim() || "152 57% 47%";
  const colors = [
    `hsl(${accent})`,
    `hsl(${primary})`,
    `hsl(${accent} / 0.8)`,
    `hsl(${primary} / 0.7)`,
    baseColor, // Habit color
    baseColor, // Habit color (double weight)
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
export function ParticleIcon({
  shape,
  size,
  color,
}: {
  shape: ParticleShape;
  size: number;
  color: string;
}) {
  switch (shape) {
    case "star":
      return (
        <Star
          className="fill-current"
          style={{ width: size, height: size, color }}
        />
      );
    case "heart":
      return (
        <Heart
          className="fill-current"
          style={{ width: size, height: size, color }}
        />
      );
    case "sparkle":
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
