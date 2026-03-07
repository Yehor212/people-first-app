/**
 * BurnThoughtWidget — Premium "burn a worry" section for the journal editor.
 *
 * "Paper Burning" cinematic text disintegration — the card itself burns away:
 *   STATE MACHINE: IDLE -> BURNING -> RELEASED -> COLLAPSING -> closed
 *
 *   Director's Arc (sub-phases within BURNING, tracked by elapsed time):
 *     1. IGNITION     (0-400ms)     — spark burst at bottom-center, card glow builds
 *     2. BURN_SPREAD  (400-2800ms)  — burn line advances bottom→top, text crumbles
 *                                      at fire edge, embers rise from burn line,
 *                                      card content clipped away progressively
 *     3. FINAL_EMBERS (2800-4200ms) — remaining particles + embers float away
 *     4. FADE_OUT     (4200-4800ms) — last embers fade → RELEASED
 *
 *   IDLE: Ambient ember particles float along card edges when text is entered.
 *         Flame icon pulses gently. Burn button glows with warm pulse.
 *         Character counter at bottom-right. Textarea auto-grows.
 *
 *   BURNING: Three particle systems on single canvas:
 *     - TextDust (1200): tiny 0.5-1.5px particles from text pixel sampling,
 *       activated by burn line position (text crumbles at fire edge)
 *     - Embers (80): 2-4px glowing particles spawned from burn line,
 *       deep orange core + yellow halo
 *     - Sparks (30): 0.3-1px white-hot burst at ignition point
 *     Card content clipped via GPU-composited clip-path: inset()
 *     Burn line rendered as 12px horizontal gradient band
 *
 *   RELEASED: Animated check circle draws itself + "Released" text.
 *   COLLAPSING: Telegram-style height collapse -> onClose().
 *   FALLBACK: shouldAnimate() false -> instant RELEASED (no animation).
 *
 *   Safari/iOS: Uses standard font stack for canvas (Safari returns
 *   .AppleSystemUIFont which Canvas API can't parse). willReadFrequently
 *   hint for getImageData. Keyboard dismissed before animation.
 *
 * No html2canvas - fillText is GPU-accelerated, <1ms.
 * Memory-safe: offscreen canvas + particle arrays destroyed in cleanup.
 * Haptic feedback via Capacitor. Respects in-app Dopamine toggle only.
 * Performance: fillRect for 95% of particles, shadowBlur reserved for embers.
 */

import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { Flame, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { zenMotion, zenTap, shouldAnimate } from '@/lib/animationUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticWarning, hapticMedium, hapticSuccess, hapticTap } from '@/lib/haptics';
import { announceSuccess } from '@/lib/a11y';

interface BurnThoughtWidgetProps {
  onClose: () => void;
}

// -- Text dust particle (sampled from text pixels) -------------------------

interface TextDustParticle {
  x: number; y: number;
  originX: number; originY: number;
  vx: number; vy: number;
  size: number;
  alpha: number;
  color: string;
  ashColor: string;
  glow: boolean;
  life: number;
  maxLife: number;

  phase: number;
  started: boolean;
}

// -- Ember particle (spawned from burn line) --------------------------------

interface EmberParticle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  alpha: number;
  coreColor: string;
  haloColor: string;
  haloRadius: number;
  life: number;
  maxLife: number;
  flickerPhase: number;
  active: boolean;
}

// -- Spark particle (ignition burst) ----------------------------------------

interface SparkParticle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
}

// -- Color palettes ---------------------------------------------------------

// Hot ember palette - bright, warm colors for fresh particles
const COLORS_HOT = [
  '#fbbf24',  // amber-400
  '#fb923c',  // orange-400
  '#f87171',  // red-400
  '#fca5a5',  // red-300
];

// Ash palette - cool, muted colors for dying particles
const COLORS_ASH = [
  '#d4d4d8',  // zinc-300
  '#a1a1aa',  // zinc-400
  '#71717a',  // zinc-500
];

// Ember core colors
const EMBER_CORES = ['#ea580c', '#dc2626', '#c2410c'];
// Ember halo colors
const EMBER_HALOS = ['#fbbf24', '#fb923c', '#fde68a'];

// Ambient ember colors (for floating CSS particles)
const EMBER_AMBIENT = ['#fbbf24', '#fb923c', '#f87171', '#ef4444'];

// -- Animation constants (Director's pacing) --------------------------------

const TOTAL_DURATION   = 4800;   // ms - full burn arc
const IGNITION_PHASE   = 400;    // ms - spark burst + glow build
const BURN_PHASE       = 2400;   // ms - burn line sweeps bottom→top
const MAX_PARTICLES    = 1200;   // text dust budget
const MAX_EMBERS       = 80;     // dedicated ember particles
const MAX_SPARKS       = 30;     // ignition spark burst
const SAMPLE_STEP      = 2;      // sample every 2nd pixel (finer than before)
const HARD_TIMEOUT     = 6500;   // ms - safety cutoff
const RELEASED_PAUSE   = 800;    // ms - serenity pause before collapse

// Safari-safe font stack for Canvas API
const CANVAS_FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

// -- Word-wrap helper (canvas fillText doesn't auto-wrap) -------------------

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// -- Text-to-pixel sampling -------------------------------------------------

function sampleTextPixels(
  text: string,
  areaW: number,
  areaH: number,
  dpr: number,
  textareaEl: HTMLTextAreaElement | null,
): Array<{ x: number; y: number }> {
  const offscreen = document.createElement('canvas');
  const scaledW = Math.round(areaW * dpr);
  const scaledH = Math.round(areaH * dpr);
  offscreen.width = scaledW;
  offscreen.height = scaledH;

  // willReadFrequently hint - optimizes getImageData on Safari/iOS
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.scale(dpr, dpr);

  // Match textarea styling - use standard font stack for Safari compatibility
  const computed = textareaEl ? getComputedStyle(textareaEl) : null;
  const fontSize = computed ? (parseFloat(computed.fontSize) || 14) : 14;
  const lineHeight = computed ? (parseFloat(computed.lineHeight) || fontSize * 1.5) : fontSize * 1.5;
  const borderLeft = computed ? (parseFloat(computed.borderLeftWidth) || 0) : 1;
  const borderTop = computed ? (parseFloat(computed.borderTopWidth) || 0) : 1;
  const paddingLeft = (computed ? (parseFloat(computed.paddingLeft) || 14) : 14) + borderLeft;
  const paddingTop = (computed ? (parseFloat(computed.paddingTop) || 10) : 10) + borderTop;
  const textAreaWidth = areaW - paddingLeft * 2;

  // Use standard font stack instead of computed fontFamily
  ctx.font = `${fontSize}px ${CANVAS_FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';

  const lines = wrapText(ctx, text, textAreaWidth);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], paddingLeft, paddingTop + i * lineHeight);
  }

  // Read pixel data and collect positions where text exists
  const imageData = ctx.getImageData(0, 0, scaledW, scaledH);
  const pixels = imageData.data;
  const positions: Array<{ x: number; y: number }> = [];

  for (let py = 0; py < scaledH; py += SAMPLE_STEP) {
    for (let px = 0; px < scaledW; px += SAMPLE_STEP) {
      const idx = (py * scaledW + px) * 4;
      if (pixels[idx + 3] > 30) {
        positions.push({ x: px / dpr, y: py / dpr });
      }
    }
  }

  // Cleanup offscreen canvas
  offscreen.width = 0;
  offscreen.height = 0;

  // Cap at MAX_PARTICLES via random subsampling (Fisher-Yates partial shuffle)
  if (positions.length > MAX_PARTICLES) {
    for (let i = positions.length - 1; i > 0 && i >= positions.length - MAX_PARTICLES; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    positions.length = MAX_PARTICLES;
  }

  return positions;
}

// -- Ignition spark creation ------------------------------------------------

function createIgnitionSparks(centerX: number, bottomY: number): SparkParticle[] {
  const sparks: SparkParticle[] = [];
  for (let i = 0; i < MAX_SPARKS; i++) {
    // Radial burst — mostly upward with wide spread
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
    const speed = 40 + Math.random() * 80;
    sparks.push({
      x: centerX + (Math.random() - 0.5) * 20,
      y: bottomY - Math.random() * 5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 0.3 + Math.random() * 0.7,
      alpha: 1,
      color: Math.random() > 0.3 ? '#fef3c7' : '#ffffff', // warm white / pure white
      life: 0,
      maxLife: 300 + Math.random() * 500,
    });
  }
  return sparks;
}

// -- Component --------------------------------------------------------------

export const BurnThoughtWidget = memo(function BurnThoughtWidget({ onClose }: BurnThoughtWidgetProps) {
  const { t, isRTL } = useLanguage();
  const ts = (t as unknown as Record<string, string>) ?? {};
  const [text, setText] = useState('');
  const [burned, setBurned] = useState(false);
  const [burning, setBurning] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentWrapRef = useRef<HTMLDivElement>(null);
  const hotGlowRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const hapticTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const midHapticRef = useRef<ReturnType<typeof setTimeout>>();

  // -- Textarea auto-grow --
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  // -- Cinematic burn animation --

  const startBurn = useCallback(() => {
    if (!text.trim() || burning) return;

    // Dismiss iOS virtual keyboard before animation
    textareaRef.current?.blur();

    // Haptic: burn initiation (Beat 1 - the decision)
    void hapticWarning();

    // Reduced motion: skip animation entirely
    if (!shouldAnimate()) {
      setBurned(true);
      announceSuccess(ts.journalBurnReleasedMessage || 'Your thought has been released.');
      void hapticSuccess();
      return;
    }

    setBurning(true);

    // Fallback helper - instant release if canvas setup fails
    const instantRelease = () => {
      setBurned(true);
      setBurning(false);
      void hapticSuccess();
      announceSuccess(ts.journalBurnReleasedMessage || 'Your thought has been released.');
    };

    const container = containerRef.current;
    if (!container) { instantRelease(); return; }

    const canvas = canvasRef.current;
    if (!canvas) { instantRelease(); return; }

    const ctx = canvas.getContext('2d');
    if (!ctx) { instantRelease(); return; }

    // Size canvas to container
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const areaW = rect.width;
    const areaH = rect.height;

    // Sample text pixel positions
    const textareaEl = container.querySelector('textarea');
    let positions: Array<{ x: number; y: number }>;
    try {
      positions = sampleTextPixels(text, areaW, areaH, dpr, textareaEl);
    } catch {
      instantRelease();
      return;
    }

    // If no pixels sampled, instant release
    if (positions.length === 0) {
      instantRelease();
      return;
    }

    // Create text dust particles — activated by burn line position
    const dustParticles: TextDustParticle[] = positions.map(pos => {
      const maxLife = 1200 + Math.random() * 1200;
      return {
        x: pos.x,
        y: pos.y,
        originX: pos.x,
        originY: pos.y,
        vx: 0,
        vy: 0,
        size: 0.5 + Math.random() * 1, // 0.5-1.5px (much finer)
        alpha: 0.9,
        color: COLORS_HOT[Math.floor(Math.random() * COLORS_HOT.length)],
        ashColor: COLORS_ASH[Math.floor(Math.random() * COLORS_ASH.length)],
        glow: Math.random() < 0.05, // 5% glow rate (performance)
        life: 0,
        maxLife,

        phase: Math.random() * Math.PI * 2,
        started: false,
      };
    });

    // Create ignition sparks
    const sparks = createIgnitionSparks(areaW / 2, areaH);

    // Ember pool (pre-allocated, activated during burn)
    const embers: EmberParticle[] = [];
    const emberSpawnRate = MAX_EMBERS / (BURN_PHASE / 1000); // embers per second

    function spawnEmber(burnY: number) {
      if (embers.length >= MAX_EMBERS) return;
      embers.push({
        x: Math.random() * areaW,
        y: burnY + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 30,
        vy: -(10 + Math.random() * 25),
        size: 2 + Math.random() * 2,
        alpha: 0.9,
        coreColor: EMBER_CORES[Math.floor(Math.random() * EMBER_CORES.length)],
        haloColor: EMBER_HALOS[Math.floor(Math.random() * EMBER_HALOS.length)],
        haloRadius: 3 + Math.random() * 3,
        life: 0,
        maxLife: 1000 + Math.random() * 1500,
        flickerPhase: Math.random() * Math.PI * 2,
        active: true,
      });
    }

    // Haptic at burn start (Beat 2 - fire catches)
    hapticTimerRef.current = setTimeout(() => { void hapticMedium(); }, IGNITION_PHASE);

    // Midway haptic (Beat 3 - past midpoint)
    midHapticRef.current = setTimeout(() => { void hapticTap(); }, IGNITION_PHASE + BURN_PHASE);

    let lastTime = performance.now();
    const startTime = lastTime;
    let lastEmberSpawn = 0;

    function frame(now: number) {
      if (!ctx) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      const elapsed = now - startTime;
      lastTime = now;

      ctx.clearRect(0, 0, areaW, areaH);

      // -- Calculate burn line position --
      let currentBurnLineY = areaH; // starts at bottom
      let burnT = 0;
      if (elapsed > IGNITION_PHASE) {
        burnT = Math.min(1, (elapsed - IGNITION_PHASE) / BURN_PHASE);
        const burnEased = burnT * burnT; // ease-in: slow start, accelerates
        currentBurnLineY = areaH * (1 - burnEased);

        // Direct DOM mutation — zero React re-renders (was setBurnProgress at 60fps)
        if (contentWrapRef.current) {
          contentWrapRef.current.style.clipPath = `inset(0 0 ${burnEased * 100}% 0)`;
        }
        if (hotGlowRef.current) {
          hotGlowRef.current.style.opacity = String(Math.min(1, burnEased * 2));
        }
      }

      // -- Spawn embers along burn line --
      if (elapsed > IGNITION_PHASE && burnT < 1) {
        const timeSinceLastEmber = elapsed - lastEmberSpawn;
        const spawnInterval = 1000 / emberSpawnRate;
        if (timeSinceLastEmber > spawnInterval) {
          spawnEmber(currentBurnLineY);
          lastEmberSpawn = elapsed;
        }
      }

      // -- Render burn line glow (12px gradient band) --
      if (elapsed > IGNITION_PHASE && currentBurnLineY > -12 && currentBurnLineY < areaH + 12) {
        const glowIntensity = burnT < 1 ? Math.min(1, burnT * 3) : Math.max(0, 1 - (burnT - 1) * 5);
        const gradient = ctx.createLinearGradient(0, currentBurnLineY - 8, 0, currentBurnLineY + 8);
        gradient.addColorStop(0, `rgba(239, 68, 68, 0)`);
        gradient.addColorStop(0.25, `rgba(234, 88, 12, ${0.4 * glowIntensity})`);
        gradient.addColorStop(0.5, `rgba(251, 191, 36, ${0.85 * glowIntensity})`);
        gradient.addColorStop(0.75, `rgba(234, 88, 12, ${0.4 * glowIntensity})`);
        gradient.addColorStop(1, `rgba(239, 68, 68, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, currentBurnLineY - 8, areaW, 16);
      }

      let alive = 0;

      // -- Update & render text dust particles --
      for (let i = 0; i < dustParticles.length; i++) {
        const p = dustParticles[i];
        if (p.alpha <= 0) continue;

        // Activate when burn line reaches this particle's Y position
        if (!p.started) {
          if (currentBurnLineY > p.originY) {
            // Burn line hasn't reached yet — only render tremble within 25px proximity
            // (farther particles stay invisible — real text is visible via clip-path)
            const distToBurnLine = currentBurnLineY - p.originY;
            if (distToBurnLine < 25 && elapsed > IGNITION_PHASE) {
              const proximity = 1 - (distToBurnLine / 25); // 0=far, 1=at burn line
              const trembleAmp = proximity * proximity * 3;
              p.x = p.originX + (Math.random() - 0.5) * trembleAmp;
              p.y = p.originY + (Math.random() - 0.5) * trembleAmp * 0.7;

              alive++;
              // Fade in as burn line approaches — avoids popping
              ctx.globalAlpha = 0.85 * proximity;
              ctx.fillStyle = p.color;
              const hs = p.size * 0.5;
              ctx.fillRect(p.x - hs, p.y - hs, p.size, p.size);
            }
            continue;
          }

          // -- Activate: upward release velocity --
          p.started = true;
          p.life = 0;
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
          const speed = 15 + Math.random() * 40;
          const windBias = isRTL ? -8 : 8;
          p.vx = Math.cos(angle) * speed + windBias;
          p.vy = Math.sin(angle) * speed;
        }

        // -- Physics update --
        p.life += dt * 1000;
        if (p.life >= p.maxLife) { p.alpha = 0; continue; }

        // Gentle wind drift
        p.vx += Math.sin(now * 0.002 + p.phase) * 5 * dt;
        // Slight upward pull
        p.vy -= 8 * dt;

        // Move
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Alpha: quadratic ease-out fade
        const lifeT = p.life / p.maxLife;
        p.alpha = Math.max(0, 1 - lifeT * lifeT);

        // Size: very slow shrink
        p.size *= (1 - 0.0015 * (dt * 60));

        if (p.alpha <= 0.01 || p.size < 0.15) { p.alpha = 0; continue; }

        alive++;

        // Temperature-based color
        const temp = 1 - Math.min(lifeT * 1.3, 1);
        const currentColor = temp > 0.35 ? p.color : p.ashColor;

        // Render glow halo (only 5% of particles)
        if (p.glow && temp > 0.3) {
          ctx.globalAlpha = p.alpha * 0.25;
          ctx.shadowBlur = Math.min(p.size * 4, 4);
          ctx.shadowColor = currentColor;
          ctx.fillStyle = currentColor;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Render core particle (fillRect for performance)
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = currentColor;
        const hs = p.size * 0.5;
        ctx.fillRect(p.x - hs, p.y - hs, p.size, p.size);
      }

      // -- Update & render sparks --
      for (let i = 0; i < sparks.length; i++) {
        const s = sparks[i];
        if (s.alpha <= 0) continue;

        s.life += dt * 1000;
        if (s.life >= s.maxLife) { s.alpha = 0; continue; }

        // Gravity (sparks arc downward slightly)
        s.vy += 60 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        // Quick fade
        const sparkT = s.life / s.maxLife;
        s.alpha = Math.max(0, 1 - sparkT * sparkT);

        if (s.alpha <= 0.02) { s.alpha = 0; continue; }

        alive++;

        // Render spark (tiny bright dot)
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x - s.size * 0.5, s.y - s.size * 0.5, s.size, s.size);
      }

      // -- Update & render embers --
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        if (!e.active || e.alpha <= 0) continue;

        e.life += dt * 1000;
        if (e.life >= e.maxLife) { e.alpha = 0; e.active = false; continue; }

        // Embers: slow rise with lateral drift
        e.vy -= 12 * dt;
        e.vx += Math.sin(now * 0.003 + e.flickerPhase) * 15 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;

        // Alpha with flicker
        const emberT = e.life / e.maxLife;
        const flickerAlpha = 0.7 + 0.3 * Math.sin(now * 0.01 + e.flickerPhase);
        e.alpha = Math.max(0, (1 - emberT * emberT) * flickerAlpha);

        // Size: slow shrink
        e.size *= (1 - 0.001 * (dt * 60));

        if (e.alpha <= 0.02 || e.size < 0.5) { e.alpha = 0; e.active = false; continue; }

        alive++;

        // Render ember halo (glow)
        ctx.globalAlpha = e.alpha * 0.3;
        ctx.shadowBlur = Math.min(e.haloRadius, 4);
        ctx.shadowColor = e.haloColor;
        ctx.fillStyle = e.haloColor;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.haloRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Render ember core
        ctx.globalAlpha = e.alpha;
        ctx.fillStyle = e.coreColor;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      // End condition: past total duration AND no alive particles
      if (elapsed > TOTAL_DURATION && alive === 0) {
        if (hotGlowRef.current) hotGlowRef.current.style.opacity = '0';
        setBurning(false);
        setBurned(true);
        void hapticSuccess(); // Beat 4 - resolution
        announceSuccess(ts.journalBurnReleasedMessage || 'Your thought has been released.');
        return;
      }

      // Hard timeout safety
      if (elapsed > HARD_TIMEOUT) {
        if (hotGlowRef.current) hotGlowRef.current.style.opacity = '0';
        setBurning(false);
        setBurned(true);
        void hapticSuccess();
        announceSuccess(ts.journalBurnReleasedMessage || 'Your thought has been released.');
        return;
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [text, burning, ts.journalBurnReleasedMessage, isRTL]);

  // -- Telegram-style collapse: burned -> serenity pause -> collapse -> close --
  useEffect(() => {
    if (burned && !collapsing) {
      closeTimerRef.current = setTimeout(() => {
        setCollapsing(true);
      }, RELEASED_PAUSE);
    }
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  }, [burned, collapsing]);

  // -- Cleanup rAF + timers --
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (hapticTimerRef.current) clearTimeout(hapticTimerRef.current);
      if (midHapticRef.current) clearTimeout(midHapticRef.current);
    };
  }, []);

  // Determine animation states
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
      return { duration: 0.55, ease: [0.32, 0.72, 0, 1] as const };
    }
    if (burned) {
      return { duration: 0.3, ease: 'easeOut' as const };
    }
    if (burning) {
      return { duration: 0.8, ease: 'easeOut' as const };
    }
    return zenMotion.gentle;
  };

  const hasText = text.trim().length > 0;
  const animate = shouldAnimate();
  const showAmbientEmbers = hasText && !burning && !burned && animate;

  return (
    <motion.div
      className="my-8 p-6 rounded-2xl relative overflow-hidden bg-surface-glass backdrop-blur-[var(--surface-glass-blur)] border border-[var(--surface-glass-border)] zen-shadow-soft"
      style={{ boxShadow: 'inset 0 0 60px rgba(239, 68, 68, 0.04), var(--zen-shadow-soft)' }}
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={getAnimateProps()}
      exit={{ opacity: 0, height: 0, scaleY: 0.92, y: -8, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={getTransition()}
      onAnimationComplete={() => {
        if (collapsing) onClose();
      }}
    >
      {/* Card warm glow - GPU-only opacity transition */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-500 ease-out"
        style={{
          boxShadow: 'inset 0 0 80px rgba(239, 68, 68, 0.1), 0 0 24px rgba(239, 68, 68, 0.12)',
          opacity: burning ? 1 : 0,
        }}
        aria-hidden="true"
      />

      {/* Card hot glow - bottom-heavy fire glow, driven by burn line via ref (no re-renders) */}
      <div
        ref={hotGlowRef}
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          boxShadow: 'inset 0 40px 60px -20px rgba(251, 191, 36, 0.15), 0 0 40px rgba(234, 88, 12, 0.2)',
          opacity: 0,
        }}
        aria-hidden="true"
      />

      {/* Ambient floating embers - visible when text is entered */}
      {showAmbientEmbers && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              className="absolute w-1 h-1 rounded-full animate-burn-float-ember"
              style={{
                left: `${8 + (i * 12) % 84}%`,
                bottom: '-2px',
                animationDelay: `${i * 0.5}s`,
                backgroundColor: EMBER_AMBIENT[i % EMBER_AMBIENT.length],
              }}
            />
          ))}
        </div>
      )}

      {/* Rising embers during dissolution */}
      {burning && animate && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-[3]" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className="absolute rounded-full animate-burn-rise-ember"
              style={{
                width: `${2 + (i % 3)}px`,
                height: `${2 + (i % 3)}px`,
                left: `${5 + (i * 7) % 88}%`,
                bottom: '5%',
                animationDelay: `${i * 0.15}s`,
                backgroundColor: COLORS_HOT[i % COLORS_HOT.length],
              }}
            />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className={`flex items-center gap-2 ${burned ? 'text-muted-foreground/70' : 'text-red-400'}`}>
          <Flame className={`w-4 h-4 ${showAmbientEmbers ? 'animate-burn-flame-pulse' : ''}`} />
          <span className="text-sm font-medium">
            {burned ? (ts.journalBurnReleased || 'Released') : (ts.journalBurnTitle || 'Burn a thought')}
          </span>
        </div>
        {!burned && !burning && (
          <motion.button
            whileTap={zenTap.icon}
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full"
            aria-label={ts.close || 'Close'}
          >
            <X className="w-3.5 h-3.5 text-red-400/60" />
          </motion.button>
        )}
      </div>

      {/* Body */}
      <div className="relative px-4 pb-4">
        {burned ? (
          <motion.div
            className="flex flex-col items-center gap-3 py-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={collapsing ? { opacity: 0, y: -12 } : { opacity: 1, scale: 1 }}
            transition={collapsing ? { duration: 0.25 } : zenMotion.gentle}
            aria-live="polite"
          >
            {/* Animated check circle */}
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-emerald-400"
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
                    animation: 'burn-draw-check 0.5s ease-out 0.15s forwards',
                  } : undefined}
                />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground/60">
              {ts.journalBurnReleasedMessage || 'Your thought has been released.'}
            </p>
          </motion.div>
        ) : (
          <div ref={containerRef} className="relative overflow-hidden">
            {/* Content wrapper — clip-path driven by burn line via ref (zero re-renders).
                No opacity fade: real text stays visible above burn line, clip-path
                clips it from bottom as fire advances. Canvas particles tremble at
                the burn edge (25px proximity) to create the "crumbling" transition. */}
            <div ref={contentWrapRef}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={ts.journalBurnPlaceholder || 'Write what worries you...'}
                className={`w-full rounded-xl px-4 py-3 text-sm outline-none resize-none bg-white/[0.03] ring-1 ring-white/[0.06] focus:ring-red-500/20 placeholder:text-muted-foreground/40 transition-colors duration-150 ${burning ? 'text-orange-400/80' : 'text-foreground/90'}`}
                style={{ minHeight: 64, maxHeight: 200 }}
                rows={2}
                maxLength={500}
                disabled={burning}
                aria-label={ts.journalBurnPlaceholder || 'Write what worries you...'}
              />

              {/* Character counter */}
              {text.length > 0 && !burning && (
                <div className={`text-end text-xs mt-1 transition-opacity duration-200 ${text.length > 450 ? 'text-red-400/70' : 'text-muted-foreground/30'}`}>
                  {text.length}/500
                </div>
              )}

              {!burning && (
                <motion.button
                  whileTap={zenTap.button}
                  onClick={startBurn}
                  disabled={!hasText}
                  className={`mt-3 w-full py-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 min-h-[44px] ${hasText ? 'bg-red-500/15 text-red-300 ring-1 ring-red-500/20 hover:bg-red-500/20' : 'bg-white/[0.03] text-muted-foreground/50 ring-1 ring-white/[0.06]'} ${hasText && animate ? 'burn-glow-pulse-wrap' : ''}`}
                >
                  <Flame className="w-4 h-4" />
                  {ts.journalBurnAction || 'Burn it'}
                </motion.button>
              )}
            </div>

            {/* Dust canvas - ALWAYS in DOM so ref is available synchronously.
                React 18 batches setState, so {burning && <canvas>} would make
                canvasRef.current null when startBurn() accesses it. */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full rounded-xl"
              style={{
                zIndex: 2,
                pointerEvents: 'none',
                opacity: burning ? 1 : 0,
              }}
              aria-hidden="true"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
});
