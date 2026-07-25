/**
 * BurnThoughtWidget - legacy component name for the journal "release a worry" action.
 *
 * Snap Release cinematic:
 *   IDLE -> RELEASING -> RELEASED -> COLLAPSING -> closed
 *
 * The active scene is a calm Telegram-style vaporize pass:
 *   1. RITUAL PAUSE    0-650ms    - readable card takes a quiet breath
 *   2. SOFT SNAP     650-1050ms   - pressure wave and DOM handoff
 *   3. DISSOLVE     1050-3200ms   - entered text scatters into slow fragments
 *   4. AFTERGLOW    3200-4000ms   - sparse dust trail, then release mark
 *
 * Reduced motion skips the particle field and goes directly to released state.
 */

import { useCallback, useEffect, useRef, useState, memo } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { zenMotion, zenTap, shouldAnimate } from '@/lib/animationUtils';
import { easings } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticWarning, hapticMedium, hapticSuccess, hapticTap } from '@/lib/haptics';
import { announceSuccess } from '@/lib/a11y';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { V2_JOURNAL_ICONS } from '@/lib/v2IconSystem';

interface BurnThoughtWidgetProps {
  onClose: () => void;
  onReleased?: () => void | Promise<void>;
  surfaceClassName?: string;
}

interface SnapParticle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  glowColor: string;
  delay: number;
  life: number;
  maxLife: number;
  drag: number;
  driftPhase: number;
  started: boolean;
  glow: boolean;
}

interface SnapPalette {
  card: string;
  cardAlt: string;
  text: string;
  mutedText: string;
  border: string;
  depth: string;
  purple: string;
  purpleSoft: string;
  cyan: string;
  cyanSoft: string;
  primary: string;
  clear: string;
  sourceDust: string[];
  glowDust: string[];
}

const SNAP_AMBIENT_MOTES = [
  'hsl(var(--cosmic-nebula-purple) / 0.82)',
  'hsl(var(--cosmic-nebula-cyan) / 0.7)',
  'hsl(var(--foreground) / 0.58)',
  'hsl(var(--cosmic-nebula-cyan) / 0.42)',
];

const TOTAL_DURATION = 4000;
const RITUAL_PAUSE_PHASE = 650;
const DOM_HANDOFF_PHASE = 1050;
const PRESSURE_WAVE_DURATION = 1050;
const HARD_TIMEOUT = 5600;
const RELEASED_PAUSE = 1250;
const MOBILE_PARTICLE_BUDGET = 820;
const DESKTOP_PARTICLE_BUDGET = 1180;
const CANVAS_FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const QuietReleaseIcon = V2_JOURNAL_ICONS.quietRelease;
function readHslToken(styles: CSSStyleDeclaration, name: string, fallback: string, alpha = 1): string {
  const value = styles.getPropertyValue(name).trim() || fallback;
  return `hsl(${value} / ${alpha})`;
}

function createSnapPalette(): SnapPalette {
  const styles = getComputedStyle(document.documentElement);
  const purple = readHslToken(styles, '--cosmic-nebula-purple', '263 84% 66%', 0.9);
  const cyan = readHslToken(styles, '--cosmic-nebula-cyan', '189 94% 43%', 0.82);
  const primary = readHslToken(styles, '--primary', '158 60% 50%', 0.68);
  const text = readHslToken(styles, '--foreground', '0 0% 100%', 0.9);
  const mutedText = readHslToken(styles, '--cosmic-text-muted', '0 0% 60%', 0.74);

  return {
    card: readHslToken(styles, '--cosmic-space-deep', '240 40% 6%', 0.94),
    cardAlt: readHslToken(styles, '--cosmic-space-surface', '240 32% 16%', 0.78),
    text,
    mutedText,
    border: readHslToken(styles, '--cosmic-nebula-purple', '263 84% 66%', 0.28),
    depth: readHslToken(styles, '--cosmic-space-mid', '240 40% 10%', 0.42),
    purple,
    purpleSoft: readHslToken(styles, '--cosmic-nebula-purple', '263 84% 66%', 0.2),
    cyan,
    cyanSoft: readHslToken(styles, '--cosmic-nebula-cyan', '189 94% 43%', 0.18),
    primary,
    clear: readHslToken(styles, '--foreground', '46 4% 92%', 0),
    sourceDust: [
      purple,
      cyan,
      text,
      mutedText,
      readHslToken(styles, '--cosmic-space-surface', '240 32% 16%', 0.74),
    ],
    glowDust: [
      readHslToken(styles, '--cosmic-nebula-purple', '263 84% 66%', 0.34),
      readHslToken(styles, '--cosmic-nebula-cyan', '189 94% 43%', 0.28),
      readHslToken(styles, '--foreground', '0 0% 100%', 0.18),
    ],
  };
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(nextLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 4);
}

function paintSnapTextMask(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
  palette: SnapPalette,
  isRTL: boolean,
) {
  const cardX = 2;
  const cardY = 10;
  const cardW = Math.max(1, width - 4);
  const textX = isRTL ? cardX + cardW - 20 : cardX + 20;
  const textY = cardY + 20;
  const maxWidth = Math.max(40, cardW - 40);

  ctx.clearRect(0, 0, width, height);
  ctx.font = `600 15px ${CANVAS_FONT_FAMILY}`;
  ctx.direction = isRTL ? 'rtl' : 'ltr';
  ctx.textAlign = isRTL ? 'right' : 'left';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = palette.purpleSoft;
  ctx.fillStyle = palette.text;

  const lines = wrapText(ctx, text, maxWidth);
  lines.forEach((line, index) => {
    const lineY = textY + index * 23;
    ctx.strokeText(line, textX, lineY);
    ctx.fillText(line, textX, lineY);
  });
}

function colorFromSource(
  data: Uint8ClampedArray,
  index: number,
  palette: SnapPalette,
  fallbackIndex: number,
): string {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const a = data[index + 3] / 255;
  const luminance = (r + g + b) / 3;
  const warmParticle = r > 150 && r > b * 1.25 && b < 170 && g > 40;

  if (a < 0.08 || luminance < 34 || warmParticle) {
    return palette.sourceDust[fallbackIndex % palette.sourceDust.length];
  }

  return `rgba(${r}, ${g}, ${b}, ${Math.max(0.42, Math.min(0.96, a))})`;
}

function buildSnapParticles(
  text: string,
  width: number,
  height: number,
  palette: SnapPalette,
  isRTL: boolean,
): SnapParticle[] {
  const offscreen = document.createElement('canvas');
  offscreen.width = Math.max(1, Math.floor(width));
  offscreen.height = Math.max(1, Math.floor(height));

  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  paintSnapTextMask(ctx, text, offscreen.width, offscreen.height, palette, isRTL);

  const image = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
  const data = image.data;
  const isMobile = Math.min(window.innerWidth || width, width) < 430;
  const budget = isMobile ? MOBILE_PARTICLE_BUDGET : DESKTOP_PARTICLE_BUDGET;
  const sampleStep = text.length <= 24 ? 1 : isMobile ? 3 : 2;
  const candidates: Array<{ x: number; y: number; color: string; alpha: number }> = [];

  for (let y = 0; y < offscreen.height; y += sampleStep) {
    for (let x = 0; x < offscreen.width; x += sampleStep) {
      const index = (y * offscreen.width + x) * 4;
      const alpha = data[index + 3] / 255;
      if (alpha < 0.08) continue;

      candidates.push({
        x,
        y,
        alpha,
        color: colorFromSource(data, index, palette, x + y),
      });
    }
  }

  if (candidates.length > budget) {
    for (let i = candidates.length - 1; i > 0 && i >= candidates.length - budget; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    candidates.length = budget;
  }

  const centerX = candidates.length
    ? candidates.reduce((sum, pixel) => sum + pixel.x, 0) / candidates.length
    : width * (isRTL ? 0.46 : 0.54);
  const centerY = candidates.length
    ? candidates.reduce((sum, pixel) => sum + pixel.y, 0) / candidates.length
    : height * 0.42;
  const wind = isRTL ? -1 : 1;

  return candidates.map((pixel, index): SnapParticle => {
    const angle = Math.atan2(pixel.y - centerY, pixel.x - centerX);
    const outward = 10 + Math.random() * 24;
    const diagonal = 12 + Math.random() * 34;
    const vertical = 18 + Math.random() * 50;

    return {
      x: pixel.x,
      y: pixel.y,
      originX: pixel.x,
      originY: pixel.y,
      vx: Math.cos(angle) * outward + wind * diagonal + (Math.random() - 0.5) * 14,
      vy: Math.sin(angle) * outward - vertical,
      size: 0.65 + Math.random() * 1.25,
      alpha: Math.min(0.94, pixel.alpha + 0.16),
      color: pixel.color,
      glowColor: palette.glowDust[index % palette.glowDust.length],
      delay: DOM_HANDOFF_PHASE + Math.random() * 720 + Math.max(0, pixel.y - centerY) * 0.6,
      life: 0,
      maxLife: 1600 + Math.random() * 1600,
      drag: 0.955 + Math.random() * 0.03,
      driftPhase: Math.random() * Math.PI * 2,
      started: false,
      glow: Math.random() < 0.025,
    };
  });
}

export const BurnThoughtWidget = memo(function BurnThoughtWidget({
  onClose,
  onReleased,
  surfaceClassName,
}: BurnThoughtWidgetProps) {
  const { t, isRTL } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const [text, setText] = useState('');
  const [released, setReleased] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const [traceSaveFailed, setTraceSaveFailed] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentWrapRef = useRef<HTMLDivElement>(null);
  const pressureRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseCallbackCalledRef = useRef(false);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [text]);

  const notifyReleased = useCallback(async () => {
    if (releaseCallbackCalledRef.current) return;
    releaseCallbackCalledRef.current = true;
    if (!onReleased) return;
    try {
      await onReleased();
    } catch (error) {
      logger.warn("[Journal] Quiet release trace callback failed", error);
      setTraceSaveFailed(true);
    }
  }, [onReleased]);

  const finishRelease = useCallback(() => {
    if (contentWrapRef.current) {
      contentWrapRef.current.style.opacity = '0';
      contentWrapRef.current.style.transform = '';
      contentWrapRef.current.style.filter = '';
      contentWrapRef.current.style.willChange = '';
    }
    if (pressureRef.current) {
      pressureRef.current.style.opacity = '0';
      pressureRef.current.style.transform = '';
    }

    setReleasing(false);
    setReleased(true);
    void notifyReleased();
    void hapticSuccess();
    announceSuccess(ts.journalReleaseFinalTitle || ts.journalBurnReleasedMessage || 'The text was deleted.');
  }, [notifyReleased, ts.journalBurnReleasedMessage, ts.journalReleaseFinalTitle]);

  const startSnapRelease = useCallback(() => {
    const releaseText = text.trim();
    if (!releaseText || releasing) {
      void hapticWarning();
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (!shouldAnimate()) {
      setReleased(true);
      void notifyReleased();
      announceSuccess(ts.journalReleaseFinalTitle || ts.journalBurnReleasedMessage || 'The text was deleted.');
      return;
    }

    setReleasing(true);
    void hapticMedium();

    const canvas = canvasRef.current;
    const stage = containerRef.current;
    if (!canvas || !stage) {
      finishRelease();
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      finishRelease();
      return;
    }
    const context = ctx;

    const rect = stage.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height || 168));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    context.setTransform?.(dpr, 0, 0, dpr, 0, 0);

    const palette = createSnapPalette();
    const particles = buildSnapParticles(releaseText, cssWidth, cssHeight, palette, isRTL);
    const startTime = performance.now();
    let lastTime = startTime;

    if (contentWrapRef.current) {
      contentWrapRef.current.style.willChange = 'transform, opacity, filter';
      contentWrapRef.current.style.transformOrigin = isRTL ? '46% 56%' : '54% 56%';
    }

    pressureTimerRef.current = setTimeout(() => { void hapticTap(); }, RITUAL_PAUSE_PHASE);
    successTimerRef.current = setTimeout(() => { void hapticTap(); }, DOM_HANDOFF_PHASE);

    function frame(now: number) {
      const elapsed = now - startTime;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      context.clearRect(0, 0, cssWidth, cssHeight);

      const pauseT = Math.min(1, elapsed / RITUAL_PAUSE_PHASE);
      const pressureT = Math.min(1, Math.max(0, (elapsed - RITUAL_PAUSE_PHASE) / (DOM_HANDOFF_PHASE - RITUAL_PAUSE_PHASE)));
      const handoffT = pressureT;
      const releaseT = Math.min(1, elapsed / TOTAL_DURATION);

      if (contentWrapRef.current) {
        const breath = Math.sin(smoothStep(pauseT) * Math.PI);
        const pulse = Math.sin(pressureT * Math.PI);
        const fade = smoothStep(handoffT);
        const driftX = (isRTL ? -1 : 1) * fade * 5;
        const liftY = -fade * 6;
        const scale = 1 - breath * 0.018 - pulse * 0.014 - fade * 0.05;
        const blur = fade * 2.1;

        contentWrapRef.current.style.transform = `translate3d(${driftX.toFixed(2)}px, ${liftY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
        contentWrapRef.current.style.opacity = String(Math.max(0, 1 - fade));
        contentWrapRef.current.style.filter = `blur(${blur.toFixed(2)}px) saturate(${(1 + breath * 0.08 + pulse * 0.06).toFixed(2)})`;
      }

      if (pressureRef.current) {
        const pressureElapsed = Math.max(0, elapsed - RITUAL_PAUSE_PHASE);
        const ring = smoothStep(Math.min(1, pressureElapsed / PRESSURE_WAVE_DURATION));
        pressureRef.current.style.opacity = String(pressureElapsed > 0 ? Math.max(0, (1 - ring) * 0.72) : 0);
        pressureRef.current.style.transform = `translate(-50%, -50%) scale(${(0.58 + ring * 1.48).toFixed(3)})`;
      }

      const globalLift = Math.max(0, 1 - releaseT) * 4;

      for (const particle of particles) {
        if (!particle.started) {
          if (elapsed < particle.delay) {
            if (elapsed > RITUAL_PAUSE_PHASE && handoffT > 0.08) {
              context.globalAlpha = Math.min(0.34, handoffT * 0.36) * particle.alpha;
              context.fillStyle = particle.color;
              context.fillRect(particle.originX, particle.originY, particle.size, particle.size);
            }
            continue;
          }

          particle.started = true;
          particle.life = 0;
        }

        particle.life += dt * 1000;
        if (particle.life >= particle.maxLife) {
          particle.alpha = 0;
          continue;
        }

        const drag = Math.pow(particle.drag, dt * 60);
        particle.vx *= drag;
        particle.vy = particle.vy * Math.pow(0.985, dt * 60) - globalLift * dt;
        particle.vx += Math.sin(now * 0.0016 + particle.driftPhase) * 5 * dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        const lifeT = particle.life / particle.maxLife;
        particle.alpha = Math.max(0, (1 - smoothStep(lifeT)) * (1 - lifeT * 0.18));
        particle.size *= 1 - 0.0007 * (dt * 60);

        if (particle.alpha <= 0.015 || particle.size < 0.16) {
          particle.alpha = 0;
          continue;
        }

        if (particle.glow && lifeT < 0.58) {
          context.globalAlpha = particle.alpha * 0.16;
          context.shadowBlur = 3;
          context.shadowColor = particle.glowColor;
          context.fillStyle = particle.glowColor;
          context.fillRect(
            particle.x - particle.size,
            particle.y - particle.size,
            particle.size * 2.2,
            particle.size * 2.2,
          );
          context.shadowBlur = 0;
        }

        context.globalAlpha = particle.alpha;
        context.fillStyle = particle.color;
        context.fillRect(
          particle.x - particle.size * 0.5,
          particle.y - particle.size * 0.5,
          particle.size,
          particle.size,
        );
      }

      context.globalAlpha = 1;

      if (elapsed > TOTAL_DURATION || elapsed > HARD_TIMEOUT) {
        finishRelease();
        return;
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [finishRelease, isRTL, notifyReleased, releasing, text, ts.journalBurnReleasedMessage, ts.journalReleaseFinalTitle]);

  useEffect(() => {
    if (released && !collapsing) {
      closeTimerRef.current = setTimeout(() => {
        setCollapsing(true);
      }, RELEASED_PAUSE);
    }
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [released, collapsing]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (pressureTimerRef.current) clearTimeout(pressureTimerRef.current);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const getAnimateProps = () => {
    if (collapsing) {
      return {
        opacity: 0,
        height: 0,
        scaleY: 0.92,
        y: -8,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
      };
    }
    return { opacity: 1, y: 0, scale: 1 };
  };

  const getTransition = () => {
    if (collapsing) {
      return { duration: 0.55, ease: easings.emphasizedAccelerate };
    }
    if (released) {
      return { duration: 0.24, ease: 'easeOut' as const };
    }
    if (releasing) {
      return { duration: 0.42, ease: 'easeOut' as const };
    }
    return zenMotion.gentle;
  };

  const hasText = text.trim().length > 0;
  const releaseThought = text.trim();
  const animate = shouldAnimate();
  const showAmbientMotes = hasText && !releasing && !released && animate;

  return (
    <motion.div
      className={cn(
        "snap-release-panel my-8 w-full p-6 rounded-2xl relative overflow-hidden bg-surface-glass backdrop-blur-[var(--surface-glass-blur)] border border-[var(--surface-glass-border)] zen-shadow-soft shadow-[inset_0_0_60px_hsl(var(--cosmic-nebula-purple)/0.04),var(--zen-shadow-soft)]",
        surfaceClassName,
      )}
      data-burn-state={releasing ? "burning" : released ? "released" : "idle"}
      data-release-mode="snap"
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={getAnimateProps()}
      exit={{ opacity: 0, height: 0, scaleY: 0.92, y: -8, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={getTransition()}
      onAnimationComplete={() => {
        if (collapsing) onClose();
      }}
    >
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none motion-safe:transition-opacity motion-safe:duration-300 ease-out shadow-[inset_0_0_80px_hsl(var(--cosmic-nebula-purple)/0.1),0_0_24px_hsl(var(--cosmic-nebula-cyan)/0.1)]"
        style={{ opacity: releasing ? 1 : 0 }}
        aria-hidden="true"
      />

      {showAmbientMotes && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              className="absolute w-1 h-1 rounded-full motion-safe:animate-snap-idle-mote"
              style={{
                left: `${8 + (i * 12) % 84}%`,
                bottom: '-2px',
                animationDelay: `${i * 0.5}s`,
                backgroundColor: SNAP_AMBIENT_MOTES[i % SNAP_AMBIENT_MOTES.length],
              }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2">
        <div className={`flex items-center gap-2 ${released ? 'text-muted-foreground/70' : 'text-[hsl(var(--cosmic-nebula-purple))]'}`}>
          <QuietReleaseIcon className={`w-4 h-4 ${showAmbientMotes ? 'motion-safe:animate-snap-icon-pulse' : ''}`} />
          <span className="text-sm font-medium">
            {released ? (ts.journalBurnReleased || 'Released') : (ts.journalBurnTitle || 'Burn a thought')}
          </span>
        </div>
        {!released && !releasing && (
          <motion.button
            whileTap={zenTap.icon}
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full"
            aria-label={ts.close || 'Close'}
          >
            <X className="w-3.5 h-3.5 text-muted-foreground/60" />
          </motion.button>
        )}
      </div>

      <div className="relative px-4 pb-4">
        {released ? (
          <motion.div
            className="snap-release-result flex flex-col items-center gap-3 py-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={collapsing ? { opacity: 0, y: -12 } : { opacity: 1, scale: 1 }}
            transition={collapsing ? { duration: 0.25 } : zenMotion.gentle}
            aria-live="polite"
          >
              <div className="relative w-16 h-16 flex items-center justify-center">
              {animate && (
                <>
                  <span className="absolute inset-1 rounded-full snap-release-halo" aria-hidden="true" />
                  {Array.from({ length: 12 }, (_, i) => (
                    <span
                      key={i}
                      className="absolute rounded-full snap-release-speck"
                      style={{
                        width: `${2 + (i % 3)}px`,
                        height: `${2 + (i % 3)}px`,
                        left: `${50 + Math.cos((i / 12) * Math.PI * 2) * 34}%`,
                        top: `${50 + Math.sin((i / 12) * Math.PI * 2) * 34}%`,
                        animationDelay: `${i * 0.045}s`,
                      }}
                      aria-hidden="true"
                    />
                  ))}
                </>
              )}
              <div className="relative w-11 h-11 rounded-full bg-[hsl(var(--cosmic-nebula-cyan)/0.10)] ring-1 ring-[hsl(var(--cosmic-nebula-cyan)/0.25)] flex items-center justify-center snap-release-core">
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 text-[hsl(var(--cosmic-nebula-cyan))]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    style={animate ? {
                      strokeDasharray: 22,
                      strokeDashoffset: 22,
                      animation: 'snap-draw-check 0.5s ease-out 0.15s forwards',
                    } : undefined}
                  />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <h4 className="text-base font-semibold text-foreground">
                {ts.journalReleaseFinalTitle || ts.journalBurnReleased || 'Released'}
              </h4>
              <p className="snap-release-copy mt-1 text-sm text-muted-foreground/60">
                {traceSaveFailed
                  ? ts.journalReleaseTraceSaveFailed ||
                    'The text was deleted, but ZenFlow could not save the release record. Nothing from the text was saved.'
                  : ts.journalReleaseFinalSubtitle ||
                    'Your text was deleted. ZenFlow saved a text-free release record on this device and in backups you create.'}
              </p>
            </div>
          </motion.div>
        ) : (
          <div
            ref={containerRef}
            className={cn(
              "snap-release-stage relative overflow-hidden rounded-[1.35rem]",
              releasing && "min-h-[154px]",
            )}
          >
            <div
              ref={contentWrapRef}
              className={cn(
                "relative z-[1]",
                releasing ? "snap-fragment-surface" : "snap-message-surface",
              )}
            >
              {releasing ? (
                <div className="snap-fragment-card" aria-hidden="true">
                  <span className="snap-card-depth" />
                  <span className="snap-card-grid" />
                  <p className="snap-fragment-text">
                    {releaseThought}
                  </p>
                  <span className="snap-card-scan snap-card-scan-a" />
                  <span className="snap-card-scan snap-card-scan-b" />
                  <span className="snap-card-scan snap-card-scan-c" />
                </div>
              ) : (
                <>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={ts.journalBurnPlaceholder || 'Write what worries you...'}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none bg-white/[0.03] dark:bg-white/[0.03] ring-1 ring-white/[0.06] focus:ring-[hsl(var(--cosmic-nebula-purple)/0.24)] placeholder:text-muted-foreground/60 motion-safe:transition-colors motion-safe:duration-150 min-h-16 max-h-[200px] text-foreground/90"
                    rows={2}
                    maxLength={500}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    data-gramm="false"
                    data-gramm_editor="false"
                    data-enable-grammarly="false"
                    aria-label={ts.journalBurnPlaceholder || 'Write what worries you...'}
                  />

                   {text.length > 0 && (
                     <div className={`text-end text-xs mt-1 motion-safe:transition-opacity motion-safe:duration-200 ${text.length > 450 ? 'text-red-400/70' : 'text-muted-foreground/60'}`}>
                       {text.length}/500
                     </div>
                   )}

                   <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                     {ts.journalReleaseBeforeAction ||
                       "This text will be deleted. ZenFlow saves a text-free release record on this device and in backups you create."}
                   </p>

                   <motion.button
                    whileTap={zenTap.button}
                    onClick={startSnapRelease}
                    disabled={!hasText}
                    className={`mt-3 w-full py-3 rounded-full text-sm font-medium motion-safe:transition-all flex items-center justify-center gap-2 min-h-[44px] ${hasText ? 'snap-release-action-active' : 'bg-white/[0.03] dark:bg-white/[0.03] text-muted-foreground/50 ring-1 ring-white/[0.06]'} ${hasText && animate ? 'snap-glow-pulse-wrap' : ''}`}
                  >
                    <QuietReleaseIcon className="w-4 h-4" />
                    {ts.journalBurnAction || 'Burn it'}
                  </motion.button>
                </>
              )}
            </div>

            {releasing && animate && (
              <div ref={pressureRef} className="snap-pressure-wave" aria-hidden="true" />
            )}

            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full rounded-xl z-[4] pointer-events-none"
              style={{ opacity: releasing ? 1 : 0 }}
              aria-hidden="true"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
});
