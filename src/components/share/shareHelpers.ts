/**
 * Helper functions for UnifiedShareModal
 * Extracted from UnifiedShareModal.tsx for TD-20 decomposition
 */

import { interpolate } from '@/lib/utils';
import type { UnifiedShareModalProps } from './shareTypes';

// ============================================
// SHARE TITLE / TEXT / MODAL TITLE / SUCCESS
// ============================================

export function getShareTitle(
  props: UnifiedShareModalProps,
  t: Record<string, string>,
): string {
  switch (props.mode) {
    case 'achievement':
      return t.shareTitle || 'Achievement Unlocked!';
    case 'streak':
      return `${props.streak} ${t.shareStreak || 'Day Streak'}`;
    case 'weekly':
      return t.myProgress || 'My Weekly Progress';
    case 'progress':
      return t.myProgress || 'My Progress';
    case 'trophy':
      return t.shareAchievements || 'My ZenFlow Achievements';
  }
}

export function getShareText(
  props: UnifiedShareModalProps,
  t: Record<string, string>,
  language: string,
): string {
  switch (props.mode) {
    case 'achievement':
      return `${props.badge.title[language] || props.badge.title['en']} - ZenFlow`;
    case 'streak':
      return `${props.streak} ${t.shareStreak || 'day streak'}`;
    case 'weekly':
      return interpolate(t.shareText || '{streak} day streak! {habits} habits completed, {focus} minutes of focus.', {
        streak: props.data.streak,
        habits: props.data.habitsCompleted,
        focus: props.data.focusMinutes,
      });
    case 'progress':
      return interpolate(t.shareText || '{streak} day streak! {habits} habits completed, {focus} minutes of focus.', {
        streak: props.data.stats?.[0]?.value || 0,
        habits: props.data.stats?.[1]?.value || 0,
        focus: props.data.stats?.[2]?.value || 0,
      });
    case 'trophy':
      return interpolate(t.shareText || '{streak} day streak! {habits} habits completed, {focus} minutes of focus.', {
        streak: props.data.streak,
        habits: props.data.habitsCompleted,
        focus: props.data.focusMinutes,
      });
  }
}

export function getModalTitle(
  props: UnifiedShareModalProps,
  t: Record<string, string>,
): string {
  switch (props.mode) {
    case 'achievement':
      return t.shareAchievements || 'Share Achievement';
    case 'streak':
      return t.shareStreak || 'Share Streak';
    case 'weekly':
      return t.myProgress || 'Share Weekly Report';
    case 'progress':
      return t.shareAchievements || 'Share Progress';
    case 'trophy':
      return t.hallOfFame || 'Hall of Fame';
  }
}

export function getSuccessMessage(
  lastAction: string | null,
  t: Record<string, string>,
): string {
  switch (lastAction) {
    case 'download':
      return t.shareDownloadSuccess || t.imageSaved || 'Image saved!';
    case 'copy':
      return t.shareCopySuccess || t.shareCopied || 'Copied to clipboard!';
    case 'share':
      return t.shareSharedSuccess || 'Shared successfully!';
    default:
      return '';
  }
}
