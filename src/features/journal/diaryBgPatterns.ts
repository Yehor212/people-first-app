/**
 * diaryBgPatterns — Atmospheric Background Patterns & Paper Textures
 *
 * LAYER 1 (atmospheric): CSS mesh gradients behind the paper card.
 *   Multi-layered radial/linear/conic gradients creating watercolor,
 *   bokeh, aurora, and decorative effects. Zero image files.
 *
 * LAYER 2 (paper): CSS textures on the paper card itself.
 *   Extended from clean/dots to include grid, lines, linen, craft.
 */

import type { DiaryBgPattern, PaperTexture } from './types';

// ══════════════════════════════════════════════════════════════
// LAYER 1 — Atmospheric Background Patterns (behind paper card)
// ══════════════════════════════════════════════════════════════

export interface BgPatternMeta {
  name: DiaryBgPattern;
  i18nKey: string;
  /** Small color swatch for the picker UI */
  swatch: string;
  /** Category for grouping */
  category: 'warm' | 'cool' | 'dark' | 'pastel';
}

export const BG_PATTERN_LIST: BgPatternMeta[] = [
  { name: 'none',         i18nKey: 'diaryBgNone',         swatch: 'transparent',                                category: 'warm' },
  { name: 'sakura',       i18nKey: 'diaryBgSakura',       swatch: 'linear-gradient(135deg, #FFE4EC, #FFB7C5)',   category: 'pastel' },
  { name: 'honey',        i18nKey: 'diaryBgHoney',        swatch: 'linear-gradient(135deg, #FFF3D6, #F0C060)',   category: 'warm' },
  { name: 'cloud',        i18nKey: 'diaryBgCloud',        swatch: 'linear-gradient(135deg, #E8F4FD, #B8D8F0)',   category: 'cool' },
  { name: 'matcha',       i18nKey: 'diaryBgMatcha',       swatch: 'linear-gradient(135deg, #E8F5E0, #A3D9A5)',   category: 'cool' },
  { name: 'peach',        i18nKey: 'diaryBgPeach',        swatch: 'linear-gradient(135deg, #FFF0E6, #FFB088)',   category: 'warm' },
  { name: 'aurora',       i18nKey: 'diaryBgAurora',       swatch: 'linear-gradient(135deg, #0F172A, #5EEAD4)',   category: 'dark' },
  { name: 'moonlight',    i18nKey: 'diaryBgMoonlight',    swatch: 'linear-gradient(135deg, #0A0E1A, #C0D0E8)',   category: 'dark' },
  { name: 'watercolor',   i18nKey: 'diaryBgWatercolor',   swatch: 'linear-gradient(135deg, #FFD6E0, #D6E8FF)',   category: 'pastel' },
  { name: 'stardust',     i18nKey: 'diaryBgStardust',     swatch: 'linear-gradient(135deg, #1A1028, #FFD700)',   category: 'dark' },
  { name: 'garden',       i18nKey: 'diaryBgGarden',       swatch: 'linear-gradient(135deg, #E0F5E8, #FFD6E8)',   category: 'pastel' },
  { name: 'cotton-candy', i18nKey: 'diaryBgCottonCandy',  swatch: 'linear-gradient(135deg, #F0D6FF, #D6F0FF)',   category: 'pastel' },
  { name: 'sunset-beach', i18nKey: 'diaryBgSunsetBeach',  swatch: 'linear-gradient(135deg, #FF9A76, #8B5CF6)',   category: 'warm' },
  { name: 'snowfall',     i18nKey: 'diaryBgSnowfall',     swatch: 'linear-gradient(135deg, #E8F0F8, #F5F5FF)',   category: 'cool' },
];

/**
 * Get CSS styles for atmospheric background pattern.
 * Returns background + backgroundSize + other relevant properties.
 */
export function getBgPatternStyle(pattern: DiaryBgPattern): React.CSSProperties {
  switch (pattern) {
    case 'none':
      return {};

    // ── SAKURA: Cherry blossom watercolor + soft petal bokeh ──
    case 'sakura':
      return {
        background: [
          // Petal-like bokeh spots (scattered soft circles)
          'radial-gradient(ellipse 60px 80px at 15% 20%, rgba(255,183,197,0.5) 0%, transparent 70%)',
          'radial-gradient(ellipse 40px 50px at 75% 15%, rgba(255,218,233,0.4) 0%, transparent 65%)',
          'radial-gradient(ellipse 50px 60px at 85% 65%, rgba(255,192,203,0.45) 0%, transparent 70%)',
          'radial-gradient(ellipse 70px 90px at 25% 75%, rgba(255,228,236,0.5) 0%, transparent 65%)',
          'radial-gradient(ellipse 35px 45px at 55% 45%, rgba(255,182,193,0.35) 0%, transparent 60%)',
          'radial-gradient(ellipse 45px 55px at 40% 90%, rgba(255,210,225,0.4) 0%, transparent 65%)',
          // Base watercolor wash
          'radial-gradient(ellipse at 30% 40%, rgba(255,182,193,0.3) 0%, transparent 55%)',
          'radial-gradient(ellipse at 70% 60%, rgba(255,228,236,0.35) 0%, transparent 50%)',
          'radial-gradient(ellipse at 50% 85%, rgba(255,240,245,0.4) 0%, transparent 60%)',
          'linear-gradient(155deg, #FFF0F5 0%, #FFE4EC 35%, #FFEEF2 65%, #FFF5F7 100%)',
        ].join(','),
      };

    // ── HONEY: Warm amber glow + golden light pools + honeycomb hint ──
    case 'honey':
      return {
        background: [
          // Golden light pools (warm sunbeam effect)
          'radial-gradient(ellipse 80px 100px at 20% 30%, rgba(255,215,0,0.25) 0%, transparent 65%)',
          'radial-gradient(ellipse 60px 70px at 70% 20%, rgba(240,192,96,0.3) 0%, transparent 60%)',
          'radial-gradient(ellipse 90px 80px at 80% 70%, rgba(255,223,128,0.2) 0%, transparent 65%)',
          'radial-gradient(ellipse 50px 60px at 35% 80%, rgba(255,200,64,0.25) 0%, transparent 55%)',
          // Hexagonal honeycomb hint (conic gradients)
          'conic-gradient(from 0deg at 50% 35%, transparent 0deg, rgba(218,165,32,0.06) 30deg, transparent 60deg)',
          'conic-gradient(from 60deg at 30% 60%, transparent 0deg, rgba(218,165,32,0.05) 30deg, transparent 60deg)',
          'conic-gradient(from 120deg at 70% 50%, transparent 0deg, rgba(218,165,32,0.04) 30deg, transparent 60deg)',
          // Warm base
          'radial-gradient(ellipse at 40% 50%, rgba(255,243,214,0.6) 0%, transparent 60%)',
          'linear-gradient(165deg, #FFFAEB 0%, #FFF3D6 30%, #FFEEBB 60%, #FFF8E7 100%)',
        ].join(','),
      };

    // ── CLOUD: Dreamy sky + soft cloud puffs + light rays ──
    case 'cloud':
      return {
        background: [
          // Cloud puffs (large soft ellipses)
          'radial-gradient(ellipse 120px 80px at 20% 25%, rgba(255,255,255,0.5) 0%, transparent 60%)',
          'radial-gradient(ellipse 100px 60px at 65% 20%, rgba(255,255,255,0.4) 0%, transparent 55%)',
          'radial-gradient(ellipse 140px 90px at 80% 55%, rgba(255,255,255,0.35) 0%, transparent 60%)',
          'radial-gradient(ellipse 90px 70px at 30% 70%, rgba(255,255,255,0.3) 0%, transparent 55%)',
          'radial-gradient(ellipse 110px 60px at 50% 40%, rgba(255,255,255,0.25) 0%, transparent 50%)',
          // Subtle sun ray
          'conic-gradient(from 200deg at 85% 10%, transparent 0deg, rgba(255,248,220,0.15) 20deg, transparent 40deg)',
          // Sky gradient base
          'linear-gradient(180deg, #D6ECFA 0%, #E3F1FC 25%, #EBF5FD 50%, #F0F7FF 75%, #F5FAFF 100%)',
        ].join(','),
      };

    // ── MATCHA: Zen garden + bamboo shadows + stone circles ──
    case 'matcha':
      return {
        background: [
          // Zen stone circles (concentric radial hints)
          'radial-gradient(circle 30px at 25% 35%, transparent 60%, rgba(107,158,94,0.08) 62%, transparent 64%)',
          'radial-gradient(circle 50px at 25% 35%, transparent 60%, rgba(107,158,94,0.06) 62%, transparent 64%)',
          'radial-gradient(circle 70px at 25% 35%, transparent 60%, rgba(107,158,94,0.04) 62%, transparent 64%)',
          // Bamboo shadow stripes
          'repeating-linear-gradient(80deg, transparent 0px, transparent 60px, rgba(107,158,94,0.04) 60px, rgba(107,158,94,0.04) 62px)',
          'repeating-linear-gradient(80deg, transparent 0px, transparent 90px, rgba(85,130,75,0.03) 90px, rgba(85,130,75,0.03) 91px)',
          // Leaf-like bokeh
          'radial-gradient(ellipse 50px 70px at 70% 30%, rgba(163,217,165,0.25) 0%, transparent 60%)',
          'radial-gradient(ellipse 40px 55px at 45% 70%, rgba(141,200,130,0.2) 0%, transparent 55%)',
          'radial-gradient(ellipse 60px 40px at 80% 80%, rgba(180,230,170,0.2) 0%, transparent 55%)',
          // Base
          'linear-gradient(170deg, #EEF7E8 0%, #E2F0D9 30%, #E8F5E0 60%, #F2F9EE 100%)',
        ].join(','),
      };

    // ── PEACH: Warm coral sunset glow + soft light diffusion ──
    case 'peach':
      return {
        background: [
          // Warm light diffusion spots
          'radial-gradient(ellipse 70px 90px at 20% 25%, rgba(255,176,136,0.35) 0%, transparent 65%)',
          'radial-gradient(ellipse 80px 60px at 75% 30%, rgba(255,200,170,0.3) 0%, transparent 60%)',
          'radial-gradient(ellipse 60px 80px at 60% 75%, rgba(255,180,150,0.3) 0%, transparent 60%)',
          'radial-gradient(ellipse 50px 50px at 35% 60%, rgba(255,210,190,0.25) 0%, transparent 55%)',
          // Soft diagonal light beam
          'linear-gradient(135deg, rgba(255,228,210,0.4) 0%, transparent 40%)',
          // Base
          'radial-gradient(ellipse at 50% 50%, rgba(255,240,230,0.5) 0%, transparent 70%)',
          'linear-gradient(160deg, #FFF5EE 0%, #FFEDE0 30%, #FFF0E6 55%, #FFF8F2 100%)',
        ].join(','),
      };

    // ── AURORA: Northern lights curtains + star field + color bands ──
    case 'aurora':
      return {
        background: [
          // Aurora curtain bands (wide vertical/diagonal swaths)
          'radial-gradient(ellipse 200px 400px at 25% 40%, rgba(94,234,212,0.2) 0%, transparent 60%)',
          'radial-gradient(ellipse 150px 350px at 55% 30%, rgba(167,139,250,0.18) 0%, transparent 55%)',
          'radial-gradient(ellipse 180px 300px at 75% 50%, rgba(52,211,153,0.15) 0%, transparent 55%)',
          'radial-gradient(ellipse 100px 250px at 40% 60%, rgba(96,165,250,0.12) 0%, transparent 50%)',
          // Star-like tiny bright spots
          'radial-gradient(circle 2px at 10% 15%, rgba(255,255,255,0.4) 0%, transparent 100%)',
          'radial-gradient(circle 1px at 30% 8%, rgba(255,255,255,0.3) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 55% 12%, rgba(255,255,255,0.35) 0%, transparent 100%)',
          'radial-gradient(circle 1px at 80% 20%, rgba(255,255,255,0.3) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 90% 45%, rgba(255,255,255,0.25) 0%, transparent 100%)',
          'radial-gradient(circle 1px at 15% 55%, rgba(255,255,255,0.3) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 45% 70%, rgba(255,255,255,0.2) 0%, transparent 100%)',
          'radial-gradient(circle 1px at 70% 85%, rgba(255,255,255,0.25) 0%, transparent 100%)',
          // Deep sky base
          'linear-gradient(170deg, #0F172A 0%, #1E1B4B 30%, #0C1445 60%, #0A0E1A 100%)',
        ].join(','),
      };

    // ── MOONLIGHT: Silver moon glow + starry reflections + mist ──
    case 'moonlight':
      return {
        background: [
          // Moon glow (top-right bright circle)
          'radial-gradient(circle 80px at 78% 12%, rgba(220,230,245,0.35) 0%, transparent 60%)',
          'radial-gradient(circle 130px at 78% 12%, rgba(192,208,232,0.15) 0%, transparent 70%)',
          // Moonbeam ray
          'conic-gradient(from 220deg at 78% 12%, transparent 0deg, rgba(200,215,240,0.08) 15deg, transparent 30deg)',
          // Mist layers
          'radial-gradient(ellipse 200px 40px at 30% 85%, rgba(200,215,240,0.12) 0%, transparent 70%)',
          'radial-gradient(ellipse 250px 30px at 60% 90%, rgba(180,200,225,0.1) 0%, transparent 65%)',
          // Star sprinkle
          'radial-gradient(circle 1px at 15% 25%, rgba(255,255,255,0.35) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 35% 18%, rgba(255,255,255,0.25) 0%, transparent 100%)',
          'radial-gradient(circle 1px at 50% 30%, rgba(255,255,255,0.3) 0%, transparent 100%)',
          'radial-gradient(circle 1px at 25% 50%, rgba(255,255,255,0.2) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 60% 55%, rgba(255,255,255,0.2) 0%, transparent 100%)',
          // Night sky base
          'linear-gradient(175deg, #0E1525 0%, #141E35 30%, #111928 65%, #0A0E1A 100%)',
        ].join(','),
      };

    // ── WATERCOLOR: Multi-color pastel splashes + paint drips ──
    case 'watercolor':
      return {
        background: [
          // Color splashes (large soft blobs in different pastel colors)
          'radial-gradient(ellipse 100px 120px at 15% 20%, rgba(255,182,193,0.35) 0%, transparent 65%)',    // pink
          'radial-gradient(ellipse 80px 100px at 70% 15%, rgba(173,216,230,0.35) 0%, transparent 60%)',     // blue
          'radial-gradient(ellipse 90px 80px at 85% 55%, rgba(255,228,181,0.3) 0%, transparent 60%)',       // peach
          'radial-gradient(ellipse 70px 90px at 20% 70%, rgba(186,230,186,0.3) 0%, transparent 60%)',       // green
          'radial-gradient(ellipse 60px 70px at 50% 45%, rgba(221,190,239,0.3) 0%, transparent 55%)',       // lavender
          'radial-gradient(ellipse 80px 60px at 40% 85%, rgba(255,218,185,0.25) 0%, transparent 55%)',      // orange
          // Paint drip streaks
          'linear-gradient(175deg, transparent 0%, transparent 20%, rgba(255,192,203,0.1) 21%, transparent 23%)',
          'linear-gradient(170deg, transparent 0%, transparent 45%, rgba(173,216,230,0.08) 46%, transparent 48%)',
          'linear-gradient(178deg, transparent 0%, transparent 65%, rgba(221,190,239,0.08) 66%, transparent 68%)',
          // Soft cream base
          'linear-gradient(145deg, #FFF8F5 0%, #F8F0FF 25%, #F0F8FF 50%, #FFF5F0 75%, #FFFBF5 100%)',
        ].join(','),
      };

    // ── STARDUST: Cosmic gold + nebula clouds + glitter particles ──
    case 'stardust':
      return {
        background: [
          // Gold nebula clouds
          'radial-gradient(ellipse 120px 100px at 30% 35%, rgba(255,215,0,0.15) 0%, transparent 60%)',
          'radial-gradient(ellipse 80px 120px at 65% 25%, rgba(255,190,50,0.12) 0%, transparent 55%)',
          'radial-gradient(ellipse 100px 80px at 75% 70%, rgba(255,200,80,0.1) 0%, transparent 55%)',
          // Purple nebula undertone
          'radial-gradient(ellipse at 20% 60%, rgba(120,80,180,0.12) 0%, transparent 50%)',
          'radial-gradient(ellipse at 80% 40%, rgba(100,60,160,0.1) 0%, transparent 45%)',
          // Glitter stars
          'radial-gradient(circle 2px at 12% 18%, rgba(255,215,0,0.5) 0%, transparent 100%)',
          'radial-gradient(circle 1px at 28% 10%, rgba(255,255,200,0.4) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 45% 22%, rgba(255,200,100,0.45) 0%, transparent 100%)',
          'radial-gradient(circle 1px at 62% 15%, rgba(255,220,130,0.35) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 78% 28%, rgba(255,215,0,0.4) 0%, transparent 100%)',
          'radial-gradient(circle 1px at 88% 50%, rgba(255,255,180,0.3) 0%, transparent 100%)',
          'radial-gradient(circle 1px at 35% 65%, rgba(255,215,0,0.3) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 55% 78%, rgba(255,200,80,0.35) 0%, transparent 100%)',
          'radial-gradient(circle 1px at 20% 85%, rgba(255,220,100,0.25) 0%, transparent 100%)',
          // Deep space base
          'linear-gradient(155deg, #1A1028 0%, #150D22 30%, #1E1230 60%, #12081C 100%)',
        ].join(','),
      };

    // ── GARDEN: Floral bokeh + leaf patterns + soft sunshine ──
    case 'garden':
      return {
        background: [
          // Flower-like bokeh blobs (pinks + whites)
          'radial-gradient(ellipse 40px 45px at 15% 25%, rgba(255,182,193,0.35) 0%, transparent 65%)',
          'radial-gradient(ellipse 30px 35px at 30% 15%, rgba(255,255,255,0.3) 0%, transparent 60%)',
          'radial-gradient(ellipse 35px 40px at 75% 20%, rgba(255,200,210,0.3) 0%, transparent 60%)',
          'radial-gradient(ellipse 25px 30px at 88% 35%, rgba(255,228,236,0.35) 0%, transparent 55%)',
          'radial-gradient(ellipse 40px 35px at 60% 75%, rgba(255,192,203,0.3) 0%, transparent 60%)',
          'radial-gradient(ellipse 30px 40px at 40% 85%, rgba(255,215,225,0.3) 0%, transparent 55%)',
          // Leaf-shaped green accents
          'radial-gradient(ellipse 25px 50px at 10% 55%, rgba(144,238,144,0.2) 0%, transparent 60%)',
          'radial-gradient(ellipse 20px 45px at 90% 60%, rgba(144,238,144,0.15) 0%, transparent 55%)',
          'radial-gradient(ellipse 30px 15px at 50% 50%, rgba(168,230,160,0.15) 0%, transparent 50%)',
          // Sunshine glow (top-left)
          'radial-gradient(circle 100px at 10% 5%, rgba(255,248,220,0.3) 0%, transparent 55%)',
          // Base
          'linear-gradient(160deg, #F0FAF0 0%, #E8F5EA 25%, #FFF5F8 50%, #F0F8F0 75%, #F5FFF5 100%)',
        ].join(','),
      };

    // ── COTTON CANDY: Dreamy pink-blue-purple swirl + sugar sparkle ──
    case 'cotton-candy':
      return {
        background: [
          // Cotton candy swirls (large pastel blobs)
          'radial-gradient(ellipse 100px 130px at 20% 25%, rgba(255,182,220,0.35) 0%, transparent 60%)',
          'radial-gradient(ellipse 120px 100px at 70% 20%, rgba(186,220,255,0.35) 0%, transparent 55%)',
          'radial-gradient(ellipse 90px 110px at 80% 65%, rgba(221,190,255,0.3) 0%, transparent 55%)',
          'radial-gradient(ellipse 110px 90px at 25% 75%, rgba(255,200,230,0.3) 0%, transparent 55%)',
          'radial-gradient(ellipse 80px 70px at 50% 50%, rgba(200,215,255,0.25) 0%, transparent 50%)',
          // Sugar sparkle dots
          'radial-gradient(circle 2px at 25% 20%, rgba(255,255,255,0.4) 0%, transparent 100%)',
          'radial-gradient(circle 1px at 55% 15%, rgba(255,255,255,0.35) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 80% 40%, rgba(255,255,255,0.3) 0%, transparent 100%)',
          'radial-gradient(circle 1px at 40% 65%, rgba(255,255,255,0.3) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 65% 80%, rgba(255,255,255,0.25) 0%, transparent 100%)',
          // Base
          'linear-gradient(135deg, #FFF0F8 0%, #F5E8FF 25%, #E8F0FF 50%, #FFF0FA 75%, #F8F0FF 100%)',
        ].join(','),
      };

    // ── SUNSET BEACH: Horizon gradient + water reflections + warm haze ──
    case 'sunset-beach':
      return {
        background: [
          // Sun disk (low on horizon)
          'radial-gradient(circle 60px at 50% 55%, rgba(255,165,80,0.35) 0%, transparent 60%)',
          'radial-gradient(circle 120px at 50% 55%, rgba(255,140,60,0.15) 0%, transparent 65%)',
          // Light rays from sun
          'conic-gradient(from 250deg at 50% 55%, transparent 0deg, rgba(255,180,100,0.08) 10deg, transparent 20deg, transparent 40deg, rgba(255,160,80,0.06) 50deg, transparent 60deg)',
          // Water reflection shimmer (bottom half)
          'repeating-linear-gradient(0deg, transparent 0px, transparent 8px, rgba(255,200,150,0.04) 8px, rgba(255,200,150,0.04) 10px)',
          // Warm haze
          'radial-gradient(ellipse at 30% 40%, rgba(255,120,80,0.15) 0%, transparent 50%)',
          'radial-gradient(ellipse at 70% 45%, rgba(180,100,200,0.12) 0%, transparent 45%)',
          // Horizon gradient base
          'linear-gradient(180deg, #2D1B4E 0%, #6B2E7B 15%, #C74B6D 30%, #FF8C5A 45%, #FFAF70 55%, #FFD4A8 70%, #3D2854 85%, #1A0E2E 100%)',
        ].join(','),
      };

    // ── SNOWFALL: Cool white-blue + falling snow dots + frost crystals ──
    case 'snowfall':
      return {
        background: [
          // Snowflake dots (scattered white circles)
          'radial-gradient(circle 3px at 10% 15%, rgba(255,255,255,0.5) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 25% 8%, rgba(255,255,255,0.4) 0%, transparent 100%)',
          'radial-gradient(circle 4px at 40% 22%, rgba(255,255,255,0.45) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 55% 12%, rgba(255,255,255,0.35) 0%, transparent 100%)',
          'radial-gradient(circle 3px at 70% 28%, rgba(255,255,255,0.4) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 85% 18%, rgba(255,255,255,0.3) 0%, transparent 100%)',
          'radial-gradient(circle 3px at 20% 45%, rgba(255,255,255,0.35) 0%, transparent 100%)',
          'radial-gradient(circle 4px at 50% 55%, rgba(255,255,255,0.3) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 75% 50%, rgba(255,255,255,0.35) 0%, transparent 100%)',
          'radial-gradient(circle 3px at 35% 72%, rgba(255,255,255,0.3) 0%, transparent 100%)',
          'radial-gradient(circle 2px at 60% 80%, rgba(255,255,255,0.25) 0%, transparent 100%)',
          'radial-gradient(circle 3px at 88% 68%, rgba(255,255,255,0.3) 0%, transparent 100%)',
          // Frost crystal hint (subtle star patterns)
          'conic-gradient(from 0deg at 30% 30%, transparent 0deg, rgba(200,220,240,0.06) 30deg, transparent 60deg, transparent 120deg, rgba(200,220,240,0.04) 150deg, transparent 180deg)',
          'conic-gradient(from 30deg at 70% 60%, transparent 0deg, rgba(210,225,240,0.05) 30deg, transparent 60deg, transparent 120deg, rgba(200,220,240,0.04) 150deg, transparent 180deg)',
          // Cold mist
          'radial-gradient(ellipse 180px 50px at 40% 90%, rgba(220,230,245,0.15) 0%, transparent 65%)',
          // Winter sky base
          'linear-gradient(180deg, #E0EAF5 0%, #E8F0F8 25%, #EEF3FA 50%, #F2F6FC 75%, #F5F8FF 100%)',
        ].join(','),
      };

    default:
      return {};
  }
}


// ══════════════════════════════════════════════════════════════
// LAYER 2 — Paper Textures (on the paper card itself)
// ══════════════════════════════════════════════════════════════

/**
 * Get CSS styles for paper texture overlay.
 * Applied on the paper card as backgroundImage.
 */
export function getPaperTextureStyle(texture: PaperTexture, isDark: boolean): React.CSSProperties {
  const dotColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const lineColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';

  switch (texture) {
    case 'clean':
      return {};

    case 'dots':
      return {
        backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      };

    case 'grid':
      return {
        backgroundImage: [
          `linear-gradient(to right, ${lineColor} 1px, transparent 1px)`,
          `linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`,
        ].join(','),
        backgroundSize: '32px 32px',
      };

    case 'lines':
      return {
        backgroundImage: `linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`,
        backgroundSize: '100% 28px',
      };

    case 'linen':
      return {
        backgroundImage: [
          `linear-gradient(45deg, ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'} 25%, transparent 25%)`,
          `linear-gradient(-45deg, ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'} 25%, transparent 25%)`,
          `linear-gradient(45deg, transparent 75%, ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'} 75%)`,
          `linear-gradient(-45deg, transparent 75%, ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'} 75%)`,
        ].join(','),
        backgroundSize: '4px 4px',
      };

    case 'craft':
      return {
        backgroundImage: [
          `radial-gradient(circle, ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'} 1px, transparent 1px)`,
          `radial-gradient(circle, ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'} 1px, transparent 1px)`,
        ].join(','),
        backgroundSize: '7px 7px, 13px 13px',
        backgroundPosition: '0 0, 3px 5px',
      };

    default:
      return {};
  }
}
