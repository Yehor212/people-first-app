/**
 * SeasonalTree - Canvas-rendered tree with seasonal variation and growth stages.
 */

import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Season,
  TreeStage,
  getSeasonColors,
  getCurrentSeason,
} from '@/lib/seasonHelper';

interface SeasonalTreeProps {
  stage: TreeStage;
  waterLevel: number; // 0-100
  xp?: number;
  season?: Season;
  isWatering?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  lowStimulus?: boolean;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  rotation: number;
  rotationSpeed: number;
}

const sizeConfig = {
  sm: { width: 120, height: 150, scale: 0.6 },
  md: { width: 200, height: 250, scale: 1 },
  lg: { width: 280, height: 350, scale: 1.4 },
};

const stageScaleMap: Record<TreeStage, number> = {
  1: 0.55,
  2: 0.7,
  3: 0.9,
  4: 1,
  5: 1.15,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const mixColor = (a: string, b: string, t: number) => {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  const mix = (v1: number, v2: number) => Math.round(v1 + (v2 - v1) * t);
  return `rgb(${mix(c1.r, c2.r)}, ${mix(c1.g, c2.g)}, ${mix(c1.b, c2.b)})`;
};

const colorWithAlpha = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawLeaf = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  color: string
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(size, 0, 0, size);
  ctx.quadraticCurveTo(-size, 0, 0, -size);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
};

export function SeasonalTree({
  stage,
  waterLevel,
  season: propSeason,
  isWatering = false,
  onClick,
  className,
  size = 'md',
  lowStimulus = false,
}: SeasonalTreeProps) {
  const season = propSeason || getCurrentSeason();
  const colors = getSeasonColors(season);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);

  const { width, height } = sizeConfig[size];
  const stageScale = stageScaleMap[stage];

  const particleCount = lowStimulus ? 3 : 10;

  const canopyColors = useMemo(() => {
    const dryness = clamp((40 - waterLevel) / 40, 0, 0.6);
    const primary = mixColor(colors.primary, '#9ca3af', dryness);
    const secondary = mixColor(colors.secondary, '#9ca3af', dryness);
    return { primary, secondary };
  }, [colors.primary, colors.secondary, waterLevel]);

  const accentPoints = useMemo(() => {
    if (lowStimulus) return [];
    const count = season === 'spring' ? 8 : season === 'autumn' ? 6 : 0;
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 1.2,
      y: (Math.random() - 0.6) * 1.0,
      r: season === 'spring' ? 0.06 : 0.05,
    }));
  }, [season, lowStimulus]);

  useEffect(() => {
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: (Math.random() * 2 + 2) * (lowStimulus ? 0.7 : 1),
      speed: (Math.random() * 0.3 + 0.2) * (lowStimulus ? 0.6 : 1),
      drift: (Math.random() - 0.5) * 0.3 * (lowStimulus ? 0.5 : 1),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.01,
    }));
  }, [particleCount, width, height, lowStimulus, season]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const trunkColor = mixColor('#8b5a2b', '#6b3f1f', (stage - 1) / 6);
    const shadowColor = 'rgba(0, 0, 0, 0.12)';

    const draw = (time: number) => {
      const t = time * 0.001;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const groundY = height * 0.85;
      const sway = Math.sin(t * 1.2) * (lowStimulus ? 0.004 : 0.01);

      ctx.save();
      ctx.translate(centerX, groundY);
      ctx.scale(1, 0.25);
      ctx.beginPath();
      ctx.ellipse(0, 0, width * 0.22 * stageScale, width * 0.14 * stageScale, 0, 0, Math.PI * 2);
      ctx.fillStyle = shadowColor;
      ctx.fill();
      ctx.restore();

      if (stage <= 2) {
        const potW = width * 0.32;
        const potH = height * 0.2;
        const potX = centerX - potW / 2;
        const potY = groundY - potH * 0.9;
        const rimH = potH * 0.18;

        const potGradient = ctx.createLinearGradient(potX, potY, potX + potW, potY);
        potGradient.addColorStop(0, '#c9845c');
        potGradient.addColorStop(0.5, '#d58c61');
        potGradient.addColorStop(1, '#b7744d');

        ctx.fillStyle = potGradient;
        drawRoundedRect(ctx, potX, potY, potW, potH, potH * 0.15);
        ctx.fill();

        ctx.fillStyle = '#9a5a3d';
        drawRoundedRect(ctx, potX - potW * 0.02, potY - rimH * 0.4, potW * 1.04, rimH, rimH * 0.5);
        ctx.fill();

        ctx.fillStyle = '#3b2a22';
        ctx.beginPath();
        ctx.ellipse(centerX, potY + rimH * 0.3, potW * 0.38, rimH * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        if (stage === 1) {
          ctx.fillStyle = '#5a4034';
          ctx.beginPath();
          ctx.ellipse(centerX, potY + rimH * 0.1, potW * 0.1, potW * 0.13, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const stemHeight = height * 0.18;
          ctx.strokeStyle = '#2f7b3a';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(centerX, potY + rimH * 0.1);
          ctx.quadraticCurveTo(centerX + width * 0.02, potY - stemHeight * 0.4, centerX, potY - stemHeight);
          ctx.stroke();

          ctx.fillStyle = canopyColors.secondary;
          ctx.beginPath();
          ctx.ellipse(centerX - width * 0.05, potY - stemHeight * 0.7, width * 0.06, width * 0.035, -0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(centerX + width * 0.05, potY - stemHeight * 0.7, width * 0.06, width * 0.035, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const trunkHeight = height * 0.45 * stageScale;
        const trunkWidth = width * 0.12 * stageScale;
        const trunkX = centerX - trunkWidth / 2;
        const trunkY = groundY - trunkHeight;

        const trunkGradient = ctx.createLinearGradient(trunkX, trunkY, trunkX + trunkWidth, trunkY + trunkHeight);
        trunkGradient.addColorStop(0, trunkColor);
        trunkGradient.addColorStop(1, '#5c3a1f');

        ctx.fillStyle = trunkGradient;
        drawRoundedRect(ctx, trunkX, trunkY, trunkWidth, trunkHeight, trunkWidth * 0.35);
        ctx.fill();

        if (stage >= 4) {
          ctx.strokeStyle = '#6b3f1f';
          ctx.lineWidth = trunkWidth * 0.35;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(centerX - trunkWidth * 0.1, trunkY + trunkHeight * 0.25);
          ctx.quadraticCurveTo(centerX - width * 0.25, trunkY + trunkHeight * 0.1, centerX - width * 0.3, trunkY + trunkHeight * 0.25);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(centerX + trunkWidth * 0.1, trunkY + trunkHeight * 0.25);
          ctx.quadraticCurveTo(centerX + width * 0.25, trunkY + trunkHeight * 0.1, centerX + width * 0.3, trunkY + trunkHeight * 0.25);
          ctx.stroke();
        }

        const canopyRadius = width * 0.28 * stageScale;
        const canopyX = centerX + sway * width * 3;
        const canopyY = trunkY - canopyRadius * 0.15;

        const canopyGradient = ctx.createRadialGradient(
          canopyX - canopyRadius * 0.2,
          canopyY - canopyRadius * 0.2,
          canopyRadius * 0.2,
          canopyX,
          canopyY,
          canopyRadius * 1.2
        );
        canopyGradient.addColorStop(0, colorWithAlpha(canopyColors.secondary, 0.95));
        canopyGradient.addColorStop(1, colorWithAlpha(canopyColors.primary, 0.9));

        ctx.fillStyle = canopyGradient;
        ctx.beginPath();
        ctx.ellipse(canopyX, canopyY, canopyRadius, canopyRadius * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = colorWithAlpha(canopyColors.secondary, 0.85);
        ctx.beginPath();
        ctx.ellipse(canopyX - canopyRadius * 0.6, canopyY + canopyRadius * 0.2, canopyRadius * 0.55, canopyRadius * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(canopyX + canopyRadius * 0.6, canopyY + canopyRadius * 0.2, canopyRadius * 0.55, canopyRadius * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = colorWithAlpha(canopyColors.primary, 0.9);
        ctx.beginPath();
        ctx.ellipse(canopyX, canopyY - canopyRadius * 0.6, canopyRadius * 0.65, canopyRadius * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        if (season === 'spring' && accentPoints.length > 0) {
          ctx.fillStyle = '#ffc7d6';
          for (const point of accentPoints) {
            ctx.beginPath();
            ctx.ellipse(
              canopyX + point.x * canopyRadius,
              canopyY + point.y * canopyRadius,
              canopyRadius * point.r,
              canopyRadius * point.r * 0.7,
              0,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        }
        if (season === 'autumn' && accentPoints.length > 0) {
          ctx.fillStyle = '#f39c3d';
          for (const point of accentPoints) {
            ctx.beginPath();
            ctx.ellipse(
              canopyX + point.x * canopyRadius,
              canopyY + point.y * canopyRadius,
              canopyRadius * point.r,
              canopyRadius * point.r * 0.6,
              0,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        }
        if (season === 'winter' && !lowStimulus) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.beginPath();
          ctx.ellipse(canopyX, canopyY - canopyRadius * 0.55, canopyRadius * 0.5, canopyRadius * 0.12, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const particles = particlesRef.current;
      const particleColor = season === 'winter'
        ? 'rgba(255,255,255,0.8)'
        : colorWithAlpha(colors.particle, lowStimulus ? 0.35 : 0.55);

      for (const p of particles) {
        p.y += p.speed;
        p.x += p.drift;
        p.rotation += p.rotationSpeed;

        if (p.y > height + p.size * 2) {
          p.y = -p.size * 2;
          p.x = Math.random() * width;
        }

        if (p.x < -p.size) p.x = width + p.size;
        if (p.x > width + p.size) p.x = -p.size;

        if (season === 'winter') {
          ctx.fillStyle = particleColor;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawLeaf(ctx, p.x, p.y, p.size, p.rotation, particleColor);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [width, height, stage, stageScale, season, waterLevel, lowStimulus, colors.particle, canopyColors, accentPoints]);

  const isThirsty = waterLevel < 30;

  return (
    <div
      className={cn(
        'relative cursor-pointer select-none',
        onClick && 'hover:scale-105 transition-transform',
        className
      )}
      onClick={onClick}
      style={{ width, height }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/20 backdrop-blur-sm rounded-full px-2 py-1">
        <span className="text-sm">💧</span>
        <div className="w-12 h-2 bg-white/30 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              'h-full rounded-full',
              waterLevel >= 70 ? 'bg-blue-400' :
              waterLevel >= 30 ? 'bg-yellow-400' :
              'bg-red-400'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${waterLevel}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <AnimatePresence>
        {isWatering && (
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: height / 2, opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
          >
            {[...Array(5)].map((_, i) => (
              <motion.span
                key={i}
                className="absolute text-xl"
                style={{ left: `${i * 10 - 20}px` }}
                animate={{
                  y: [0, 30],
                  opacity: [1, 0],
                }}
                transition={{
                  duration: 0.8,
                  delay: i * 0.1,
                  repeat: 2,
                }}
              >
                💧
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {isThirsty && !isWatering && (
        <motion.div
          className="absolute top-2 right-2 text-2xl"
          animate={{ scale: [1, 1.2, 1], rotate: [-5, 5, -5] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          🥺
        </motion.div>
      )}
    </div>
  );
}
