/**
 * ADHD Engagement Hooks System
 * Dopamine-triggering mechanics to keep users engaged
 */

// ============================================
// TYPES
// ============================================

export interface DailyLoginReward {
  day: number;
  reward: {
    type: 'xp' | 'badge' | 'spin' | 'mystery_box';
    value: number;
    label: string;
    icon: string;
  };
  claimed: boolean;
}

export interface ComboState {
  count: number;
  multiplier: number;
  lastActionTime: number;
  expiresAt: number;
  bonusXp: number;
}

export interface SpinWheelPrize {
  id: string;
  label: string;
  icon: string;
  xp: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  probability: number;
}

export interface MysteryBox {
  id: string;
  type: 'bronze' | 'silver' | 'gold' | 'diamond';
  icon: string;
  rewards: MysteryBoxReward[];
  unlockedAt?: number;
  openedAt?: number;
}

export interface MysteryBoxReward {
  type: 'xp' | 'badge' | 'theme' | 'sound' | 'title';
  value: number | string;
  label: string;
  icon: string;
}

export interface TimeChallenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  progress: number;
  xpReward: number;
  startsAt: number;
  expiresAt: number;
  completed: boolean;
  type: 'hourly' | 'flash' | 'weekend';
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatar: string;
  xp: number;
  streak: number;
  isCurrentUser: boolean;
}

export interface PowerUp {
  id: string;
  name: string;
  icon: string;
  description: string;
  duration: number; // minutes
  effect: '2x_xp' | 'freeze_streak' | 'bonus_time' | 'auto_complete';
  activatedAt?: number;
  expiresAt?: number;
}

// ============================================
// DAILY LOGIN REWARDS (7-day cycle with escalating rewards)
// ============================================

const DAILY_REWARDS: DailyLoginReward['reward'][] = [
  { type: 'xp', value: 25, label: '25 XP', icon: '⚡' },
  { type: 'xp', value: 50, label: '50 XP', icon: '⚡' },
  { type: 'spin', value: 1, label: 'Spin Wheel', icon: '🎰' },
  { type: 'xp', value: 75, label: '75 XP', icon: '⚡' },
  { type: 'mystery_box', value: 1, label: 'Bronze Box', icon: '📦' },
  { type: 'xp', value: 100, label: '100 XP', icon: '⚡' },
  { type: 'mystery_box', value: 2, label: 'Silver Box', icon: '🎁' }, // Day 7 special
];

export function getDailyLoginRewards(): DailyLoginReward[] {
  return DAILY_REWARDS.map((reward, index) => ({
    day: index + 1,
    reward,
    claimed: false,
  }));
}

export function getLoginStreakBonus(consecutiveDays: number): number {
  // Escalating bonus for consecutive logins
  if (consecutiveDays >= 30) return 500;
  if (consecutiveDays >= 14) return 200;
  if (consecutiveDays >= 7) return 100;
  if (consecutiveDays >= 3) return 50;
  return 0;
}

// ============================================
// COMBO SYSTEM (actions within time window)
// ============================================

const COMBO_WINDOW = 5 * 60 * 1000; // 5 minutes between actions
const MAX_COMBO = 10;

export function initCombo(): ComboState {
  return {
    count: 0,
    multiplier: 1,
    lastActionTime: 0,
    expiresAt: 0,
    bonusXp: 0,
  };
}

export function updateCombo(current: ComboState): ComboState {
  const now = Date.now();

  // Check if combo expired
  if (current.expiresAt > 0 && now > current.expiresAt) {
    return {
      count: 1,
      multiplier: 1,
      lastActionTime: now,
      expiresAt: now + COMBO_WINDOW,
      bonusXp: 0,
    };
  }

  const newCount = Math.min(current.count + 1, MAX_COMBO);
  const newMultiplier = getComboMultiplier(newCount);

  return {
    count: newCount,
    multiplier: newMultiplier,
    lastActionTime: now,
    expiresAt: now + COMBO_WINDOW,
    bonusXp: getComboBonusXp(newCount),
  };
}

function getComboMultiplier(count: number): number {
  if (count >= 10) return 3.0;
  if (count >= 7) return 2.5;
  if (count >= 5) return 2.0;
  if (count >= 3) return 1.5;
  return 1.0;
}

function getComboBonusXp(count: number): number {
  if (count >= 10) return 100;
  if (count >= 7) return 50;
  if (count >= 5) return 25;
  if (count >= 3) return 10;
  return 0;
}

export function getComboMessage(count: number): { text: string; emoji: string } | null {
  const messages: Record<number, { text: string; emoji: string }> = {
    3: { text: 'COMBO x3!', emoji: '🔥' },
    5: { text: 'SUPER COMBO!', emoji: '💥' },
    7: { text: 'MEGA COMBO!', emoji: '⚡' },
    10: { text: 'UNSTOPPABLE!!!', emoji: '🌟' },
  };
  return messages[count] || null;
}

// ============================================
// SPIN WHEEL (luck-based rewards)
// ============================================

const SPIN_PRIZES: SpinWheelPrize[] = [
  { id: 'xp_10', label: '10 XP', icon: '⚡', xp: 10, rarity: 'common', probability: 0.25 },
  { id: 'xp_25', label: '25 XP', icon: '⚡', xp: 25, rarity: 'common', probability: 0.20 },
  { id: 'xp_50', label: '50 XP', icon: '💫', xp: 50, rarity: 'rare', probability: 0.15 },
  { id: 'xp_100', label: '100 XP', icon: '✨', xp: 100, rarity: 'rare', probability: 0.12 },
  { id: 'xp_200', label: '200 XP', icon: '🌟', xp: 200, rarity: 'epic', probability: 0.08 },
  { id: 'xp_500', label: '500 XP', icon: '👑', xp: 500, rarity: 'legendary', probability: 0.03 },
  { id: 'mystery', label: 'Mystery Box', icon: '🎁', xp: 0, rarity: 'epic', probability: 0.10 },
  { id: 'double', label: '2x Next Reward', icon: '🎰', xp: 0, rarity: 'rare', probability: 0.07 },
];

export function getSpinWheelPrizes(): SpinWheelPrize[] {
  return SPIN_PRIZES;
}

export function spinWheel(): SpinWheelPrize {
  const random = Math.random();
  let cumulative = 0;

  for (const prize of SPIN_PRIZES) {
    cumulative += prize.probability;
    if (random <= cumulative) {
      return prize;
    }
  }

  return SPIN_PRIZES[0]; // Fallback
}

// ============================================
// MYSTERY BOXES (random rewards)
// ============================================

const MYSTERY_BOX_REWARDS: Record<MysteryBox['type'], MysteryBoxReward[][]> = {
  bronze: [
    [{ type: 'xp', value: 15, label: '15 XP', icon: '⚡' }],
    [{ type: 'xp', value: 25, label: '25 XP', icon: '⚡' }],
    [{ type: 'xp', value: 30, label: '30 XP', icon: '💫' }],
  ],
  silver: [
    [{ type: 'xp', value: 50, label: '50 XP', icon: '💫' }],
    [{ type: 'xp', value: 75, label: '75 XP', icon: '✨' }],
    [{ type: 'xp', value: 100, label: '100 XP', icon: '🌟' }],
    [{ type: 'title', value: 'silver_champion', label: 'Silver Champion Title', icon: '🏅' }],
  ],
  gold: [
    [{ type: 'xp', value: 150, label: '150 XP', icon: '🌟' }],
    [{ type: 'xp', value: 200, label: '200 XP', icon: '👑' }],
    [
      { type: 'xp', value: 100, label: '100 XP', icon: '✨' },
      { type: 'title', value: 'gold_master', label: 'Gold Master Title', icon: '🥇' },
    ],
  ],
  diamond: [
    [{ type: 'xp', value: 500, label: '500 XP', icon: '💎' }],
    [
      { type: 'xp', value: 300, label: '300 XP', icon: '👑' },
      { type: 'badge', value: 'diamond_collector', label: 'Diamond Collector Badge', icon: '💎' },
    ],
    [
      { type: 'xp', value: 250, label: '250 XP', icon: '🌟' },
      { type: 'theme', value: 'diamond_theme', label: 'Diamond Theme', icon: '💠' },
    ],
  ],
};

export function openMysteryBox(type: MysteryBox['type']): MysteryBoxReward[] {
  const possibleRewards = MYSTERY_BOX_REWARDS[type];
  const randomIndex = Math.floor(Math.random() * possibleRewards.length);
  return possibleRewards[randomIndex];
}

export function getMysteryBoxInfo(type: MysteryBox['type']): { icon: string; label: string; color: string } {
  const info = {
    bronze: { icon: '📦', label: 'Bronze Box', color: 'bg-amber-700' },
    silver: { icon: '🎁', label: 'Silver Box', color: 'bg-gray-400' },
    gold: { icon: '🎁', label: 'Gold Box', color: 'bg-yellow-500' },
    diamond: { icon: '💎', label: 'Diamond Box', color: 'bg-cyan-400' },
  };
  return info[type];
}

// ============================================
// TIME-LIMITED CHALLENGES (urgency triggers)
// ============================================

export function generateFlashChallenge(): TimeChallenge {
  const challenges = [
    { title: '⚡ Flash Focus', description: 'Complete 1 focus session in 30 min', target: 1, xpReward: 50 },
    { title: '⚡ Quick Habits', description: 'Complete 3 habits in 1 hour', target: 3, xpReward: 40 },
    { title: '⚡ Mood Check', description: 'Log your mood NOW', target: 1, xpReward: 25 },
    { title: '⚡ Gratitude Rush', description: 'Write 2 gratitudes in 15 min', target: 2, xpReward: 35 },
  ];

  const challenge = challenges[Math.floor(Math.random() * challenges.length)];
  const now = Date.now();
  const duration = challenge.title.includes('30 min') ? 30 :
                   challenge.title.includes('15 min') ? 15 : 60;

  return {
    id: `flash_${now}`,
    ...challenge,
    icon: '⚡',
    progress: 0,
    startsAt: now,
    expiresAt: now + duration * 60 * 1000,
    completed: false,
    type: 'flash',
  };
}

export function generateHourlyChallenge(): TimeChallenge {
  const now = Date.now();
  const challenges = [
    { title: '🕐 Power Hour', description: 'Complete 5 actions this hour', target: 5, xpReward: 75 },
    { title: '🕐 Focus Marathon', description: '2 focus sessions in 1 hour', target: 2, xpReward: 60 },
    { title: '🕐 Habit Blitz', description: 'Complete 4 habits in 1 hour', target: 4, xpReward: 55 },
  ];

  const challenge = challenges[Math.floor(Math.random() * challenges.length)];

  return {
    id: `hourly_${now}`,
    ...challenge,
    icon: '🕐',
    progress: 0,
    startsAt: now,
    expiresAt: now + 60 * 60 * 1000, // 1 hour
    completed: false,
    type: 'hourly',
  };
}

export function generateWeekendChallenge(): TimeChallenge | null {
  const now = new Date();
  const day = now.getDay();

  // Only on weekends
  if (day !== 0 && day !== 6) return null;

  const challenges = [
    { title: '🎉 Weekend Warrior', description: 'Complete 10 habits this weekend', target: 10, xpReward: 200 },
    { title: '🎉 Chill Focus', description: '3 hours of focus sessions', target: 180, xpReward: 250 },
    { title: '🎉 Gratitude Weekend', description: 'Write 10 gratitudes', target: 10, xpReward: 150 },
  ];

  const challenge = challenges[Math.floor(Math.random() * challenges.length)];

  // Expires at end of Sunday
  const endOfWeekend = new Date(now);
  endOfWeekend.setDate(now.getDate() + (day === 6 ? 1 : 0));
  endOfWeekend.setHours(23, 59, 59, 999);

  return {
    id: `weekend_${now.getTime()}`,
    ...challenge,
    icon: '🎉',
    progress: 0,
    startsAt: now.getTime(),
    expiresAt: endOfWeekend.getTime(),
    completed: false,
    type: 'weekend',
  };
}

// ============================================
// POWER-UPS (temporary boosts)
// ============================================

const AVAILABLE_POWERUPS: Omit<PowerUp, 'activatedAt' | 'expiresAt'>[] = [
  { id: '2x_xp', name: 'Double XP', icon: '⚡', description: 'Earn 2x XP for 30 minutes', duration: 30, effect: '2x_xp' },
  { id: 'freeze', name: 'Streak Freeze', icon: '❄️', description: 'Protect your streak for 24h', duration: 1440, effect: 'freeze_streak' },
  { id: 'bonus', name: 'Bonus Time', icon: '⏰', description: '+5 min to all focus sessions', duration: 60, effect: 'bonus_time' },
];

export function getAvailablePowerUps(): typeof AVAILABLE_POWERUPS {
  return AVAILABLE_POWERUPS;
}

export function activatePowerUp(powerUpId: string): PowerUp | null {
  const powerUp = AVAILABLE_POWERUPS.find(p => p.id === powerUpId);
  if (!powerUp) return null;

  const now = Date.now();
  return {
    ...powerUp,
    activatedAt: now,
    expiresAt: now + powerUp.duration * 60 * 1000,
  };
}

// ============================================
// NOTIFICATIONS & HOOKS
// ============================================

export interface ADHDNotification {
  id: string;
  type: 'combo' | 'streak_risk' | 'challenge' | 'reward' | 'comeback' | 'milestone';
  title: string;
  message: string;
  icon: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  action?: { label: string; handler: string };
}

export function getStreakRiskNotification(currentStreak: number, hoursUntilMidnight: number): ADHDNotification | null {
  if (hoursUntilMidnight > 3) return null;

  return {
    id: `streak_risk_${Date.now()}`,
    type: 'streak_risk',
    title: '⚠️ Streak в опасности!',
    message: `Твой ${currentStreak}-дневный streak скоро сгорит! Осталось ${Math.floor(hoursUntilMidnight)} ч.`,
    icon: '🔥',
    urgency: hoursUntilMidnight < 1 ? 'critical' : 'high',
    action: { label: 'Сохранить streak!', handler: 'open_mood' },
  };
}

export function getComebackNotification(daysSinceLastLogin: number): ADHDNotification | null {
  if (daysSinceLastLogin < 1) return null;

  const messages = {
    1: { title: '👋 Привет! Мы скучали!', message: 'Вернись и продолжи свой путь!', icon: '👋' },
    3: { title: '😢 Нам тебя не хватает!', message: 'Получи бонус за возвращение!', icon: '🎁' },
    7: { title: '🎉 С возвращением!', message: 'Специальный подарок ждет тебя!', icon: '🎁' },
  };

  const key = daysSinceLastLogin >= 7 ? 7 : daysSinceLastLogin >= 3 ? 3 : 1;
  const msg = messages[key];

  return {
    id: `comeback_${Date.now()}`,
    type: 'comeback',
    ...msg,
    urgency: 'medium',
    action: { label: 'Забрать подарок!', handler: 'claim_comeback' },
  };
}

export function getMilestoneNotification(type: string, value: number): ADHDNotification | null {
  const milestones: Record<string, { threshold: number; title: string; message: string; icon: string }[]> = {
    habits: [
      { threshold: 10, title: '🎯 10 привычек!', message: 'Отличное начало!', icon: '🎯' },
      { threshold: 50, title: '🏆 50 привычек!', message: 'Ты на пути к мастерству!', icon: '🏆' },
      { threshold: 100, title: '👑 100 привычек!', message: 'Король привычек!', icon: '👑' },
    ],
    focus: [
      { threshold: 60, title: '⏱️ 1 час фокуса!', message: 'Продуктивный старт!', icon: '⏱️' },
      { threshold: 300, title: '🧠 5 часов фокуса!', message: 'Мозг работает на максимум!', icon: '🧠' },
      { threshold: 600, title: '🚀 10 часов фокуса!', message: 'Зверь продуктивности!', icon: '🚀' },
    ],
    xp: [
      { threshold: 100, title: '⚡ 100 XP!', message: 'Первая сотня!', icon: '⚡' },
      { threshold: 500, title: '💫 500 XP!', message: 'Звездный путь!', icon: '💫' },
      { threshold: 1000, title: '🌟 1000 XP!', message: 'Тысячник!', icon: '🌟' },
      { threshold: 5000, title: '👑 5000 XP!', message: 'Легенда!', icon: '👑' },
    ],
  };

  const typeMilestones = milestones[type];
  if (!typeMilestones) return null;

  const milestone = typeMilestones.find(m => m.threshold === value);
  if (!milestone) return null;

  return {
    id: `milestone_${type}_${value}`,
    type: 'milestone',
    title: milestone.title,
    message: milestone.message,
    icon: milestone.icon,
    urgency: 'medium',
  };
}

// ============================================
// STORAGE KEYS
// ============================================

export const ADHD_STORAGE_KEYS = {
  COMBO_STATE: 'zenflow_combo_state',
  DAILY_LOGIN: 'zenflow_daily_login',
  LOGIN_STREAK: 'zenflow_login_streak',
  LAST_LOGIN: 'zenflow_last_login',
  SPIN_TOKENS: 'zenflow_spin_tokens',
  MYSTERY_BOXES: 'zenflow_mystery_boxes',
  TIME_CHALLENGES: 'zenflow_time_challenges',
  ACTIVE_POWERUPS: 'zenflow_active_powerups',
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

export function formatTimeRemaining(expiresAt: number): string {
  const now = Date.now();
  const diff = expiresAt - now;

  if (diff <= 0) return 'Истекло';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) return `${hours}ч ${minutes}м`;
  if (minutes > 0) return `${minutes}м ${seconds}с`;
  return `${seconds}с`;
}

export function shouldShowUrgentPrompt(expiresAt: number): boolean {
  const diff = expiresAt - Date.now();
  return diff > 0 && diff < 5 * 60 * 1000; // Last 5 minutes
}
