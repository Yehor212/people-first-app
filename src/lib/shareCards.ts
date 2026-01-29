/**
 * Share Cards - Generate beautiful share images for social media
 * Part of v1.4.0 Social & Sharing
 *
 * Uses html2canvas to convert styled DOM elements to images
 */

import DOMPurify from 'dompurify';

// Lazy load html2canvas (~480KB) only when needed
let html2canvasModule: typeof import('html2canvas').default | null = null;

async function getHtml2Canvas() {
  if (!html2canvasModule) {
    const module = await import('html2canvas');
    html2canvasModule = module.default;
  }
  return html2canvasModule;
}

/**
 * Preload html2canvas module in the background to avoid delay when sharing
 * Call this during app initialization
 */
export function preloadShareCardAssets(): void {
  // Start loading html2canvas in the background (don't await)
  getHtml2Canvas().catch(() => {
    // Silently fail - will retry when actually needed
  });
}
import { Badge } from '@/types';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { logger } from '@/lib/logger';

// ============================================
// SECURITY HELPERS
// ============================================

/**
 * Sanitize user input to prevent XSS attacks
 */
function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }); // Strip all HTML
}

/**
 * Create a styled span element with safe text content
 */
function createStyledSpan(text: string, style?: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.textContent = sanitizeText(text);
  if (style) span.style.cssText = style;
  return span;
}

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

// ============================================
// CARD TEMPLATES - Gradient backgrounds per type
// ============================================

const CARD_GRADIENTS: Record<ShareCardType, string> = {
  achievement: 'linear-gradient(135deg, #10B981 0%, #059669 50%, #047857 100%)',
  streak: 'linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #B45309 100%)',
  progress: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
  weekly: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 50%, #1D4ED8 100%)',
};

const RARITY_COLORS: Record<string, { border: string; glow: string }> = {
  common: { border: '#9CA3AF', glow: 'rgba(156, 163, 175, 0.3)' },
  rare: { border: '#3B82F6', glow: 'rgba(59, 130, 246, 0.4)' },
  epic: { border: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.4)' },
  legendary: { border: '#F59E0B', glow: 'rgba(245, 158, 11, 0.5)' },
};

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Creates a DOM element with the share card design
 */
function createCardElement(data: ShareCardData): HTMLDivElement {
  const card = document.createElement('div');
  const gradient = CARD_GRADIENTS[data.type];
  const rarity = data.rarity || 'common';
  const rarityStyle = RARITY_COLORS[rarity];

  card.style.cssText = `
    width: 1080px;
    height: 1080px;
    background: ${gradient};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: white;
    position: relative;
    overflow: hidden;
  `;

  // Background pattern
  const pattern = document.createElement('div');
  pattern.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%),
                      radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 40%);
    pointer-events: none;
  `;
  card.appendChild(pattern);

  // Content container
  const content = document.createElement('div');
  content.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1;
    text-align: center;
    gap: 40px;
  `;

  // Icon with glow effect
  if (data.icon) {
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
      font-size: 140px;
      line-height: 1;
      filter: drop-shadow(0 0 30px ${rarityStyle.glow});
    `;
    iconContainer.textContent = data.icon;
    content.appendChild(iconContainer);
  }

  // Title
  const title = document.createElement('div');
  title.style.cssText = `
    font-size: 72px;
    font-weight: 800;
    letter-spacing: -1px;
    text-shadow: 0 4px 20px rgba(0,0,0,0.3);
    max-width: 900px;
  `;
  title.textContent = data.title;
  content.appendChild(title);

  // Subtitle or value
  if (data.subtitle || data.value) {
    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
      font-size: 48px;
      font-weight: 600;
      opacity: 0.95;
      text-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    subtitle.textContent = data.subtitle || String(data.value);
    content.appendChild(subtitle);
  }

  // Stats row
  if (data.stats && data.stats.length > 0) {
    const statsRow = document.createElement('div');
    statsRow.style.cssText = `
      display: flex;
      gap: 60px;
      margin-top: 20px;
    `;

    data.stats.forEach(stat => {
      const statBox = document.createElement('div');
      statBox.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 24px 40px;
        background: rgba(255,255,255,0.15);
        border-radius: 20px;
        backdrop-filter: blur(10px);
      `;

      const statValue = document.createElement('div');
      statValue.style.cssText = `font-size: 48px; font-weight: 700;`;
      statValue.textContent = String(stat.value);

      const statLabel = document.createElement('div');
      statLabel.style.cssText = `font-size: 24px; opacity: 0.9; margin-top: 8px;`;
      statLabel.textContent = stat.label;

      statBox.appendChild(statValue);
      statBox.appendChild(statLabel);
      statsRow.appendChild(statBox);
    });

    content.appendChild(statsRow);
  }

  // Rarity badge for achievements
  if (data.type === 'achievement' && data.rarity && data.rarity !== 'common') {
    const rarityBadge = document.createElement('div');
    rarityBadge.style.cssText = `
      padding: 12px 32px;
      background: rgba(255,255,255,0.2);
      border: 3px solid ${rarityStyle.border};
      border-radius: 50px;
      font-size: 28px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 2px;
      box-shadow: 0 0 20px ${rarityStyle.glow};
    `;
    rarityBadge.textContent = data.rarity;
    content.appendChild(rarityBadge);
  }

  card.appendChild(content);

  // Footer with branding
  const footer = document.createElement('div');
  footer.style.cssText = `
    position: absolute;
    bottom: 60px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    font-size: 28px;
    opacity: 0.8;
  `;

  if (data.username) {
    footer.appendChild(createStyledSpan(`@${data.username}`));
    footer.appendChild(createStyledSpan('•', 'opacity: 0.5'));
  }

  footer.appendChild(createStyledSpan('ZenFlow', 'font-weight: 600;'));

  if (data.date) {
    footer.appendChild(createStyledSpan(data.date, 'opacity: 0.5; margin-left: 8px;'));
  }

  card.appendChild(footer);

  return card;
}

/**
 * Creates a streak-specific share card
 */
function createStreakCard(streak: number, habitName?: string, username?: string): HTMLDivElement {
  const card = document.createElement('div');

  card.style.cssText = `
    width: 1080px;
    height: 1080px;
    background: linear-gradient(135deg, #FF6B35 0%, #F7931E 50%, #FFB347 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: white;
    position: relative;
    overflow: hidden;
  `;

  // Fire emoji pattern
  const fireRow = document.createElement('div');
  fireRow.style.cssText = `
    font-size: 60px;
    margin-bottom: 40px;
    filter: drop-shadow(0 0 20px rgba(255,107,53,0.5));
  `;

  const fireCount = Math.min(streak, 10);
  fireRow.textContent = '🔥'.repeat(fireCount);
  card.appendChild(fireRow);

  // Streak number
  const streakNum = document.createElement('div');
  streakNum.style.cssText = `
    font-size: 200px;
    font-weight: 900;
    line-height: 1;
    text-shadow: 0 8px 40px rgba(0,0,0,0.3);
  `;
  streakNum.textContent = String(streak);
  card.appendChild(streakNum);

  // "DAY STREAK" label
  const label = document.createElement('div');
  label.style.cssText = `
    font-size: 56px;
    font-weight: 700;
    letter-spacing: 8px;
    text-transform: uppercase;
    margin-top: 20px;
  `;
  label.textContent = 'DAY STREAK';
  card.appendChild(label);

  // Habit name if provided
  if (habitName) {
    const habit = document.createElement('div');
    habit.style.cssText = `
      font-size: 36px;
      margin-top: 40px;
      padding: 16px 40px;
      background: rgba(255,255,255,0.2);
      border-radius: 50px;
    `;
    habit.textContent = `"${habitName}"`;
    card.appendChild(habit);
  }

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    position: absolute;
    bottom: 60px;
    font-size: 28px;
    opacity: 0.9;
    display: flex;
    align-items: center;
    gap: 16px;
  `;
  if (username) {
    footer.appendChild(createStyledSpan(`@${username}`));
    footer.appendChild(createStyledSpan('•', 'opacity: 0.5'));
    footer.appendChild(createStyledSpan('ZenFlow', 'font-weight: 600;'));
  } else {
    footer.appendChild(createStyledSpan('Track your habits with ZenFlow', 'font-weight: 600;'));
  }
  card.appendChild(footer);

  return card;
}

/**
 * Creates a weekly progress share card
 */
function createWeeklyCard(data: WeeklyProgressData, username?: string, lang: string = 'en'): HTMLDivElement {
  const card = document.createElement('div');

  card.style.cssText = `
    width: 1080px;
    height: 1350px;
    background: linear-gradient(180deg, #1E293B 0%, #0F172A 100%);
    display: flex;
    flex-direction: column;
    padding: 80px;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: white;
    position: relative;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `margin-bottom: 60px; text-align: center;`;

  const headerLabel = document.createElement('div');
  headerLabel.style.cssText = 'font-size: 28px; opacity: 0.7; margin-bottom: 12px;';
  headerLabel.textContent = 'WEEKLY REVIEW';
  header.appendChild(headerLabel);

  const headerWeek = document.createElement('div');
  headerWeek.style.cssText = 'font-size: 48px; font-weight: 700;';
  headerWeek.textContent = sanitizeText(data.weekRange);
  header.appendChild(headerWeek);

  card.appendChild(header);

  // Stats grid
  const statsGrid = document.createElement('div');
  statsGrid.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 60px;
  `;

  const statItems = [
    { icon: '😊', label: 'Mood', value: getMoodEmoji(data.moodAverage), color: '#10B981' },
    { icon: '✅', label: 'Habits', value: `${data.habitsCompleted}/${data.habitsTotal}`, color: '#3B82F6' },
    { icon: '⏱️', label: 'Focus', value: formatMinutes(data.focusMinutes), color: '#8B5CF6' },
    { icon: '🔥', label: 'Streak', value: `${data.streak} days`, color: '#F59E0B' },
  ];

  statItems.forEach(stat => {
    const box = document.createElement('div');
    box.style.cssText = `
      background: rgba(255,255,255,0.05);
      border-radius: 24px;
      padding: 32px;
      border: 1px solid rgba(255,255,255,0.1);
    `;

    const iconDiv = document.createElement('div');
    iconDiv.style.cssText = 'font-size: 48px; margin-bottom: 16px;';
    iconDiv.textContent = stat.icon;
    box.appendChild(iconDiv);

    const valueDiv = document.createElement('div');
    valueDiv.style.cssText = `font-size: 36px; font-weight: 700; color: ${stat.color};`;
    valueDiv.textContent = sanitizeText(stat.value);
    box.appendChild(valueDiv);

    const labelDiv = document.createElement('div');
    labelDiv.style.cssText = 'font-size: 24px; opacity: 0.7; margin-top: 8px;';
    labelDiv.textContent = stat.label;
    box.appendChild(labelDiv);

    statsGrid.appendChild(box);
  });

  card.appendChild(statsGrid);

  // New badges section
  if (data.newBadges.length > 0) {
    const badgesSection = document.createElement('div');
    badgesSection.style.cssText = `margin-bottom: 60px;`;

    const badgesTitle = document.createElement('div');
    badgesTitle.style.cssText = 'font-size: 28px; opacity: 0.7; margin-bottom: 24px; text-align: center;';
    badgesTitle.textContent = 'NEW ACHIEVEMENTS';
    badgesSection.appendChild(badgesTitle);

    const badgesRow = document.createElement('div');
    badgesRow.style.cssText = `display: flex; justify-content: center; gap: 24px; flex-wrap: wrap;`;

    data.newBadges.slice(0, 4).forEach(badge => {
      const badgeEl = document.createElement('div');
      badgeEl.style.cssText = `
        background: rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 24px;
        text-align: center;
        min-width: 140px;
      `;

      const badgeIcon = document.createElement('div');
      badgeIcon.style.cssText = 'font-size: 48px;';
      badgeIcon.textContent = badge.icon;
      badgeEl.appendChild(badgeIcon);

      const badgeTitle = document.createElement('div');
      badgeTitle.style.cssText = 'font-size: 18px; margin-top: 12px; opacity: 0.9;';
      badgeTitle.textContent = sanitizeText(badge.title[lang] || badge.title['en']);
      badgeEl.appendChild(badgeTitle);

      badgesRow.appendChild(badgeEl);
    });

    badgesSection.appendChild(badgesRow);
    card.appendChild(badgesSection);
  }

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    margin-top: auto;
    text-align: center;
    padding-top: 40px;
    border-top: 1px solid rgba(255,255,255,0.1);
  `;
  const footerBrand = document.createElement('div');
  footerBrand.style.cssText = 'font-size: 32px; font-weight: 600; margin-bottom: 8px;';
  footerBrand.textContent = 'ZenFlow';
  footer.appendChild(footerBrand);

  const footerInfo = document.createElement('div');
  footerInfo.style.cssText = 'font-size: 20px; opacity: 0.6;';
  footerInfo.textContent = username ? `@${sanitizeText(username)} • zenflow.app` : 'zenflow.app';
  footer.appendChild(footerInfo);

  card.appendChild(footer);

  return card;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getMoodEmoji(average: number): string {
  if (average >= 4.5) return '😄 Great';
  if (average >= 3.5) return '🙂 Good';
  if (average >= 2.5) return '😐 Okay';
  if (average >= 1.5) return '😔 Low';
  return '😢 Tough';
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Generate a share card image as a Blob
 */
export async function generateShareCard(data: ShareCardData): Promise<Blob> {
  const cardElement = createCardElement(data);

  // Temporarily add to DOM (required for html2canvas)
  cardElement.style.position = 'fixed';
  cardElement.style.left = '-9999px';
  cardElement.style.top = '0';
  document.body.appendChild(cardElement);

  try {
    const html2canvas = await getHtml2Canvas();
    const canvas = await html2canvas(cardElement, {
      width: 1080,
      height: 1080,
      scale: 2,
      backgroundColor: null,
      logging: false,
    });

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to generate image'));
        },
        'image/png',
        1.0
      );
    });
  } finally {
    document.body.removeChild(cardElement);
  }
}

/**
 * Generate a streak share card
 */
export async function generateStreakCard(
  streak: number,
  habitName?: string,
  username?: string
): Promise<Blob> {
  const cardElement = createStreakCard(streak, habitName, username);

  cardElement.style.position = 'fixed';
  cardElement.style.left = '-9999px';
  cardElement.style.top = '0';
  document.body.appendChild(cardElement);

  try {
    const html2canvas = await getHtml2Canvas();
    const canvas = await html2canvas(cardElement, {
      width: 1080,
      height: 1080,
      scale: 2,
      backgroundColor: null,
      logging: false,
    });

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to generate image'));
        },
        'image/png',
        1.0
      );
    });
  } finally {
    document.body.removeChild(cardElement);
  }
}

/**
 * Generate a weekly progress share card
 */
export async function generateWeeklyCard(
  data: WeeklyProgressData,
  username?: string,
  lang: string = 'en'
): Promise<Blob> {
  const cardElement = createWeeklyCard(data, username, lang);

  cardElement.style.position = 'fixed';
  cardElement.style.left = '-9999px';
  cardElement.style.top = '0';
  document.body.appendChild(cardElement);

  try {
    const html2canvas = await getHtml2Canvas();
    const canvas = await html2canvas(cardElement, {
      width: 1080,
      height: 1350,
      scale: 2,
      backgroundColor: null,
      logging: false,
    });

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to generate image'));
        },
        'image/png',
        1.0
      );
    });
  } finally {
    document.body.removeChild(cardElement);
  }
}

/**
 * Generate an achievement badge share card
 */
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
  });
}

/**
 * Download the generated image
 */
export function downloadImage(blob: Blob, filename: string = 'zenflow-share.png'): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Share image using Capacitor Share (native) or Web Share API (web)
 */
export async function shareImage(
  blob: Blob,
  title: string,
  text?: string
): Promise<boolean> {
  // Use Capacitor Share on native platforms
  if (Capacitor.isNativePlatform()) {
    try {
      // Convert blob to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove data:image/png;base64, prefix
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });

      // Save to cache directory
      const fileName = `zenflow-share-${Date.now()}.png`;
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      logger.log('[ShareCards] File saved to:', savedFile.uri);

      // Share using file URI
      await Share.share({
        title,
        text: text || title,
        files: [savedFile.uri],
        dialogTitle: title,
      });

      // Clean up cached file after sharing
      try {
        await Filesystem.deleteFile({
          path: fileName,
          directory: Directory.Cache,
        });
      } catch (cleanupError) {
        logger.warn('[ShareCards] Failed to cleanup cached file:', cleanupError);
      }

      return true;
    } catch (err) {
      logger.error('[ShareCards] Native share failed:', err);
      // Don't fallback to download on native - just return false
      return false;
    }
  }

  // Web: Check if Web Share API is available with files support
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], 'zenflow-share.png', { type: 'image/png' });
    const shareData = { files: [file], title, text };

    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return true;
      } catch (err) {
        // User cancelled or error
        if ((err as Error).name !== 'AbortError') {
          logger.error('[ShareCards] Web share failed:', err);
        }
        return false;
      }
    }
  }

  // Fallback: download the image
  downloadImage(blob, 'zenflow-share.png');
  return false;
}

/**
 * Copy image to clipboard
 */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    return true;
  } catch (err) {
    console.error('Failed to copy image:', err);
    return false;
  }
}
