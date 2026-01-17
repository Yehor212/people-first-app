/**
 * CompanionPanel - Interactive companion mascot panel
 * Allows users to interact with, rename, and customize their companion
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit3, Check, Heart, Star, MessageCircle, Hand, Cookie, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Companion, CompanionType } from '@/types';
import { COMPANION_EMOJIS } from '@/lib/innerWorldConstants';

interface CompanionPanelProps {
  companion: Companion;
  isOpen: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  onChangeType: (type: CompanionType) => void;
  onPet: () => { happinessGain: number; warmthGain: number; xpGain: number; canPetAgain: boolean };
  onFeed: () => { hungerReduction: number; energyGain: number; xpGain: number; canFeedAgain: boolean };
  onTalk: () => { wisdomGain: number; xpGain: number };
  streak: number;
  hasMoodToday: boolean;
  hasHabitsToday: boolean;
  hasFocusToday: boolean;
  hasGratitudeToday: boolean;
}

const COMPANION_TYPES: CompanionType[] = ['fox', 'cat', 'owl', 'rabbit', 'dragon'];

const COMPANION_NAMES: Record<CompanionType, { default: string; personality: string }> = {
  fox: { default: 'Луна', personality: 'Curious & Playful' },
  cat: { default: 'Мурка', personality: 'Calm & Wise' },
  owl: { default: 'Сова', personality: 'Thoughtful & Patient' },
  rabbit: { default: 'Зайка', personality: 'Energetic & Kind' },
  dragon: { default: 'Дракоша', personality: 'Brave & Loyal' },
};

// Context-aware messages based on companion state and user activity
function getContextualMessage(
  companion: Companion,
  hasMoodToday: boolean,
  hasHabitsToday: boolean,
  hasFocusToday: boolean,
  hasGratitudeToday: boolean,
  streak: number
): string {
  const hour = new Date().getHours();
  const happiness = companion.happiness || 50;
  const hunger = companion.hunger || 50;

  // Time-based greetings
  const timeGreetings = {
    morning: ['Доброе утро! ☀️', 'Новый день - новые возможности!', 'Проснулся? Я тоже! 🌅'],
    afternoon: ['Как проходит день? 🌤️', 'Уже обед, а ты молодец!', 'Продолжаем в том же духе! 💪'],
    evening: ['Вечер! Время отдыхать 🌙', 'Какой был день?', 'Скоро отдых! ✨'],
    night: ['Zzz... 💤', '*мирно спит*', 'Пора спать... 🌜'],
  };

  const getTimeOfDay = () => {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 23) return 'evening';
    return 'night';
  };

  // Priority-based messages

  // If hungry
  if (hunger >= 70) {
    return ['Я голодный... 🥺', 'Покорми меня? 🍪', '*урчит животик*'][Math.floor(Math.random() * 3)];
  }

  // Celebrating streak
  if (streak >= 7) {
    return ['🏆 ' + streak + ' дней подряд! Легенда!', 'Ты невероятен! ' + streak + ' дней! 🔥', 'Мы команда мечты! ' + streak + '! 🌟'][Math.floor(Math.random() * 3)];
  }

  if (streak >= 3) {
    return ['🔥 ' + streak + ' дня подряд!', 'Так держать! ' + streak + ' дней!', streak + ' дней! Горжусь тобой! ✨'][Math.floor(Math.random() * 3)];
  }

  // Activity reminders
  if (!hasMoodToday) {
    return ['Как ты сегодня? 💜', 'Расскажи о настроении!', 'Как настрой?'][Math.floor(Math.random() * 3)];
  }

  if (!hasHabitsToday) {
    return ['Привычки ждут! 🎯', 'Не забудь про привычки!', 'Время для привычек? 💪'][Math.floor(Math.random() * 3)];
  }

  if (!hasFocusToday) {
    return ['Может сфокусируемся? 🧠', 'Готов поработать?', 'Время фокуса! ⏱️'][Math.floor(Math.random() * 3)];
  }

  if (!hasGratitudeToday) {
    return ['За что благодарен? 💖', 'Напиши благодарность!', 'Что хорошего сегодня? ✨'][Math.floor(Math.random() * 3)];
  }

  // All done - celebration!
  if (hasMoodToday && hasHabitsToday && hasFocusToday && hasGratitudeToday) {
    return ['Всё сделано! Ты СУПЕР! 🏆', 'Идеальный день! 🌟', 'Легенда! 100%! 🎉'][Math.floor(Math.random() * 3)];
  }

  // Happy based
  if (happiness >= 80) {
    return ['Обожаю тебя! 💕', 'Лучший хозяин! ✨', 'Мы команда! 🎉'][Math.floor(Math.random() * 3)];
  }

  // Default time-based
  const timeOfDay = getTimeOfDay();
  const messages = timeGreetings[timeOfDay];
  return messages[Math.floor(Math.random() * messages.length)];
}

// Pet reaction messages
const PET_REACTIONS = [
  '💕 Мррр~',
  '✨ Приятно!',
  '😊 Спасибо!',
  '💖 Обожаю!',
  '🥰 Ещё!',
];

// Feed reaction messages
const FEED_REACTIONS = [
  '🍪 Вкусно!',
  '😋 Ням-ням!',
  '✨ Спасибо!',
  '💪 Энергия!',
  '🎉 Сытый!',
];

// Talk reaction messages
const TALK_REACTIONS = [
  '🧠 Интересно...',
  '💡 Понял!',
  '✨ Мудрость +1',
  '📚 Учусь!',
  '🌟 Спасибо!',
];

export function CompanionPanel({
  companion,
  isOpen,
  onClose,
  onRename,
  onChangeType,
  onPet,
  onFeed,
  onTalk,
  streak,
  hasMoodToday,
  hasHabitsToday,
  hasFocusToday,
  hasGratitudeToday,
}: CompanionPanelProps) {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(companion.name);
  const [message, setMessage] = useState('');
  const [showReaction, setShowReaction] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Update message on open
  useEffect(() => {
    if (isOpen) {
      setMessage(getContextualMessage(companion, hasMoodToday, hasHabitsToday, hasFocusToday, hasGratitudeToday, streak));
    }
  }, [isOpen, companion, hasMoodToday, hasHabitsToday, hasFocusToday, hasGratitudeToday, streak]);

  const handleSaveName = () => {
    if (editName.trim()) {
      onRename(editName.trim());
      setIsEditing(false);
    }
  };

  const handleTypeChange = (type: CompanionType) => {
    onChangeType(type);
    setMessage(getContextualMessage(companion, hasMoodToday, hasHabitsToday, hasFocusToday, hasGratitudeToday, streak));
  };

  const handlePet = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const result = onPet();
    const reaction = PET_REACTIONS[Math.floor(Math.random() * PET_REACTIONS.length)];
    setShowReaction(reaction + (result.canPetAgain ? ` +${result.xpGain} XP` : ''));
    setTimeout(() => {
      setShowReaction(null);
      setIsAnimating(false);
      setMessage(getContextualMessage(companion, hasMoodToday, hasHabitsToday, hasFocusToday, hasGratitudeToday, streak));
    }, 1500);
  };

  const handleFeed = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const result = onFeed();
    const reaction = FEED_REACTIONS[Math.floor(Math.random() * FEED_REACTIONS.length)];
    setShowReaction(reaction + (result.canFeedAgain ? ` +${result.xpGain} XP` : ''));
    setTimeout(() => {
      setShowReaction(null);
      setIsAnimating(false);
      setMessage(getContextualMessage(companion, hasMoodToday, hasHabitsToday, hasFocusToday, hasGratitudeToday, streak));
    }, 1500);
  };

  const handleTalk = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const result = onTalk();
    const reaction = TALK_REACTIONS[Math.floor(Math.random() * TALK_REACTIONS.length)];
    setShowReaction(reaction + ` +${result.xpGain} XP`);
    setTimeout(() => {
      setShowReaction(null);
      setIsAnimating(false);
      setMessage(getContextualMessage(companion, hasMoodToday, hasHabitsToday, hasFocusToday, hasGratitudeToday, streak));
    }, 1500);
  };

  // Calculate XP progress
  const xpForNextLevel = companion.level * 100;
  const xpProgress = (companion.experience / xpForNextLevel) * 100;

  // Calculate stats with fallbacks
  const happiness = companion.happiness ?? 50;
  const hunger = companion.hunger ?? 50;
  const warmth = companion.personality?.warmth ?? 70;
  const energy = companion.personality?.energy ?? 50;
  const wisdom = companion.personality?.wisdom ?? 50;

  // Hunger indicator (inverted - low hunger = good, high hunger = needs feeding)
  const satiety = 100 - hunger; // Convert hunger to satiety for display

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-lg bg-gradient-to-b from-primary/10 to-background rounded-t-3xl max-h-[85vh] overflow-hidden"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with close button */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h2 className="text-lg font-semibold">{t.myCompanion}</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(85vh-60px)]">
              {/* Companion display */}
              <div className="text-center mb-6">
                {/* Speech bubble */}
                <motion.div
                  className="inline-block relative mb-4"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: 'spring' }}
                  key={showReaction || message}
                >
                  <div className={cn(
                    "px-4 py-2 rounded-2xl relative",
                    showReaction ? "bg-primary/20 text-primary" : "bg-muted"
                  )}>
                    <p className="text-sm font-medium">{showReaction || message}</p>
                    <div className={cn(
                      "absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45",
                      showReaction ? "bg-primary/20" : "bg-muted"
                    )} />
                  </div>
                </motion.div>

                {/* Big companion emoji */}
                <motion.div
                  className="text-8xl mb-4"
                  animate={isAnimating ? {
                    scale: [1, 1.2, 1],
                    rotate: [-5, 5, -5, 0],
                  } : {
                    y: [0, -10, 0],
                    rotate: [-2, 2, -2],
                  }}
                  transition={{
                    duration: isAnimating ? 0.5 : 2,
                    repeat: isAnimating ? 0 : Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  {COMPANION_EMOJIS[companion.type]}
                </motion.div>

                {/* Name with edit */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="px-3 py-1 rounded-lg bg-muted border border-border text-center font-medium"
                        maxLength={20}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-2xl font-bold">{companion.name}</h3>
                      <button
                        onClick={() => {
                          setEditName(companion.name);
                          setIsEditing(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </>
                  )}
                </div>

                {/* Personality */}
                <p className="text-sm text-muted-foreground">
                  {COMPANION_NAMES[companion.type].personality}
                </p>
              </div>

              {/* Interactive buttons */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <button
                  onClick={handlePet}
                  disabled={isAnimating}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl transition-all",
                    "bg-gradient-to-br from-pink-500/20 to-red-500/20",
                    "hover:from-pink-500/30 hover:to-red-500/30 hover:scale-105",
                    "active:scale-95",
                    isAnimating && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Hand className="w-6 h-6 text-pink-500" />
                  <span className="text-xs font-medium">{t.pet}</span>
                </button>

                <button
                  onClick={handleFeed}
                  disabled={isAnimating}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl transition-all",
                    "bg-gradient-to-br from-orange-500/20 to-yellow-500/20",
                    "hover:from-orange-500/30 hover:to-yellow-500/30 hover:scale-105",
                    "active:scale-95",
                    hunger >= 70 && "ring-2 ring-orange-500 animate-pulse",
                    isAnimating && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Cookie className="w-6 h-6 text-orange-500" />
                  <span className="text-xs font-medium">{t.feed}</span>
                </button>

                <button
                  onClick={handleTalk}
                  disabled={isAnimating}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl transition-all",
                    "bg-gradient-to-br from-blue-500/20 to-purple-500/20",
                    "hover:from-blue-500/30 hover:to-purple-500/30 hover:scale-105",
                    "active:scale-95",
                    isAnimating && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <MessageCircle className="w-6 h-6 text-blue-500" />
                  <span className="text-xs font-medium">{t.talk}</span>
                </button>
              </div>

              {/* Level and XP */}
              <div className="bg-muted/50 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span className="font-semibold">Level {companion.level}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {companion.experience}/{xpForNextLevel} XP
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${xpProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Happiness and Hunger bars */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-muted/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">😊 {t.happiness}</span>
                    <span className="text-xs font-medium">{happiness}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all rounded-full",
                        happiness >= 70 ? "bg-green-500" : happiness >= 40 ? "bg-yellow-500" : "bg-red-500"
                      )}
                      style={{ width: `${happiness}%` }}
                    />
                  </div>
                </div>

                <div className="bg-muted/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">🍪 {t.satiety}</span>
                    <span className="text-xs font-medium">{satiety}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all rounded-full",
                        satiety >= 70 ? "bg-green-500" : satiety >= 40 ? "bg-yellow-500" : "bg-red-500"
                      )}
                      style={{ width: `${satiety}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <Heart className="w-5 h-5 mx-auto mb-1 text-red-400" />
                  <p className="text-lg font-bold">{warmth}%</p>
                  <p className="text-xs text-muted-foreground">{t.warmth}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <Zap className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
                  <p className="text-lg font-bold">{energy}%</p>
                  <p className="text-xs text-muted-foreground">{t.energy}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <MessageCircle className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                  <p className="text-lg font-bold">{wisdom}%</p>
                  <p className="text-xs text-muted-foreground">{t.wisdom}</p>
                </div>
              </div>

              {/* Streak display */}
              {streak > 0 && (
                <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-2xl p-4 mb-6 text-center">
                  <p className="text-3xl mb-1">🔥 {streak}</p>
                  <p className="text-sm font-medium">{t.companionStreak}</p>
                </div>
              )}

              {/* Companion selector */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  {t.chooseCompanion}
                </h4>
                <div className="flex justify-center gap-2">
                  {COMPANION_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      className={cn(
                        "p-3 rounded-xl text-3xl transition-all",
                        companion.type === type
                          ? "bg-primary/20 ring-2 ring-primary scale-110"
                          : "bg-muted hover:bg-muted/80 hover:scale-105"
                      )}
                    >
                      {COMPANION_EMOJIS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* How to level up hint */}
              <div className="text-center text-xs text-muted-foreground">
                <p>💡 {t.levelUpHint}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
