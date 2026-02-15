/**
 * Share Cards - Generate beautiful share images using Canvas 2D API
 * Replaces DOM-based html2canvas approach for instant, reliable rendering
 */

import { Badge } from '@/types';
import { logger } from '@/lib/logger';
import {
  createCanvas,
  fillGradientRect,
  drawRoundedRect,
  drawText,
  drawRadialOverlay,
  canvasToBlob,
  ensureSanitizer,
  sanitizeText,
  preloadShareCardAssets,
  measureText,
} from '@/lib/shareCardRenderer';

// Re-export preload for app initialization
export { preloadShareCardAssets };
// Re-export cleanupShareCache from shareActions
export { cleanupShareCache } from '@/lib/shareActions';

// ============================================
// TYPES
// ============================================

export type ShareCardType = 'achievement' | 'streak' | 'progress' | 'weekly';

export interface ShareCardData {
  type: ShareCardType;
  title: string;
  subtitle?: string;
  icon?: string;
  value?: string | number;
  username?: string;
  date?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  stats?: {
    label: string;
    value: string | number;
  }[];
}

export interface WeeklyProgressData {
  weekRange: string;
  moodAverage: number;
  habitsCompleted: number;
  habitsTotal: number;
  focusMinutes: number;
  streak: number;
  newBadges: Badge[];
}

export interface TrophyShareData {
  streak: number;
  focusMinutes: number;
  habitsCompleted: number;
}

/** Translations passed to card generators for localized content */
export interface ShareCardTranslations {
  dayStreak: string;
  weeklyReview: string;
  mood: string;
  habits: string;
  focus: string;
  streak: string;
  days: string;
  newAchievements: string;
  trackHabits: string;
  moodGreat: string;
  moodGood: string;
  moodOkay: string;
  moodLow: string;
  moodTough: string;
}

/** Default English translations */
export const DEFAULT_CARD_TRANSLATIONS: ShareCardTranslations = {
  dayStreak: 'DAY STREAK',
  weeklyReview: 'WEEKLY REVIEW',
  mood: 'Mood',
  habits: 'Habits',
  focus: 'Focus',
  streak: 'Streak',
  days: 'days',
  newAchievements: 'NEW ACHIEVEMENTS',
  trackHabits: 'Track your habits with ZenFlow',
  moodGreat: 'Great',
  moodGood: 'Good',
  moodOkay: 'Okay',
  moodLow: 'Low',
  moodTough: 'Tough',
};

// ============================================
// THEME PALETTES
// ============================================

interface ThemePalette {
  cardBg: [number, string][];
  textColor: string;
  textSecondary: string;
  glassBg: string;
  glassBorder: string;
  footerBorder: string;
}

const DARK_PALETTE: ThemePalette = {
  cardBg: [[0, '#1E293B'], [1, '#0F172A']],
  textColor: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  glassBg: 'rgba(255,255,255,0.05)',
  glassBorder: 'rgba(255,255,255,0.1)',
  footerBorder: 'rgba(255,255,255,0.1)',
};

const LIGHT_PALETTE: ThemePalette = {
  cardBg: [[0, '#F8FAFC'], [1, '#E2E8F0']],
  textColor: '#0F172A',
  textSecondary: 'rgba(15,23,42,0.6)',
  glassBg: 'rgba(0,0,0,0.03)',
  glassBorder: 'rgba(0,0,0,0.08)',
  footerBorder: 'rgba(0,0,0,0.08)',
};

function getPalette(theme: 'light' | 'dark'): ThemePalette {
  return theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
}

// ============================================
// CARD GRADIENTS
// ============================================

const CARD_GRADIENTS: Record<ShareCardType, [number, string][]> = {
  achievement: [[0, '#10B981'], [0.5, '#059669'], [1, '#047857']],
  streak: [[0, '#FF6B35'], [0.5, '#F7931E'], [1, '#FFB347']],
  progress: [[0, '#8B5CF6'], [0.5, '#7C3AED'], [1, '#6D28D9']],
  weekly: [[0, '#3B82F6'], [0.5, '#2563EB'], [1, '#1D4ED8']],
};

const RARITY_COLORS: Record<string, { border: string; glow: string }> = {
  common: { border: '#9CA3AF', glow: 'rgba(156, 163, 175, 0.3)' },
  rare: { border: '#3B82F6', glow: 'rgba(59, 130, 246, 0.4)' },
  epic: { border: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.4)' },
  legendary: { border: '#F59E0B', glow: 'rgba(245, 158, 11, 0.5)' },
};

// ============================================
// CONSTANTS
// ============================================

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const CARD_SIZE = 1080;
const WEEKLY_HEIGHT = 1350;
const PADDING = 80;

// ============================================
// UTILITY FUNCTIONS
// ============================================

function isRTL(lang: string): boolean {
  return lang === 'ar' || lang === 'he';
}

function getMoodText(average: number, tr: ShareCardTranslations): string {
  if (average >= 4.5) return `😄 ${tr.moodGreat}`;
  if (average >= 3.5) return `🙂 ${tr.moodGood}`;
  if (average >= 2.5) return `😐 ${tr.moodOkay}`;
  if (average >= 1.5) return `😔 ${tr.moodLow}`;
  return `😢 ${tr.moodTough}`;
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

function getTextAlign(lang: string): CanvasTextAlign {
  return isRTL(lang) ? 'right' : 'center';
}

function getTextX(lang: string, width: number): number {
  if (isRTL(lang)) return width - PADDING;
  return width / 2;
}

function getDirection(lang: string): CanvasDirection | undefined {
  return isRTL(lang) ? 'rtl' : undefined;
}

// ============================================
// CARD DRAWING FUNCTIONS
// ============================================

function drawBackgroundPattern(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  drawRadialOverlay(ctx, w * 0.2, h * 0.8, w * 0.5, 'rgba(255,255,255,0.1)');
  drawRadialOverlay(ctx, w * 0.8, h * 0.2, w * 0.4, 'rgba(255,255,255,0.08)');
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  username?: string,
  date?: string,
  lang: string = 'en'
): void {
  const y = h - 60;
  const parts: string[] = [];
  if (username) parts.push(`@${sanitizeText(username)}`);
  parts.push('ZenFlow');
  if (date) parts.push(date);
  const text = parts.join(' • ');

  drawText(ctx, text, getTextX(lang, w), y, {
    font: `600 28px ${FONT_FAMILY}`,
    color: 'white',
    align: isRTL(lang) ? 'right' : 'center',
    baseline: 'middle',
    opacity: 0.8,
    direction: getDirection(lang),
  });
}

function drawStreakCard(
  ctx: CanvasRenderingContext2D,
  streak: number,
  tr: ShareCardTranslations,
  habitName?: string,
  username?: string,
  lang: string = 'en'
): void {
  const W = CARD_SIZE;

  // Background
  fillGradientRect(ctx, 0, 0, W, W, 135, CARD_GRADIENTS.streak);
  drawBackgroundPattern(ctx, W, W);

  const centerX = getTextX(lang, W);
  const align = getTextAlign(lang);
  const dir = getDirection(lang);

  // Fire emojis row
  const fireCount = Math.min(streak, 10);
  const fireText = '🔥'.repeat(fireCount);
  drawText(ctx, fireText, W / 2, 280, {
    font: `60px ${FONT_FAMILY}`,
    color: 'white',
    align: 'center',
    baseline: 'middle',
    shadow: { color: 'rgba(255,107,53,0.5)', blur: 20 },
  });

  // Streak number
  drawText(ctx, String(streak), W / 2, 480, {
    font: `900 200px ${FONT_FAMILY}`,
    color: 'white',
    align: 'center',
    baseline: 'middle',
    shadow: { color: 'rgba(0,0,0,0.3)', blur: 40, offsetY: 8 },
  });

  // Day streak label
  drawText(ctx, tr.dayStreak, centerX, 600, {
    font: `700 56px ${FONT_FAMILY}`,
    color: 'white',
    align,
    baseline: 'middle',
    direction: dir,
  });

  // Habit name pill
  if (habitName) {
    const pillText = `"${sanitizeText(habitName)}"`;
    const textWidth = measureText(ctx, pillText, `36px ${FONT_FAMILY}`);
    const pillW = textWidth + 80;
    const pillH = 64;
    const pillX = W / 2 - pillW / 2;
    const pillY = 660;
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 50, 'rgba(255,255,255,0.2)');
    drawText(ctx, pillText, W / 2, pillY + pillH / 2, {
      font: `36px ${FONT_FAMILY}`,
      color: 'white',
      align: 'center',
      baseline: 'middle',
    });
  }

  // Footer
  const footerY = W - 60;
  if (username) {
    drawText(ctx, `@${sanitizeText(username)} • ZenFlow`, centerX, footerY, {
      font: `600 28px ${FONT_FAMILY}`,
      color: 'white',
      align,
      baseline: 'middle',
      opacity: 0.9,
      direction: dir,
    });
  } else {
    drawText(ctx, tr.trackHabits, centerX, footerY, {
      font: `600 28px ${FONT_FAMILY}`,
      color: 'white',
      align,
      baseline: 'middle',
      opacity: 0.9,
      direction: dir,
    });
  }
}

function drawGenericCard(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  lang: string = 'en'
): void {
  const W = CARD_SIZE;
  const gradient = CARD_GRADIENTS[data.type];
  const rarity = data.rarity || 'common';
  const rarityStyle = RARITY_COLORS[rarity];

  // Background
  fillGradientRect(ctx, 0, 0, W, W, 135, gradient);
  drawBackgroundPattern(ctx, W, W);

  const centerX = getTextX(lang, W);
  const align = getTextAlign(lang);
  const dir = getDirection(lang);
  let y = 260;

  // Icon (emoji)
  if (data.icon) {
    drawText(ctx, data.icon, W / 2, y, {
      font: `140px ${FONT_FAMILY}`,
      color: 'white',
      align: 'center',
      baseline: 'middle',
      shadow: { color: rarityStyle.glow, blur: 30 },
    });
    y += 120;
  }

  // Title
  drawText(ctx, sanitizeText(data.title), centerX, y, {
    font: `800 72px ${FONT_FAMILY}`,
    color: 'white',
    align,
    baseline: 'middle',
    maxWidth: 900,
    shadow: { color: 'rgba(0,0,0,0.3)', blur: 20, offsetY: 4 },
    direction: dir,
  });
  y += 80;

  // Subtitle or value
  if (data.subtitle || data.value) {
    drawText(ctx, sanitizeText(data.subtitle || String(data.value)), centerX, y, {
      font: `600 48px ${FONT_FAMILY}`,
      color: 'white',
      align,
      baseline: 'middle',
      opacity: 0.95,
      shadow: { color: 'rgba(0,0,0,0.2)', blur: 10, offsetY: 2 },
      direction: dir,
    });
    y += 70;
  }

  // Stats row
  if (data.stats && data.stats.length > 0) {
    y += 20;
    const statW = 180;
    const statH = 100;
    const gap = 30;
    const totalW = data.stats.length * statW + (data.stats.length - 1) * gap;
    let sx = W / 2 - totalW / 2;

    for (const stat of data.stats) {
      drawRoundedRect(ctx, sx, y, statW, statH, 20, 'rgba(255,255,255,0.15)');
      drawText(ctx, String(stat.value), sx + statW / 2, y + 38, {
        font: `700 48px ${FONT_FAMILY}`,
        color: 'white',
        align: 'center',
        baseline: 'middle',
      });
      drawText(ctx, stat.label, sx + statW / 2, y + 76, {
        font: `24px ${FONT_FAMILY}`,
        color: 'white',
        align: 'center',
        baseline: 'middle',
        opacity: 0.9,
      });
      sx += statW + gap;
    }
    y += statH + 30;
  }

  // Rarity badge
  if (data.type === 'achievement' && data.rarity && data.rarity !== 'common') {
    const badgeText = data.rarity.toUpperCase();
    const badgeW = measureText(ctx, badgeText, `600 28px ${FONT_FAMILY}`) + 64;
    const badgeH = 52;
    const bx = W / 2 - badgeW / 2;
    drawRoundedRect(ctx, bx, y, badgeW, badgeH, 50, 'rgba(255,255,255,0.2)', rarityStyle.border, 3);
    drawText(ctx, badgeText, W / 2, y + badgeH / 2, {
      font: `600 28px ${FONT_FAMILY}`,
      color: 'white',
      align: 'center',
      baseline: 'middle',
    });
  }

  // Footer
  drawFooter(ctx, W, W, data.username, data.date, lang);
}

function drawWeeklyCard(
  ctx: CanvasRenderingContext2D,
  data: WeeklyProgressData,
  tr: ShareCardTranslations,
  palette: ThemePalette,
  username?: string,
  lang: string = 'en'
): void {
  const W = CARD_SIZE;
  const H = WEEKLY_HEIGHT;
  const dir = getDirection(lang);

  // Background
  fillGradientRect(ctx, 0, 0, W, H, 180, palette.cardBg);

  // Header
  drawText(ctx, tr.weeklyReview, W / 2, 100, {
    font: `28px ${FONT_FAMILY}`,
    color: palette.textSecondary,
    align: 'center',
    baseline: 'middle',
    direction: dir,
  });
  drawText(ctx, sanitizeText(data.weekRange), W / 2, 150, {
    font: `700 48px ${FONT_FAMILY}`,
    color: palette.textColor,
    align: 'center',
    baseline: 'middle',
    direction: dir,
  });

  // Stats grid (2x2)
  const statItems = [
    { icon: '😊', label: tr.mood, value: getMoodText(data.moodAverage, tr), color: '#10B981' },
    { icon: '✅', label: tr.habits, value: `${data.habitsCompleted}/${data.habitsTotal}`, color: '#3B82F6' },
    { icon: '⏱️', label: tr.focus, value: formatMinutes(data.focusMinutes), color: '#8B5CF6' },
    { icon: '🔥', label: tr.streak, value: `${data.streak} ${tr.days}`, color: '#F59E0B' },
  ];

  const gridX = PADDING;
  const gridY = 220;
  const cellW = (W - PADDING * 2 - 24) / 2;
  const cellH = 180;
  const gap = 24;

  statItems.forEach((stat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = gridX + col * (cellW + gap);
    const cy = gridY + row * (cellH + gap);

    drawRoundedRect(ctx, cx, cy, cellW, cellH, 24, palette.glassBg, palette.glassBorder, 1);

    // Icon
    drawText(ctx, stat.icon, cx + 32, cy + 48, {
      font: `48px ${FONT_FAMILY}`,
      baseline: 'middle',
    });

    // Value
    drawText(ctx, sanitizeText(stat.value), cx + 32, cy + 110, {
      font: `700 36px ${FONT_FAMILY}`,
      color: stat.color,
      baseline: 'middle',
      direction: dir,
    });

    // Label
    drawText(ctx, stat.label, cx + 32, cy + 152, {
      font: `24px ${FONT_FAMILY}`,
      color: palette.textSecondary,
      baseline: 'middle',
      direction: dir,
    });
  });

  let nextY = gridY + 2 * (cellH + gap) + 20;

  // New badges
  if (data.newBadges.length > 0) {
    drawText(ctx, tr.newAchievements, W / 2, nextY, {
      font: `28px ${FONT_FAMILY}`,
      color: palette.textSecondary,
      align: 'center',
      baseline: 'middle',
      direction: dir,
    });
    nextY += 40;

    const badgeSize = 120;
    const badgeGap = 24;
    const badges = data.newBadges.slice(0, 4);
    const totalBadgeW = badges.length * badgeSize + (badges.length - 1) * badgeGap;
    let bx = W / 2 - totalBadgeW / 2;

    for (const badge of badges) {
      drawRoundedRect(ctx, bx, nextY, badgeSize, badgeSize + 30, 16, palette.glassBg);
      // Badge icon
      drawText(ctx, badge.icon, bx + badgeSize / 2, nextY + 50, {
        font: `48px ${FONT_FAMILY}`,
        align: 'center',
        baseline: 'middle',
      });
      // Badge title
      const badgeTitle = badge.title[lang] || badge.title['en'];
      drawText(ctx, sanitizeText(badgeTitle), bx + badgeSize / 2, nextY + badgeSize + 10, {
        font: `18px ${FONT_FAMILY}`,
        color: palette.textSecondary,
        align: 'center',
        baseline: 'middle',
        maxWidth: badgeSize - 8,
        direction: dir,
      });
      bx += badgeSize + badgeGap;
    }
    nextY += badgeSize + 60;
  }

  // Footer
  const footerY = H - 80;
  // Divider line
  ctx.beginPath();
  ctx.moveTo(PADDING, footerY - 30);
  ctx.lineTo(W - PADDING, footerY - 30);
  ctx.strokeStyle = palette.footerBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  drawText(ctx, 'ZenFlow', W / 2, footerY, {
    font: `600 32px ${FONT_FAMILY}`,
    color: palette.textColor,
    align: 'center',
    baseline: 'middle',
    direction: dir,
  });

  const footerInfo = username ? `@${sanitizeText(username)} • zenflow.app` : 'zenflow.app';
  drawText(ctx, footerInfo, W / 2, footerY + 36, {
    font: `20px ${FONT_FAMILY}`,
    color: palette.textSecondary,
    align: 'center',
    baseline: 'middle',
    direction: dir,
  });
}

function drawTrophyCard(
  ctx: CanvasRenderingContext2D,
  data: TrophyShareData,
  tr: ShareCardTranslations,
  theme: 'light' | 'dark',
  lang: string = 'en'
): void {
  const W = CARD_SIZE;
  const dir = getDirection(lang);
  const palette = getPalette(theme);

  // Background
  fillGradientRect(ctx, 0, 0, W, W, 135, [
    [0, theme === 'dark' ? '#1a1a2e' : '#FFFBEB'],
    [0.5, theme === 'dark' ? '#16213e' : '#FEF3C7'],
    [1, theme === 'dark' ? '#0f3460' : '#FDE68A'],
  ]);

  // Trophy icon
  drawText(ctx, '🏆', W / 2, 200, {
    font: `120px ${FONT_FAMILY}`,
    align: 'center',
    baseline: 'middle',
    shadow: { color: 'rgba(245,158,11,0.5)', blur: 30 },
  });

  // Title
  drawText(ctx, 'ZenFlow', W / 2, 320, {
    font: `800 64px ${FONT_FAMILY}`,
    color: palette.textColor,
    align: 'center',
    baseline: 'middle',
    direction: dir,
  });

  // Stats
  const stats = [
    { icon: '🔥', label: tr.streak, value: `${data.streak}`, color: '#F59E0B' },
    { icon: '⏱️', label: tr.focus, value: formatMinutes(data.focusMinutes), color: '#8B5CF6' },
    { icon: '✅', label: tr.habits, value: `${data.habitsCompleted}`, color: '#10B981' },
  ];

  const statW = 260;
  const statH = 140;
  const gap = 30;
  const totalW = stats.length * statW + (stats.length - 1) * gap;
  let sx = W / 2 - totalW / 2;
  const statY = 420;

  for (const stat of stats) {
    drawRoundedRect(ctx, sx, statY, statW, statH, 24, palette.glassBg, palette.glassBorder, 1);
    drawText(ctx, stat.icon, sx + statW / 2, statY + 40, {
      font: `40px ${FONT_FAMILY}`,
      align: 'center',
      baseline: 'middle',
    });
    drawText(ctx, stat.value, sx + statW / 2, statY + 85, {
      font: `700 40px ${FONT_FAMILY}`,
      color: stat.color,
      align: 'center',
      baseline: 'middle',
    });
    drawText(ctx, stat.label, sx + statW / 2, statY + 120, {
      font: `22px ${FONT_FAMILY}`,
      color: palette.textSecondary,
      align: 'center',
      baseline: 'middle',
      direction: dir,
    });
    sx += statW + gap;
  }

  // Footer
  drawText(ctx, tr.trackHabits, W / 2, W - 80, {
    font: `600 28px ${FONT_FAMILY}`,
    color: palette.textSecondary,
    align: 'center',
    baseline: 'middle',
    opacity: 0.8,
    direction: dir,
  });
}

// ============================================
// PUBLIC API
// ============================================

export async function generateShareCard(data: ShareCardData, lang: string = 'en'): Promise<Blob> {
  await ensureSanitizer();
  const [canvas, ctx] = createCanvas(CARD_SIZE, CARD_SIZE);
  drawGenericCard(ctx, data, lang);
  return canvasToBlob(canvas);
}

export async function generateStreakCard(
  streak: number,
  tr: ShareCardTranslations = DEFAULT_CARD_TRANSLATIONS,
  habitName?: string,
  username?: string,
  lang: string = 'en'
): Promise<Blob> {
  await ensureSanitizer();
  const [canvas, ctx] = createCanvas(CARD_SIZE, CARD_SIZE);
  drawStreakCard(ctx, streak, tr, habitName, username, lang);
  return canvasToBlob(canvas);
}

export async function generateWeeklyCard(
  data: WeeklyProgressData,
  tr: ShareCardTranslations = DEFAULT_CARD_TRANSLATIONS,
  theme: 'light' | 'dark' = 'dark',
  username?: string,
  lang: string = 'en'
): Promise<Blob> {
  await ensureSanitizer();
  const palette = getPalette(theme);
  const [canvas, ctx] = createCanvas(CARD_SIZE, WEEKLY_HEIGHT);
  drawWeeklyCard(ctx, data, tr, palette, username, lang);
  return canvasToBlob(canvas);
}

export async function generateAchievementCard(
  badge: Badge,
  lang: string = 'en',
  username?: string
): Promise<Blob> {
  return generateShareCard({
    type: 'achievement',
    icon: badge.icon,
    title: badge.title[lang] || badge.title['en'],
    subtitle: badge.description[lang] || badge.description['en'],
    rarity: badge.rarity,
    username,
    date: badge.unlockedDate
      ? new Date(badge.unlockedDate).toLocaleDateString()
      : new Date().toLocaleDateString(),
  }, lang);
}

export async function generateTrophyCard(
  data: TrophyShareData,
  tr: ShareCardTranslations = DEFAULT_CARD_TRANSLATIONS,
  theme: 'light' | 'dark' = 'dark',
  lang: string = 'en'
): Promise<Blob> {
  await ensureSanitizer();
  const [canvas, ctx] = createCanvas(CARD_SIZE, CARD_SIZE);
  drawTrophyCard(ctx, data, tr, theme, lang);
  return canvasToBlob(canvas);
}

// Legacy re-exports for backwards compatibility during migration
export { downloadImage, shareImage, copyImageToClipboard } from '@/lib/shareActions';

// Suppress unused import warning
void logger;
